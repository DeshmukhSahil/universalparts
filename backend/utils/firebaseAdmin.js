// utils/firebaseAdmin.js
const admin = require("firebase-admin");

function initFirebaseAdmin() {
  if (admin.apps.length) return admin;
  // We accept either a stringified JSON in FIREBASE_SERVICE_ACCOUNT_JSON or a path in FIREBASE_SERVICE_ACCOUNT_PATH
  const keyJsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (keyJsonStr) {
    const keyJson = JSON.parse(keyJsonStr);
    admin.initializeApp({ credential: admin.credential.cert(keyJson) });
    return admin;
  }

  if (keyPath) {
    admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
    return admin;
  }

  throw new Error("Firebase service account not configured: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH");
}

module.exports = { initFirebaseAdmin, admin: () => require("firebase-admin") };
