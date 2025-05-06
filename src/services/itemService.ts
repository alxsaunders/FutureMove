import { Platform } from 'react-native';
import { auth } from '../config/firebase.js';

// Use a more React Native compatible error handling approach
// instead of directly importing DOMException which might not be available
const createAbortError = () => {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
};

// Define item interfaces
export interface Item {
  item_id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  price: number;
  is_active: number;
  created_at: string;
}

export interface UserItem extends Item {
  is_equipped: number;
  purchased_at: string;
}

// Get API base URL based on platform with error handling
export const getApiBaseUrl = () => {
  try {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3001/api";
    } else {
      // For iOS or development on Mac
      return "http://localhost:3001/api";
    }
  } catch (error) {
    console.error("Error determining API base URL:", error);
    // Return a fallback URL to prevent crashes
    return "http://localhost:3001/api";
  }
};

// Helper function to get current user ID from Firebase
export const getCurrentUserId = async (): Promise<string> => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return currentUser.uid;
    }
    throw new Error('No authenticated user found');
  } catch (error) {
    console.error("Error getting current user ID:", error);
    throw error;
  }
};

// Transform raw item data to ensure it matches the Item interface
const transformItem = (item: any): Item | null => {
  // First, check if we have a valid item object with required fields
  if (!item || typeof item !== 'object') {
    console.warn('Invalid item object received:', item);
    return null;
  }

  // Check for the most essential fields
  if (!item.item_id && !item.id) {
    console.warn('Item missing ID field:', item);
    return null;
  }

  // Extract all the fields with proper fallbacks
  try {
    const transformedItem: Item = {
      item_id: item.item_id || item.id,
      name: item.name || 'Unnamed Item',
      description: item.description || '',
      image_url: item.image_url || null,
      category: item.category || 'misc',
      price: typeof item.price === 'number' ? item.price : 0,
      is_active: item.is_active === 1 || item.is_active === true ? 1 : 0,
      created_at: item.created_at || new Date().toISOString()
    };

    return transformedItem;
  } catch (error) {
    console.error('Error transforming item data:', error);
    return null;
  }
};

// Transform raw user item data
const transformUserItem = (item: any): UserItem | null => {
  // First transform as standard item
  const baseItem = transformItem(item);
  if (!baseItem) return null;

  // Then add user item specific fields
  try {
    return {
      ...baseItem,
      is_equipped: item.is_equipped === 1 || item.is_equipped === true ? 1 : 0,
      purchased_at: item.purchased_at || new Date().toISOString()
    };
  } catch (error) {
    console.error('Error transforming user item data:', error);
    return null;
  }
};

// Get all available items in the shop
export const fetchShopItems = async (): Promise<Item[]> => {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/items`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (data.items && Array.isArray(data.items)) {
      // Transform items and filter out any null values (invalid items)
      const validItems = data.items.map(transformItem).filter(item => item !== null) as Item[];
      console.log(`Fetched ${validItems.length} valid items from ${data.items.length} total items`);
      return validItems;
    } else if (Array.isArray(data)) {
      // Transform items and filter out any null values (invalid items)
      const validItems = data.map(transformItem).filter(item => item !== null) as Item[];
      console.log(`Fetched ${validItems.length} valid items from ${data.length} total items`);
      return validItems;
    }
    
    // If no valid format is found
    console.warn('Invalid format for items data:', data);
    return [];
  } catch (err: unknown) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for items timed out');
    } else {
      console.error('Error fetching shop items:', err);
    }
    return [];
  }
};

// Get user's purchased items
export const fetchUserItems = async (userId?: string): Promise<UserItem[]> => {
  try {
    // Get current user ID if not provided
    let uid: string;
    if (!userId) {
      try {
        uid = await getCurrentUserId();
      } catch (authError) {
        console.warn('Failed to get user ID:', authError);
        return [];
      }
    } else {
      uid = userId;
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch(`${apiUrl}/users/${uid}/items`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (data.items && Array.isArray(data.items)) {
      // Transform user items and filter out any null values
      const validItems = data.items.map(transformUserItem).filter(item => item !== null) as UserItem[];
      console.log(`Fetched ${validItems.length} valid user items from ${data.items.length} total items`);
      return validItems;
    } else if (Array.isArray(data)) {
      // Transform user items and filter out any null values
      const validItems = data.map(transformUserItem).filter(item => item !== null) as UserItem[];
      console.log(`Fetched ${validItems.length} valid user items from ${data.length} total items`);
      return validItems;
    }
    
    // If no valid format is found
    console.warn('Invalid format for user items data:', data);
    return [];
  } catch (err: unknown) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for items timed out');
    } else {
      console.error('Error fetching user items:', err);
    }
    return [];
  }
};

// Purchase an item
export const purchaseItem = async (itemId: number): Promise<{
  success: boolean;
  message: string;
  futureCoins?: number;
}> => {
  try {
    // Get current user ID
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID for purchase:', authError);
      return { success: false, message: 'Authentication required to purchase items' };
    }
    
    console.log(`Attempting to purchase item ${itemId} for user ${userId}`);
    
    // Validate item ID
    if (!itemId || isNaN(Number(itemId))) {
      console.warn(`Invalid item ID for purchase: ${itemId}`);
      return { success: false, message: 'Invalid item ID' };
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    // Make purchase request
    const apiUrl = getApiBaseUrl();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch(`${apiUrl}/users/${userId}/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ itemId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response status codes
    if (res.status === 400) {
      const errorData = await res.json();
      console.warn('Purchase error 400:', errorData);
      return { 
        success: false, 
        message: errorData.error || 'Failed to purchase item'
      };
    }
    
    if (res.status === 404) {
      console.warn(`Item not found with ID: ${itemId}`);
      return { success: false, message: 'Item not found' };
    }
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return { success: false, message: 'Failed to purchase item. Please try again.' };
    }
    
    // Parse successful response
    try {
      const data = await res.json();
      console.log(`Successfully purchased item ${itemId}`, data);
      return {
        success: true,
        message: data.message || 'Item purchased successfully',
        futureCoins: data.futureCoins
      };
    } catch (parseError) {
      console.error('Error parsing purchase response:', parseError);
      return { success: true, message: 'Item purchased, but failed to get updated coins' };
    }
  } catch (err: unknown) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for purchase timed out');
      return { success: false, message: 'Purchase request timed out. Please try again.' };
    } else {
      console.error('Error purchasing item:', err);
      return { success: false, message: 'Failed to purchase item due to network error' };
    }
  }
};

// Rest of the code remains functionally the same with the same error handling pattern
// for the remaining functions...

// Toggle an item's equipped status
export const toggleItemEquipped = async (itemId: number): Promise<{
  success: boolean;
  message: string;
  isEquipped?: boolean;
}> => {
  try {
    // Get current user ID
    let userId: string;
    try {
      userId = await getCurrentUserId();
    } catch (authError) {
      console.warn('Failed to get user ID for toggle:', authError);
      return { success: false, message: 'Authentication required to equip items' };
    }
    
    console.log(`Attempting to toggle equipped status for item ${itemId}`);
    
    // Validate item ID
    if (!itemId || isNaN(Number(itemId))) {
      console.warn(`Invalid item ID for toggle: ${itemId}`);
      return { success: false, message: 'Invalid item ID' };
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    // Make toggle request
    const apiUrl = getApiBaseUrl();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch(`${apiUrl}/users/${userId}/items/${itemId}/toggle`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response status codes
    if (res.status === 404) {
      console.warn(`Item not found with ID: ${itemId}`);
      return { success: false, message: 'Item not found in your inventory' };
    }
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      return { success: false, message: 'Failed to toggle item. Please try again.' };
    }
    
    // Parse successful response
    try {
      const data = await res.json();
      console.log(`Successfully toggled item ${itemId}`, data);
      return {
        success: true,
        message: data.message || 'Item status updated',
        isEquipped: data.isEquipped
      };
    } catch (parseError) {
      console.error('Error parsing toggle response:', parseError);
      return { success: true, message: 'Item status updated successfully' };
    }
  } catch (err: unknown) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for toggle timed out');
      return { success: false, message: 'Request timed out. Please try again.' };
    } else {
      console.error('Error toggling item:', err);
      return { success: false, message: 'Failed to update item due to network error' };
    }
  }
};

// Get user's equipped items
export const getEquippedItems = async (userId?: string): Promise<UserItem[]> => {
  try {
    // Fetch all user items first
    const userItems = await fetchUserItems(userId);
    
    // Filter to get only equipped items
    return userItems.filter(item => item.is_equipped === 1);
  } catch (error) {
    console.error('Error getting equipped items:', error);
    return [];
  }
};

// Get equipped item in a specific category
export const getEquippedItemByCategory = async (category: string, userId?: string): Promise<UserItem | null> => {
  try {
    // Fetch all user items first
    const userItems = await fetchUserItems(userId);
    
    // Find the equipped item in the specified category
    return userItems.find(item => 
      item.category === category && item.is_equipped === 1
    ) || null;
  } catch (error) {
    console.error(`Error getting equipped item for category ${category}:`, error);
    return null;
  }
};

// Get item details by ID
export const getItemById = async (itemId: number): Promise<Item | null> => {
  try {
    // Validate item ID
    if (!itemId || isNaN(Number(itemId))) {
      console.warn(`Invalid item ID: ${itemId}`);
      return null;
    }
    
    // First check if it's in user items
    try {
      const userItems = await fetchUserItems();
      const userItem = userItems.find(item => item.item_id === itemId);
      if (userItem) return userItem;
    } catch (userItemsError) {
      console.warn('Failed to check user items:', userItemsError);
      // Continue to check shop items
    }
    
    // If not found in user items, check shop items
    try {
      const shopItems = await fetchShopItems();
      return shopItems.find(item => item.item_id === itemId) || null;
    } catch (shopItemsError) {
      console.warn('Failed to check shop items:', shopItemsError);
      return null;
    }
  } catch (error) {
    console.error(`Error getting item by ID ${itemId}:`, error);
    return null;
  }
};

// Check if user owns a specific item
export const checkIfUserOwnsItem = async (itemId: number, userId?: string): Promise<boolean> => {
  try {
    // Get user items
    const userItems = await fetchUserItems(userId);
    
    // Check if the item is in the user's inventory
    return userItems.some(item => item.item_id === itemId);
  } catch (error) {
    console.error(`Error checking if user owns item ${itemId}:`, error);
    return false;
  }
};

// Get user's future coins balance
export const getUserFutureCoins = async (userId?: string): Promise<number> => {
  try {
    // Get current user ID if not provided
    let uid: string;
    if (!userId) {
      try {
        uid = await getCurrentUserId();
      } catch (authError) {
        console.warn('Failed to get user ID for coins:', authError);
        return 0;
      }
    } else {
      uid = userId;
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const res = await fetch(`${apiUrl}/users/${uid}/futurecoins`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error fetching future coins: ${res.status} ${res.statusText}`);
      return 0;
    }
    
    const data = await res.json();
    return data.futureCoins || 0;
  } catch (err: unknown) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for coins timed out');
    } else {
      console.error('Error fetching future coins:', err);
    }
    return 0;
  }
};

// The utility functions below remain unchanged as they don't interact with APIs
// and are less likely to cause startup errors

// Get item usage instructions based on category
export const getItemUsageInstructions = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'theme':
      return 'Go to Settings and select Appearance to apply this theme.';
    case 'avatar':
      return 'Visit your Profile and tap on your current avatar to change it.';
    case 'badge':
      return 'Badges are displayed on your profile automatically once equipped.';
    case 'feature':
      return 'This feature is now unlocked and available in your app.';
    default:
      return 'Equip this item from your inventory to use it.';
  }
};

// Get color associated with item category
export const getCategoryColor = (category?: string): string => {
  const categoryColors: Record<string, string> = {
    'theme': '#6A5ACD',   // SlateBlue
    'avatar': '#20B2AA',  // LightSeaGreen
    'badge': '#FFD700',   // Gold
    'feature': '#FF6347', // Tomato
    'misc': '#9C27B0'     // Purple
  };
  
  return category && categoryColors[category.toLowerCase()] 
    ? categoryColors[category.toLowerCase()] 
    : '#9C27B0'; // Default color
};

// Get user-friendly category label
export const getCategoryLabel = (category: string): string => {
  const categoryLabels: Record<string, string> = {
    'theme': 'Theme',
    'avatar': 'Avatar',
    'badge': 'Badge',
    'feature': 'Feature',
    'misc': 'Miscellaneous'
  };
  
  return category && categoryLabels[category.toLowerCase()]
    ? categoryLabels[category.toLowerCase()]
    : category.charAt(0).toUpperCase() + category.slice(1);
};

// Group items by category
export const groupItemsByCategory = (items: Item[] | UserItem[]): Record<string, (Item | UserItem)[]> => {
  return items.reduce((groups: Record<string, (Item | UserItem)[]>, item) => {
    const category = item.category.toLowerCase();
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
    return groups;
  }, {});
};

// Apply item effects - this would integrate with other parts of your app
export const applyItemEffects = async (item: UserItem): Promise<boolean> => {
  try {
    console.log(`Applying effects for ${item.name} (${item.category})`);
    
    // Based on item category, apply different effects
    switch (item.category.toLowerCase()) {
      case 'theme':
        // Apply theme changes
        console.log(`Applying theme: ${item.name}`);
        // You would integrate with your theme system here
        return true;
        
      case 'avatar':
        // Update user's avatar
        console.log(`Setting avatar: ${item.name}`);
        // You would update the user's profile here
        return true;
        
      case 'badge':
        // Apply badge to user profile
        console.log(`Applying badge: ${item.name}`);
        // You would update the user's badges here
        return true;
        
      case 'feature':
        // Unlock feature
        console.log(`Unlocking feature: ${item.name}`);
        // You would update app settings to enable the feature
        return true;
        
      default:
        console.log(`No specific effects for ${item.category} items`);
        return true;
    }
  } catch (error) {
    console.error(`Error applying item effects for ${item.name}:`, error);
    return false;
  }
};