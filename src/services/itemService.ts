// services/itemService.ts
import { Platform } from 'react-native';

// Debug flag - set to true to enable detailed logging
const DEBUG_SHOP = true;

// Types
export interface Item {
  item_id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  price: number;
  is_active: number;
  created_at?: string;
}

export interface UserItem extends Item {
  user_item_id: number;
  user_id: string;
  purchased_at: string;
  is_equipped: number;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  futureCoins?: number;
}

export interface ToggleResponse {
  success: boolean;
  message: string;
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
  success?: boolean;
  message?: string;
}

// Utility function for logging
const logDebug = (message: string, data?: any) => {
  if (DEBUG_SHOP) {
    if (data) {
      console.log(`[SHOP CLIENT] ${message}`, data);
    } else {
      console.log(`[SHOP CLIENT] ${message}`);
    }
  }
};

// API Base URL - use environment variable if available
export const getApiBaseUrl = (): string => {
  logDebug("Getting API base URL");

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return 'http://192.168.1.207:3001/api';
  }
};

// Fetch all available shop items
export const fetchShopItems = async (): Promise<Item[]> => {
  try {
    logDebug("Fetching shop items");
    // IMPORTANT: Use /items instead of /shop/items because of the new route pattern
    const response = await fetch(`${getApiBaseUrl()}/items`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    logDebug(`Shop items received: ${data.length}`);
    return data;
  } catch (error) {
    console.error('Error fetching shop items:', error);
    logDebug(`Error fetching items: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

// Fetch user's purchased items
export const fetchUserItems = async (userId: string): Promise<UserItem[]> => {
  try {
    logDebug(`Fetching items for user: ${userId}`);
    // IMPORTANT: Use /items/user/:userId instead of /users/:userId/items
    const response = await fetch(`${getApiBaseUrl()}/items/user/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    logDebug(`User items received: ${data.length}`);
    return data;
  } catch (error) {
    console.error('Error fetching user items:', error);
    logDebug(`Error fetching user items: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

// Fetch user's FutureCoins
export const fetchUserFutureCoins = async (userId: string): Promise<number> => {
  try {
    logDebug(`Fetching FutureCoins for user: ${userId}`);
    // IMPORTANT: Use /items/coins/:userId instead of /users/:userId/futurecoins
    const response = await fetch(`${getApiBaseUrl()}/items/coins/${userId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    logDebug(`Received FutureCoins: ${data.futureCoins}`);
    return data.futureCoins;
  } catch (error) {
    console.error('Error fetching FutureCoins:', error);
    logDebug(`Error fetching coins: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

// Purchase an item
export const purchaseItem = async (userId: string, itemId: number): Promise<PurchaseResponse> => {
  try {
    logDebug(`Purchasing item ${itemId} for user ${userId}`);
    // IMPORTANT: Use /items/purchase/:userId/:itemId instead of /users/:userId/purchase/:itemId
    const response = await fetch(`${getApiBaseUrl()}/items/purchase/${userId}/${itemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    logDebug(`Purchase response:`, result);
    return result;
  } catch (error) {
    console.error('Error purchasing item:', error);
    logDebug(`Error purchasing: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, message: 'An unexpected error occurred' };
  }
};

// Toggle item equipped status
export const toggleItemEquipped = async (userId: string, itemId: number): Promise<ToggleResponse> => {
  try {
    logDebug(`Toggling item ${itemId} equipped status for user ${userId}`);
    // IMPORTANT: Use /items/toggle/:userId/:itemId instead of /users/:userId/items/:itemId/toggle
    const response = await fetch(`${getApiBaseUrl()}/items/toggle/${userId}/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    logDebug(`Toggle response:`, result);
    return result;
  } catch (error) {
    console.error('Error toggling item equipped status:', error);
    logDebug(`Error toggling: ${error instanceof Error ? error.message : String(error)}`);
    return { success: false, message: 'An unexpected error occurred' };
  }
};

// Update user's FutureCoins
export const updateUserFutureCoins = async (userId: string, amount: number): Promise<number> => {
  try {
    logDebug(`Updating user ${userId} FutureCoins by ${amount}`);
    // IMPORTANT: Use /items/coins/:userId instead of /users/:userId/futurecoins
    const response = await fetch(`${getApiBaseUrl()}/items/coins/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    logDebug(`Update coins response:`, data);
    return data.futureCoins;
  } catch (error) {
    console.error('Error updating FutureCoins:', error);
    logDebug(`Error updating coins: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

// Utility functions
export const isItemOwned = (userItems: UserItem[], itemId: number): boolean => {
  return userItems.some(item => item.item_id === itemId);
};

export const canAffordItem = (futureCoins: number, price: number): boolean => {
  return futureCoins >= price;
};

export const getCategoryColor = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'theme':
      return '#4A6572';
    case 'avatar':
      return '#F9A826';
    case 'badge':
      return '#6A0DAD';
    case 'feature':
      return '#388E3C';
    default:
      return '#2196F3';
  }
};

export const getCategoryLabel = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'theme':
      return 'App Theme';
    case 'avatar':
      return 'Profile Avatar';
    case 'badge':
      return 'Profile Badge';
    case 'feature':
      return 'Special Feature';
    default:
      return category;
  }
};

// Find equipped item in a category
export const getEquippedItemInCategory = (userItems: UserItem[], category: string): UserItem | undefined => {
  return userItems.find(item => item.category.toLowerCase() === category.toLowerCase() && item.is_equipped === 1);
};

// Group items by category
export const groupItemsByCategory = (items: Item[]): Record<string, Item[]> => {
  return items.reduce((groups, item) => {
    const category = item.category.toLowerCase();
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {} as Record<string, Item[]>);
};

// Get the equipped items for each category
export const getEquippedItems = (userItems: UserItem[]): Record<string, UserItem> => {
  return userItems.reduce((result, item) => {
    if (item.is_equipped === 1) {
      result[item.category.toLowerCase()] = item;
    }
    return result;
  }, {} as Record<string, UserItem>);
};