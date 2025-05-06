// src/services/CommunityService.ts
import { Platform } from "react-native";
import { auth } from "../config/firebase.js";

// Define Community type interface
export interface Community {
  id: string | number;
  name: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  isJoined?: boolean;
}

// Get API base URL based on platform
export const getApiBaseUrl = () => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return "http://localhost:3001/api";
  }
};

// Helper function to get current user ID from Firebase
export const getCurrentUserId = async (): Promise<string> => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    return currentUser.uid;
  }
  throw new Error('No authenticated user found');
};

// Helper function to transform API response into Community object
const transformCommunity = (community: any): Community | null => {
  // Validate input
  if (!community || typeof community !== 'object') {
    console.warn('Invalid community object received:', community);
    return null;
  }

  // Check for essential fields
  if (!community.community_id && !community.id) {
    console.warn('Community missing ID field:', community);
    return null;
  }

  try {
    // Transform the community with sensible defaults
    const transformedCommunity: Community = {
      id: community.community_id || community.id,
      name: community.name || 'Unnamed Community',
      description: community.description || null,
      category: community.category || 'General',
      imageUrl: community.image_url || community.imageUrl || null,
      createdBy: community.created_by || community.createdBy || 'Unknown',
      createdAt: community.created_at || community.createdAt || new Date().toISOString(),
      updatedAt: community.updated_at || community.updatedAt || new Date().toISOString(),
      memberCount: typeof community.member_count === 'number' ? community.member_count : 
                  typeof community.memberCount === 'number' ? community.memberCount : 0,
      isJoined: community.is_joined === true || community.isJoined === true || false
    };

    return transformedCommunity;
  } catch (error) {
    console.error('Error transforming community data:', error);
    return null;
  }
};

// Fetch all communities
export const fetchCommunities = async (): Promise<Community[]> => {
  try {
    // Get current user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities?userId=${currentUserId}`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to fetch communities: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // Transform communities and filter out any null values
      const validCommunities = data.map(transformCommunity).filter(community => community !== null) as Community[];
      console.log(`Fetched ${validCommunities.length} valid communities from ${data.length} total communities`);
      return validCommunities;
    }
    
    // If it's in the { communities: [] } format
    if (data.communities && Array.isArray(data.communities)) {
      // Transform communities and filter out any null values
      const validCommunities = data.communities.map(transformCommunity).filter(community => community !== null) as Community[];
      console.log(`Fetched ${validCommunities.length} valid communities from ${data.communities.length} total communities`);
      return validCommunities;
    }
    
    // If no valid format is found
    console.warn('Invalid format for communities data:', data);
    return [];
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error('Fetch request for communities timed out');
    } else {
      console.error('Error fetching communities:', err);
    }
    
    // Return empty array
    return [];
  }
};

// Fetch communities that a user has joined
export const fetchJoinedCommunities = async (userId?: string): Promise<Community[]> => {
  try {
    // Get current user ID if not provided
    const currentUserId = userId || await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities/user/${currentUserId}/joined`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to fetch joined communities: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // Transform communities and filter out any null values
      const validCommunities = data.map(transformCommunity).filter(community => community !== null) as Community[];
      console.log(`Fetched ${validCommunities.length} valid joined communities from ${data.length} total communities`);
      return validCommunities;
    }
    
    // If it's in the { communities: [] } format
    if (data.communities && Array.isArray(data.communities)) {
      // Transform communities and filter out any null values
      const validCommunities = data.communities.map(transformCommunity).filter(community => community !== null) as Community[];
      console.log(`Fetched ${validCommunities.length} valid joined communities from ${data.communities.length} total communities`);
      return validCommunities;
    }
    
    // If no valid format is found
    console.warn('Invalid format for joined communities data:', data);
    return [];
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error('Fetch request for joined communities timed out');
    } else {
      console.error('Error fetching joined communities:', err);
    }
    
    // Return empty array
    return [];
  }
};

// Get a single community by ID
export const getCommunityById = async (communityId: string | number): Promise<Community | null> => {
  try {
    // Get current user ID
    const currentUserId = await getCurrentUserId();
    
    // Validate communityId
    if (!communityId) {
      console.warn(`Invalid community ID: ${communityId}`);
      return null;
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities/${communityId}?userId=${currentUserId}`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response status codes
    if (res.status === 404) {
      console.warn(`Community not found with ID: ${communityId}`);
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to fetch community: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    const communityData = data.community || data;
    
    // Enhanced validation: try to transform the community
    const community = transformCommunity(communityData);
    
    if (!community) {
      console.warn(`Invalid community data returned for ID: ${communityId}`);
      return null;
    }
    
    return community;
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error(`Fetch request for community ${communityId} timed out`);
    } else {
      console.error(`Error fetching community by ID: ${communityId}`, err);
    }
    
    return null;
  }
};

// Join a community
export const joinCommunity = async (communityId: string | number): Promise<boolean> => {
  try {
    console.log(`Joining community: ${communityId}`);
    
    // Validate inputs
    if (!communityId) {
      console.warn('Invalid community ID for joining');
      return false;
    }
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities/${communityId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({ userId: currentUserId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error joining community: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during community join, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Successfully joined community: ${communityId}`);
    return true;
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error(`Fetch request for joining community ${communityId} timed out`);
    } else {
      console.error(`Error joining community: ${communityId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Leave a community
export const leaveCommunity = async (communityId: string | number): Promise<boolean> => {
  try {
    console.log(`Leaving community: ${communityId}`);
    
    // Validate inputs
    if (!communityId) {
      console.warn('Invalid community ID for leaving');
      return false;
    }
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities/${communityId}/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({ userId: currentUserId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error leaving community: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during community leave, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Successfully left community: ${communityId}`);
    return true;
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error(`Fetch request for leaving community ${communityId} timed out`);
    } else {
      console.error(`Error leaving community: ${communityId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Create a new community
export const createCommunity = async (
  name: string,
  category: string,
  description?: string,
  imageUrl?: string
): Promise<Community | null> => {
  try {
    console.log(`Creating new community: ${name}`);
    
    // Validate inputs
    if (!name || name.trim() === '') {
      console.warn('Invalid name for community creation');
      return null;
    }
    
    if (!category || category.trim() === '') {
      console.warn('Invalid category for community creation');
      return null;
    }
    
    // Get current user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      },
      body: JSON.stringify({
        name,
        category,
        description: description || null,
        image_url: imageUrl || null,
        created_by: currentUserId
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error creating community: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to create community: ${res.status} ${res.statusText}`);
    }
    
    try {
      const data = await res.json();
      const communityData = data.community || data;
      
      // Transform community data
      const community = transformCommunity(communityData);
      
      if (!community) {
        console.warn('Invalid data returned from community creation');
        return null;
      }
      
      return community;
    } catch (parseError) {
      console.error('Error parsing community creation response:', parseError);
      return null;
    }
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error('Fetch request for community creation timed out');
    } else {
      console.error('Error creating community:', err);
    }
    
    return null;
  }
};

// Search communities by name or description
export const searchCommunities = async (query: string): Promise<Community[]> => {
  try {
    if (!query || query.trim() === '') {
      return [];
    }
    
    // Get current user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/communities/search?q=${encodeURIComponent(query)}&userId=${currentUserId}`, {
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error searching communities: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to search communities: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // Transform communities and filter out any null values
      const validCommunities = data.map(transformCommunity).filter(community => community !== null) as Community[];
      return validCommunities;
    }
    
    // If it's in the { communities: [] } format
    if (data.communities && Array.isArray(data.communities)) {
      // Transform communities and filter out any null values
      const validCommunities = data.communities.map(transformCommunity).filter(community => community !== null) as Community[];
      return validCommunities;
    }
    
    // If no valid format is found
    console.warn('Invalid format for community search data:', data);
    return [];
  } catch (err: any) {
    // Check if error is from AbortController (timeout)
    if (err && err.name === 'AbortError') {
      console.error('Fetch request for community search timed out');
    } else {
      console.error('Error searching communities:', err);
    }
    
    return [];
  }
};

// These functions are already defined in CommunityPostService.ts, 
// but since they're referenced in the error messages, we'll re-export them here
export { fetchComments } from './CommunityPostService';