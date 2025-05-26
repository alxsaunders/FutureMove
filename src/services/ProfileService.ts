// src/services/ProfileService.ts - Updated with Old Image Deletion
import axios, { AxiosError } from 'axios';
import { Platform } from 'react-native';
import { auth } from '../config/firebase';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { User } from '../contexts/AuthContext';

// Debug flag - set to true to enable detailed logging
const DEBUG_PROFILE = true;

// Utility function for logging
const logDebug = (message: string, data?: any) => {
  if (DEBUG_PROFILE) {
    if (data) {
      console.log(`[PROFILE CLIENT] ${message}`, data);
    } else {
      console.log(`[PROFILE CLIENT] ${message}`);
    }
  }
};

// Achievement badge image mapping
const ACHIEVEMENT_BADGE_IMAGES: Record<string, any> = {
  // Personal badges
  'Personal_Pioneer_Badge': require("../assets/images/achivements-futuremove/Personal/Personal_Pioneer_Badge.png"),
  'Self_Sovereign_Badge': require("../assets/images/achivements-futuremove/Personal/Self_Sovereign_Badge.png"),
  'Identity_Architect_Badge': require("../assets/images/achivements-futuremove/Personal/Identity_Architect_Badge.png"),
  'Legendary_Life_Curator_Badge': require("../assets/images/achivements-futuremove/Personal/Legendary_Life_Curator_Badge.png"),
  
  // Work badges
  'Productivity_Prodigy_Badge': require("../assets/images/achivements-futuremove/Work/Productivity_Prodigy_Badge.png"),
  'Workflow_Wizard_Badge': require("../assets/images/achivements-futuremove/Work/Workflow_Wizard_Badge.png"),
  'Career_Cornerstone_Badge': require("../assets/images/achivements-futuremove/Work/Career_Cornerstone_Badge.png"),
  'Executive_Excellence_Badge': require("../assets/images/achivements-futuremove/Work/Executive_Excellence_Badge.png"),
  
  // Learning badges
  'Knowledge_Seeker_Badge': require("../assets/images/achivements-futuremove/Learning/Knowledge_Seeker_Badge.png"),
  'Wisdom_Weaver_Badge': require("../assets/images/achivements-futuremove/Learning/Wisdom_Weaver_Badge.png"),
  'Skill_Sculptor_Badge': require("../assets/images/achivements-futuremove/Learning/Skill_Sculptor_Badge.png"),
  'Grand_Scholar_Badge': require("../assets/images/achivements-futuremove/Learning/Grand_Scholar_Badge.png"),
  
  // Health badges
  'Vitality_Voyager_Badge': require("../assets/images/achivements-futuremove/Health/Vitality_Voyager_Badge.png"),
  'Wellness_Warrior_Badge': require("../assets/images/achivements-futuremove/Health/Wellness_Warrior_Badge.png"),
  'Health_Harmonizer_Badge': require("../assets/images/achivements-futuremove/Health/Health_Harmonizer_Badge.png"),
  'Peak_Performance_Paragon_Badge': require("../assets/images/achivements-futuremove/Health/Peak_Performance_Paragon_Badge.png"),
  
  // Repair badges
  'Fixer_Fledgling_Badge': require("../assets/images/achivements-futuremove/Repair/Fixer_Fledgling_Badge.png"),
  'Restoration_Ranger_Badge': require("../assets/images/achivements-futuremove/Repair/Restoration_Ranger_Badge.png"),
  'Mending_Master_Badge': require("../assets/images/achivements-futuremove/Repair/Mending_Master_Badge.png"),
  'Legendary_Rebuilder_Badge': require("../assets/images/achivements-futuremove/Repair/Legendary_Rebuilder_Badge.png"),
  
  // Finance badges
  'Fiscal_Foundling_Badge': require("../assets/images/achivements-futuremove/Finance/Fiscal_Foundling_Badge.png"),
  'Wealth_Warden_Badge': require("../assets/images/achivements-futuremove/Finance/Wealth_Warden_Badge.png"),
  'Money_Maestro_Badge': require("../assets/images/achivements-futuremove/Finance/Money_Maestro_Badge.png"),
  'Fortune_Forger_Badge': require("../assets/images/achivements-futuremove/Finance/Fortune_Forger_Badge.png"),
};

// Default badge placeholder
const DEFAULT_BADGE_IMAGE = require("../assets/images/placeholder-badge.png");

// Helper function to get badge image
const getBadgeImage = (badgeIconName: string): any => {
  const badgeImage = ACHIEVEMENT_BADGE_IMAGES[badgeIconName];
  if (badgeImage) {
    return badgeImage;
  }
  
  logDebug(`Badge image not found for: ${badgeIconName}, using default`);
  return DEFAULT_BADGE_IMAGE;
};

// Get API base URL based on platform
export const getApiBaseUrl = () => {
  const baseUrl = Platform.OS === "android"
    ? "http://10.0.2.2:3001/api"
    : 'http://192.168.1.207:3001/api';

  logDebug(`Using API base URL: ${baseUrl}`);
  return baseUrl;
};

// Helper function to get current user ID from Firebase
export const getCurrentUserId = async (): Promise<string> => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    logDebug(`Current user ID: ${currentUser.uid}`);
    return currentUser.uid;
  }
  logDebug('No authenticated user found');
  throw new Error('No authenticated user found');
};

// Extended user profile with additional fields
export interface ExtendedUserProfile extends User {
  streakCount?: number;
  badgeCount?: number;
  commends?: number;
  communityCount?: number;
  completedGoalsCount?: number;
  hasCommended?: boolean;
  bio?: string;
  location?: string;
  website?: string;
}

// Define Community interface
export interface Community {
  community_id: number | string;
  name: string;
  description?: string;
  category?: string;
  image_url?: string;
  members_count?: number;
  posts_count?: number;
  is_joined?: boolean;
  created_by?: string;
}

// Badge interface
export interface Badge {
  id: string;
  name: string;
  description: string;
  category?: string;
  milestone?: number;
  icon: any;
  type: string;
  earned_at?: string;
  achievement_id?: string;
}

/**
 * Delete an old profile image from Firebase Storage
 * @param imageUrl - The Firebase Storage URL of the image to delete
 * @returns Promise resolving to success status
 */
const deleteOldProfileImage = async (imageUrl: string): Promise<boolean> => {
  try {
    if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
      logDebug('No valid Firebase Storage URL to delete');
      return false;
    }

    // Extract the path from the Firebase Storage URL
    // URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}?alt=media&token={token}
    const urlParts = imageUrl.split('/o/');
    if (urlParts.length < 2) {
      logDebug('Invalid Firebase Storage URL format');
      return false;
    }

    const pathWithQuery = urlParts[1];
    const path = decodeURIComponent(pathWithQuery.split('?')[0]);
    
    logDebug(`Attempting to delete old image at path: ${path}`);

    // Get Firebase Storage instance
    const storage = getStorage();
    const oldImageRef = ref(storage, path);

    // Delete the old image
    await deleteObject(oldImageRef);
    logDebug(`Successfully deleted old profile image: ${path}`);
    
    return true;
  } catch (error) {
    // If the image doesn't exist, that's okay - it might have been deleted already
    if (error instanceof Error && error.message.includes('object-not-found')) {
      logDebug('Old image not found in storage (already deleted)');
      return true;
    }
    
    logDebug(`Error deleting old profile image: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw the error - we don't want to block the update process
    return false;
  }
};

/**
 * Fetch a user's profile data
 * @param userId - The ID of the user to fetch
 * @returns Promise resolving to extended user profile data
 */
export const fetchUserProfile = async (userId: string): Promise<ExtendedUserProfile> => {
  try {
    logDebug(`Fetching profile for user: ${userId}`);
    const apiUrl = getApiBaseUrl();

    // Get current user ID for authorization context
    let currentUserId;
    try {
      currentUserId = await getCurrentUserId();
      logDebug(`Using currentUserId for context: ${currentUserId}`);
    } catch (error) {
      logDebug(`Using provided userId as fallback context: ${userId}`);
      currentUserId = userId;
    }

    const requestUrl = `${apiUrl}/profile/${userId}?userId=${currentUserId}`;
    logDebug(`Making request to: ${requestUrl}`);

    const response = await axios.get(requestUrl, {
      timeout: 10000
    });

    logDebug(`Profile API response status: ${response.status}`);
    logDebug(`Raw profile data received:`, response.data);

    const profileData = response.data;

    // Map database field names to our interface fields
    const result: ExtendedUserProfile = {
      id: profileData.user_id,
      username: profileData.username,
      name: profileData.name,
      email: profileData.email,
      level: profileData.level || 1,
      xp_points: profileData.xp_points || 0,
      future_coins: profileData.future_coins || 0,
      created_at: profileData.created_at,
      last_login: profileData.last_login,
      profileImage: profileData.profile_image,
      streakCount: profileData.streakCount || 0,
      badgeCount: profileData.badgeCount || 0,
      commends: profileData.commends || 0,
      communityCount: profileData.communityCount || 0,
      completedGoalsCount: profileData.completedGoalsCount || 0,
      hasCommended: profileData.hasCommended || false,
      bio: profileData.bio || '',
      location: profileData.location || '',
      website: profileData.website || ''
    };

    logDebug('Profile data transformed:', result);
    return result;
  } catch (error) {
    logDebug(`Error fetching user profile: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Fetch a user's statistics
 * @param userId - The ID of the user to fetch stats for
 * @returns Promise resolving to user stats
 */
export const fetchUserStats = async (userId: string): Promise<any> => {
  try {
    logDebug(`Fetching stats for user: ${userId}`);
    const apiUrl = getApiBaseUrl();

    const requestUrl = `${apiUrl}/profile/${userId}/stats`;
    logDebug(`Making request to: ${requestUrl}`);

    const response = await axios.get(requestUrl, {
      timeout: 8000
    });

    logDebug(`Stats API response status: ${response.status}`);
    logDebug(`Stats received for user: ${userId}`, response.data);

    return response.data;
  } catch (error) {
    logDebug(`Error fetching user stats: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error fetching user stats:', error);
    throw error;
  }
};

/**
 * Upload image data to Firebase Storage
 * @param blob - Image blob data
 * @param fileName - Filename to use for storage
 * @returns Promise resolving to download URL
 */
const uploadImageToFirebase = async (blob: Blob, fileName: string): Promise<string> => {
  try {
    logDebug(`Starting Firebase upload for file: ${fileName}, size: ${blob.size} bytes`);

    // Validate the blob
    if (!blob || blob.size === 0) {
      throw new Error("Invalid image data");
    }

    // Size validation - limit to 5MB
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error("Image is too large (over 5MB)");
    }

    // Get Firebase Storage instance
    const storage = getStorage();
    if (!storage) {
      throw new Error("Firebase Storage not initialized");
    }

    logDebug(`Creating storage reference for ${fileName}`);
    const storageRef = ref(storage, `profile_images/${fileName}`);

    // Create upload task with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let uploadError = null;

    while (attempts < maxAttempts) {
      try {
        logDebug(`Upload attempt ${attempts + 1} of ${maxAttempts}`);
        const uploadTask = await uploadBytesResumable(storageRef, blob);
        logDebug('Upload successful, getting download URL');

        // Get the download URL
        const downloadUrl = await getDownloadURL(uploadTask.ref);
        logDebug(`Download URL obtained: ${downloadUrl}`);
        return downloadUrl;
      } catch (error) {
        attempts++;
        uploadError = error;
        logDebug(`Upload attempt ${attempts} failed: ${error instanceof Error ? error.message : String(error)}`);

        if (attempts < maxAttempts) {
          // Wait before retry (exponential backoff)
          const delay = 1000 * Math.pow(2, attempts);
          logDebug(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we got here, all attempts failed
    throw uploadError || new Error("Failed to upload image after multiple attempts");

  } catch (error) {
    logDebug(`Firebase upload error: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

/**
 * Update a user's profile information
 * @param userId - The ID of the user to update
 * @param updates - Object containing the fields to update
 * @returns Promise resolving to success status
 */
export const updateUserProfile = async (
  userId: string,
  updates: {
    name?: string;
    username?: string;
    bio?: string;
    location?: string;
    website?: string;
    profileImage?: Blob;
    fileName?: string;
  }
): Promise<string | boolean> => {
  try {
    logDebug(`Updating profile for user: ${userId}`, {
      hasImage: !!updates.profileImage,
      fileName: updates.fileName,
      name: updates.name,
      username: updates.username,
      bio: updates.bio,
      location: updates.location,
      website: updates.website
    });

    const apiUrl = getApiBaseUrl();

    // If there's a profile image to upload
    if (updates.profileImage && updates.fileName) {
      try {
        // First, get the current profile data to check for existing image
        let oldImageUrl: string | null = null;
        try {
          const currentProfile = await fetchUserProfile(userId);
          oldImageUrl = currentProfile.profileImage || null;
          logDebug(`Found existing profile image: ${oldImageUrl ? 'Yes' : 'No'}`);
        } catch (error) {
          logDebug('Could not fetch current profile for old image check');
        }

        // Upload new image to Firebase
        const downloadUrl = await uploadImageToFirebase(updates.profileImage, updates.fileName);

        try {
          // Update the profile image URL in the database
          const updateUrl = `${apiUrl}/profile/${userId}/profile-image`;
          logDebug(`Updating profile image URL in database: ${updateUrl}`);

          await axios.put(updateUrl, {
            imageUrl: downloadUrl
          }, { timeout: 10000 });

          logDebug('Profile image URL updated in database');

          // After successful update, delete the old image if it exists
          if (oldImageUrl && oldImageUrl !== downloadUrl) {
            logDebug('Attempting to delete old profile image from storage');
            const deleteSuccess = await deleteOldProfileImage(oldImageUrl);
            if (deleteSuccess) {
              logDebug('Old profile image deleted successfully');
            } else {
              logDebug('Failed to delete old profile image, but continuing');
            }
          }

        } catch (dbError) {
          logDebug(`Database update error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          logDebug('Continuing despite database error - image was uploaded to Firebase');
        }

        // If there are other fields to update, do that separately
        if (updates.name || updates.username || updates.bio || updates.location || updates.website) {
          const updateData = {
            name: updates.name,
            username: updates.username,
            bio: updates.bio,
            location: updates.location,
            website: updates.website
          };

          try {
            logDebug('Updating other profile fields', updateData);
            await axios.put(`${apiUrl}/profile/${userId}`, updateData, { timeout: 10000 });
            logDebug('Other profile fields updated');
          } catch (dbError) {
            logDebug(`Database update error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          }
        }

        return downloadUrl;
      } catch (firebaseError) {
        logDebug(`Firebase error: ${firebaseError instanceof Error ? firebaseError.message : String(firebaseError)}`);
        throw firebaseError;
      }
    }

    // If just updating name/username/bio/location/website
    if (updates.name || updates.username || updates.bio || updates.location || updates.website) {
      const updateData = {
        name: updates.name,
        username: updates.username,
        bio: updates.bio,
        location: updates.location,
        website: updates.website
      };

      try {
        logDebug('Updating profile fields', updateData);
        const response = await axios.put(`${apiUrl}/profile/${userId}`, updateData, { timeout: 10000 });
        logDebug('Profile fields updated successfully');
        return true;
      } catch (dbError) {
        logDebug(`Database update error: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        throw dbError;
      }
    }

    return false;
  } catch (error) {
    logDebug(`Error updating user profile: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// ... rest of the functions remain the same ...

/**
 * Add a commend to a user
 * @param userId - The ID of the user to commend
 * @returns Promise resolving to success status and new commend count
 */
export const commendUser = async (userId: string): Promise<{ success: boolean, commends: number }> => {
  try {
    logDebug(`Commending user: ${userId}`);
    const apiUrl = getApiBaseUrl();
    const currentUserId = await getCurrentUserId();

    const response = await axios.post(`${apiUrl}/profile/${userId}/commend`, { userId: currentUserId });

    logDebug('Commend successful', response.data);
    return {
      success: response.data.success,
      commends: response.data.commends
    };
  } catch (error) {
    logDebug(`Error commending user: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
      throw new Error(error.response.data.error || `Error response from API: ${error.response.status}`);
    }
    console.error('Error commending user:', error);
    throw error;
  }
};

/**
 * Remove a commend from a user
 * @param userId - The ID of the user to remove commend from
 * @returns Promise resolving to success status and new commend count
 */
export const removeCommend = async (userId: string): Promise<{ success: boolean, commends: number }> => {
  try {
    logDebug(`Removing commend from user: ${userId}`);
    const apiUrl = getApiBaseUrl();
    const currentUserId = await getCurrentUserId();

    const response = await axios.delete(`${apiUrl}/profile/${userId}/commend?userId=${currentUserId}`);

    logDebug('Commend removal successful', response.data);
    return {
      success: response.data.success,
      commends: response.data.commends
    };
  } catch (error) {
    logDebug(`Error removing commend: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
      throw new Error(error.response.data.error || `Error response from API: ${error.response.status}`);
    }
    console.error('Error removing commend:', error);
    throw error;
  }
};

/**
 * Fetch users who commended a particular user
 * @param userId - The ID of the user to get commenders for
 * @param page - Page number for pagination
 * @param limit - Number of results per page
 * @returns Promise resolving to commenders list with pagination info
 */
export const fetchUserCommenders = async (userId: string, page: number = 1, limit: number = 20): Promise<any> => {
  try {
    logDebug(`Fetching commenders for user: ${userId}, page: ${page}, limit: ${limit}`);
    const apiUrl = getApiBaseUrl();

    const response = await axios.get(`${apiUrl}/profile/${userId}/commenders?page=${page}&limit=${limit}`);

    logDebug(`Commenders received:`, response.data);
    return response.data;
  } catch (error) {
    logDebug(`Error fetching user commenders: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error fetching user commenders:', error);
    throw error;
  }
};

/**
 * Fetch achievement badges for a user
 * @param userId - The ID of the user to get badges for
 * @returns Promise resolving to array of badges with proper image mapping
 */
export const fetchUserBadges = async (userId: string): Promise<Badge[]> => {
  try {
    logDebug(`Fetching achievement badges for user: ${userId}`);
    const apiUrl = getApiBaseUrl();

    const response = await axios.get(`${apiUrl}/profile/${userId}/badges`, {
      timeout: 8000
    });

    logDebug(`Raw badges received:`, response.data);

    // Transform the backend badge data to include proper images
    const badges: Badge[] = (response.data || []).map((badgeData: any) => {
      const badgeImage = getBadgeImage(badgeData.icon);
      
      return {
        id: badgeData.id,
        name: badgeData.name,
        description: badgeData.description,
        category: badgeData.category,
        milestone: badgeData.milestone,
        icon: badgeImage,
        type: badgeData.type || 'achievement',
        earned_at: badgeData.earned_at,
        achievement_id: badgeData.achievement_id
      };
    });

    logDebug(`Mapped ${badges.length} badges with images`);
    return badges;
  } catch (error) {
    logDebug(`Error fetching user badges: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error fetching user badges:', error);
    return [];
  }
};

/**
 * Fetch goals for a user
 * @param userId - The ID of the user to get goals for
 * @param includeCompleted - Whether to include completed goals
 * @returns Promise resolving to array of goals
 */
export const fetchUserGoals = async (userId: string, includeCompleted: boolean = false): Promise<any[]> => {
  try {
    logDebug(`Fetching goals for user: ${userId}, includeCompleted: ${includeCompleted}`);
    const apiUrl = getApiBaseUrl();

    const response = await axios.get(`${apiUrl}/profile/${userId}/goals?includeCompleted=${includeCompleted}`);

    logDebug(`Goals received: ${response.data.length || 0}`);
    return response.data;
  } catch (error) {
    logDebug(`Error fetching user goals: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error fetching user goals:', error);
    throw error;
  }
};

/**
 * Fetch communities the user has joined
 * @param userId - The ID of the user to get communities for
 * @returns Promise resolving to array of communities
 */
export const fetchUserCommunities = async (userId: string): Promise<Community[]> => {
  try {
    logDebug(`Fetching joined communities for user: ${userId}`);
    const apiUrl = getApiBaseUrl();

    let currentUserId;
    try {
      currentUserId = await getCurrentUserId();
      logDebug(`Using currentUserId for context: ${currentUserId}`);
    } catch (error) {
      logDebug(`Using provided userId as fallback context: ${userId}`);
      currentUserId = userId;
    }

    const requestUrl = `${apiUrl}/communities/user/${userId}/joined`;
    logDebug(`Making request to: ${requestUrl}`);

    const response = await axios.get(requestUrl, {
      timeout: 8000
    });

    logDebug(`Communities API response status: ${response.status}`);
    logDebug(`Communities received: ${response.data ? (response.data.length || 0) : 0}`);

    let communities = response.data;
    if (response.data && Array.isArray(response.data)) {
      communities = response.data;
    } else if (response.data && response.data.communities && Array.isArray(response.data.communities)) {
      communities = response.data.communities;
    }

    if (!Array.isArray(communities)) {
      logDebug('Invalid communities data structure, returning empty array');
      return [];
    }

    const mappedCommunities: Community[] = communities.map(community => ({
      community_id: community.community_id,
      name: community.name,
      description: community.description,
      category: community.category,
      image_url: community.image_url,
      members_count: community.members_count,
      posts_count: community.posts_count,
      is_joined: community.is_joined === 1 || community.is_joined === true,
      created_by: community.created_by
    }));

    logDebug(`Mapped ${mappedCommunities.length} communities for user ${userId}`);
    return mappedCommunities;
  } catch (error) {
    logDebug(`Error fetching user communities: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error fetching user communities:', error);
    return [];
  }
};

/**
 * Create a new community
 * @param communityData - Data for the community to create
 * @returns Promise resolving to the created community
 */
export const createCommunity = async (communityData: {
  name: string;
  description?: string;
  category: string;
  image_url?: string;
}): Promise<Community> => {
  try {
    logDebug(`Creating community with name: ${communityData.name}`);
    const apiUrl = getApiBaseUrl();

    const currentUserId = await getCurrentUserId();

    const response = await axios.post(`${apiUrl}/communities`, {
      ...communityData,
      created_by: currentUserId
    }, {
      timeout: 10000
    });

    logDebug(`Community creation response:`, response.data);
    return response.data;
  } catch (error) {
    logDebug(`Error creating community: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error creating community:', error);
    throw error;
  }
};

/**
 * Join a community
 * @param communityId - ID of the community to join
 * @returns Promise resolving to success status
 */
export const joinCommunity = async (communityId: number | string): Promise<boolean> => {
  try {
    logDebug(`Joining community: ${communityId}`);
    const apiUrl = getApiBaseUrl();
    const currentUserId = await getCurrentUserId();

    const response = await axios.post(`${apiUrl}/communities/${communityId}/join`, {
      userId: currentUserId
    }, {
      timeout: 8000
    });

    logDebug(`Community join response:`, response.data);
    return response.data.success === true;
  } catch (error) {
    logDebug(`Error joining community: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error joining community:', error);
    throw error;
  }
};

/**
 * Leave a community
 * @param communityId - ID of the community to leave
 * @returns Promise resolving to success status
 */
export const leaveCommunity = async (communityId: number | string): Promise<boolean> => {
  try {
    logDebug(`Leaving community: ${communityId}`);
    const apiUrl = getApiBaseUrl();
    const currentUserId = await getCurrentUserId();

    const response = await axios.post(`${apiUrl}/communities/${communityId}/leave`, {
      userId: currentUserId
    }, {
      timeout: 8000
    });

    logDebug(`Community leave response:`, response.data);
    return response.data.success === true;
  } catch (error) {
    logDebug(`Error leaving community: ${error instanceof Error ? error.message : String(error)}`);
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    console.error('Error leaving community:', error);
    throw error;
  }
};