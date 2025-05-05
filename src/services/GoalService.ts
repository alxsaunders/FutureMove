// Fixed version of GoalService.ts with getUserStreaks function added back
import { Goal } from '../types';
import { Platform } from 'react-native';
import { auth } from '../config/firebase.js';

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

// ENHANCED: Improved goal data validation and transformation
const transformGoal = (goal: any): Goal | null => {
  // First, check if we have a valid goal object with required fields
  if (!goal || typeof goal !== 'object') {
    console.warn('Invalid goal object received:', goal);
    return null;
  }

  // Check for the most essential fields
  if (!goal.goal_id && !goal.id) {
    console.warn('Goal missing ID field:', goal);
    return null;
  }

  // Extract all the fields with proper fallbacks
  try {
    const transformedGoal: Goal = {
      id: goal.goal_id || goal.id,
      title: goal.title || 'Untitled Goal',
      description: goal.description || '',
      category: goal.category || 'Personal',
      color: getCategoryColor(goal.category),
      isCompleted: goal.is_completed === 1 || goal.isCompleted === true,
      isDaily: goal.is_daily === 1 || goal.isDaily === true,
      progress: typeof goal.progress === 'number' ? goal.progress : 0,
      startDate: goal.target_date || goal.startDate || goal.start_date || new Date().toISOString().split('T')[0],
      userId: goal.user_id || goal.userId || 'default_user',
      coinReward: typeof goal.coin_reward === 'number' ? goal.coin_reward : 
                  typeof goal.coinReward === 'number' ? goal.coinReward : 0,
      routineDays: parseRoutineDays(goal.routine_days || goal.routineDays || []),
      // Add the required type field - default to 'recurring' for daily goals, 'one-time' otherwise
      type: goal.type || (goal.is_daily === 1 || goal.isDaily === true ? 'recurring' : 'one-time'),
      // Add targetDate (same as startDate for backwards compatibility)
      targetDate: goal.target_date || goal.targetDate || goal.startDate || goal.start_date || new Date().toISOString().split('T')[0],
      // Add last completed date if available
      lastCompleted: goal.last_completed || goal.lastCompleted || undefined,
    };

    return transformedGoal;
  } catch (error) {
    console.error('Error transforming goal data:', error);
    return null;
  }
};

// ENHANCED: Improved routine days parsing with more robust error handling
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
        // Filter any non-number values and ensure days are within 0-6 range
        return parsed
          .filter(day => typeof day === 'number')
          .map(day => Math.min(Math.max(Math.floor(day), 0), 6));
      }
    } catch (e) {
      console.warn('Error parsing routine days:', e);
    }
  }
  
  // Default return empty array
  return [];
};

// ENHANCED: Fetch all goals with better error handling and data validation
export const fetchUserGoals = async (): Promise<Goal[]> => {
  try {
    // Get current user ID from Firebase
    const userId = await getCurrentUserId();

    const apiUrl = getApiBaseUrl();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const res = await fetch(`${apiUrl}/goals?userId=${userId}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    
    // Handle different response formats
    // If the response is already an array, map and filter
    if (Array.isArray(data)) {
      // Transform goals and filter out any null values (invalid goals)
      const validGoals = data.map(transformGoal).filter(goal => goal !== null) as Goal[];
      console.log(`Fetched ${validGoals.length} valid goals from ${data.length} total goals`);
      return validGoals;
    }
    
    // If it's in the { goals: [] } format
    if (data.goals && Array.isArray(data.goals)) {
      // Transform goals and filter out any null values (invalid goals)
      const validGoals = data.goals.map(transformGoal).filter(goal => goal !== null) as Goal[];
      console.log(`Fetched ${validGoals.length} valid goals from ${data.goals.length} total goals`);
      return validGoals;
    }
    
    // If no valid format is found
    console.warn('Invalid format for goals data:', data);
    return [];
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error('Fetch request for goals timed out');
    } else {
      console.error('Error fetching user goals:', err);
    }
    return [];
  }
};

// ENHANCED: Get a single goal by ID with additional fallback logic
export const fetchGoalById = async (goalId: number): Promise<Goal | null> => {
  try {
    // Check that goalId is valid
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID: ${goalId}`);
      return null;
    }
    
    // For locally created goals (with negative IDs)
    if (goalId < 0) {
      console.log(`Cannot fetch local goal with ID: ${goalId} from server, creating fallback`);
      
      // Create a fallback goal
      return {
        id: goalId,
        title: 'Local Goal',
        description: '',
        category: 'Personal',
        color: getCategoryColor('Personal'),
        isCompleted: false,
        isDaily: false,
        progress: 0,
        startDate: new Date().toISOString().split('T')[0],
        targetDate: new Date().toISOString().split('T')[0],
        userId: 'default_user',
        coinReward: 10,
        routineDays: [],
        type: 'one-time',
        lastCompleted: undefined
      };
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goalId}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response status codes more specifically
    if (res.status === 404) {
      console.warn(`Goal not found with ID: ${goalId}`);
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      
      // For severe server errors, attempt to fetch the goal from all goals as fallback
      if (res.status === 500) {
        console.log(`Server error 500, attempting to find goal ${goalId} in all goals`);
        
        // Fetch all goals and find the one we want
        try {
          const allGoals = await fetchUserGoals();
          const foundGoal = allGoals.find(g => g.id === goalId);
          
          if (foundGoal) {
            console.log(`Found goal ${goalId} in all goals as fallback`);
            return foundGoal;
          }
        } catch (allGoalsError) {
          console.error('Failed to fetch all goals as fallback:', allGoalsError);
        }
      }
      
      return null;
    }
    
    const data = await res.json();
    const goalData = data.goal || data;
    
    // Enhanced validation: try to transform the goal, which now returns null for invalid goals
    const goal = transformGoal(goalData);
    
    if (!goal) {
      console.warn(`Invalid goal data returned for ID: ${goalId}`);
      return null;
    }
    
    return goal;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`Fetch request for goal ${goalId} timed out`);
    } else {
      console.error(`Error fetching goal by ID: ${goalId}`, err);
    }
    
    return null;
  }
};

// ENHANCED: Update a goal's progress with improved data validation and fallback
export const updateGoalProgress = async (goalId: number, progress: number): Promise<Goal | null> => {
  try {
    console.log(`Updating goal progress for ID: ${goalId} to ${progress}%`);
    
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
    
    // For locally created goals (with negative IDs)
    if (goalId < 0) {
      console.log(`Cannot update server for local goal ID: ${goalId}`);
      
      // Try to get the goal from local state
      try {
        // Fetch all goals and find this one
        const allGoals = await fetchUserGoals();
        let existingGoal = allGoals.find(g => g.id === goalId);
        
        if (existingGoal) {
          // Create an updated copy
          return {
            ...existingGoal,
            progress: progress,
            isCompleted: progress === 100
          };
        }
      } catch (fetchError) {
        console.warn(`Could not fetch local goals for ID: ${goalId}`, fetchError);
      }
      
      // Create a minimal fallback if we couldn't find the local goal
      return {
        id: goalId,
        title: 'Local Goal',
        description: '',
        category: 'Personal',
        color: getCategoryColor('Personal'),
        isCompleted: progress === 100,
        isDaily: false,
        progress: progress,
        startDate: new Date().toISOString().split('T')[0],
        targetDate: new Date().toISOString().split('T')[0],
        userId: 'default_user',
        coinReward: 10,
        routineDays: [],
        type: 'one-time',
        lastCompleted: undefined
      };
    }
    
    // First try to fetch the existing goal to have as fallback
    let existingGoal: Goal | null = null;
    try {
      existingGoal = await fetchGoalById(goalId);
      console.log(`Found existing goal for ID: ${goalId}:`, existingGoal ? 'valid' : 'not found');
    } catch (fetchError) {
      console.warn(`Could not fetch existing goal before update: ${fetchError}`);
    }
    
    // Create the update payload
    const payload: any = { progress };
    
    // If we got the existing goal info and it's a daily/routine goal being marked complete,
    // track the last completion date
    if (existingGoal && existingGoal.isDaily && progress === 100 && !existingGoal.isCompleted) {
      payload.last_completed = new Date().toISOString().split('T')[0];
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goalId}/progress`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response status codes
    if (res.status === 404) {
      console.warn(`Goal not found when updating progress for ID: ${goalId}`);
      
      // If we have an existing goal, return it with updated progress as fallback
      if (existingGoal) {
        console.log(`Using existing goal as fallback for ID: ${goalId}`);
        return {
          ...existingGoal,
          progress: progress,
          isCompleted: progress === 100
        };
      }
      
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error updating goal progress: ${res.status} ${res.statusText}`);
      
      // If existing goal is available, return that with updated progress as fallback
      if (existingGoal) {
        console.log(`Using existing goal as fallback for update error, ID: ${goalId}`);
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
      const goalData = data.goal || data;
      
      // Enhanced validation: try to transform the goal, which now returns null for invalid goals
      const goal = transformGoal(goalData);
      
      if (!goal) {
        console.warn(`Invalid goal data returned after progress update for ID: ${goalId}`);
        
        // If existing goal is available, return that with updated progress as fallback
        if (existingGoal) {
          console.log(`Using existing goal as fallback for transform error, ID: ${goalId}`);
          return {
            ...existingGoal,
            progress: progress,
            isCompleted: progress === 100
          };
        }
        
        return null; 
      }
      
      return goal;
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      console.error(`Error parsing API response for goal update: ${errorMessage}`);
      
      // If we have the existing goal, return that with updated progress as fallback
      if (existingGoal) {
        console.log(`Using existing goal as fallback for parse error, ID: ${goalId}`);
        return {
          ...existingGoal,
          progress: progress,
          isCompleted: progress === 100
        };
      }
      
      return null;
    }
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`Fetch request for goal progress update ${goalId} timed out`);
    } else {
      console.error(`Error updating goal progress for ID: ${goalId}`, err);
    }
    
    return null;
  }
};
export const updateGoal = async (goal: Goal): Promise<boolean> => {
  try {
    console.log(`Updating goal with ID: ${goal.id}`);
    
    // Validate input
    if (!goal || !goal.id) {
      console.warn('Invalid goal for update', goal);
      return false;
    }
    
    // For local goals (with negative IDs), just return success
    if (goal.id < 0) {
      console.log(`Cannot update server for local goal ID: ${goal.id}`);
      return true; // Return success for UI update
    }
    
    // Prepare routine days - convert to json string if needed
    let routineDaysString: string | null = null;
    if (goal.isDaily && goal.routineDays) {
      routineDaysString = JSON.stringify(goal.routineDays);
    }
    
    // Prepare API payload
    const payload = {
      title: goal.title,
      description: goal.description || '',
      target_date: goal.targetDate || goal.startDate || new Date().toISOString().split('T')[0],
      progress: goal.progress,
      is_completed: goal.isCompleted ? 1 : 0,
      is_daily: goal.isDaily ? 1 : 0,
      category: goal.category || 'Personal',
      coin_reward: goal.coinReward || 10,
      routine_days: routineDaysString,
      type: goal.type || (goal.isDaily ? 'recurring' : 'one-time'),
      // Preserve existing last_completed date if present
      last_completed: goal.lastCompleted,
    };
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Make API request
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goal.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Check response
    if (!res.ok) {
      console.warn(`Error updating goal: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during update, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    // Parse response
    try {
      const data = await res.json();
      console.log(`Goal updated successfully, ID: ${goal.id}`);
      return true;
    } catch (parseError) {
      console.error('Error parsing update response:', parseError);
      // Still return true if server returned OK but parsing failed
      return true;
    }
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`Fetch request for goal update ${goal.id} timed out`);
    } else {
      console.error(`Error updating goal with ID: ${goal.id}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Delete goal function
export const deleteGoal = async (goalId: number): Promise<boolean> => {
  try {
    console.log(`Deleting goal with ID: ${goalId}`);
    
    // Validate input
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID for deletion: ${goalId}`);
      return false;
    }
    
    // For local goals (with negative IDs), just return success
    if (goalId < 0) {
      console.log(`Cannot delete server goal for local ID: ${goalId}`);
      return true; // Return success for UI update
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    // Make API request
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/goals/${goalId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Check response
    if (!res.ok) {
      console.warn(`Error deleting goal: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during deletion, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Goal deleted successfully, ID: ${goalId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`Fetch request for goal deletion ${goalId} timed out`);
    } else {
      console.error(`Error deleting goal with ID: ${goalId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
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

// ENHANCED: Check if a goal is active today with better error handling
export const isGoalActiveToday = (goal: Goal): boolean => {
  try {
    // Validate the goal object
    if (!goal || typeof goal !== 'object') {
      console.warn('Invalid goal object in isGoalActiveToday');
      return false;
    }

    // Non-daily goals are always active
    if (!goal.isDaily) return true;
    
    // For daily goals, check routine days
    if (!goal.routineDays || !Array.isArray(goal.routineDays) || goal.routineDays.length === 0) {
      // If no valid routine days specified, show on all days
      return true;
    }
    
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    return goal.routineDays.includes(today);
  } catch (error) {
    console.error('Error in isGoalActiveToday:', error);
    // Default to showing the goal if there's an error
    return true;
  }
};

// ADDED BACK: Get user's streak function that was missing
export const getUserStreaks = async (): Promise<number> => {
  try {
    // Get user ID from Firebase
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID for streaks:', authError);
      return 0;
    }
    
    const apiUrl = getApiBaseUrl();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const res = await fetch(`${apiUrl}/users/${userId}/streak`, {
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.warn(`Error fetching streaks: ${res.status} ${res.statusText}`);
        return 0;
      }
      
      const data = await res.json();
      return data.streak || data.streakCount || data.current_streak || 0;
    } catch (fetchError) {
      // Handle fetch timeout/abort error specifically
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        console.error('Fetch request for streak timed out');
      } else {
        console.error('Network error fetching streaks:', fetchError);
      }
      return 0;
    }
  } catch (err) {
    console.error('Error fetching streaks:', err);
    return 0;
  }
};

// ENHANCED: Toggle goal completion with better validation and fallbacks
export const toggleGoalCompletion = async (goalId: number, goals: Goal[]): Promise<boolean> => {
  try {
    console.log(`Toggling goal completion for goal ID: ${goalId}`);
    
    // Check that goalId is valid
    if (!goalId || isNaN(Number(goalId))) {
      console.warn(`Invalid goal ID for toggle: ${goalId}`);
      return false;
    }
    
    // Get current user ID from Firebase
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID:', authError);
      userId = 'default_user';
    }
    
    // Find the goal to toggle
    let goalToToggle: Goal | null = goals.find((g) => g.id === goalId) || null;

    // If not found in the provided goals array, try to fetch it directly
    if (!goalToToggle) {
      console.warn(`Goal not found in local state: ${goalId}, attempting to fetch`);
      try {
        goalToToggle = await fetchGoalById(goalId);
        
        if (!goalToToggle) {
          console.warn(`Failed to fetch goal for ID: ${goalId}`);
          return false;
        }
      } catch (fetchError) {
        console.error(`Error fetching goal for toggle: ${fetchError}`);
        return false;
      }
    }

    const wasCompleted = goalToToggle.isCompleted;
    console.log(`Goal ${goalId} was${wasCompleted ? '' : ' not'} completed`);

    // Calculate new progress - either 100% if completing, or 0% if uncompleting
    const newProgress = !wasCompleted ? 100 : 0;

    // For local goals (negative IDs), just update locally without server call
    if (goalId < 0) {
      console.log(`Local update for goal with negative ID: ${goalId}`);
      
      // If this is a completion (not unchecking) and goal wasn't previously completed,
      // process rewards if eligible
      if (!wasCompleted && newProgress === 100) {
        if (canClaimRewardsForGoal(goalToToggle)) {
          console.log(`Processing rewards for local goal ${goalId}`);
          
          // Define reward amounts
          const XP_REWARD = 10;
          const COIN_REWARD = 5;
          
          try {
            // Process rewards
            await processGoalRewards(XP_REWARD, COIN_REWARD);
          } catch (rewardError) {
            console.error(`Error processing rewards: ${rewardError}`);
            // Continue with the toggle even if rewards fail
          }
        } else {
          console.log(`Goal ${goalId} not eligible for rewards`);
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
      // try to process rewards only if eligible
      if (!wasCompleted && newProgress === 100) {
        if (canClaimRewardsForGoal(goalToToggle)) {
          console.log(`Processing rewards for goal ${goalId} (optimistic update)`);
          
          // Define reward amounts
          const XP_REWARD = 10;
          const COIN_REWARD = 5;
          
          try {
            // Still try to process rewards even though the update failed
            await processGoalRewards(XP_REWARD, COIN_REWARD);
          } catch (rewardError) {
            console.error(`Error processing rewards: ${rewardError}`);
            // Continue with the toggle even if rewards fail
          }
        } else {
          console.log(`Goal ${goalId} not eligible for rewards`);
        }
      }
      
      return true; // Return true so UI can be updated optimistically
    }

    // If this is a completion (not unchecking) and goal wasn't previously completed,
    // process rewards only if eligible
    if (!wasCompleted && newProgress === 100) {
      if (canClaimRewardsForGoal(updatedGoal)) {
        console.log(`Processing rewards for goal ${goalId}`);
        
        // Define reward amounts
        const XP_REWARD = 10;
        const COIN_REWARD = 5;
        
        try {
          // Process rewards
          await processGoalRewards(XP_REWARD, COIN_REWARD);
        } catch (rewardError) {
          console.error(`Error processing rewards: ${rewardError}`);
          // Continue with the toggle even if rewards fail
        }
      } else {
        console.log(`Goal ${goalId} not eligible for rewards`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error toggling goal completion: ${error}`);
    return false;
  }
};

// Improved reward eligibility check function
export const canClaimRewardsForGoal = (goal: Goal): boolean => {
  // Validate input
  if (!goal || typeof goal !== 'object') {
    console.warn('Invalid goal object in canClaimRewardsForGoal');
    return false;
  }

  console.log(`Checking reward eligibility for goal ID: ${goal.id}, Type: ${goal.type || 'unknown'}`);
  
  // For one-time goals, check completion date against target date
  if (goal.type === 'one-time' || (!goal.isDaily && !goal.type)) {
    const today = new Date();
    
    // Handle potential invalid date
    let goalDate: Date;
    try {
      goalDate = new Date(goal.targetDate || goal.startDate || Date.now());
    } catch (dateError) {
      console.warn(`Invalid date format for goal ${goal.id}:`, dateError);
      goalDate = new Date(); // Default to today if parsing fails
    }
    
    // Format dates for logging
    console.log(`Today: ${today.toISOString().split('T')[0]}, Goal date: ${goalDate.toISOString().split('T')[0]}`);
    
    // Allow rewards for goals that are due today or in the future
    // Also allow if the target date is the same day (even if earlier hours)
    if (goalDate.toDateString() === today.toDateString() || goalDate > today) {
      console.log(`Goal ${goal.id} is eligible for rewards: same day or future date`);
      return true;
    }
    
    // For past goals, don't allow claiming rewards
    console.log(`Goal ${goal.id} is not eligible: past due date`);
    return false;
  }
  
  // For recurring goals, check if it's scheduled for today
  if (goal.isDaily || goal.type === 'recurring') {
    // Check if it's scheduled for today
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    
    // If it has routine days defined and today is not in the list, don't give rewards
    if (goal.routineDays && 
        Array.isArray(goal.routineDays) && 
        goal.routineDays.length > 0 && 
        !goal.routineDays.includes(today)) {
      console.log(`Goal ${goal.id} is not scheduled for today, no rewards given`);
      return false;
    }
  }
  
  // All other cases can claim rewards
  console.log(`Goal ${goal.id} is eligible for rewards`);
  return true;
};

// ADDED BACK: Get user's coin balance function that was missing
export const getUserFutureCoins = async (): Promise<number> => {
  try {
    // Get user ID from Firebase
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID for coins:', authError);
      return 0;
    }
    
    const apiUrl = getApiBaseUrl();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    try {
      const res = await fetch(`${apiUrl}/users/${userId}/futurecoins`, {
        headers: {
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        console.warn(`Error fetching future coins: ${res.status} ${res.statusText}`);
        return 0;
      }
      
      const data = await res.json();
      return data.futureCoins || data.future_coins || 0;
    } catch (fetchError) {
      // Handle fetch timeout/abort error specifically
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        console.error('Fetch request for coins timed out');
      } else {
        console.error('Network error fetching coins:', fetchError);
      }
      return 0;
    }
  } catch (err) {
    console.error('Error fetching coins:', err);
    return 0;
  }
};

// Simplified function to process rewards
export const processGoalRewards = async (
  xpAmount: number = 10,
  coinAmount: number = 5
): Promise<boolean> => {
  try {
    // Get user ID from Firebase
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID for rewards:', authError);
      userId = 'default_user';
    }
    
    console.log(`Processing rewards for user ${userId}: ${xpAmount} XP, ${coinAmount} coins`);
    
    const apiUrl = getApiBaseUrl();
    
    // Unified stats update to minimize API calls
    try {
      const response = await fetch(`${apiUrl}/users/${userId}/stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xp_points_to_add: xpAmount,
          future_coins_to_add: coinAmount,
          increment_streak: true
        }),
      });
      
      if (!response.ok) {
        console.warn(`Error updating user stats: ${response.status} ${response.statusText}`);
        return false;
      }
      
      const result = await response.json();
      console.log('Rewards processed successfully:', result);
      
      return true;
    } catch (fetchError) {
      console.error('Network error updating stats:', fetchError);
      return false;
    }
  } catch (error) {
    console.error('Error processing rewards:', error);
    return false;
  }
};

// Export other functions to maintain compatibility
export const createGoal = async (goal: Partial<Goal>): Promise<Goal> => {
  try {
    // Get current user ID from Firebase
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID for goal creation:', authError);
      userId = 'default_user';
    }

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
        const createdGoalData = data.goal || data;
        
        // Validate the returned goal
        const createdGoal = transformGoal(createdGoalData);
        
        if (!createdGoal) {
          throw new Error('No goal data returned from server');
        }
        
        return createdGoal;
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

// Get today's goals function
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
/**
 * Update user's FutureCoins balance
 * @param userId User ID
 * @param coinsToAdd Number of coins to add (can be negative for spending)
 * @returns Promise resolving to success status
 */
export const updateUserCoins = async (userId: string, coinsToAdd: number): Promise<boolean> => {
  try {
    // Get API base URL
    const apiUrl = getApiBaseUrl();
    
    // Use the existing stats endpoint for efficiency
    try {
      const response = await fetch(`${apiUrl}/users/${userId}/stats`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          future_coins_to_add: coinsToAdd,
          xp_points_to_add: 0,  // No XP change
          increment_streak: false // Don't affect streak
        }),
      });
      
      if (!response.ok) {
        console.warn(`Error updating user coins: ${response.status} ${response.statusText}`);
        return false;
      }
      
      console.log(`Updated user ${userId} coins by ${coinsToAdd}`);
      return true;
    } catch (fetchError) {
      console.error('Network error updating coins:', fetchError);
      return false;
    }
  } catch (error) {
    console.error('Error updating user coins:', error);
    return false;
  }
};

/**
 * Update user's XP and level
 * @param userId User ID
 * @param xpToAdd XP points to add
 * @param newLevel Optional new level if level up occurred
 * @returns Promise resolving to success status
 */
export const updateUserXP = async (
  userId: string, 
  xpToAdd: number,
  newLevel?: number
): Promise<boolean> => {
  try {
    // Get API base URL
    const apiUrl = getApiBaseUrl();
    
    // Use the existing stats endpoint for efficiency
    try {
      const response = await fetch(`${apiUrl}/users/${userId}/stats`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          xp_points_to_add: xpToAdd,
          future_coins_to_add: 0, // No coins change
          increment_streak: false, // Don't affect streak
          level: newLevel // Include level if provided
        }),
      });
      
      if (!response.ok) {
        console.warn(`Error updating user XP: ${response.status} ${response.statusText}`);
        return false;
      }
      
      console.log(`Updated user ${userId} XP by ${xpToAdd}${newLevel ? `, level to ${newLevel}` : ''}`);
      return true;
    } catch (fetchError) {
      console.error('Network error updating XP:', fetchError);
      return false;
    }
  } catch (error) {
    console.error('Error updating user XP:', error);
    return false;
  }
};