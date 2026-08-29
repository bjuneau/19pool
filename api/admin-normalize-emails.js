// Lowercase every stored `email` field across the database so that
// case-insensitive email uniqueness holds going forward. This is the
// backfill for historical data — new writes are already lowercased by
// members.ts / SignUp.tsx.
//
// Scans:
//   users/{uid}.email
//   leagues/{code}/members/{id}.email
//
// After lowercasing, reports any (leagueCode, email) pair with more
// than one member doc so those can be dedupe'd manually. Firestore
// doesn't collapse rows by field value on its own.
//
// Defaults to dryRun. To actually write, pass {"dryRun":false}.
//
// Invoke (dry run):
//   curl -X POST https://www.19pool.com/api/admin-normalize-emails \
//     -H "x-admin-secret: <SECRET>"
//
// Invoke (write):
//   curl -X POST https://www.19pool.com/api/admin-normalize-emails \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"dryRun":false}'

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

function needsLowercase(email) {
    if (typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (!trimmed) return false;
    return trimmed !== trimmed.toLowerCase() || trimmed !== email;
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

    const { dryRun = true } = req.body ?? {};

    let db;
    try {
        db = initAdmin();
    } catch (err) {
        return res.status(500).json({ error: `Init failed: ${err.message}` });
    }

    const summary = {
        dryRun,
        usersScanned: 0,
        usersLowercased: [],
        membersScanned: 0,
        membersLowercased: [],
        duplicatesByLeagueAndEmail: [],
    };

    try {
        // 1. users/{uid}.email
        const usersSnap = await db.collection('users').get();
        for (const userDoc of usersSnap.docs) {
            summary.usersScanned++;
            const email = userDoc.data().email;
            if (needsLowercase(email)) {
                const lower = email.trim().toLowerCase();
                summary.usersLowercased.push({
                    id: userDoc.id,
                    from: email,
                    to: lower,
                });
                if (!dryRun) {
                    await userDoc.ref.update({ email: lower });
                }
            }
        }

        // 2. leagues/*/members/*.email + duplicate detection per league.
        const leaguesSnap = await db.collection('leagues').get();
        for (const leagueDoc of leaguesSnap.docs) {
            const membersSnap = await leagueDoc.ref.collection('members').get();
            const byEmail = new Map();
            for (const memberDoc of membersSnap.docs) {
                summary.membersScanned++;
                const email = memberDoc.data().email;
                let effective = email;
                if (needsLowercase(email)) {
                    const lower = email.trim().toLowerCase();
                    summary.membersLowercased.push({
                        leagueCode: leagueDoc.id,
                        id: memberDoc.id,
                        from: email,
                        to: lower,
                    });
                    if (!dryRun) {
                        await memberDoc.ref.update({ email: lower });
                    }
                    effective = lower;
                } else if (typeof email === 'string') {
                    effective = email.trim().toLowerCase();
                }
                if (effective) {
                    const list = byEmail.get(effective) ?? [];
                    list.push({
                        id: memberDoc.id,
                        uid: memberDoc.data().uid ?? null,
                        name: memberDoc.data().name ?? '',
                        firstName: memberDoc.data().firstName ?? '',
                        lastName: memberDoc.data().lastName ?? '',
                        joined: !!memberDoc.data().joinedAt,
                    });
                    byEmail.set(effective, list);
                }
            }
            for (const [email, list] of byEmail.entries()) {
                if (list.length > 1) {
                    summary.duplicatesByLeagueAndEmail.push({
                        leagueCode: leagueDoc.id,
                        email,
                        docs: list,
                    });
                }
            }
        }

        return res.status(200).json(summary);
    } catch (err) {
        console.error('admin-normalize-emails error:', err);
        return res.status(500).json({
            error: err.message,
            partialSummary: summary,
        });
    }
}
