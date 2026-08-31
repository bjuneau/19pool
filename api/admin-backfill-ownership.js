// One-off backfill: stamps an `ownership` snapshot and `ownershipLockedAt`
// onto every existing weeklyResults doc in a league.
//
// WARNING: this uses the league's CURRENT member ownership. For weeks where
// teams were reassigned after the fact, the real historical ownership is
// unrecoverable, so the current map is the best available approximation.
// Weeks written after this feature shipped snapshot themselves correctly at
// refresh time and do not need backfilling.
//
// Docs that already carry a non-empty ownership map are skipped unless
// ?force=1 is passed, so re-running is safe.
//
// Protected by the same x-admin-secret gate as the other admin endpoints.
//
// Invoke:
//   curl -X POST "https://www.19pool.com/api/admin-backfill-ownership?leagueCode=BOLT-E833H" \
//     -H "x-admin-secret: $ADMIN_WIPE_SECRET"

import admin from 'firebase-admin';

const ADMIN_WIPE_SECRET = process.env.ADMIN_WIPE_SECRET;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const NOTE =
    'Backfill uses current ownership snapshot; historical reassignments cannot be recovered.';

function initAdmin() {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    return admin.firestore();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
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
    const force = (req.query?.force ?? '').toString() === '1';

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

        // Build the current ownership map: memberId -> teams. Members holding
        // no teams are omitted, matching buildOwnershipFromMembers on the
        // client side.
        const membersSnap = await leagueRef.collection('members').get();
        const ownership = {};
        for (const d of membersSnap.docs) {
            const teams = d.data().teams;
            if (Array.isArray(teams) && teams.length > 0) {
                ownership[d.id] = [...teams];
            }
        }

        const teamsInSnapshot = Object.values(ownership).reduce(
            (n, teams) => n + teams.length,
            0
        );

        const weeksSnap = await leagueRef.collection('weeklyResults').get();

        const batch = db.batch();
        const backfilled = [];
        const skipped = [];

        for (const d of weeksSnap.docs) {
            const wr = d.data() ?? {};
            const existing = wr.ownership ?? {};
            if (!force && Object.keys(existing).length > 0) {
                skipped.push({ week: wr.week ?? d.id, reason: 'already has ownership' });
                continue;
            }

            // A settled week is history, so lock its snapshot at the moment it
            // settled. An unsettled week stays unlocked and will be refreshed
            // normally on the next scoring pass.
            const lockedAt = wr.settledAt ?? null;

            batch.update(d.ref, {
                ownership,
                ownershipLockedAt: lockedAt,
            });
            backfilled.push({
                week: wr.week ?? d.id,
                status: wr.status ?? null,
                ownershipLockedAt: lockedAt?.toDate?.().toISOString() ?? null,
            });
        }

        if (backfilled.length > 0) await batch.commit();

        return res.status(200).json({
            league: leagueCode,
            weeksBackfilled: backfilled.length,
            membersInSnapshot: Object.keys(ownership).length,
            teamsInSnapshot,
            weeksSkipped: skipped.length,
            backfilled,
            skipped,
            force,
            note: NOTE,
        });
    } catch (err) {
        console.error('admin-backfill-ownership error:', err);
        return res.status(500).json({ error: err.message });
    }
}
