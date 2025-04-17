// types/goal.ts

export interface Goal {
  id: number;
  user_id: string;
  title: string;
  description?: string;
  target_date?: string;
  progress: number;
  isCompleted: boolean;
  category?: string;
  coin_reward: number;
  color?: string;
  isDaily?: boolean;
  created_at?: string;
}

export interface Routine {
  id: number;
  user_id: string;
  title: string;
  description?: string;
  frequency: string; // 'daily', 'weekly', 'custom'
  category?: string;
  color?: string;
  created_at: string;
  
  // UI helper properties
  completedTasks?: number;
  totalTasks?: number;
}

export interface Quote {
  id?: number;
  text: string;
  author?: string;
  created_at?: string;
}

export interface News {
  id: number;
  title: string;
  summary?: string;
  image_url?: string;
  source_url?: string;
  published_date?: string;
  category?: string;
  created_at?: string;
}

export interface Streak {
  id?: number;
  user_id: string;
  trackable_type: 'goal' | 'routine';
  trackable_id: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date?: string;
  streak_start_date?: string;
}

export interface Badge {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  requirement_type: string; // 'streak', 'goal_count', 'routine_count'
  requirement_value: number;
  coins_reward: number;
  created_at?: string;
}

export interface ShopItem {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  category: string; // 'theme', 'avatar', 'badge', 'feature'
  price: number;
  is_active: boolean;
  created_at?: string;
}

export interface UserItem {
  id?: number;
  user_id: string;
  item_id: number;
  purchase_date: string;
  is_equipped: boolean;
}

export interface CoinTransaction {
  id?: number;
  user_id: string;
  amount: number; // Positive for earned, negative for spent
  transaction_type: string; // 'goal_completion', 'routine_completion', 'purchase', 'badge_reward'
  reference_id?: number; // ID of related entity (goal_id, routine_id, etc.)
  reference_type?: string; // 'goal', 'routine', 'item', 'badge'
  transaction_date: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string;
  created_at?: string;
}