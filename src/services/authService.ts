import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// User types
export type MySQLUser = {
  user_id: string;
  username: string;
  name: string;
  email: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterCredentials = {
  username: string;
  name: string;
  email: string;
  password: string;
};

export type AuthUser = {
  user_id: string;
  username: string;
  name: string;
  email: string;
  level: number;
  xp_points: number;
  future_coins: number;
  created_at: string;
  last_login: string | null;
};

// Get the appropriate API base URL based on platform
const getApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001/api';
  } else {
    // For iOS or development on Mac
    return 'http://192.168.1.207:3001/api'; 
  }
};

// Check if username is available
export const checkUsernameAvailable = async (username: string): Promise<boolean> => {
  const apiUrl = `${getApiBaseUrl()}/check-username`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (!response.ok) {
      throw new Error(`Username check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw error;
  }
};

// Check if email is available
export const checkEmailAvailable = async (email: string): Promise<boolean> => {
  const apiUrl = `${getApiBaseUrl()}/check-email`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!response.ok) {
      throw new Error(`Email check failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.available;
  } catch (error) {
    console.error('Error checking email availability:', error);
    throw error;
  }
};

// Register a new user to MySQL
export const registerUserToMySQL = async ({
  user_id,
  username,
  name,
  email
}: MySQLUser) => {
  const apiUrl = `${getApiBaseUrl()}/users`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        username,
        name,
        email,
        password: '',
        level: 1,
        xp_points: 0,
        future_coins: 0,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        last_login: null
      })
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
};

// Login user
export const loginUser = async (credentials: LoginCredentials) => {
  const apiUrl = `${getApiBaseUrl()}/auth/login`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      throw new Error(`Login failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store the auth token
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
    }
    
    // Store user data
    if (data.user) {
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};

// Register a new user
export const registerUser = async (credentials: RegisterCredentials) => {
  const apiUrl = `${getApiBaseUrl()}/auth/register`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // If the authentication system returns a token on register
    if (data.token) {
      await AsyncStorage.setItem('authToken', data.token);
    }
    
    // If the authentication system returns user data
    if (data.user) {
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      
      // Also register to MySQL if needed
      await registerUserToMySQL({
        user_id: data.user.user_id,
        username: data.user.username,
        name: data.user.name,
        email: data.user.email
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error registering:', error);
    throw error;
  }
};

// Logout user
export const logoutUser = async () => {
  try {
    // Remove auth token and user data from storage
    await AsyncStorage.multiRemove(['authToken', 'user']);
    return true;
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
};

// Check if user is logged in
export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return !!token;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

// Get current user data
export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const userJson = await AsyncStorage.getItem('user');
    if (!userJson) return null;
    return JSON.parse(userJson);
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Update user data in both backend and local storage
export const updateUserData = async (userData: Partial<AuthUser>): Promise<AuthUser | null> => {
  try {
    // Get current user data
    const userJson = await AsyncStorage.getItem('user');
    if (!userJson) throw new Error('No user found');
    
    const currentUser = JSON.parse(userJson) as AuthUser;
    const updatedUser = { ...currentUser, ...userData };
    
    // Update in local storage
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    
    // Update in the backend
    const apiUrl = `${getApiBaseUrl()}/users/${currentUser.user_id}`;
    const token = await AsyncStorage.getItem('authToken');
    
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });
    
    if (!response.ok) {
      throw new Error(`Update failed with status: ${response.status}`);
    }
    
    return updatedUser;
  } catch (error) {
    console.error('Error updating user data:', error);
    return null;
  }
};

// Update user coins
export const updateUserCoins = async (amount: number): Promise<AuthUser | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const newCoins = user.future_coins + amount;
    return await updateUserData({ future_coins: newCoins });
  } catch (error) {
    console.error('Error updating user coins:', error);
    return null;
  }
};

// Update user XP and potentially level up
export const updateUserXP = async (amount: number): Promise<AuthUser | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error('No user found');
    
    const newXP = user.xp_points + amount;
    
    // Check if user should level up (example: 100 XP per level)
    const xpPerLevel = 100;
    const newLevel = Math.floor(newXP / xpPerLevel) + 1;
    
    return await updateUserData({ 
      xp_points: newXP,
      level: newLevel > user.level ? newLevel : user.level
    });
  } catch (error) {
    console.error('Error updating user XP:', error);
    return null;
  }
};