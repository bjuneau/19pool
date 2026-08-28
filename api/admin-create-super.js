// Provisions the single super-user (bjuneau+super@gmail.com) in Firebase
// Auth with the custom claim { super: true }, and creates a minimal
// users/{uid} doc marker so the client has something to read. Idempotent
// — safe to re-run; existing user gets the claim re-applied.
//
// Protected by the same x-admin-secret header as /api/admin-wipe.
//
// Invoke:
//   curl -X POST https://www.19pool.com/api/admin-create-super \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"bjuneau+super@gmail.com","password":"L0v3land"}'

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

    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
    }

    let db, auth;
    try {
        ({ db, auth } = initAdmin());
    } catch (err) {
        return res.status(500).json({ error: `Init failed: ${err.message}` });
    }

    try {
        // 1. Find or create the Firebase Auth user.
        let user = await auth.getUserByEmail(email).catch(() => null);
        let created = false;
        if (!user) {
            user = await auth.createUser({
                email,
                password,
                emailVerified: true,
                displayName: 'Super Admin',
            });
            created = true;
        } else {
            // Ensure the password matches the requested one — useful if a
            // prior invocation used a different password.
            await auth.updateUser(user.uid, { password, emailVerified: true });
        }

        // 2. Apply the super custom claim. Merges with any existing claims.
        const existingClaims = user.customClaims ?? {};
        await auth.setCustomUserClaims(user.uid, {
            ...existingClaims,
            super: true,
        });

        // 3. Minimal users doc so the client has something to read. No
        // firstName/lastName — super doesn't appear in any league roster.
        await db.collection('users').doc(user.uid).set(
            {
                email,
                super: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return res.status(200).json({
            ok: true,
            uid: user.uid,
            email,
            created,
            claimApplied: true,
        });
    } catch (err) {
        console.error('admin-create-super error:', err);
        return res.status(500).json({ error: err.message });
    }
}
