// Read-only diagnostic: dumps a league's weeklyResults subcollection so we
// can inspect what's actually stored (teams-at-19 counts, per-week status,
// season, etc). No writes. Protected by x-admin-secret.
//
// Invoke:
//   curl -sS "https://www.19pool.com/api/admin-list-weekly-results?leagueCode=BOLT-7MSE8" \
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

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!ADMIN_WIPE_SECRET) {
        return res.status(500).json({ error: 'ADMIN_WIPE_SECRET not configured' });
    }
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' });
    }
    if (req.headers['x-admin-secret'] !== ADMIN_WIPE_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { leagueCode } = req.query;
    if (!leagueCode || typeof leagueCode !== 'string') {
        return res.status(400).json({ error: 'Missing leagueCode' });
    }
    const code = leagueCode.toUpperCase();

    try {
        const db = initAdmin();
        const snap = await db
            .collection('leagues')
            .doc(code)
            .collection('weeklyResults')
            .get();

        const rows = snap.docs
            .map((d) => {
                const wr = d.data() ?? {};
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
                    fetchedAt: wr.fetchedAt?.toDate
                        ? wr.fetchedAt.toDate().toISOString()
                        : null,
                };
            })
            .sort((a, b) => (a.week ?? 0) - (b.week ?? 0));

        const totalHits19 = rows.reduce((n, r) => n + r.teamsAt19Count, 0);

        return res.status(200).json({
            leagueCode: code,
            docCount: rows.length,
            totalHits19,
            rows,
        });
    } catch (err) {
        console.error('admin-list-weekly-results error:', err);
        return res.status(500).json({ error: err.message });
    }
}
