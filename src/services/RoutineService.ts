// src/services/RoutineService.ts
import { Routine } from '../types';
import { auth } from '../config/firebase';

const getApiBaseUrl = () => {
  return 'http://10.0.2.2:3001/api';
};

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
  color?: string;
  start_date?: string;
  startDate?: string;
}

// Extended Routine type that matches what HomeScreen expects
interface ExtendedRoutine extends Omit<Routine, "frequency"> {
  routine_days?: number[];
  category: string;
  isCompleted?: boolean;
  completedTasks: number;
  totalTasks: number;
  frequency?: string;
  color?: string;
}

// Fetch all routines for a user - gets daily goals and treats them as routines
export const fetchUserRoutines = async (userId: string = 'default_user'): Promise<ExtendedRoutine[]> => {
  try {
    const apiUrl = getApiBaseUrl();
    
    // Get Firebase token for authentication
    const idToken = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    
    // Use the goals endpoint but filter for daily/routine goals
    const res = await fetch(`${apiUrl}/goals?userId=${userId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch routines');
    const data = await res.json();
    
    let dailyGoals: GoalResponse[] = [];
    
    // Handle different response formats
    if (Array.isArray(data)) {
      dailyGoals = data.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    } else if (data.goals && Array.isArray(data.goals)) {
      dailyGoals = data.goals.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    }
    
    // Convert the goals to routines format that HomeScreen expects
    return dailyGoals.map(goal => {
      // Parse routine days if it's a string
      let routineDaysArray: number[] = [];
      if (goal.routine_days && typeof goal.routine_days === 'string') {
        try {
          routineDaysArray = JSON.parse(goal.routine_days);
        } catch (e) {
          console.error('Error parsing routine days:', e);
          routineDaysArray = [];
        }
      } else if (goal.routineDays && Array.isArray(goal.routineDays)) {
        routineDaysArray = goal.routineDays;
      }
      
      // If no routine days specified, default to all days
      if (routineDaysArray.length === 0) {
        routineDaysArray = [0, 1, 2, 3, 4, 5, 6]; // All days
      }
      
      // Determine frequency based on routine days
      let frequency = 'Daily';
      if (routineDaysArray.length > 0) {
        if (routineDaysArray.length === 7) {
          frequency = 'Daily';
        } else if (routineDaysArray.length === 5 && routineDaysArray.every(day => day >= 1 && day <= 5)) {
          frequency = 'Weekdays';
        } else if (routineDaysArray.length === 2 && routineDaysArray.every(day => day === 0 || day === 6)) {
          frequency = 'Weekends';
        } else {
          frequency = 'Custom';
        }
      }
      
      return {
        id: goal.goal_id || goal.id || 0,
        title: goal.title || 'Untitled Routine',
        frequency,
        routine_days: routineDaysArray, // Include the actual days array
        category: goal.category || 'Personal',
        isCompleted: goal.is_completed === 1 || goal.isCompleted === true || (goal.progress || 0) >= 100,
        completedTasks: (goal.is_completed === 1 || goal.isCompleted === true || (goal.progress || 0) >= 100) ? 1 : 0,
        totalTasks: 1,
        color: goal.color,
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
export const toggleRoutineCompletion = async (routineId: number): Promise<ExtendedRoutine | null> => {
  try {
    const apiUrl = getApiBaseUrl();
    
    // Get Firebase token for authentication
    const idToken = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    
    // Get current state
    const res = await fetch(`${apiUrl}/goals/${routineId}`, { headers });
    if (!res.ok) throw new Error('Failed to get routine state');
    const goal: GoalResponse = await res.json();
    
    // Calculate new progress - 100 if not completed, 0 if completed
    const currentProgress = goal.progress || 0;
    const isCurrentlyCompleted = goal.is_completed === 1 || goal.isCompleted === true || currentProgress >= 100;
    const newProgress = isCurrentlyCompleted ? 0 : 100;
    
    // Update goal progress
    const updateRes = await fetch(`${apiUrl}/goals/${routineId}/progress`, {
      method: 'PUT', 
      headers,
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
        console.error('Error parsing routine days:', e);
        routineDaysArray = [];
      }
    } else if (updatedGoal.routineDays && Array.isArray(updatedGoal.routineDays)) {
      routineDaysArray = updatedGoal.routineDays;
    }
    
    // If no routine days specified, default to all days
    if (routineDaysArray.length === 0) {
      routineDaysArray = [0, 1, 2, 3, 4, 5, 6]; // All days
    }
    
    // Determine frequency based on routine days
    let frequency = 'Daily';
    if (routineDaysArray.length > 0) {
      if (routineDaysArray.length === 7) {
        frequency = 'Daily';
      } else if (routineDaysArray.length === 5 && routineDaysArray.every(day => day >= 1 && day <= 5)) {
        frequency = 'Weekdays';
      } else if (routineDaysArray.length === 2 && routineDaysArray.every(day => day === 0 || day === 6)) {
        frequency = 'Weekends';
      } else {
        frequency = 'Custom';
      }
    }
    
    const isCompleted = updatedGoal.is_completed === 1 || updatedGoal.isCompleted === true || (updatedGoal.progress || 0) >= 100;
    
    return {
      id: updatedGoal.goal_id || updatedGoal.id || routineId,
      title: updatedGoal.title || 'Untitled Routine',
      frequency,
      routine_days: routineDaysArray, // Include the actual days array
      category: updatedGoal.category || 'Personal',
      isCompleted,
      completedTasks: isCompleted ? 1 : 0,
      totalTasks: 1,
      color: updatedGoal.color,
      icon: null,
    };
  } catch (err) {
    console.error('Error toggling routine completion:', err);
    throw err;
  }
};

// Get today's routines (daily goals scheduled for today)
export const getTodaysRoutines = async (userId: string = 'default_user'): Promise<ExtendedRoutine[]> => {
  try {
    const apiUrl = getApiBaseUrl();
    
    // Get Firebase token for authentication
    const idToken = await auth.currentUser?.getIdToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    
    // Use the goals/today endpoint to get today's goals
    const res = await fetch(`${apiUrl}/goals/today?userId=${userId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch today\'s routines');
    const data = await res.json();
    
    let todayGoals: GoalResponse[] = [];
    
    // Handle different response formats
    if (Array.isArray(data)) {
      todayGoals = data.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    } else if (data.goals && Array.isArray(data.goals)) {
      todayGoals = data.goals.filter(goal => goal.is_daily === 1 || goal.isDaily === true);
    }
    
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Filter for routines that should be active today
    const activeTodayRoutines = todayGoals.filter(goal => {
      // Parse routine days
      let routineDaysArray: number[] = [];
      if (goal.routine_days && typeof goal.routine_days === 'string') {
        try {
          routineDaysArray = JSON.parse(goal.routine_days);
        } catch (e) {
          console.error('Error parsing routine days:', e);
          routineDaysArray = [];
        }
      } else if (goal.routineDays && Array.isArray(goal.routineDays)) {
        routineDaysArray = goal.routineDays;
      }
      
      // If no routine days specified, default to all days
      if (routineDaysArray.length === 0) {
        routineDaysArray = [0, 1, 2, 3, 4, 5, 6]; // All days
      }
      
      // Check if today is in the routine days
      return routineDaysArray.includes(today);
    });
    
    // Convert the goals to routines format
    return activeTodayRoutines.map(goal => {
      // Parse routine days
      let routineDaysArray: number[] = [];
      if (goal.routine_days && typeof goal.routine_days === 'string') {
        try {
          routineDaysArray = JSON.parse(goal.routine_days);
        } catch (e) {
          console.error('Error parsing routine days:', e);
          routineDaysArray = [];
        }
      } else if (goal.routineDays && Array.isArray(goal.routineDays)) {
        routineDaysArray = goal.routineDays;
      }
      
      // If no routine days specified, default to all days
      if (routineDaysArray.length === 0) {
        routineDaysArray = [0, 1, 2, 3, 4, 5, 6]; // All days
      }
      
      // Determine frequency based on routine days
      let frequency = 'Daily';
      if (routineDaysArray.length > 0) {
        if (routineDaysArray.length === 7) {
          frequency = 'Daily';
        } else if (routineDaysArray.length === 5 && routineDaysArray.every(day => day >= 1 && day <= 5)) {
          frequency = 'Weekdays';
        } else if (routineDaysArray.length === 2 && routineDaysArray.every(day => day === 0 || day === 6)) {
          frequency = 'Weekends';
        } else {
          frequency = 'Custom';
        }
      }
      
      const isCompleted = goal.is_completed === 1 || goal.isCompleted === true || (goal.progress || 0) >= 100;
      
      return {
        id: goal.goal_id || goal.id || 0,
        title: goal.title || 'Untitled Routine',
        frequency,
        routine_days: routineDaysArray, // Include the actual days array
        category: goal.category || 'Personal',
        isCompleted,
        completedTasks: isCompleted ? 1 : 0,
        totalTasks: 1,
        color: goal.color,
        icon: null,
      };
    });
  } catch (err) {
    console.error('Error fetching today\'s routines:', err);
    return [];
  }
};

// Helper function to determine if a routine should be active today
export const isRoutineActiveToday = (routine: ExtendedRoutine): boolean => {
  const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Check routine_days array if available
  if (routine.routine_days && Array.isArray(routine.routine_days)) {
    return routine.routine_days.includes(today);
  }
  
  // Fall back to frequency-based logic
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