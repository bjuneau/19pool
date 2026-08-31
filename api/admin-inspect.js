// Read-only diagnostics for one league. Two endpoints were merged into this
// one to stay under Vercel Hobby's 12-function cap when
// admin-backfill-ownership.js was added:
//
//   ?action=members         (default) former /api/admin-inspect-members
//   ?action=weekly-results            former /api/admin-list-weekly-results
//
// No writes. Same x-admin-secret gate as the other admin endpoints.
//
// Invoke:
//   curl -sS "https://www.19pool.com/api/admin-inspect?leagueCode=BOLT-E833H&action=members" \
//     -H "x-admin-secret: $ADMIN_WIPE_SECRET"
//   curl -sS "https://www.19pool.com/api/admin-inspect?leagueCode=BOLT-E833H&action=weekly-results" \
//     -H "x-admin-secret: $ADMIN_WIPE_SECRET"

import admin from 'firebase-admin';

const ADMIN_WIPE_SECRET = process.env.ADMIN_WIPE_SECRET;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

function initAdmin() {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    return admin.firestore();
}

const iso = (ts) => ts?.toDate?.().toISOString() ?? null;

// ─── action=members ──────────────────────────────────────────────────────────

async function inspectMembers(leagueRef, leagueSnap, leagueCode) {
    const membersSnap = await leagueRef.collection('members').get();
    const members = membersSnap.docs.map((d) => {
        const data = d.data();
        return {
            id: d.id,
            uid: data.uid ?? null,
            email: data.email ?? '',
            emailLower: (data.email ?? '').trim().toLowerCase(),
            emailIsLower: data.email === (data.email ?? '').trim().toLowerCase(),
            name: data.name ?? '',
            firstName: data.firstName ?? '',
            lastName: data.lastName ?? '',
            role: data.role ?? '',
            joined: !!data.joinedAt,
            joinedAt: iso(data.joinedAt),
            invitedAt: iso(data.invitedAt),
            teams: data.teams ?? [],
        };
    });

    // Group by lowercased email to surface duplicates at a glance.
    const byEmail = {};
    for (const m of members) {
        if (!m.emailLower) continue;
        (byEmail[m.emailLower] ??= []).push(m.id);
    }
    const duplicates = Object.entries(byEmail)
        .filter(([, ids]) => ids.length > 1)
        .map(([email, ids]) => ({ email, ids }));

    return {
        action: 'members',
        leagueCode,
        leagueName: leagueSnap.data().name ?? null,
        leagueMode: leagueSnap.data().mode ?? 'classic',
        memberCount: members.length,
        members,
        duplicatesByEmail: duplicates,
    };
}

// ─── action=weekly-results ───────────────────────────────────────────────────

async function inspectWeeklyResults(leagueRef, leagueCode) {
    const snap = await leagueRef.collection('weeklyResults').get();

    const rows = snap.docs
        .map((d) => {
            const wr = d.data() ?? {};
            const ownership = wr.ownership ?? {};
            return {
                docId: d.id,
                week: wr.week,
                season: wr.season,
                status: wr.status,
                gamesCount: Array.isArray(wr.games) ? wr.games.length : 0,
                teamsAt19: wr.teamsAt19 ?? [],
                teamsAt19Count: (wr.teamsAt19 ?? []).length,
                winningMemberIds: wr.winningMemberIds ?? [],
                weeklyShare: wr.weeklyShare,
                rolloverFrom: wr.rolloverFrom,
                payoutPerWinner: wr.payoutPerWinner,
                fetchedAt: iso(wr.fetchedAt),
                settledAt: iso(wr.settledAt),
                // Ownership snapshot diagnostics.
                ownershipMemberCount: Object.keys(ownership).length,
                ownershipTeamCount: Object.values(ownership).reduce(
                    (n, teams) => n + (Array.isArray(teams) ? teams.length : 0),
                    0
                ),
                ownershipLockedAt: iso(wr.ownershipLockedAt),
                hasOwnership: Object.keys(ownership).length > 0,
            };
        })
        .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));

    const totalHits19 = rows.reduce((n, r) => n + r.teamsAt19Count, 0);

    return {
        action: 'weekly-results',
        leagueCode,
        docCount: rows.length,
        totalHits19,
        weeksMissingOwnership: rows.filter((r) => !r.hasOwnership).map((r) => r.week),
        rows,
    };
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!ADMIN_WIPE_SECRET || !FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({ error: 'Server not configured' });
    }
    if (req.headers['x-admin-secret'] !== ADMIN_WIPE_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const rawCode = (req.query?.leagueCode ?? '').toString().trim();
    if (!rawCode) {
        return res.status(400).json({ error: 'leagueCode required' });
    }
    const leagueCode = rawCode.toUpperCase();

    const action = (req.query?.action ?? 'members').toString().trim();
    if (action !== 'members' && action !== 'weekly-results') {
        return res
            .status(400)
            .json({ error: "action must be 'members' or 'weekly-results'" });
    }

    let db;
    try {
        db = initAdmin();
    } catch (err) {
        return res.status(500).json({ error: `Init failed: ${err.message}` });
    }

    try {
        const leagueRef = db.collection('leagues').doc(leagueCode);
        const leagueSnap = await leagueRef.get();
        if (!leagueSnap.exists) {
            return res.status(404).json({ error: `League ${leagueCode} not found` });
        }

        const payload =
            action === 'members'
                ? await inspectMembers(leagueRef, leagueSnap, leagueCode)
                : await inspectWeeklyResults(leagueRef, leagueCode);

        return res.status(200).json(payload);
    } catch (err) {
        console.error('admin-inspect error:', err);
        return res.status(500).json({ error: err.message });
    }
}
