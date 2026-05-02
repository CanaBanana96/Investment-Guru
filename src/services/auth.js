import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(firebaseConfig).every(Boolean);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;

const provider = isFirebaseConfigured ? new GoogleAuthProvider() : null;
if (provider) {
  provider.setCustomParameters({
    prompt: 'select_account',
  });
}

export const signInWithGoogle = async () => {
  if (!auth || !provider) {
    throw new Error('Firebase is not configured');
  }

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!user.email.endsWith('@gmail.com')) {
      await signOut(auth);
      throw new Error('Only Gmail accounts are allowed');
    }

    return user;
  } catch (error) {
    throw error;
  }
};

export const signOutUser = async () => {
  if (!auth) return;
  await signOut(auth);
};
