// Automated weekly reshuffle for Roulette leagues.
//
// Registered as a daily Vercel cron in vercel.json. The endpoint is a no-op
// outside the 48 hour pre-kickoff window, so a daily trigger is correct and
// fits inside Vercel Hobby's once-per-day cron limit. It is safe to hit
// repeatedly: reshuffleHistory is checked for the target week before any write.
//
// Every decision comes from src/lib/reshuffleCore, the same pure module the
// commissioner button uses. This file does IO only.
//
// This is the one .ts file in api/. It has to be: Vercel's Node builder does
// not resolve a relative .ts import from a .js entrypoint (the function fails
// at module load with FUNCTION_INVOCATION_FAILED), but it does compile and
// bundle a .ts entrypoint along with its imports. Route path is unchanged.
//
// Auth: Authorization: Bearer $CRON_SECRET. Vercel sends this header
// automatically for cron invocations when CRON_SECRET is set on the project.
//
// Manual dry run (writes nothing, runs every check):
//   curl -sS "https://www.19pool.com/api/cron-reshuffle?dryRun=1" \
//     -H "Authorization: Bearer $CRON_SECRET"

import admin from 'firebase-admin';
import {
    evaluatePreflight,
    isInReshuffleWindow,
    planDistribution,
} from '../src/lib/reshuffleCore';
import type { ReshuffleMember } from '../src/lib/reshuffleCore';
import { fetchEspnWeek, getCurrentNFLWeek, getEffectiveSeason } from '../src/lib/espn';
import type { GameResult } from '../src/lib/types';

const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

// Minimal structural types for the Vercel Node request and response. Avoids a
// dependency on @vercel/node just for two shapes.
type CronRequest = {
    headers: Record<string, string | string[] | undefined>;
    query?: Record<string, string | string[] | undefined>;
};
type CronResponse = {
    status: (code: number) => { json: (body: unknown) => void };
};

type Firestore = admin.firestore.Firestore;
type LeagueDoc = admin.firestore.QueryDocumentSnapshot;
type DocRef = admin.firestore.DocumentReference;

type Schedule = {
    week: number;
    currentWeekGames: GameResult[];
    nextWeekGames: GameResult[];
};

type LeagueResult =
    | {
          action: 'reshuffled';
          week: number;
          membersReassigned: number;
          unowned: number;
          dryRun: boolean;
      }
    | { action: 'skipped'; reason: string; details?: string[] };

type LockResult = { ok: true; alreadyLocked: boolean } | { ok: false; reason: string };

type Summary = {
    examined: number;
    reshuffled: Array<Record<string, unknown>>;
    skipped: Array<{ code: string; reason: string }>;
    errors: Array<{ code: string; message: string }>;
    dryRun: boolean;
};

function initAdmin(): Firestore {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON as string);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    return admin.firestore();
}

// ─── Per league ──────────────────────────────────────────────────────────────

/**
 * Returns { action: 'reshuffled' | 'skipped' , ... } or throws. The caller
 * catches per league so one bad league cannot abort the run.
 */
async function processLeague(
    db: Firestore,
    leagueDoc: LeagueDoc,
    schedule: Schedule,
    dryRun: boolean
): Promise<LeagueResult> {
    const code = leagueDoc.id;
    const league = leagueDoc.data();
    const { week, currentWeekGames, nextWeekGames } = schedule;

    // 1. Only act inside the window before next week's first kickoff.
    const window = isInReshuffleWindow(nextWeekGames, new Date());
    if (!window.inWindow) {
        return {
            action: 'skipped',
            reason: window.earliestKickoff === null
                ? 'no upcoming kickoff found for the next week'
                : `outside the 48 hour window, next kickoff ${new Date(window.earliestKickoff).toISOString()}`,
        };
    }

    // 2. Idempotency. The cron runs repeatedly inside the window, so this is
    // what guarantees exactly one reshuffle per week. Checked before preflight
    // so a completed week stays cheap.
    const history: Array<{ week?: number }> = Array.isArray(league.reshuffleHistory)
        ? league.reshuffleHistory
        : [];
    if (history.some((r) => r && r.week === week)) {
        return { action: 'skipped', reason: `already reshuffled for week ${week}` };
    }

    // 3. Preflight. Never forced.
    const preflight = evaluatePreflight(currentWeekGames, nextWeekGames, week);
    if (!preflight.ok) {
        return {
            action: 'skipped',
            reason: `preflight blocked: ${preflight.reason}`,
            details: preflight.details,
        };
    }

    const leagueRef = db.collection('leagues').doc(code);
    const membersSnap = await leagueRef.collection('members').get();
    const members: ReshuffleMember[] = membersSnap.docs.map((d) => ({
        id: d.id,
        joinedAt: d.data().joinedAt ?? null,
    }));

    if (dryRun) {
        const plan = planDistribution(members);
        return {
            action: 'reshuffled',
            week,
            membersReassigned: plan.joinedIds.length,
            unowned: plan.unowned.length,
            dryRun: true,
        };
    }

    // 4a. Freeze the outgoing rosters onto the current week, then hard-abort
    // unless it comes back locked. Without that lock a later refresh could
    // recompute this week's winners against the incoming rosters.
    const locked = await lockOutgoingWeek(leagueRef, week);
    if (!locked.ok) {
        throw new Error(`week ${week} did not lock its ownership snapshot: ${locked.reason}`);
    }

    // 4b. One batch: member teams, league pool, history entry.
    const plan = planDistribution(members);
    const batch = db.batch();
    for (const id of plan.joinedIds) {
        batch.update(leagueRef.collection('members').doc(id), {
            teams: plan.assignments[id] ?? [],
        });
    }
    for (const id of plan.pendingIds) {
        batch.update(leagueRef.collection('members').doc(id), { teams: [] });
    }
    batch.update(leagueRef, {
        unownedTeams: plan.unowned,
        teamsAssignedAt: admin.firestore.Timestamp.now(),
        reshuffleHistory: admin.firestore.FieldValue.arrayUnion({
            week,
            at: admin.firestore.Timestamp.now(),
            byUserId: 'cron',
        }),
    });
    await batch.commit();

    return {
        action: 'reshuffled',
        week,
        membersReassigned: plan.joinedIds.length,
        unowned: plan.unowned.length,
        dryRun: false,
    };
}

/**
 * Admin-SDK equivalent of the client's refreshWeek ownership step. The client
 * path recomputes scores from ESPN; here the week is already known to be all
 * final (preflight passed), so this writes the snapshot and lock onto the
 * existing doc without touching the score fields.
 *
 * Returns { ok: false } rather than writing anything if the week's doc is
 * missing, since that means the week was never scored and reshuffling would
 * strand it.
 */
async function lockOutgoingWeek(leagueRef: DocRef, week: number): Promise<LockResult> {
    const weekRef = leagueRef.collection('weeklyResults').doc(String(week).padStart(2, '0'));
    const snap = await weekRef.get();

    if (!snap.exists) {
        return { ok: false, reason: 'no weeklyResults doc for the week, refresh scores first' };
    }

    const wr = snap.data() ?? {};
    if (wr.ownershipLockedAt) return { ok: true, alreadyLocked: true };


    // Build the snapshot from the outgoing rosters, exactly as
    // buildOwnershipFromMembers does on the client: members holding no teams
    // are omitted.
    const memberDocs = await leagueRef.collection('members').get();
    const ownership: Record<string, string[]> = {};
    for (const d of memberDocs.docs) {
        const teams = d.data().teams;
        if (Array.isArray(teams) && teams.length > 0) ownership[d.id] = [...teams];
    }

    if (Object.keys(ownership).length === 0) {
        return { ok: false, reason: 'no member owns any team, nothing to snapshot' };
    }

    await weekRef.update({
        ownership,
        ownershipLockedAt: admin.firestore.Timestamp.now(),
    });
    return { ok: true, alreadyLocked: false };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: CronRequest, res: CronResponse) {
    // Auth first. An unset or empty CRON_SECRET must fail closed: comparing
    // against undefined would otherwise let "Bearer undefined" through.
    const secret = process.env.CRON_SECRET;
    if (!secret || secret.length === 0) {
        return res.status(401).json({ error: 'CRON_SECRET is not configured' });
    }
    if (req.headers.authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({ error: 'Server not configured' });
    }

    const dryRun = (req.query?.dryRun ?? '').toString() === '1';


    let db: Firestore;
    try {
        db = initAdmin();
    } catch (err) {
        return res.status(500).json({ error: `Init failed: ${(err as Error).message}` });
    }

    const summary: Summary = {
        examined: 0,
        reshuffled: [],
        skipped: [],
        errors: [],
        dryRun,
    };

    try {
        const leaguesSnap = await db
            .collection('leagues')
            .where('mode', '==', 'roulette')
            .where('status', '==', 'in_season')
            .get();

        summary.examined = leaguesSnap.size;
        if (leaguesSnap.empty) return res.status(200).json(summary);

        // ESPN is fetched ONCE per run and reused across every league. All
        // in-season leagues share the same real NFL schedule, so a per league
        // fetch would be identical data at N times the cost.
        const seasons = new Set<number>(
            leaguesSnap.docs.map((d) => d.data().season as number)
        );
        if (seasons.size > 1) {
            summary.errors.push({
                code: '*',
                message: `leagues span multiple seasons (${[...seasons].join(', ')}), skipping run`,
            });
            return res.status(200).json(summary);
        }

        const declaredSeason = [...seasons][0];
        const week = getCurrentNFLWeek(declaredSeason);
        if (week === null) {
            summary.skipped.push({ code: '*', reason: 'no active NFL week right now' });
            return res.status(200).json(summary);
        }

        // Node's fetch cannot parse a relative URL, so the proxy is called on
        // this deployment's own origin.
        const proto = req.headers['x-forwarded-proto'] ?? 'https';
        const host = req.headers['x-forwarded-host'] ?? req.headers.host;
        const baseUrl = `${proto}://${host}`;

        const season = getEffectiveSeason(declaredSeason);
        const currentWeekGames = await fetchEspnWeek(season, week, baseUrl);
        const nextWeekGames =
            week < 18 ? await fetchEspnWeek(season, week + 1, baseUrl) : [];
        const schedule = { week, currentWeekGames, nextWeekGames };

        // Sequential on purpose. These are Firestore batch writes against a
        // small number of leagues, and serial execution keeps the log readable
        // and the write rate gentle.
        for (const leagueDoc of leaguesSnap.docs) {
            try {
                const result = await processLeague(db, leagueDoc, schedule, dryRun);
                if (result.action === 'reshuffled') {
                    summary.reshuffled.push({ code: leagueDoc.id, ...result });
                } else {
                    summary.skipped.push({ code: leagueDoc.id, reason: result.reason });
                }
            } catch (err) {
                console.error(`cron-reshuffle: league ${leagueDoc.id} failed`, err);
                summary.errors.push({
                    code: leagueDoc.id,
                    message: (err as Error).message,
                });
            }
        }

        return res.status(200).json(summary);
    } catch (err) {
        console.error('cron-reshuffle error:', err);
        return res.status(500).json({ error: (err as Error).message, ...summary });
    }
}
