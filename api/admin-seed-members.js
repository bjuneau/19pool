// Adds a batch of fake accepted/active test members to a specific league.
// Protected by the same x-admin-secret header as /api/admin-wipe.
//
// Invoke:
//   curl -X POST https://19pool.vercel.app/api/admin-seed-members \
//     -H "x-admin-secret: <ADMIN_WIPE_SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"leagueCode":"BOLT-7MSE8"}'

import admin from 'firebase-admin';
import { randomBytes } from 'crypto';

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

function generateInviteToken() {
    // 32 hex chars — mirrors the client-side crypto.randomUUID().replace(/-/g, '')
    return randomBytes(16).toString('hex');
}

const TEST_MEMBERS = [
    { firstName: 'Marcus', lastName: 'Rivera',   email: 'marcus.rivera.test@mailinator.com' },
    { firstName: 'Olivia', lastName: 'Chen',     email: 'olivia.chen.test@mailinator.com' },
    { firstName: 'Derek',  lastName: 'Thompson', email: 'derek.thompson.test@mailinator.com' },
    { firstName: 'Priya',  lastName: 'Patel',    email: 'priya.patel.test@mailinator.com' },
    { firstName: 'Jason',  lastName: 'Williams', email: 'jason.williams.test@mailinator.com' },
    { firstName: 'Aisha',  lastName: 'Johnson',  email: 'aisha.johnson.test@mailinator.com' },
    { firstName: 'Tyler',  lastName: 'Brooks',   email: 'tyler.brooks.test@mailinator.com' },
    { firstName: 'Keisha', lastName: 'Davis',    email: 'keisha.davis.test@mailinator.com' },
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ADMIN_WIPE_SECRET) {
        return res.status(500).json({ error: 'ADMIN_WIPE_SECRET env var is not configured.' });
    }
    if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
        return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON env var is not configured.' });
    }

    const provided = req.headers['x-admin-secret'];
    if (!provided || provided !== ADMIN_WIPE_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { leagueCode } = req.body || {};
    if (!leagueCode) {
        return res.status(400).json({ error: 'leagueCode is required in request body.' });
    }

    const code = leagueCode.trim().toUpperCase();

    let db;
    try {
        db = initAdmin();
    } catch (err) {
        return res.status(500).json({ error: `Failed to initialize Firebase Admin: ${err.message}` });
    }

    try {
        const leagueRef = db.collection('leagues').doc(code);
        const leagueSnap = await leagueRef.get();
        if (!leagueSnap.exists) {
            return res.status(404).json({ error: `League ${code} not found.` });
        }

        const now = admin.firestore.Timestamp.now();
        const batch = db.batch();

        for (let i = 0; i < TEST_MEMBERS.length; i++) {
            const m = TEST_MEMBERS[i];
            const fakeUid = `test-uid-${code.toLowerCase()}-${i + 1}`;
            const memberRef = db.collection('leagues').doc(code).collection('members').doc();
            batch.set(memberRef, {
                uid: fakeUid,
                email: m.email.toLowerCase(),
                firstName: m.firstName,
                lastName: m.lastName,
                name: `${m.firstName} ${m.lastName}`,
                phone: '',
                teams: [],
                wins: 0,
                closest: 0,
                role: 'member',
                invitedAt: now,
                joinedAt: now,
                inviteToken: generateInviteToken(),
                lastInviteSentAt: null,
            });
        }

        // Bump memberCount by the number of members we're adding.
        batch.update(leagueRef, {
            memberCount: admin.firestore.FieldValue.increment(TEST_MEMBERS.length),
        });

        await batch.commit();

        return res.status(200).json({
            ok: true,
            leagueCode: code,
            membersAdded: TEST_MEMBERS.length,
        });
    } catch (err) {
        console.error('admin-seed-members error:', err);
        return res.status(500).json({ error: err.message || 'Seed failed' });
    }
}
