// src/services/RoutineResetService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchUserGoals, updateGoalProgress, isGoalActiveToday } from './GoalService';
import { Goal } from '../types';

// Key for storing the last reset date
const LAST_RESET_DATE_KEY = 'lastRoutineResetDate';

/**
 * Checks if daily goals need to be reset and handles the reset process
 * This should be called when the app starts or when the user logs in
 */
export const checkAndResetDailyGoals = async (userId: string): Promise<void> => {
  try {
    // Validate userId
    if (!userId) {
      console.warn("Cannot reset goals: Invalid user ID");
      return;
    }

    console.log(`Checking if goals need reset for user: ${userId}`);
    
    // Get the current date (just the date part)
    const today = new Date().toISOString().split('T')[0];
    
    // Get the last reset date from AsyncStorage
    let lastResetDate: string | null = null;
    try {
      lastResetDate = await AsyncStorage.getItem(`${LAST_RESET_DATE_KEY}_${userId}`);
    } catch (storageError) {
      console.warn("Error reading last reset date from storage:", storageError);
      // Continue with the reset to be safe
    }
    
    console.log(`Last reset date: ${lastResetDate}, Today: ${today}`);
    
    // If it's a new day or we've never reset before, reset the daily goals
    if (!lastResetDate || lastResetDate !== today) {
      console.log(`New day detected, resetting daily goals...`);
      await resetDailyGoals(userId);
      
      // Update the last reset date to today
      try {
        await AsyncStorage.setItem(`${LAST_RESET_DATE_KEY}_${userId}`, today);
        console.log(`Updated last reset date to ${today} for user ${userId}`);
      } catch (storageError) {
        console.warn("Error saving last reset date to storage:", storageError);
        // Not critical, can continue
      }
    } else {
      console.log(`Goals were already reset today (${today}) for user ${userId}`);
    }
  } catch (error) {
    console.error('Error checking and resetting daily goals:', error);
    // Even if there's an error, we don't want to crash the app
  }
};

/**
 * Resets all daily/routine goals that are scheduled for today
 * This resets both completed and incomplete daily goals to ensure a fresh start
 */
const resetDailyGoals = async (userId: string): Promise<void> => {
  try {
    if (!userId) {
      console.warn('Invalid user ID for resetting daily goals');
      return;
    }
    
    console.log(`Resetting daily goals for user: ${userId}`);
    
    // Get all goals - handle empty response gracefully
    let goals: Goal[] = [];
    try {
      goals = await fetchUserGoals();
    } catch (fetchError) {
      console.error("Error fetching goals for reset:", fetchError);
      return; // Can't proceed without goals
    }
    
    if (!goals || goals.length === 0) {
      console.log(`No goals found for user: ${userId}`);
      return;
    }
    
    // FIXED: Filter for daily/recurring goals that are scheduled for TODAY
    // Reset all daily goals that are active today, regardless of completion status
    let resetCount = 0;
    const dailyGoalsToReset = goals.filter(goal => {
      // Check if it's a daily/recurring goal
      const isDaily = goal.isDaily || goal.type === 'recurring';
      if (!isDaily) return false;
      
      // Check if it's scheduled for today
      const activeToday = isGoalActiveToday(goal);
      
      console.log(`Goal "${goal.title}": isDaily=${isDaily}, activeToday=${activeToday}, isCompleted=${goal.isCompleted}`);
      
      return activeToday;
    });
    
    console.log(`Found ${dailyGoalsToReset.length} daily goals scheduled for today to reset`);
    
    for (const goal of dailyGoalsToReset) {
      try {
        // Reset ALL daily goals scheduled for today (whether they were completed or not)
        // This ensures a fresh start for the new day
        console.log(`Resetting daily goal: ${goal.title} (ID: ${goal.id}) from progress ${goal.progress} to 0`);
        
        try {
          // Reset the progress to 0 and isCompleted to false
          await updateGoalProgress(goal.id, 0);
          resetCount++;
        } catch (updateError) {
          console.error(`Error updating goal ${goal.id} progress:`, updateError);
          // Continue with other goals
        }
      } catch (goalError) {
        console.error(`Error processing goal ${goal.id}:`, goalError);
        // Continue with other goals
      }
    }
    
    console.log(`Successfully reset ${resetCount} daily goals for the new day`);
  } catch (error) {
    console.error('Error resetting daily goals:', error);
    // Even if there's an error, we don't want to crash the app
  }
};

/**
 * Get the last reset date for debugging purposes
 */
export const getLastResetDate = async (userId: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(`${LAST_RESET_DATE_KEY}_${userId}`);
  } catch (error) {
    console.error('Error getting last reset date:', error);
    return null;
  }
};

/**
 * Force reset goals (for testing purposes)
 */
export const forceResetDailyGoals = async (userId: string): Promise<void> => {
  try {
    // Clear the last reset date to force a reset
    await AsyncStorage.removeItem(`${LAST_RESET_DATE_KEY}_${userId}`);
    // Then perform the reset
    await checkAndResetDailyGoals(userId);
  } catch (error) {
    console.error('Error forcing reset:', error);
  }
};

/**
 * Clear reset tracking (for testing/debugging)
 */
export const clearResetTracking = async (userId: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(`${LAST_RESET_DATE_KEY}_${userId}`);
    console.log(`Cleared reset tracking for user: ${userId}`);
  } catch (error) {
    console.error('Error clearing reset tracking:', error);
  }
};

// Export both as named exports AND default export to handle different import styles
export default {
  checkAndResetDailyGoals,
  getLastResetDate,
  forceResetDailyGoals,
  clearResetTracking
};