// Deploys the inline RULES constant below to Firestore via the Firebase Admin
// SDK using the service account in FIREBASE_SERVICE_ACCOUNT_JSON. Protected
// by the same x-admin-secret header as /api/admin-wipe.
//
// Invoke:
//   curl -X POST https://19pool.vercel.app/api/admin-deploy-rules \
//     -H "x-admin-secret: <ADMIN_WIPE_SECRET>"
//
// To change rules: edit RULES below, push to main, wait for Vercel deploy,
// then re-run the curl.

import admin from 'firebase-admin';

const ADMIN_WIPE_SECRET = process.env.ADMIN_WIPE_SECRET;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    // Super-user bypass. bjuneau+super@gmail.com is provisioned with a
    // custom claim { super: true } (set server-side via admin SDK, never
    // client-settable). Every commissioner-only rule below allows a
    // super-user through as if they commissionered the league.
    function isSuper() {
      return signedIn() && request.auth.token.super == true;
    }

    function leagueData(code) {
      return get(/databases/$(database)/documents/leagues/$(code)).data;
    }

    function isCommissionerOf(code) {
      return isSuper() || (signedIn() && leagueData(code).commissionerId == request.auth.uid);
    }

    function leagueStatus(code) {
      return leagueData(code).status;
    }

    match /users/{uid} {
      allow read: if signedIn() && (request.auth.uid == uid || isSuper());
      allow create: if signedIn() && request.auth.uid == uid;
      allow update: if (signedIn() && request.auth.uid == uid)
                    // Commissioner clearing the leagueCode of a member of
                    // their league (member-removal flow). Tightly scoped:
                    // only the leagueCode field, only set to '', and only
                    // when the requester commissioners the old value.
                    || (
                      signedIn()
                      && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['leagueCode'])
                      && request.resource.data.leagueCode == ''
                      && resource.data.leagueCode != ''
                      && get(/databases/$(database)/documents/leagues/$(resource.data.leagueCode)).data.commissionerId == request.auth.uid
                    )
                    || isSuper();
      allow delete: if false;
    }

    match /leagues/{code} {
      allow read: if true;
      allow create: if signedIn()
                    && request.resource.data.commissionerId == request.auth.uid;
      allow update: if signedIn() && (
        isSuper()
        // Commissioner can change anything.
        || resource.data.commissionerId == request.auth.uid
        // Any signed-in user can bump memberCount by 1 (join — recruiting status).
        || (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount'])
          && request.resource.data.memberCount == resource.data.memberCount + 1
        )
        // Any signed-in user can bump memberCount AND reset skipReassignmentCheck
        // atomically (join — assigned status).
        || (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount', 'skipReassignmentCheck'])
          && request.resource.data.memberCount == resource.data.memberCount + 1
          && request.resource.data.skipReassignmentCheck == false
        )
        // Any signed-in user can decrement memberCount by 1 during recruiting
        // (self-leave). Member-doc deletion is separately gated by the
        // self-removal rule on /members, so only actual members can usefully
        // trigger this path.
        || (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount'])
          && request.resource.data.memberCount == resource.data.memberCount - 1
          && resource.data.status == 'recruiting'
        )
      );
      allow delete: if signedIn() && (
        isSuper()
        || resource.data.commissionerId == request.auth.uid
      );

      match /members/{memberId} {
        allow read: if true;

        allow create: if signedIn() && (
          isCommissionerOf(code)
          || (
            request.resource.data.uid == request.auth.uid
            && request.resource.data.email == request.auth.token.email.lower()
          )
        );

        allow update: if signedIn() && (
          isCommissionerOf(code)
          // Initial claim of a pending invite: uid null → my uid, email matches.
          || (
            resource.data.uid == null
            && request.resource.data.uid == request.auth.uid
            && resource.data.email == request.auth.token.email.lower()
          )
          // Self-edit of profile fields on my own member doc. Scoped to
          // firstName / lastName / name / venmo — teams, wins, closest,
          // paid, role, etc all stay commissioner-only.
          || (
            resource.data.uid == request.auth.uid
            && request.resource.data
                .diff(resource.data)
                .affectedKeys()
                .hasOnly(['firstName', 'lastName', 'name', 'venmo'])
          )
        );

        // Member deletion. Commissioner can remove members at any status —
        // including in_season and complete — so they can fix rosters mid- or
        // post-season. Historical weeklyResults are separate docs and remain
        // untouched. Self-removal (a member leaving on their own) stays
        // limited to 'recruiting' — post-recruiting exits go through the
        // commissioner so nobody can abandon a paid slot unilaterally.
        allow delete: if isCommissionerOf(code) || (
          signedIn()
          && resource.data.uid == request.auth.uid
          && leagueStatus(code) == 'recruiting'
        );
      }

      // Weekly score results — written by any signed-in user via ESPN polling.
      // Data is sourced from ESPN's public API and math is deterministic, so
      // tampering is self-correcting on the next refresh.
      match /weeklyResults/{week} {
        allow read: if signedIn();
        allow create, update: if signedIn()
                               && leagueStatus(code) == 'in_season';
        // Commissioner can sweep weekly results when deleting a league.
        // Same gate as member-delete: anytime except in_season.
        allow delete: if isCommissionerOf(code)
                      && leagueStatus(code) != 'in_season';
      }
    }
  }
}
`;

function initAdmin() {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
    return admin;
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

    try {
        const sdk = initAdmin();
        const ruleset = await sdk
            .securityRules()
            .releaseFirestoreRulesetFromSource(RULES);
        return res.status(200).json({
            ok: true,
            rulesetName: ruleset.name,
            createTime: ruleset.createTime,
        });
    } catch (err) {
        console.error('admin-deploy-rules error:', err);
        return res.status(500).json({
            error: err.message || 'Rules deploy failed',
            code: err.code,
        });
    }
}
