import { Goal, SubGoal } from '../types';

// This is a mock service. In a real app, this would connect to your backend API
export const fetchUserGoals = async (): Promise<Goal[]> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // Mock data
  return [
    {
      id: 1,
      title: "Complete English Asignment",
      description: "Master Spanish lvl 1",
      startDate: "2025-03-01",
      endDate: "2025-06-30",
      progress: 45,
      category: "Learning",
      isCompleted: false,
      color: "#5E6CE7",
      subgoals: [
        {
          id: 101,
          goalId: 1,
          title: "Complete basic tutorial",
          isCompleted: true,
          dueDate: "2025-03-15"
        },
        {
          id: 102,
          goalId: 1,
          title: "able to say a sentence",
          isCompleted: true,
          dueDate: "2025-04-01"
        },
        {
          id: 103,
          goalId: 1,
          title: "Learn advance words",
          isCompleted: false,
          dueDate: "2025-05-15"
        }
      ]
    },
    {
      id: 2,
      title: "Fix DoorKnob",
      description: "fix broke door handle",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      progress: 65,
      category: "Repair",
      isCompleted: false,
      color: "#56C3B6",
      subgoals: [
        {
          id: 201,
          goalId: 2,
          title: "Monday workout",
          isCompleted: true,
          dueDate: "2025-04-08"
        },
        {
          id: 202,
          goalId: 2,
          title: "Wednesday workout",
          isCompleted: true,
          dueDate: "2025-04-10"
        },
        {
          id: 203,
          goalId: 2,
          title: "Friday workout",
          isCompleted: false,
          dueDate: "2025-04-12"
        }
      ]
    },
    {
      id: 3,
      title: "Read 20 pages",
      description: "Set aside time to read",
      startDate: "2025-01-01",
      endDate: "2025-07-31",
      progress: 30,
      category: "Learning",
      isCompleted: false,
      color: "#5E6CE7",
    }
  ];
};

// Function to get a specific goal
export const fetchGoalById = async (goalId: number): Promise<Goal | null> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Get all goals first
  const allGoals = await fetchUserGoals();
  
  // Find and return the specific goal
  return allGoals.find(goal => goal.id === goalId) || null;
};

// Function to create a new goal
export const createGoal = async (goalData: Partial<Goal>): Promise<Goal> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock response with generated ID
  return {
    id: Math.floor(Math.random() * 1000) + 10, // Generate random ID
    title: goalData.title || "New Goal",
    description: goalData.description || "",
    startDate: goalData.startDate || new Date().toISOString().split('T')[0],
    endDate: goalData.endDate,
    progress: 0,
    category: goalData.category || "Personal",
    isCompleted: false,
    color: goalData.color || "#F66E6E",
    subgoals: [],
  };
};

// Function to update a goal's progress
export const updateGoalProgress = async (
  goalId: number,
  progress: number
): Promise<Goal | null> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Get the specific goal
  const goal = await fetchGoalById(goalId);
  
  if (!goal) return null;
  
  // Update the progress
  const updatedGoal = {
    ...goal,
    progress: Math.min(Math.max(progress, 0), 100), // Ensure progress is between 0-100
    isCompleted: progress >= 100,
  };
  
  // In a real app, this would update the backend
  console.log(`Goal ${goalId} progress updated to ${progress}%`);
  
  return updatedGoal;
};

// Function to add a subgoal
export const addSubGoal = async (
  goalId: number,
  subGoalData: Partial<SubGoal>
): Promise<SubGoal> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 400));
  
  // Mock response with generated ID
  return {
    id: Math.floor(Math.random() * 1000) + 100, // Generate random ID
    goalId: goalId,
    title: subGoalData.title || "New Subgoal",
    isCompleted: false,
    dueDate: subGoalData.dueDate,
  };
};

// Function to toggle a subgoal's completion status
export const toggleSubGoalCompletion = async (
  subGoalId: number
): Promise<boolean> => {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // In a real app, this would update the backend
  console.log(`Subgoal ${subGoalId} completion toggled`);
  
  return true;
};