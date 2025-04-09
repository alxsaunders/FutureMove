import { Routine } from '../types';

// This is a mock service. In a real app, this would connect to your backend API
export const fetchUserRoutines = async (): Promise<Routine[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock data
  return [
    {
      id: 1,
      title: 'Morning Workout',
      frequency: 'Daily',
      completedTasks: 2,
      totalTasks: 3,
      icon: null, // Will use default icon
    },
    {
      id: 2,
      title: 'Study Session',
      frequency: 'Weekdays',
      completedTasks: 1,
      totalTasks: 2,
      icon: null,
    },
    {
      id: 3,
      title: 'Evening Meditation',
      frequency: 'Daily',
      completedTasks: 1,
      totalTasks: 1,
      icon: null,
    },
  ];
};

// Function to toggle routine completion
export const toggleRoutineCompletion = async (
  routineId: number
): Promise<Routine> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In a real app, this would update the backend
  // For now, we just return a mock updated routine
  return {
    id: routineId,
    title: 'Morning Workout',
    frequency: 'Daily',
    completedTasks: 3, // Updated to show completion
    totalTasks: 3,
    icon: null,
  };
};

// Function to create a new routine
export const createRoutine = async (routineData: Partial<Routine>): Promise<Routine> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock response with generated ID
  return {
    id: Math.floor(Math.random() * 1000) + 10, // Generate random ID
    title: routineData.title || 'New Routine',
    frequency: routineData.frequency || 'Daily',
    completedTasks: 0,
    totalTasks: routineData.totalTasks || 1,
    icon: routineData.icon || null,
  };
};

// Function to update a routine
export const updateRoutine = async (
  routineId: number,
  routineData: Partial<Routine>
): Promise<Routine> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock updated routine
  return {
    id: routineId,
    title: routineData.title || 'Updated Routine',
    frequency: routineData.frequency || 'Daily',
    completedTasks: routineData.completedTasks || 0,
    totalTasks: routineData.totalTasks || 1,
    icon: routineData.icon || null,
  };
};

// Function to delete a routine
export const deleteRoutine = async (routineId: number): Promise<boolean> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock successful deletion
  return true;
};