import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

// Mengizinkan compiler TypeScript mengenali properti env di import.meta secara standard
declare global {
  interface ImportMeta {
    readonly env: Record<string, string | undefined>;
  }
}

// Mengizinkan override konfigurasi Firebase menggunakan env variables di lingkungan produksi atau local storage kustom
const getFirebaseConfig = () => {
  try {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('CUSTOM_FIREBASE_CONFIG') : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.projectId) {
        return {
          apiKey: parsed.apiKey,
          authDomain: parsed.authDomain || `${parsed.projectId}.firebaseapp.com`,
          projectId: parsed.projectId,
          appId: parsed.appId || '',
          firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          storageBucket: parsed.storageBucket || `${parsed.projectId}.firebasestorage.app`,
          messagingSenderId: parsed.messagingSenderId || '',
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse custom firebase config:', e);
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
    firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DB_ID || defaultFirebaseConfig.firestoreDatabaseId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  };
};

export const firebaseConfig = getFirebaseConfig();

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
