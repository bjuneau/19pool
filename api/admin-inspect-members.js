// Read-only: dumps every member doc in a league. Same x-admin-secret
// gate as the other admin endpoints. Used to diagnose duplicates,
// missing names, or case-drifted emails.
//
// Invoke:
//   curl -sS "https://www.19pool.com/api/admin-inspect-members?leagueCode=RUSH-QJNBJ" \
//     -H "x-admin-secret: <SECRET>"

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
                joinedAt: data.joinedAt?.toDate?.().toISOString() ?? null,
                invitedAt: data.invitedAt?.toDate?.().toISOString() ?? null,
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

        return res.status(200).json({
            leagueCode,
            leagueName: leagueSnap.data().name ?? null,
            memberCount: members.length,
            members,
            duplicatesByEmail: duplicates,
        });
    } catch (err) {
        console.error('admin-inspect-members error:', err);
        return res.status(500).json({ error: err.message });
    }
}
