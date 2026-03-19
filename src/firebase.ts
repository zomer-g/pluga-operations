import { initializeApp } from 'firebase/app';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyA-Y0nio7WWw6KkAT2rLXr6QBWicsQ3q5s',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pluga-ops.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pluga-ops',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pluga-ops.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '316977351638',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:316977351638:web:8d70caa7e60bd9ee78b277',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Enable offline persistence
enableMultiTabIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence failed: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not available in this browser');
  }
});
