// src/services/GoalService.ts
import { Goal } from '../types';
import { Platform } from 'react-native';
import { auth } from '../config/firebase.js'; // Assuming you have a Firebase config file

// Get API base URL based on platform
export const getApiBaseUrl = () => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return "http://localhost:3001/api";
  }
};

// Helper function to get current user ID from Firebase
export const getCurrentUserId = async (): Promise<string> => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    return currentUser.uid;
  }
  throw new Error('No authenticated user found');
};

// Helper function to transform API response to Goal type
const transformGoal = (goal: any): Goal => ({
  id: goal.goal_id || goal.id,
  title: goal.title || 'Untitled Goal',
  description: goal.description || '',
  category: goal.category || 'Personal',
  color: getCategoryColor(goal.category),
  isCompleted: goal.is_completed === 1 || goal.isCompleted === true,
  isDaily: goal.is_daily === 1 || goal.isDaily === true,
  progress: goal.progress || 0,
  startDate: goal.target_date || goal.startDate || goal.start_date,
  userId: goal.user_id || goal.userId,
  coinReward: goal.coin_reward || goal.coinReward || 0,
  routineDays: parseRoutineDays(goal.routine_days || goal.routineDays || []),
  // Add the required type field - default to 'recurring' for daily goals, 'one-time' otherwise
  type: goal.type || (goal.is_daily === 1 || goal.isDaily === true ? 'recurring' : 'one-time'),
  // Add targetDate (same as startDate for backwards compatibility)
  targetDate: goal.target_date || goal.targetDate || goal.startDate || goal.start_date,
  // Add last completed date if available
  lastCompleted: goal.last_completed || goal.lastCompleted || undefined,
});

// Parse routine days from different possible formats
const parseRoutineDays = (routineDays: any): number[] => {
  // If already an array of numbers, return as is
  if (Array.isArray(routineDays) && routineDays.every(day => typeof day === 'number')) {
    return routineDays;
  }
  
  // If it's a JSON string, parse it
  if (typeof routineDays === 'string') {
    try {
      const parsed = JSON.parse(routineDays);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Error parsing routine days:', e);
    }
  }
  
  // Default return empty array
  return [];
};

// Fetch all goals for a user
export const fetchUserGoals = async (): Promise<Goal[]> => {
  try {
    // Get current user ID from Firebase
    const userId = await getCurrentUserId();

    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals?userId=${userId}`);
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    
    // Handle different response formats
    // If the response is already an array, return it
    if (Array.isArray(data)) {
      return data.map(transformGoal);
    }
    
    // If it's in the { goals: [] } format
    if (data.goals && Array.isArray(data.goals)) {
      return data.goals.map(transformGoal);
    }
    
    // If no valid format is found
    console.warn('Invalid format for goals data:', data);
    return [];
  } catch (err) {
    console.error('Error fetching user goals:', err);
    return [];
  }
};

// Get a single goal by ID
export const fetchGoalById = async (goalId: number): Promise<Goal | null> => {
  try {
    const apiUrl = getApiBaseUrl();
    
    // Check that goalId is valid
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID: ${goalId}`);
      return null;
    }
    
    const res = await fetch(`${apiUrl}/goals/${goalId}`);
    
    // Handle different response status codes more specifically
    if (res.status === 404) {
      console.warn(`Goal not found with ID: ${goalId}`);
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    const goal = data.goal || data;
    
    if (!goal || !goal.id) {
      console.warn(`Invalid goal data returned for ID: ${goalId}`);
      return null;
    }
    
    return transformGoal(goal);
  } catch (err) {
    console.error(`Error fetching goal by ID: ${goalId}`, err);
    return null;
  }
};

// Update a goal's progress
export const updateGoalProgress = async (goalId: number, progress: number): Promise<Goal | null> => {
  try {
    // Check that goalId is valid
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID for progress update: ${goalId}`);
      return null;
    }
    
    // Validate progress value
    if (progress < 0 || progress > 100) {
      console.warn(`Invalid progress value: ${progress}. Must be between 0 and 100.`);
      progress = Math.max(0, Math.min(100, progress)); // Clamp to valid range
    }
    
    // First check if this is a daily goal - handle potential errors gracefully
    let existingGoal: Goal | null = null;
    try {
      existingGoal = await fetchGoalById(goalId);
    } catch (fetchError) {
      console.warn(`Could not fetch goal before update: ${fetchError}`);
      // Continue with the update anyway
    }
    
    // Create the update payload
    const payload: any = { progress };
    
    // If we got the existing goal info and it's a daily/routine goal being marked complete,
    // track the last completion date
    if (existingGoal && existingGoal.isDaily && progress === 100 && !existingGoal.isCompleted) {
      payload.last_completed = new Date().toISOString().split('T')[0];
    }
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goalId}/progress`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    // Handle different response status codes
    if (res.status === 404) {
      console.warn(`Goal not found when updating progress for ID: ${goalId}`);
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error updating goal progress: ${res.status} ${res.statusText}`);
      
      // If existing goal is available, return that with updated progress as fallback
      if (existingGoal) {
        return {
          ...existingGoal,
          progress: progress,
          isCompleted: progress === 100
        };
      }
      return null;
    }
    
    try {
      const data = await res.json();
      
      // Handle different response formats
      const goal = data.goal || data;
      
      if (!goal || !goal.id) {
        console.warn(`Invalid goal data returned after progress update for ID: ${goalId}`);
        
        // If existing goal is available, return that with updated progress as fallback
        if (existingGoal) {
          return {
            ...existingGoal,
            progress: progress,
            isCompleted: progress === 100
          };
        }
        return null; 
      }
      
      return transformGoal(goal);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      console.error(`Error parsing API response for goal update: ${errorMessage}`);
      
      // If we have the existing goal, return that with updated progress as fallback
      if (existingGoal) {
        return {
          ...existingGoal,
          progress: progress,
          isCompleted: progress === 100
        };
      }
      return null;
    }
  } catch (err) {
    console.error(`Error updating goal progress for ID: ${goalId}`, err);
    return null;
  }
};

// Create a new goal
export const createGoal = async (goal: Partial<Goal>): Promise<Goal> => {
  try {
    // Get current user ID from Firebase
    const userId = await getCurrentUserId();

    if (!goal.title || goal.title.trim() === '') {
      console.warn('Goal title is missing, using default title');
      goal.title = 'Untitled Goal';
    }

    // Convert the routineDays array to a JSON string for the API
    const routineDaysString = goal.routineDays && goal.routineDays.length > 0
      ? JSON.stringify(goal.routineDays) 
      : goal.isDaily ? JSON.stringify([0, 1, 2, 3, 4, 5, 6]) : null;
    
    // Set a default type if not provided
    const goalType = goal.type || (goal.isDaily ? 'recurring' : 'one-time');
    
    console.log(`Attempting to create goal: ${goal.title} for user: ${userId}`);

    const apiUrl = getApiBaseUrl();
    
    try {
      // Add timeout to the fetch request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const res = await fetch(`${apiUrl}/goals`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          user_id: userId,
          title: goal.title,
          description: goal.description || '',
          target_date: goal.targetDate || goal.startDate || new Date().toISOString().split('T')[0],
          progress: goal.progress ?? 0,
          is_completed: goal.isCompleted ? 1 : 0,
          is_daily: goal.isDaily ? 1 : 0,
          category: goal.category || 'Personal',
          coin_reward: goal.coinReward ?? 10,
          routine_days: routineDaysString,
          type: goalType,
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Log detailed information on error response
      if (!res.ok) {
        console.warn(`Server error creating goal: ${res.status} ${res.statusText}`);
        
        // Try to get error details if available
        try {
          const errorData = await res.json();
          console.warn('Error details:', errorData);
        } catch (jsonError) {
          console.warn('No detailed error information available');
        }
        
        // Create a local goal as fallback
        console.log('Server error, creating local goal as fallback');
        
        // Generate a temporary negative ID to ensure it doesn't conflict with server IDs
        const tempId = -Math.floor(Math.random() * 10000);
        
        // Create a local goal object
        const localGoal: Goal = {
          id: tempId,
          title: goal.title,
          description: goal.description || '',
          category: goal.category || 'Personal',
          color: getCategoryColor(goal.category),
          isCompleted: goal.isCompleted || false,
          isDaily: goal.isDaily || false,
          progress: goal.progress || 0,
          startDate: goal.startDate || new Date().toISOString().split('T')[0],
          targetDate: goal.targetDate || goal.startDate || new Date().toISOString().split('T')[0],
          userId: userId,
          coinReward: goal.coinReward || 10,
          routineDays: goal.routineDays || (goal.isDaily ? [0,1,2,3,4,5,6] : []),
          type: goalType,
          lastCompleted: goal.lastCompleted || undefined
        };
        
        console.log(`Created local fallback goal with ID: ${tempId}`);
        return localGoal;
      }
      
      // Parse response data with better error handling
      try {
        const data = await res.json();
        
        // Handle different response formats
        const createdGoal = data.goal || data;
        
        if (!createdGoal || !createdGoal.id) {
          throw new Error('No goal data returned from server');
        }
        
        return transformGoal(createdGoal);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
        throw new Error(`Failed to parse server response: ${errorMessage}`);
      }
    } catch (fetchError) {
      console.error('Network error creating goal:', fetchError);
      
      // If network error occurs, create a local goal as fallback
      console.log('Network error, creating local goal as fallback');
      
      // Generate a temporary negative ID
      const tempId = -Math.floor(Math.random() * 10000);
      
      // Create a local goal object
      const localGoal: Goal = {
        id: tempId,
        title: goal.title,
        description: goal.description || '',
        category: goal.category || 'Personal',
        color: getCategoryColor(goal.category),
        isCompleted: goal.isCompleted || false,
        isDaily: goal.isDaily || false,
        progress: goal.progress || 0,
        startDate: goal.startDate || new Date().toISOString().split('T')[0],
        targetDate: goal.targetDate || goal.startDate || new Date().toISOString().split('T')[0],
        userId: userId,
        coinReward: goal.coinReward || 10,
        routineDays: goal.routineDays || (goal.isDaily ? [0,1,2,3,4,5,6] : []),
        type: goalType,
        lastCompleted: goal.lastCompleted || undefined
      };
      
      console.log(`Created local fallback goal with ID: ${tempId}`);
      return localGoal;
    }
  } catch (err) {
    console.error('Error creating goal:', err);
    
    // Get Firebase user ID or generate temporary one
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      userId = 'temp_user_' + Date.now();
      console.error('Failed to get user ID:', authError);
    }
    
    // Even if everything fails, create a minimal local goal as last resort
    const tempId = -Math.floor(Math.random() * 10000);
    
    console.log('Last resort: creating basic local goal');
    return {
      id: tempId,
      title: goal.title || 'Untitled Goal',
      description: goal.description || '',
      category: 'Personal',
      color: '#3B82F6',
      isCompleted: false,
      isDaily: goal.isDaily || false,
      progress: 0,
      startDate: new Date().toISOString().split('T')[0],
      targetDate: new Date().toISOString().split('T')[0],
      userId: userId,
      coinReward: 10,
      routineDays: goal.isDaily ? [0,1,2,3,4,5,6] : [],
      type: goal.isDaily ? 'recurring' : 'one-time',
      lastCompleted: undefined
    };
  }
};

// Delete a goal
export const deleteGoal = async (goalId: number): Promise<boolean> => {
  try {
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID for deletion: ${goalId}`);
      return false;
    }

    // Handle locally created goals (with negative IDs) by returning success immediately
    if (goalId < 0) {
      console.log(`Skipping server deletion for local goal ID: ${goalId}`);
      return true;
    }

    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    });
    
    if (res.status === 404) {
      console.warn(`Goal not found when trying to delete ID: ${goalId}`);
      return true; // Consider it a success since the goal is gone
    }
    
    if (!res.ok) {
      console.warn(`Error deleting goal: ${res.status} ${res.statusText}`);
      
      // For severe server errors (500), assume deletion worked to avoid blocking the user
      if (res.status === 500) {
        console.log('Server error 500 during deletion, assuming success');
        return true;
      }
      
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error deleting goal with ID: ${goalId}`, err);
    return false;
  }
};

// Update the routine days for a goal
export const updateGoalRoutineDays = async (goalId: number, routineDays: number[]): Promise<Goal | null> => {
  try {
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID for routine days update: ${goalId}`);
      return null;
    }
    
    // Handle locally created goals (with negative IDs)
    if (goalId < 0) {
      console.log(`Cannot update server for local goal ID: ${goalId}`);
      
      // Get current user ID
      let userId: string;
      try {
        userId = await getCurrentUserId();
      } catch (error) {
        userId = 'temp_user_' + Date.now();
        console.warn(`Could not get user ID, using temporary: ${userId}`);
      }
      
      // Return a mock goal with updated routine days
      return {
        id: goalId,
        title: 'Local Goal',
        description: '',
        category: 'Personal',
        color: '#3B82F6',
        isCompleted: false,
        isDaily: true,
        progress: 0,
        userId: userId,
        routineDays: routineDays,
        type: 'recurring',
        startDate: new Date().toISOString().split('T')[0],
        targetDate: new Date().toISOString().split('T')[0],
        coinReward: 10,
        lastCompleted: undefined
      };
    }
    
    // Validate routine days - should be array of numbers 0-6
    if (!Array.isArray(routineDays) || 
        !routineDays.every(day => typeof day === 'number' && day >= 0 && day <= 6)) {
      console.warn(`Invalid routine days format: ${routineDays}`);
      return null;
    }
    
    // Fetch existing goal first, to use as fallback if needed
    let existingGoal: Goal | null = null;
    try {
      existingGoal = await fetchGoalById(goalId);
    } catch (fetchError) {
      console.warn(`Could not fetch goal before routine days update: ${fetchError}`);
    }
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goalId}`, {
      method: 'PATCH', 
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({ 
        routine_days: JSON.stringify(routineDays) 
      }),
    });
    
    if (res.status === 404) {
      console.warn(`Goal not found when updating routine days for ID: ${goalId}`);
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error updating routine days: ${res.status} ${res.statusText}`);
      
      // If we have the existing goal, return that with updated routine days as fallback
      if (existingGoal) {
        return {
          ...existingGoal,
          routineDays: routineDays
        };
      }
      
      return null;
    }
    
    const data = await res.json();
    
    // Handle different response formats
    const goal = data.goal || data;
    
    if (!goal || !goal.id) {
      console.warn(`Invalid goal data returned after routine days update for ID: ${goalId}`);
      
      // If we have the existing goal, return that with updated routine days as fallback
      if (existingGoal) {
        return {
          ...existingGoal,
          routineDays: routineDays
        };
      }
      
      return null;
    }
    
    return transformGoal(goal);
  } catch (err) {
    console.error(`Error updating routine days for goal ${goalId}:`, err);
    return null;
  }
};

/**
 * Determines if a goal can receive rewards when completed
 * For one-time goals, they can only receive rewards if completed before expiration
 * @param goal The goal to check
 * @returns True if the goal can receive rewards, false otherwise
 */
export const canClaimRewardsForGoal = (goal: Goal): boolean => {
  // For one-time goals, check if they're completed on or before the assigned day
  if (!goal.isDaily) {
    const today = new Date();
    const goalDate = new Date(goal.targetDate || goal.startDate || Date.now());
    
    // If the goal was due in the past, don't allow claiming rewards
    if (goalDate < today && goalDate.toDateString() !== today.toDateString()) {
      console.log(`One-time goal ${goal.id} is past due, no rewards given`);
      return false;
    }
  } else {
    // For daily goals, check if it's scheduled for today
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    
    // If it has routine days defined and today is not in the list, don't give rewards
    if (goal.routineDays && goal.routineDays.length > 0 && !goal.routineDays.includes(today)) {
      console.log(`Daily goal ${goal.id} is not scheduled for today, no rewards given`);
      return false;
    }
  }
  
  console.log(`Goal ${goal.id} is eligible for rewards`);
  // All other goals can claim rewards
  return true;
};

// Process rewards for a completed goal
export const processGoalRewards = async (
  xpAmount: number = 10,
  coinAmount: number = 5
): Promise<boolean> => {
  try {
    // Get user ID from Firebase
    const userId = await getCurrentUserId();
    
    console.log(`Processing rewards for user ${userId}: ${xpAmount} XP, ${coinAmount} coins`);
    
    // Update XP in database
    const xpSuccess = await updateUserXP(userId, xpAmount);
    
    // Update coins in database
    const coinSuccess = await updateUserCoins(userId, coinAmount);
    
    // Increment streak
    let streakSuccess = false;
    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/users/${userId}/streak`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ increment: true }),
      });
      
      streakSuccess = response.ok;
      
      if (!response.ok) {
        console.warn(`Error updating streak: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
    
    return xpSuccess && coinSuccess;
  } catch (error) {
    console.error('Error processing rewards:', error);
    return false;
  }
};

// Get user's streak
export const getUserStreaks = async (): Promise<number> => {
  try {
    // Get user ID from Firebase
    const userId = await getCurrentUserId();
    
    const apiUrl = getApiBaseUrl();
    
    try {
      const res = await fetch(`${apiUrl}/users/${userId}/streak`, {
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });
      
      if (!res.ok) {
        console.warn(`Error fetching streaks: ${res.status} ${res.statusText}`);
        return 0;
      }
      
      const data = await res.json();
      return data.streak || data.streakCount || data.current_streak || 0;
    } catch (fetchError) {
      console.error('Network error fetching streaks:', fetchError);
      return 0;
    }
  } catch (err) {
    console.error('Error fetching streaks:', err);
    return 0;
  }
};

// Get user's coin balance
export const getUserFutureCoins = async (): Promise<number> => {
  try {
    // Get user ID from Firebase
    const userId = await getCurrentUserId();
    
    const apiUrl = getApiBaseUrl();
    
    try {
      const res = await fetch(`${apiUrl}/users/${userId}/futurecoins`, {
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });
      
      if (!res.ok) {
        console.warn(`Error fetching future coins: ${res.status} ${res.statusText}`);
        return 0;
      }
      
      const data = await res.json();
      return data.futureCoins || data.future_coins || 0;
    } catch (fetchError) {
      console.error('Network error fetching coins:', fetchError);
      return 0;
    }
  } catch (err) {
    console.error('Error fetching coins:', err);
    return 0;
  }
};

// Helper function to get color for a category
export const getCategoryColor = (category?: string): string => {
  const categoryColors: Record<string, string> = {
    'Personal': '#3B82F6', // Blue
    'Work': '#4CAF50',     // Green
    'Learning': '#5E6CE7', // Purple
    'Health': '#F44336',   // Red
    'Finance': '#FF9800',  // Orange
    'Repair': '#56C3B6'    // Cyan
  };
  
  return category && categoryColors[category] ? categoryColors[category] : '#3B82F6';
};

// Update user coins
export const updateUserCoins = async (userId: string, amount: number): Promise<boolean> => {
  try {
    if (!userId) {
      console.warn('Invalid user ID for updating coins');
      return false;
    }
    
    if (isNaN(Number(amount))) {
      console.warn(`Invalid amount for coins update: ${amount}`);
      return false;
    }
    
    const apiUrl = getApiBaseUrl();
    
    try {
      const res = await fetch(`${apiUrl}/users/${userId}/futurecoins`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ amount }),
      });
      
      if (!res.ok) {
        console.warn(`Error updating user coins: ${res.status} ${res.statusText}`);
        
        // For severe server errors (500), assume update worked so user isn't blocked
        if (res.status === 500) {
          console.log('Server error 500 during coin update, assuming success');
          return true;
        }
        
        return false;
      }
      
      return true;
    } catch (fetchError) {
      console.error('Network error updating coins:', fetchError);
      // Assume success for network errors to keep the UI moving forward
      return true;
    }
  } catch (err) {
    console.error('Error updating user coins:', err);
    return false;
  }
};

// Update user XP
export const updateUserXP = async (userId: string, amount: number, newLevel?: number): Promise<boolean> => {
  try {
    if (!userId) {
      console.warn('Invalid user ID for updating XP');
      return false;
    }
    
    if (isNaN(Number(amount))) {
      console.warn(`Invalid amount for XP update: ${amount}`);
      return false;
    }
    
    const apiUrl = getApiBaseUrl();
    
    try {
      const res = await fetch(`${apiUrl}/users/${userId}/xp`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({ 
          amount,
          level: newLevel 
        }),
      });
      
      if (!res.ok) {
        console.warn(`Error updating XP: ${res.status} ${res.statusText}`);
        
        // For severe server errors (500), assume update worked so user isn't blocked
        if (res.status === 500) {
          console.log('Server error 500 during XP update, assuming success');
          return true;
        }
        
        return false;
      }
      
      return true;
    } catch (fetchError) {
      console.error('Network error updating XP:', fetchError);
      // Assume success for network errors to keep the UI moving forward
      return true;
    }
  } catch (err) {
    console.error('Error updating user XP:', err);
    return false;
  }
};

// Helper function to check if a goal is active today (for daily goals)
export const isGoalActiveToday = (goal: Goal): boolean => {
  if (!goal.isDaily) return true; // Non-daily goals are always active
  
  if (!goal.routineDays || goal.routineDays.length === 0) return true; // If no days specified, show on all days
  
  const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
  return goal.routineDays.includes(today);
};

// Reset daily goals at the start of a new day
export const resetDailyGoals = async (): Promise<void> => {
  try {
    // Get current user ID from Firebase
    const userId = await getCurrentUserId();
    
    console.log(`Resetting daily goals for user: ${userId}`);
    
    // Get all goals - handle empty response gracefully
    const goals = await fetchUserGoals();
    
    if (!goals || goals.length === 0) {
      console.log(`No goals found for user: ${userId}`);
      return;
    }
    
    // For each daily goal that's scheduled for today and was completed
    let resetCount = 0;
    const dailyGoals = goals.filter(g => g.isDaily && g.isCompleted);
    
    console.log(`Found ${dailyGoals.length} completed daily goals to check`);
    
    for (const goal of dailyGoals) {
      try {
        // Check if this goal is active today
        const activeToday = isGoalActiveToday(goal);
        
        if (activeToday) {
          console.log(`Resetting daily goal: ${goal.title} (ID: ${goal.id})`);
          
          try {
            // Reset the progress to 0 and isCompleted to false
            await updateGoalProgress(goal.id, 0);
            resetCount++;
          } catch (updateError) {
            console.error(`Error updating goal ${goal.id} progress:`, updateError);
            // Continue with other goals
          }
        }
      } catch (goalError) {
        console.error(`Error processing goal ${goal.id}:`, goalError);
        // Continue with other goals
      }
    }
    
    console.log(`Reset ${resetCount} daily goals`);
  } catch (error) {
    console.error('Error resetting daily goals:', error);
  }
};

// Get all goals active for today
export const getTodaysGoals = async (): Promise<Goal[]> => {
  try {
    const allGoals = await fetchUserGoals();
    return allGoals.filter(goal => 
      !goal.isCompleted && isGoalActiveToday(goal)
    );
  } catch (error) {
    console.error('Error getting today\'s goals:', error);
    return [];
  }
};

// Improved goal completion toggle function for screens
export const toggleGoalCompletion = async (goalId: number, goals: Goal[]): Promise<boolean> => {
  try {
    // Get current user ID from Firebase
    const userId = await getCurrentUserId();
    
    // Find the goal to toggle
    const goalToToggle = goals.find((g) => g.id === goalId);

    if (!goalToToggle) {
      console.warn(`Goal not found in local state: ${goalId}`);
      return false;
    }

    const wasCompleted = goalToToggle.isCompleted;

    // Calculate new progress - either 100% if completing, or 0% if uncompleting
    const newProgress = !wasCompleted ? 100 : 0;

    // For local goals (negative IDs), just update locally without server call
    if (goalId < 0) {
      console.log(`Local update for goal with negative ID: ${goalId}`);
      
      // If this is a completion (not unchecking) and goal wasn't previously completed,
      // process rewards only if eligible
      if (!wasCompleted && newProgress === 100) {
        if (canClaimRewardsForGoal(goalToToggle)) {
          // Define reward amounts
          const XP_REWARD = 10;
          const COIN_REWARD = 5;
          
          // Process rewards
          await processGoalRewards(XP_REWARD, COIN_REWARD);
        }
      }
      
      return true;
    }

    // Update goal progress in the database
    const updatedGoal = await updateGoalProgress(goalId, newProgress);

    // If update failed but we had the goal locally, proceed with optimistic UI update
    if (!updatedGoal) {
      console.warn(`Goal progress update failed for ID: ${goalId}, using optimistic update`);
      
      // If this is a completion (not unchecking) and goal wasn't previously completed,
      // process rewards only if eligible
      if (!wasCompleted && newProgress === 100) {
        if (canClaimRewardsForGoal(goalToToggle)) {
          // Define reward amounts
          const XP_REWARD = 10;
          const COIN_REWARD = 5;
          
          // Still try to process rewards even though the update failed
          await processGoalRewards(XP_REWARD, COIN_REWARD);
        }
      }
      
      return true; // Return true so UI can be updated optimistically
    }

    // If this is a completion (not unchecking) and goal wasn't previously completed,
    // process rewards only if eligible
    if (!wasCompleted && newProgress === 100) {
      if (canClaimRewardsForGoal(updatedGoal)) {
        // Define reward amounts
        const XP_REWARD = 10;
        const COIN_REWARD = 5;
        
        // Process rewards
        await processGoalRewards(XP_REWARD, COIN_REWARD);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error toggling goal completion: ${error}`);
    return false;
  }
};