// Sets firstName/lastName on a single user + syncs any member docs where
// their uid matches. Protected by the same x-admin-secret header as
// /api/admin-wipe. Handy one-off for backfilling a user who signed up
// before we required names.
//
// Invoke:
//   curl -X POST https://www.19pool.com/api/admin-set-user-name \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"bjuneau@gmail.com","firstName":"Brooks","lastName":"Juneau"}'

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
    if (!ADMIN_WIPE_SECRET || !FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({ error: 'Server not configured' });
    }
    if (req.headers['x-admin-secret'] !== ADMIN_WIPE_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email, firstName, lastName } = req.body ?? {};
    if (!email || !firstName || !lastName) {
        return res.status(400).json({ error: 'email, firstName, lastName required' });
    }
    const fullName = `${firstName} ${lastName}`.trim();

    let db, auth;
    try {
        ({ db, auth } = initAdmin());
    } catch (err) {
        return res.status(500).json({ error: `Init failed: ${err.message}` });
    }

    try {
        const authUser = await auth.getUserByEmail(email).catch(() => null);
        if (!authUser) {
            return res.status(404).json({ error: `No auth user for ${email}` });
        }

        await db.collection('users').doc(authUser.uid).set(
            { firstName, lastName, name: fullName, email },
            { merge: true }
        );

        const leagues = await db.collection('leagues').get();
        const touched = [];
        for (const leagueDoc of leagues.docs) {
            const memberSnap = await leagueDoc.ref
                .collection('members')
                .where('uid', '==', authUser.uid)
                .get();
            for (const m of memberSnap.docs) {
                await m.ref.set(
                    { firstName, lastName, name: fullName },
                    { merge: true }
                );
                touched.push(`leagues/${leagueDoc.id}/members/${m.id}`);
            }
        }

        return res.status(200).json({
            uid: authUser.uid,
            email,
            firstName,
            lastName,
            memberDocsUpdated: touched,
        });
    } catch (err) {
        console.error('admin-set-user-name error:', err);
        return res.status(500).json({ error: err.message });
    }
}
