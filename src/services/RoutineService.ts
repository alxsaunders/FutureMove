// src/services/RoutineService.ts
import { Routine } from '../types';

const API_URL = 'http://10.0.2.2:3001/api'; // Emulator localhost

// Helper type for API response
interface GoalResponse {
  goal_id?: number;
  id?: number;
  title: string;
  description?: string;
  is_daily?: number;
  isDaily?: boolean;
  is_completed?: number;
  isCompleted?: boolean;
  progress?: number;
  routine_days?: string;
  routineDays?: number[];
  category?: string;
}

// Fetch all routines for a user - actually gets daily goals and treats them as routines
export const fetchUserRoutines = async (userId: string = 'default_user'): Promise<Routine[]> => {
  try {
    // Use the goals endpoint but filter for daily/routine goals
    const res = await fetch(`${API_URL}/goals?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch routines');
    const data = await res.json();
    
    let dailyGoals: GoalResponse[] = [];
    
    // Handle different response formats
    if (Array.isArray(data)) {
      dailyGoals = data.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    } else if (data.goals && Array.isArray(data.goals)) {
      dailyGoals = data.goals.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    }
    
    // Convert the goals to routines format
    return dailyGoals.map(goal => {
      // Parse routine days if it's a string
      let routineDaysArray: number[] = [];
      if (goal.routine_days && typeof goal.routine_days === 'string') {
        try {
          routineDaysArray = JSON.parse(goal.routine_days);
        } catch (e) {
          routineDaysArray = [];
        }
      } else if (goal.routineDays && Array.isArray(goal.routineDays)) {
        routineDaysArray = goal.routineDays;
      }
      
      // Determine frequency based on routine days
      let frequency = 'Daily';
      if (routineDaysArray.length > 0) {
        if (routineDaysArray.length === 7) {
          frequency = 'Daily';
        } else if (routineDaysArray.every(day => day >= 1 && day <= 5)) {
          frequency = 'Weekdays';
        } else if (routineDaysArray.every(day => day === 0 || day === 6)) {
          frequency = 'Weekends';
        } else {
          frequency = 'Custom';
        }
      }
      
      return {
        id: goal.goal_id || goal.id || 0,
        title: goal.title || 'Untitled Routine',
        frequency,
        completedTasks: (goal.is_completed === 1 || goal.isCompleted === true) ? 1 : 0,
        totalTasks: 1,
        icon: null,
      };
    });
  } catch (err) {
    console.error('Error fetching user routines:', err);
    // Return empty array to prevent app crashes
    return [];
  }
};

// Toggle routine completion by updating the goal progress
export const toggleRoutineCompletion = async (routineId: number): Promise<Routine | null> => {
  try {
    // Get current state
    const res = await fetch(`${API_URL}/goals/${routineId}`);
    if (!res.ok) throw new Error('Failed to get routine state');
    const goal: GoalResponse = await res.json();
    
    // Calculate new progress - 100 if not completed, 0 if completed
    const newProgress = goal.is_completed === 1 || goal.isCompleted === true ? 0 : 100;
    
    // Update goal progress
    const updateRes = await fetch(`${API_URL}/goals/${routineId}/progress`, {
      method: 'PUT', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: newProgress }),
    });
    
    if (!updateRes.ok) throw new Error('Failed to toggle routine completion');
    const updatedGoal: GoalResponse = await updateRes.json();
    
    // Parse routine days
    let routineDaysArray: number[] = [];
    if (updatedGoal.routine_days && typeof updatedGoal.routine_days === 'string') {
      try {
        routineDaysArray = JSON.parse(updatedGoal.routine_days);
      } catch (e) {
        routineDaysArray = [];
      }
    } else if (updatedGoal.routineDays && Array.isArray(updatedGoal.routineDays)) {
      routineDaysArray = updatedGoal.routineDays;
    }
    
    // Determine frequency based on routine days
    let frequency = 'Daily';
    if (routineDaysArray.length > 0) {
      if (routineDaysArray.length === 7) {
        frequency = 'Daily';
      } else if (routineDaysArray.every(day => day >= 1 && day <= 5)) {
        frequency = 'Weekdays';
      } else if (routineDaysArray.every(day => day === 0 || day === 6)) {
        frequency = 'Weekends';
      } else {
        frequency = 'Custom';
      }
    }
    
    return {
      id: updatedGoal.goal_id || updatedGoal.id || routineId,
      title: updatedGoal.title || 'Untitled Routine',
      frequency,
      completedTasks: (updatedGoal.is_completed === 1 || updatedGoal.isCompleted === true) ? 1 : 0,
      totalTasks: 1,
      icon: null,
    };
  } catch (err) {
    console.error('Error toggling routine completion:', err);
    throw err;
  }
};

// Get today's routines (daily goals scheduled for today)
export const getTodaysRoutines = async (userId: string = 'default_user'): Promise<Routine[]> => {
  try {
    // Use the goals/today endpoint to get today's goals
    const res = await fetch(`${API_URL}/goals/today?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch today\'s routines');
    const data = await res.json();
    
    let todayGoals: GoalResponse[] = [];
    
    // Handle different response formats
    if (Array.isArray(data)) {
      todayGoals = data.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    } else if (data.goals && Array.isArray(data.goals)) {
      todayGoals = data.goals.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    }
    
    // Convert the goals to routines format
    return todayGoals.map(goal => {
      // Parse routine days
      let routineDaysArray: number[] = [];
      if (goal.routine_days && typeof goal.routine_days === 'string') {
        try {
          routineDaysArray = JSON.parse(goal.routine_days);
        } catch (e) {
          routineDaysArray = [];
        }
      } else if (goal.routineDays && Array.isArray(goal.routineDays)) {
        routineDaysArray = goal.routineDays;
      }
      
      // Determine frequency based on routine days
      let frequency = 'Daily';
      if (routineDaysArray.length > 0) {
        if (routineDaysArray.length === 7) {
          frequency = 'Daily';
        } else if (routineDaysArray.every(day => day >= 1 && day <= 5)) {
          frequency = 'Weekdays';
        } else if (routineDaysArray.every(day => day === 0 || day === 6)) {
          frequency = 'Weekends';
        } else {
          frequency = 'Custom';
        }
      }
      
      return {
        id: goal.goal_id || goal.id || 0,
        title: goal.title || 'Untitled Routine',
        frequency,
        completedTasks: (goal.is_completed === 1 || goal.isCompleted === true) ? 1 : 0,
        totalTasks: 1,
        icon: null,
      };
    });
  } catch (err) {
    console.error('Error fetching today\'s routines:', err);
    return [];
  }
};

// Helper function to determine if a routine should be active today
export const isRoutineActiveToday = (routine: Routine): boolean => {
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  switch (routine.frequency) {
    case 'Daily':
      return true;
    case 'Weekdays':
      return today >= 1 && today <= 5; // Monday to Friday
    case 'Weekends':
      return today === 0 || today === 6; // Sunday or Saturday
    default:
      return true;
  }
};