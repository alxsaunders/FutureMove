// src/config/firebase.js
import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence
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

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };