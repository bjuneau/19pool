// Deletes the caller's Firestore docs AND their Firebase Auth account.
//
// Auth: a Firebase Auth ID token in the JSON body — proof the caller is who
// they say. No admin secret here; this endpoint is for end users.
//
// Refuses if the user is currently the commissioner of any league. Those
// leagues have to be deleted (or transferred — TODO) first to avoid
// orphaned data.
//
// Invoke (from the browser, after reauthenticateWithCredential):
//   const idToken = await user.getIdToken(true);
//   await fetch('/api/delete-account', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ idToken }),
//   });

import admin from 'firebase-admin';

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
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({
            error: 'FIREBASE_SERVICE_ACCOUNT_JSON env var is not configured.',
        });
    }

    const { idToken } = req.body ?? {};
    if (!idToken || typeof idToken !== 'string') {
        return res.status(400).json({ error: 'Missing idToken in body.' });
    }

    let db, auth, uid;
    try {
        ({ db, auth } = initAdmin());
    } catch (err) {
        return res.status(500).json({
            error: `Failed to initialize Firebase Admin: ${err.message}`,
        });
    }

    try {
        // verifyIdToken with checkRevoked=true forces a real round-trip and
        // rejects tokens issued before a recent password change.
        const decoded = await auth.verifyIdToken(idToken, true);
        uid = decoded.uid;
    } catch (err) {
        return res
            .status(401)
            .json({ error: `Invalid or expired token: ${err.message}` });
    }

    try {
        // ── 1. Refuse if the user is a commissioner of any league. ────────
        // Querying by commissionerId requires no index for a single equality
        // filter — Firestore auto-indexes it.
        const commish = await db
            .collection('leagues')
            .where('commissionerId', '==', uid)
            .limit(1)
            .get();
        if (!commish.empty) {
            const league = commish.docs[0].data();
            return res.status(409).json({
                error: 'commissioner',
                leagueName: league.name || '',
                leagueCode: commish.docs[0].id,
            });
        }

        // ── 2. If the user is a member of a league, clean up their membership.
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        const leagueCode = userSnap.exists ? userSnap.data().leagueCode : '';

        if (leagueCode) {
            const leagueRef = db.collection('leagues').doc(leagueCode);
            const leagueSnap = await leagueRef.get();

            if (leagueSnap.exists) {
                // Find the member doc by uid. Email would also work but uid
                // is the canonical join key after a member has joined.
                const memberQuery = await leagueRef
                    .collection('members')
                    .where('uid', '==', uid)
                    .limit(1)
                    .get();
                if (!memberQuery.empty) {
                    await memberQuery.docs[0].ref.delete();
                    // Bump memberCount down by 1. Admin SDK bypasses rules
                    // so we don't need the recruiting-only branch here.
                    await leagueRef.update({
                        memberCount: admin.firestore.FieldValue.increment(-1),
                    });
                }
            }
        }

        // ── 3. Delete purchases subcollection if present.
        let purchasesDeleted = 0;
        const purchases = await userRef.collection('purchases').listDocuments();
        if (purchases.length > 0) {
            await Promise.all(purchases.map((p) => p.delete()));
            purchasesDeleted = purchases.length;
        }

        // ── 4. Delete the user doc itself.
        if (userSnap.exists) {
            await userRef.delete();
        }

        // ── 5. Delete the Firebase Auth account.
        await auth.deleteUser(uid);

        return res.status(200).json({
            ok: true,
            uid,
            purchasesDeleted,
            leagueCodeCleared: leagueCode || null,
        });
    } catch (err) {
        console.error('delete-account error:', err);
        return res.status(500).json({
            error: err.message || 'Delete failed',
        });
    }
}
