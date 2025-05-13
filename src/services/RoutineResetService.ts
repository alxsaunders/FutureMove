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
    
    // If it's a new day or we've never reset before, reset the daily goals
    if (!lastResetDate || lastResetDate !== today) {
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
 * Resets all daily/routine goals that were completed the previous day
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
    
    // Get today's day of week
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    
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
    // Even if there's an error, we don't want to crash the app
  }
};

// Export both as named exports AND default export to handle different import styles
export default {
  checkAndResetDailyGoals 
};