// Renames every member in a league's members subcollection to fake names,
// so you can take marketing screenshots without exposing real people.
// Also syncs league.commissionerName if the commissioner is renamed.
//
// Auth / accounts are NOT touched. Only the member-doc display fields
// (firstName, lastName, name). Optional includeEmails updates email too.
//
// Invoke (dry run — see what would happen, no writes):
//   curl -X POST https://www.19pool.com/api/admin-rename-members \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"leagueCode":"BOLT-7MSE8","dryRun":true}'
//
// Invoke for real:
//   curl -X POST https://www.19pool.com/api/admin-rename-members \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"leagueCode":"BOLT-7MSE8"}'
//
// Include email swaps as well (first.last@example.com):
//   -d '{"leagueCode":"BOLT-7MSE8","includeEmails":true}'
//
// Provide your own name list:
//   -d '{"leagueCode":"BOLT-7MSE8","names":[{"firstName":"X","lastName":"Y"}]}'

import admin from 'firebase-admin';

const ADMIN_WIPE_SECRET = process.env.ADMIN_WIPE_SECRET;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

// 32 fake names — covers the max league size. Mix of first/last names so
// avatars come out with distinct initials.
const DEFAULT_NAMES = [
    { firstName: 'Bill', lastName: 'Smith' },
    { firstName: 'Dave', lastName: 'Johnson' },
    { firstName: 'Sally', lastName: 'Jones' },
    { firstName: 'Emma', lastName: 'Brown' },
    { firstName: 'James', lastName: 'Davis' },
    { firstName: 'Linda', lastName: 'Miller' },
    { firstName: 'Robert', lastName: 'Wilson' },
    { firstName: 'Patricia', lastName: 'Moore' },
    { firstName: 'Michael', lastName: 'Taylor' },
    { firstName: 'Jennifer', lastName: 'Anderson' },
    { firstName: 'John', lastName: 'Thomas' },
    { firstName: 'Susan', lastName: 'Jackson' },
    { firstName: 'David', lastName: 'White' },
    { firstName: 'Karen', lastName: 'Harris' },
    { firstName: 'Chris', lastName: 'Martin' },
    { firstName: 'Nancy', lastName: 'Thompson' },
    { firstName: 'Kevin', lastName: 'Garcia' },
    { firstName: 'Barbara', lastName: 'Martinez' },
    { firstName: 'Steven', lastName: 'Robinson' },
    { firstName: 'Betty', lastName: 'Clark' },
    { firstName: 'Paul', lastName: 'Rodriguez' },
    { firstName: 'Sandra', lastName: 'Lewis' },
    { firstName: 'Andrew', lastName: 'Lee' },
    { firstName: 'Ashley', lastName: 'Walker' },
    { firstName: 'Josh', lastName: 'Hall' },
    { firstName: 'Amanda', lastName: 'Allen' },
    { firstName: 'Ryan', lastName: 'Young' },
    { firstName: 'Melissa', lastName: 'King' },
    { firstName: 'Nicholas', lastName: 'Wright' },
    { firstName: 'Amy', lastName: 'Lopez' },
    { firstName: 'Eric', lastName: 'Hill' },
    { firstName: 'Rebecca', lastName: 'Scott' },
];

function initAdmin() {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    return admin.firestore();
}

function buildDisplayName(first, last, fallback) {
    const combined = `${first} ${last}`.trim();
    if (combined) return combined;
    if (fallback) return fallback;
    return 'Member';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
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

    const {
        leagueCode,
        dryRun = false,
        includeEmails = false,
        names,
    } = req.body ?? {};

    if (!leagueCode || typeof leagueCode !== 'string') {
        return res.status(400).json({ error: 'Missing leagueCode in body' });
    }
    const code = leagueCode.toUpperCase();
    const nameList =
        Array.isArray(names) && names.length > 0 ? names : DEFAULT_NAMES;

    let db;
    try {
        db = initAdmin();
    } catch (err) {
        return res.status(500).json({ error: `Init failed: ${err.message}` });
    }

    try {
        const leagueRef = db.collection('leagues').doc(code);
        const leagueSnap = await leagueRef.get();
        if (!leagueSnap.exists) {
            return res.status(404).json({ error: `League ${code} not found` });
        }

        // Order by invitedAt so the assignment is deterministic across runs.
        // (Deterministic = re-running with the same list produces the same
        // rename result, which is handy when iterating on screenshots.)
        const membersSnap = await leagueRef
            .collection('members')
            .orderBy('invitedAt', 'asc')
            .get();

        const report = [];
        const writes = [];
        let commissionerNewName = null;

        membersSnap.docs.forEach((doc, i) => {
            const data = doc.data() ?? {};
            const pick = nameList[i % nameList.length];
            const newName = buildDisplayName(
                pick.firstName,
                pick.lastName,
                pick.firstName.toLowerCase()
            );
            const newEmail = includeEmails
                ? `${pick.firstName.toLowerCase()}.${pick.lastName.toLowerCase()}@example.com`
                : data.email;

            const update = {
                firstName: pick.firstName,
                lastName: pick.lastName,
                name: newName,
            };
            if (includeEmails) update.email = newEmail;

            report.push({
                id: doc.id,
                role: data.role,
                from: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                },
                to: {
                    firstName: pick.firstName,
                    lastName: pick.lastName,
                    email: newEmail,
                },
            });

            if (data.role === 'commissioner') {
                commissionerNewName = newName;
            }

            writes.push({ ref: doc.ref, update });
        });

        if (dryRun) {
            return res.status(200).json({
                dryRun: true,
                leagueCode: code,
                memberCount: membersSnap.size,
                includeEmails,
                report,
            });
        }

        // Batched writes — cap 500 ops per batch (32 members is well under).
        const batch = db.batch();
        for (const w of writes) {
            batch.update(w.ref, w.update);
        }
        await batch.commit();

        // Keep the denormalized commissionerName on the league doc in sync.
        if (commissionerNewName) {
            await leagueRef.update({ commissionerName: commissionerNewName });
        }

        return res.status(200).json({
            leagueCode: code,
            memberCount: membersSnap.size,
            commissionerRenamed: commissionerNewName,
            includeEmails,
            report,
        });
    } catch (err) {
        console.error('admin-rename-members error:', err);
        return res.status(500).json({ error: err.message });
    }
}
