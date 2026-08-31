// Adds a batch of fake test members to a league. Protected by the same
// x-admin-secret header as /api/admin-wipe.
//
// Body:
//   leagueCode   required
//   count        how many members to add (default 8, max 40)
//   pending      how many of those get joinedAt: null, i.e. invited but not
//                joined (default 0). These exercise the reshuffle guard that
//                clears teams for members who never joined.
//   emailDomain  default 'example.com', which RFC 2606 reserves and which
//                never accepts mail, so a stray invite cannot bounce off a
//                real inbox. The old default was mailinator.com, a real
//                domain that does accept mail.
//
// Note: there is no `status` field on Member. Pending membership IS
// joinedAt === null, which is what teamAssignment and the reshuffle read.
//
// Invoke:
//   curl -X POST https://www.19pool.com/api/admin-seed-members \
//     -H "x-admin-secret: $ADMIN_WIPE_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"leagueCode":"XXXX-YYYYY","count":31,"pending":2}'

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

const FIRST_NAMES = [
    'Marcus', 'Olivia', 'Derek', 'Priya', 'Jason', 'Aisha', 'Tyler', 'Keisha',
    'Nathan', 'Sofia', 'Andre', 'Lena', 'Devin', 'Maya', 'Caleb', 'Rosa',
    'Ibrahim', 'Nora', 'Victor', 'Camille', 'Owen', 'Talia', 'Grant', 'Yuki',
    'Elias', 'Bianca', 'Rashad', 'Iris', 'Miles', 'Dahlia', 'Hugo', 'Simone',
    'Errol', 'Paloma', 'Kofi', 'Wren', 'Dmitri', 'Anaya', 'Soren', 'Juniper',
];

const LAST_NAMES = [
    'Rivera', 'Chen', 'Thompson', 'Patel', 'Williams', 'Johnson', 'Brooks',
    'Davis', 'Okafor', 'Lindqvist', 'Moreau', 'Castillo', 'Nakamura', 'Boyle',
    'Ferrari', 'Adeyemi', 'Volkov', 'Sandoval', 'Whitfield', 'Kaur',
    'Lombardi', 'Espinoza', 'Hargrove', 'Delacroix', 'Mbeki', 'Kowalski',
    'Rasmussen', 'Villanueva', 'Ahmadi', 'Sinclair', 'Duarte', 'Novak',
    'Ellison', 'Fontaine', 'Osei', 'Marchetti', 'Blackwood', 'Iyer',
    'Karlsson', 'Redmond',
];

const MAX_COUNT = 40;

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

    const { leagueCode, count, pending, emailDomain } = req.body || {};
    if (!leagueCode) {
        return res.status(400).json({ error: 'leagueCode is required in request body.' });
    }

    const code = leagueCode.trim().toUpperCase();
    const total = Number.isInteger(count) ? count : 8;
    const pendingCount = Number.isInteger(pending) ? pending : 0;
    const domain = (emailDomain || 'example.com').trim().toLowerCase();

    if (total < 1 || total > MAX_COUNT) {
        return res.status(400).json({ error: `count must be between 1 and ${MAX_COUNT}.` });
    }
    if (pendingCount < 0 || pendingCount > total) {
        return res.status(400).json({ error: 'pending must be between 0 and count.' });
    }

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
        const joined = [];
        const pendingMembers = [];

        for (let i = 0; i < total; i++) {
            // The last `pendingCount` members are the invited-but-not-joined
            // ones, so they are easy to identify in the response.
            const isPending = i >= total - pendingCount;
            const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
            const lastName = LAST_NAMES[i % LAST_NAMES.length];
            const email = `test${String(i + 1).padStart(2, '0')}@${domain}`;
            const memberRef = leagueRef.collection('members').doc();

            batch.set(memberRef, {
                // A pending member has not claimed their invite, so uid stays
                // null exactly as it would for a real unaccepted invite.
                uid: isPending ? null : `test-uid-${code.toLowerCase()}-${i + 1}`,
                email,
                firstName,
                lastName,
                name: `${firstName} ${lastName}`,
                phone: '',
                teams: [],
                wins: 0,
                closest: 0,
                role: 'member',
                invitedAt: now,
                joinedAt: isPending ? null : now,
                inviteToken: generateInviteToken(),
                lastInviteSentAt: null,
            });

            const row = { id: memberRef.id, name: `${firstName} ${lastName}`, email };
            if (isPending) pendingMembers.push(row);
            else joined.push(row);
        }

        // Bump memberCount by the number of members we're adding.
        batch.update(leagueRef, {
            memberCount: admin.firestore.FieldValue.increment(total),
        });

        await batch.commit();

        return res.status(200).json({
            ok: true,
            leagueCode: code,
            membersAdded: total,
            joinedCount: joined.length,
            pendingCount: pendingMembers.length,
            emailDomain: domain,
            pendingMembers,
            joined,
        });
    } catch (err) {
        console.error('admin-seed-members error:', err);
        return res.status(500).json({ error: err.message || 'Seed failed' });
    }
}
