// src/services/StreakService.ts
import { Streak } from '../types';
import { Platform } from 'react-native';

const getApiBaseUrl = (): string => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return 'http://192.168.1.207:3001/api';
  }
};

/**
 * Fetches a user's streak data
 * @param userId The ID of the user
 * @returns The streak data for the user
 */
export const fetchUserStreak = async (userId: string): Promise<Streak> => {
  try {
    const API_URL = getApiBaseUrl();
    const res = await fetch(`${API_URL}/users/${userId}/streak`);
    if (!res.ok) throw new Error('Failed to fetch streak data');
    const data = await res.json();

    // Transform API response to Streak type
    return {
      streak_id: data.streak_id || data.id || 1,
      user_id: userId,
      trackable_type: data.trackable_type || "all",
      trackable_id: data.trackable_id || null,
      current_streak: data.current_streak || data.streak || 0,
      longest_streak: data.longest_streak || data.streak || 0,
      last_completed_date: data.last_completed_date || new Date().toISOString(),
      streak_start_date: data.streak_start_date || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching user streak:", error);

    // Return a default streak object if there's an error
    return {
      streak_id: 1,
      user_id: userId,
      trackable_type: "all",
      trackable_id: null,
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: new Date().toISOString(),
      streak_start_date: new Date().toISOString(),
    };
  }
};

/**
 * Updates a user's streak data
 * @param userId The ID of the user
 * @param streakData The updated streak data
 * @returns The updated streak data
 */
export const updateUserStreak = async (userId: string, streakData: Partial<Streak>): Promise<Streak> => {
  try {
    const API_URL = getApiBaseUrl();
    const res = await fetch(`${API_URL}/users/${userId}/streak`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(streakData),
    });

    if (!res.ok) throw new Error('Failed to update streak data');
    const data = await res.json();

    // If the API returns the updated streak, use that
    if (data.streak_id || data.id) {
      return {
        streak_id: data.streak_id || data.id,
        user_id: userId,
        trackable_type: data.trackable_type || streakData.trackable_type || "all",
        trackable_id: data.trackable_id || streakData.trackable_id || null,
        current_streak: data.current_streak || streakData.current_streak || 0,
        longest_streak: data.longest_streak || streakData.longest_streak || 0,
        last_completed_date: data.last_completed_date || streakData.last_completed_date || new Date().toISOString(),
        streak_start_date: data.streak_start_date || streakData.streak_start_date || new Date().toISOString(),
      };
    }

    // If not, return the data we sent with the update
    const existingStreak = await fetchUserStreak(userId);
    return { ...existingStreak, ...streakData };
  } catch (error) {
    console.error("Error updating user streak:", error);
    throw error;
  }
};

/**
 * Resets a user's streak to 1 (today)
 * @param userId The ID of the user
 * @returns The reset streak data
 */
export const resetUserStreak = async (userId: string): Promise<Streak> => {
  try {
    // Reset to a new streak with count 1 (today)
    const resetStreak: Partial<Streak> = {
      current_streak: 1,
      last_completed_date: new Date().toISOString(),
      streak_start_date: new Date().toISOString(),
    };

    return await updateUserStreak(userId, resetStreak);
  } catch (error) {
    console.error("Error resetting user streak:", error);
    throw error;
  }
};

/**
 * Checks if a user's streak is still active or needs to be reset/incremented
 * @param userId The ID of the user
 * @returns The updated streak data
 */
export const checkAndUpdateStreak = async (userId: string): Promise<Streak> => {
  try {
    const streakData = await fetchUserStreak(userId);
    const today = new Date();
    const lastCompletedDate = new Date(streakData.last_completed_date);
    const oneDayInMs = 24 * 60 * 60 * 1000;

    // If already completed today, just return current data
    if (today.toDateString() === lastCompletedDate.toDateString()) {
      return streakData;
    }

    // If last completion was yesterday, increment streak
    if (
      today.getTime() - lastCompletedDate.getTime() <= oneDayInMs * 2 &&
      today.toDateString() !== lastCompletedDate.toDateString()
    ) {
      // Increment streak and update last completion date
      const updatedStreak: Partial<Streak> = {
        current_streak: streakData.current_streak + 1,
        last_completed_date: today.toISOString(),
      };

      // Check if this is a new record
      if (updatedStreak.current_streak! > streakData.longest_streak) {
        updatedStreak.longest_streak = updatedStreak.current_streak;
      }

      return await updateUserStreak(userId, updatedStreak);
    }
    // If more than one day has passed, reset streak
    else if (today.getTime() - lastCompletedDate.getTime() > oneDayInMs * 2) {
      return await resetUserStreak(userId);
    }

    // If already completed today or no action needed, just return current data
    return streakData;
  } catch (error) {
    console.error("Error checking streak:", error);
    throw error;
  }
};

/**
 * Checks if the user has hit a streak milestone (7, 30, 90 days)
 * @param streakCount The current streak count
 * @returns True if the streak count is a milestone, false otherwise
 */
export const isStreakMilestone = (streakCount: number): boolean => {
  const milestones = [7, 30, 90];
  return milestones.includes(streakCount);
};