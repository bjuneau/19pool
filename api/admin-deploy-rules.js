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

    function leagueData(code) {
      return get(/databases/$(database)/documents/leagues/$(code)).data;
    }

    function isCommissionerOf(code) {
      return signedIn() && leagueData(code).commissionerId == request.auth.uid;
    }

    match /users/{uid} {
      allow read: if signedIn() && request.auth.uid == uid;
      allow create: if signedIn() && request.auth.uid == uid;
      allow update: if signedIn() && request.auth.uid == uid;
      allow delete: if false;
    }

    match /leagues/{code} {
      allow read: if true;
      allow create: if signedIn()
                    && request.resource.data.commissionerId == request.auth.uid;
      allow update: if signedIn() && (
        resource.data.commissionerId == request.auth.uid
        || (
          request.resource.data.diff(resource.data).affectedKeys().hasOnly(['memberCount'])
          && request.resource.data.memberCount == resource.data.memberCount + 1
        )
      );
      allow delete: if signedIn()
                    && resource.data.commissionerId == request.auth.uid;

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
          || (
            resource.data.uid == null
            && request.resource.data.uid == request.auth.uid
            && resource.data.email == request.auth.token.email.lower()
          )
        );

        allow delete: if isCommissionerOf(code);
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
