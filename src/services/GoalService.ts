// src/services/GoalService.ts
import { Goal } from '../types';

const API_URL = 'http://10.0.2.2:3001/api'; // Emulator localhost

// Fetch all goals for a user
export const fetchUserGoals = async (userId: string = 'default_user'): Promise<Goal[]> => {
  try {
    const res = await fetch(`${API_URL}/goals?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch goals');
    const data = await res.json();
    
    // Transform function to convert API response to Goal type
    const transformGoal = (goal: any): Goal => ({
      id: goal.goal_id || goal.id,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      color: getCategoryColor(goal.category),
      isCompleted: goal.is_completed === 1 || goal.isCompleted === true,
      isDaily: goal.is_daily === 1 || goal.isDaily === true,
      progress: goal.progress || 0,
      startDate: goal.target_date || goal.startDate,
      userId: goal.user_id || goal.userId,
      coinReward: goal.coin_reward || goal.coinReward || 0,
      routineDays: goal.routine_days || goal.routineDays || [], // Added for routine days
      // Add the required type field - default to 'recurring' for daily goals, 'one-time' otherwise
      type: goal.type || (goal.is_daily === 1 || goal.isDaily === true ? 'recurring' : 'one-time'),
      // Add targetDate (same as startDate for backwards compatibility)
      targetDate: goal.target_date || goal.targetDate || goal.startDate,
    });
    
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
    return [];
  } catch (err) {
    console.error('Error fetching user goals:', err);
    throw err;
  }
};

// Update a goal's progress
export const updateGoalProgress = async (goalId: number, progress: number): Promise<Goal | null> => {
  try {
    const res = await fetch(`${API_URL}/goals/${goalId}/progress`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    });
    
    if (!res.ok) throw new Error('Failed to update goal progress');
    const data = await res.json();
    
    // Handle different response formats
    const goal = data.goal || data;
    
    if (!goal) return null;
    
    return {
      id: goal.goal_id || goal.id,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      color: getCategoryColor(goal.category),
      isCompleted: goal.is_completed === 1 || goal.isCompleted === true,
      isDaily: goal.is_daily === 1 || goal.isDaily === true,
      progress: goal.progress || 0,
      startDate: goal.target_date || goal.startDate,
      userId: goal.user_id || goal.userId,
      coinReward: goal.coin_reward || goal.coinReward || 0,
      routineDays: goal.routine_days || goal.routineDays || [], // Added for routine days
      // Add the required type field - default to 'recurring' for daily goals, 'one-time' otherwise
      type: goal.type || (goal.is_daily === 1 || goal.isDaily === true ? 'recurring' : 'one-time'),
      // Add targetDate (same as startDate for backwards compatibility)
      targetDate: goal.target_date || goal.targetDate || goal.startDate,
    };
  } catch (err) {
    console.error('Error updating goal progress:', err);
    throw err;
  }
};

// Create a new goal for a user
export const createGoal = async (goal: Partial<Goal>, userId: string): Promise<Goal> => {
  try {
    // Convert the routineDays array to a JSON string for the API
    const routineDaysString = goal.routineDays ? JSON.stringify(goal.routineDays) : null;
    
    // Set a default type if not provided
    const goalType = goal.type || (goal.isDaily ? 'recurring' : 'one-time');
    
    const res = await fetch(`${API_URL}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,                         // fix snake_case for DB
        title: goal.title,
        description: goal.description || '',
        target_date: goal.targetDate || goal.startDate || new Date().toISOString().split('T')[0],
        progress: goal.progress ?? 0,
        is_completed: goal.isCompleted ? 1 : 0,  // Convert to integer for DB
        is_daily: goal.isDaily ? 1 : 0,          // Convert to integer for DB
        category: goal.category || 'Personal',
        coin_reward: goal.coinReward ?? 10,      // Default reward value
        routine_days: routineDaysString,         // Added for routine days
        type: goalType,                          // Add type field
      }),
    });

    if (!res.ok) throw new Error('Failed to create goal');
    const data = await res.json();
    
    // Handle different response formats
    const createdGoal = data.goal || data;
    
    if (!createdGoal) throw new Error('No goal data returned from server');
    
    return {
      id: createdGoal.goal_id || createdGoal.id,
      title: createdGoal.title,
      description: createdGoal.description,
      category: createdGoal.category,
      color: getCategoryColor(createdGoal.category),
      isCompleted: createdGoal.is_completed === 1 || createdGoal.isCompleted === true,
      isDaily: createdGoal.is_daily === 1 || createdGoal.isDaily === true,
      progress: createdGoal.progress || 0,
      startDate: createdGoal.target_date || createdGoal.startDate,
      userId: createdGoal.user_id || createdGoal.userId,
      coinReward: createdGoal.coin_reward || createdGoal.coinReward || 0,
      routineDays: createdGoal.routine_days 
        ? JSON.parse(createdGoal.routine_days) 
        : createdGoal.routineDays || [], // Parse routine days from JSON string
      type: createdGoal.type || (createdGoal.is_daily === 1 || createdGoal.isDaily === true 
        ? 'recurring' : 'one-time'),
      targetDate: createdGoal.target_date || createdGoal.targetDate || createdGoal.startDate,
    };
  } catch (err) {
    console.error('Error creating goal:', err);
    throw err;
  }
};

// Update the routine days for a goal
export const updateGoalRoutineDays = async (goalId: number, routineDays: number[]): Promise<Goal | null> => {
  try {
    const res = await fetch(`${API_URL}/goals/${goalId}`, {
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        routine_days: JSON.stringify(routineDays) 
      }),
    });
    
    if (!res.ok) throw new Error('Failed to update routine days');
    const data = await res.json();
    
    // Handle different response formats
    const goal = data.goal || data;
    
    if (!goal) return null;
    
    return {
      id: goal.goal_id || goal.id,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      color: getCategoryColor(goal.category),
      isCompleted: goal.is_completed === 1 || goal.isCompleted === true,
      isDaily: goal.is_daily === 1 || goal.isDaily === true,
      progress: goal.progress || 0,
      startDate: goal.target_date || goal.startDate,
      userId: goal.user_id || goal.userId,
      coinReward: goal.coin_reward || goal.coinReward || 0,
      routineDays: goal.routine_days 
        ? JSON.parse(goal.routine_days) 
        : goal.routineDays || [],
      type: goal.type || (goal.is_daily === 1 || goal.isDaily === true ? 'recurring' : 'one-time'),
      targetDate: goal.target_date || goal.targetDate || goal.startDate,
    };
  } catch (err) {
    console.error('Error updating routine days:', err);
    throw err;
  }
};

/**
 * Determines if a goal can receive rewards when completed
 * For one-time goals, they can only receive rewards if completed before expiration
 * @param goal The goal to check
 * @returns True if the goal can receive rewards, false otherwise
 */
export const canClaimRewardsForGoal = async (goal: Goal): Promise<boolean> => {
  // For one-time goals, check if they're completed on or before the assigned day
  if (goal.type === 'one-time') {
    const today = new Date();
    const goalDate = new Date(goal.targetDate || goal.startDate || Date.now());
    
    // If the goal was due in the past, don't allow claiming rewards
    if (goalDate < today && goalDate.toDateString() !== today.toDateString()) {
      return false;
    }
  }
  
  // All other goals (recurring) can claim rewards
  return true;
};

// Get user's streak
export const getUserStreaks = async (userId: string): Promise<number> => {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/streak`);
    if (!res.ok) throw new Error('Failed to fetch streaks');
    const data = await res.json();
    return data.streak || data.streakCount || 0;
  } catch (err) {
    console.error('Error fetching streaks:', err);
    return 0;
  }
};

// Get user's coin balance
export const getUserFutureCoins = async (userId: string): Promise<number> => {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/futurecoins`);
    if (!res.ok) throw new Error('Failed to fetch future coins');
    const data = await res.json();
    return data.futureCoins || data.future_coins || 0;
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
export const updateUserCoins = async (userId: string, amount: number): Promise<void> => {
  try {
    await fetch(`${API_URL}/users/${userId}/futurecoins`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
  } catch (err) {
    console.error('Error updating user coins:', err);
    throw err;
  }
};

// Update user XP
export const updateUserXP = async (userId: string, amount: number, newLevel?: number): Promise<any> => {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/xp`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount,
        level: newLevel 
      }),
    });
    
    if (!res.ok) throw new Error('Failed to update XP');
    return await res.json();
  } catch (err) {
    console.error('Error updating user XP:', err);
    throw err;
  }
};

// Helper function to check if a goal is active today (for daily goals)
export const isGoalActiveToday = (goal: Goal): boolean => {
  if (!goal.isDaily) return true; // Non-daily goals are always active
  
  if (!goal.routineDays || goal.routineDays.length === 0) return true; // If no days specified, show on all days
  
  const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
  return goal.routineDays.includes(today);
};

// Get all goals active for today
export const getTodaysGoals = async (userId: string): Promise<Goal[]> => {
  const allGoals = await fetchUserGoals(userId);
  return allGoals.filter(goal => 
    !goal.isCompleted && isGoalActiveToday(goal)
  );
};