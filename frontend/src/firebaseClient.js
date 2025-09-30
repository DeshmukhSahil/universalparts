// src/firebaseClient.js
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Connect to emulator when REACT_APP_USE_AUTH_EMULATOR=1
if (process.env.REACT_APP_USE_AUTH_EMULATOR === "1") {
  // emulator default URL; change if yours differs
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  console.log("Connected to Firebase Auth emulator");
}

console.log("firebase auth initialized:", !!auth);
export { auth };
export default app;
