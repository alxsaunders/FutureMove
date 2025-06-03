// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyA7bbNanaC5dDV3wnaLrU8HT-bySmVMUVU",
  authDomain: "futuremove-86603.firebaseapp.com",
  projectId: "futuremove-86603",
  storageBucket: "futuremove-86603.firebasestorage.app",
  messagingSenderId: "765249859918",
  appId: "1:765249859918:web:f80304cebf58204de06e1f",
  measurementId: "G-09284YZSRN",
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Auth with persistence
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (error) {
  // If auth is already initialized, get the existing instance
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Test Firebase connection (optional - for debugging)
const testFirebaseConnection = () => {
  try {
    console.log('🔥 Firebase initialized successfully');
    console.log('📱 App:', app.name);
    console.log('🔐 Auth domain:', firebaseConfig.authDomain);
    console.log('💾 Storage bucket:', firebaseConfig.storageBucket);
    console.log('📊 Project ID:', firebaseConfig.projectId);
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    return false;
  }
};

// Run connection test in development
if (__DEV__) {
  testFirebaseConnection();
}

export { auth, db, storage, app };
export default app;