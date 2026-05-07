// DESTRUCTIVE — wipes every league, every user doc, and every Firebase Auth
// account in the project. Protected by an x-admin-secret header. The config/
// collection (pricing) is intentionally skipped.
//
// Invoke:
//   curl -X POST https://19pool.vercel.app/api/admin-wipe \
//     -H "x-admin-secret: <ADMIN_WIPE_SECRET>"

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
    return { db: admin.firestore(), auth: admin.auth() };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ADMIN_WIPE_SECRET) {
        return res.status(500).json({
            error: 'ADMIN_WIPE_SECRET env var is not configured.',
        });
    }
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({
            error: 'FIREBASE_SERVICE_ACCOUNT_JSON env var is not configured.',
        });
    }

    const provided = req.headers['x-admin-secret'];
    if (!provided || provided !== ADMIN_WIPE_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    let db, auth;
    try {
        ({ db, auth } = initAdmin());
    } catch (err) {
        return res.status(500).json({
            error: `Failed to initialize Firebase Admin: ${err.message}`,
        });
    }

    const summary = {
        leaguesDeleted: 0,
        membersDeleted: 0,
        usersDeleted: 0,
        purchasesDeleted: 0,
        authUsersDeleted: 0,
    };

    try {
        // 1. Delete every league + its members subcollection.
        const leagues = await db.collection('leagues').listDocuments();
        for (const leagueDoc of leagues) {
            const members = await leagueDoc.collection('members').listDocuments();
            if (members.length > 0) {
                await Promise.all(members.map((m) => m.delete()));
                summary.membersDeleted += members.length;
            }
            await leagueDoc.delete();
            summary.leaguesDeleted += 1;
        }

        // 2. Delete every user + its purchases subcollection (if any).
        const users = await db.collection('users').listDocuments();
        for (const userDoc of users) {
            const purchases = await userDoc.collection('purchases').listDocuments();
            if (purchases.length > 0) {
                await Promise.all(purchases.map((p) => p.delete()));
                summary.purchasesDeleted += purchases.length;
            }
            await userDoc.delete();
            summary.usersDeleted += 1;
        }

        // 3. Delete every Firebase Auth account, paginated.
        let pageToken = undefined;
        do {
            const result = await auth.listUsers(1000, pageToken);
            const uids = result.users.map((u) => u.uid);
            if (uids.length > 0) {
                const deleteResult = await auth.deleteUsers(uids);
                summary.authUsersDeleted += deleteResult.successCount;
            }
            pageToken = result.pageToken;
        } while (pageToken);

        return res.status(200).json(summary);
    } catch (err) {
        console.error('admin-wipe error:', err);
        return res.status(500).json({
            error: err.message || 'Wipe failed',
            partialSummary: summary,
        });
    }
}
