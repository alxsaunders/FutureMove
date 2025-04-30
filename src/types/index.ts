// Type definitions for the FutureMove app

// User-related types
export interface User {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
  futureCoins: number;
  level: number;
  experience: number;
  joinedDate: string;
}
export interface Streak {
  streak_id: number;
  user_id: string;
  trackable_type: string;  // 'all', 'goal', 'routine'
  trackable_id: number | null;  // null for 'all', ID of goal/routine otherwise
  current_streak: number;
  longest_streak: number;
  last_completed_date: string;  // ISO date string
  streak_start_date: string;    // ISO date string
}

export interface Quote {
  id?: number;       // Local ID for saved quotes
  quote: string;     // The quote text (API returns as "quote")
  text?: string;     // Alternative field name for quote content
  author: string;    // The author of the quote
  category?: string; // Optional category from the API
  savedAt?: string;  // Timestamp for when the quote was saved as favorite
}
// Goal-related types
export interface Goal {
  id: number;
  title: string;
  description?: string;
  category?: string;
  color?: string;
  isCompleted: boolean;
  isDaily: boolean;
  progress: number;
  startDate?: string;
  targetDate?: string;
  userId: string;
  coinReward?: number;
  routineDays?: number[];
  type?: 'one-time' | 'recurring';
  lastCompleted?: string; // ISO date string of when the goal was last completed
}

export interface SubGoal {
  id: number;
  goalId: number;
  title: string;
  isCompleted: boolean;
  dueDate?: string;
}

// Routine-related types
export interface Routine {
  id: number;
  title: string;
  frequency: string; // e.g., "Daily", "Weekdays", "Weekends", "Weekly", "Monthly"
  completedTasks: number;
  totalTasks: number;
  icon?: string | null;
  category?: string;
}

// Community-related types
export interface Community {
  id: number;
  name: string;
  description: string;
  memberCount: number;
  category: string;
  image?: string;
}

export interface CommunityPost {
  id: number;
  communityId: number;
  userId: string;
  username: string;
  userImage?: string;
  content: string;
  timestamp: string;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
}

// News and quotes
export interface News {
  id: number;
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  imageUrl?: string;
  category: string;
}


// Achievement and Rewards
export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  isUnlocked: boolean;
  unlockedDate?: string;
  rewardCoins: number;
}

export interface ShopItem {
  id: number;
  title: string;
  description: string;
  category: string; // "theme", "avatar", "badge", "feature"
  price: number; // in FutureCoins
  image: string;
  isOwned: boolean;
  isEquipped: boolean;
}

// Streak tracking types
export interface StreakInfo {
  userId: string;
  goalId?: number;
  routineId?: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate?: string;
  startDate?: string;
}

// Coin transaction type
export interface CoinTransaction {
  id: number;
  userId: string;
  amount: number; // Positive for earned, negative for spent
  source: string; // "goal_completion", "routine_completion", "purchase", "achievement"
  referenceId?: number;
  timestamp: string;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Goals: undefined;
  GoalDetail: { goalId: number };
  Communities: undefined;
  CommunityDetail: { communityId: number };
  Profile: undefined;
  ItemShop: undefined;
  Settings: undefined;
  Authentication: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Onboarding: undefined;
};