import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import axios from 'axios';

// Your API base URL - replace with your actual API URL when you create it
const API_BASE_URL = 'http://localhost:3000/api';

// Register a new user
export const registerUser = async (username, email, password, name) => {
  try {
    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile
    await updateProfile(user, {
      displayName: name
    });
    
    // Store in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      username,
      name,
      email,
      createdAt: new Date(),
      level: 1,
      xpPoints: 0,
      futureCoins: 0
    });
    
    // Store in MySQL via API (you'll need to create this API)
    await axios.post(`${API_BASE_URL}/users`, {
      user_id: user.uid,
      username,
      name,
      email
    });
    
    return user;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

// Login user
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

// Get user data
export const getUserData = async (userId) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};