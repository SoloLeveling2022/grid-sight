import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?.trim(),
};

let authInstance: Auth | null = null;
let googleProviderInstance: GoogleAuthProvider | null = null;

/**
 * Returns the initialized Firebase Auth instance in the client browser.
 * Safe to import and call during server-side prerendering.
 */
export function getFirebaseAuth(): Auth | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (authInstance) {
    return authInstance;
  }

  try {
    if (!firebaseConfig.apiKey) {
      console.warn("Firebase NEXT_PUBLIC_FIREBASE_API_KEY is not defined in environment.");
      return null;
    }
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    return authInstance;
  } catch (e) {
    console.error("Failed to initialize Firebase Auth:", e);
    return null;
  }
}

/**
 * Returns the Google Auth provider instance in the client browser.
 * Safe to import and call during server-side prerendering.
 */
export function getGoogleAuthProvider(): GoogleAuthProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (googleProviderInstance) {
    return googleProviderInstance;
  }

  try {
    googleProviderInstance = new GoogleAuthProvider();
    googleProviderInstance.setCustomParameters({ prompt: "select_account" });
    return googleProviderInstance;
  } catch (e) {
    console.error("Failed to initialize Google Auth Provider:", e);
    return null;
  }
}
