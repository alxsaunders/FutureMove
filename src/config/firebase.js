// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA7bbNanaC5dDV3wnaLrU8HT-bySmVMUVU",
  authDomain: "futuremove-86603.firebaseapp.com",
  projectId: "futuremove-86603",
  storageBucket: "futuremove-86603.appspot.com", // ✅ fixed .app typo here
  messagingSenderId: "765249859918",
  appId: "1:765249859918:web:f80304cebf58204de06e1f",
  measurementId: "G-09284YZSRN"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Use AsyncStorage for Firebase Auth persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// ✅ Firestore
const db = getFirestore(app);

export { auth, db };
