// Scans a league's members subcollection for duplicate member docs sharing
// the same non-null uid and deletes the extras. Adjusts memberCount to match.
// Pending invites (uid === null) are legitimately allowed to share an email,
// so they're ignored.
//
// Which doc is kept, per uid group:
//   1. role === 'commissioner' wins outright
//   2. otherwise, the earliest joinedAt wins (settled members)
//   3. otherwise, the earliest invitedAt wins (fallback)
//
// If any dropped doc has team assignments (teams.length > 0), the endpoint
// merges them into the kept doc to avoid orphaning teams.
//
// Invoke (dry run — see what would happen):
//   curl -X POST https://19pool.vercel.app/api/admin-cleanup-duplicates \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"leagueCode":"BOLT-7MSE8","dryRun":true}'
//
// Invoke for real:
//   curl -X POST https://19pool.vercel.app/api/admin-cleanup-duplicates \
//     -H "x-admin-secret: <SECRET>" \
//     -H "Content-Type: application/json" \
//     -d '{"leagueCode":"BOLT-7MSE8"}'

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

function millis(ts) {
    if (!ts) return Infinity;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts.seconds != null) return ts.seconds * 1000;
    return Infinity;
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

    const { leagueCode, dryRun = false } = req.body ?? {};
    if (!leagueCode || typeof leagueCode !== 'string') {
        return res.status(400).json({ error: 'Missing leagueCode in body' });
    }
    const code = leagueCode.toUpperCase();

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

        const membersSnap = await leagueRef.collection('members').get();

        // Group by uid. Skip null/empty uids — pending invites are allowed
        // to duplicate an email until claimed.
        const byUid = new Map();
        for (const d of membersSnap.docs) {
            const data = d.data();
            if (!data.uid) continue;
            const arr = byUid.get(data.uid) ?? [];
            arr.push({ id: d.id, ref: d.ref, data });
            byUid.set(data.uid, arr);
        }

        const report = [];
        const toDelete = [];
        const teamMerges = []; // { keepId, mergedTeams }

        for (const [uid, docs] of byUid.entries()) {
            if (docs.length <= 1) continue;
            // Sort by keep-priority.
            docs.sort((a, b) => {
                const aCom = a.data.role === 'commissioner' ? 0 : 1;
                const bCom = b.data.role === 'commissioner' ? 0 : 1;
                if (aCom !== bCom) return aCom - bCom;
                const jd = millis(a.data.joinedAt) - millis(b.data.joinedAt);
                if (jd !== 0) return jd;
                return millis(a.data.invitedAt) - millis(b.data.invitedAt);
            });
            const keep = docs[0];
            const drop = docs.slice(1);

            // Merge team assignments upward so we don't orphan teams.
            const droppedTeams = drop.flatMap((d) => d.data.teams ?? []);
            const keptTeams = Array.from(
                new Set([...(keep.data.teams ?? []), ...droppedTeams])
            );

            report.push({
                uid,
                email: keep.data.email,
                keptId: keep.id,
                keptRole: keep.data.role,
                droppedIds: drop.map((d) => d.id),
                droppedTeams,
                mergedTeamsInto: droppedTeams.length > 0 ? keep.id : null,
            });

            toDelete.push(...drop.map((d) => d.ref));
            if (droppedTeams.length > 0) {
                teamMerges.push({ keepRef: keep.ref, keptTeams });
            }
        }

        if (dryRun) {
            return res.status(200).json({
                dryRun: true,
                leagueCode: code,
                totalMembers: membersSnap.size,
                duplicateGroups: report.length,
                docsToDelete: toDelete.length,
                report,
            });
        }

        // Merge teams into the kept doc first, so a delete failure doesn't
        // leave the teams array missing an entry that used to be assigned.
        for (const { keepRef, keptTeams } of teamMerges) {
            await keepRef.update({ teams: keptTeams });
        }

        for (const ref of toDelete) {
            await ref.delete();
        }

        if (toDelete.length > 0) {
            await leagueRef.update({
                memberCount: admin.firestore.FieldValue.increment(-toDelete.length),
            });
        }

        return res.status(200).json({
            leagueCode: code,
            totalMembers: membersSnap.size,
            deletedCount: toDelete.length,
            duplicateGroups: report.length,
            report,
        });
    } catch (err) {
        console.error('admin-cleanup-duplicates error:', err);
        return res.status(500).json({ error: err.message });
    }
}
