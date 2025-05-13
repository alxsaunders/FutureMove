// src/services/ProfileService.ts
import { User } from '../contexts/AuthContext';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc, setDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as authService from "../services/authService";

// Initialize Firebase Storage
const storage = getStorage();

/**
 * Extended user profile type with additional fields
 */
export interface ExtendedUserProfile extends User {
  profileImage?: string | null;
  bio?: string;
  location?: string;
  website?: string;
  followers?: string[];
  following?: string[];
  badges?: Badge[];
  communities?: Community[];
  recentActivity?: Activity[];
  recentPosts?: Post[];
  numFollowers?: number;
  numFollowing?: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description?: string;
  awardedAt?: string;
}

export interface Community {
  id: string;
  name: string;
  description?: string;
  icon: string;
  memberCount: number;
  createdAt: string;
}

export interface Activity {
  type: string;
  description: string;
  timestamp: string;
  goalId?: number;
  communityId?: string;
  postId?: string;
  badgeId?: string;
}

export interface Post {
  id: string;
  communityId: string;
  communityName: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  image?: string;
  createdAt: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
}

/**
 * Fetch a user's profile data
 * @param userId - The ID of the user to fetch
 * @returns Promise resolving to extended user profile data
 */
export const fetchUserProfile = async (userId: string): Promise<ExtendedUserProfile> => {
  try {
    // First try to get basic user info from your existing auth service
    let basicUserInfo: User | null = null;
    
    // Get current authenticated user if the requested user is the current user
    const authStatus = await authService.isAuthenticated();
    if (authStatus) {
      const currentUser = await authService.getCurrentUser();
      if (currentUser && currentUser.user_id === userId) {
        basicUserInfo = {
          id: currentUser.user_id,
          username: currentUser.username,
          name: currentUser.name,
          email: currentUser.email,
          level: currentUser.level,
          xp_points: currentUser.xp_points,
          future_coins: currentUser.future_coins,
          created_at: currentUser.created_at,
          last_login: currentUser.last_login,
        };
      }
    }
    
    // If not the current user or not authenticated, try to get user info from Firestore
    if (!basicUserInfo) {
      try {
        // Try to get user info from your backend via API
        // This would depend on your backend API structure
        // For now we'll just create a placeholder
        basicUserInfo = {
          id: userId,
          username: 'user_' + userId.substring(0, 5),
          name: 'User',
          email: '',
          level: 1,
          xp_points: 0,
          future_coins: 0,
          created_at: new Date().toISOString(),
          last_login: null
        };
      } catch (error) {
        console.error('Error fetching user from API:', error);
      }
    }
    
    // Now get extended profile data from Firestore
    const profileDocRef = doc(db, 'user_profiles', userId);
    const profileDoc = await getDoc(profileDocRef);
    
    if (!profileDoc.exists()) {
      console.log(`Extended profile for user ID ${userId} not found, creating default`);
      
      // Create a basic profile if it doesn't exist
      const defaultProfile: Omit<ExtendedUserProfile, keyof User> = {
        profileImage: null,
        bio: '',
        location: '',
        website: '',
        followers: [],
        following: [],
        badges: [],
        communities: [],
        recentActivity: [],
        recentPosts: [],
        numFollowers: 0,
        numFollowing: 0
      };
      
      // Save default profile to Firestore
      await setDoc(profileDocRef, defaultProfile);
      
      // Return combined data
      return {
        ...basicUserInfo,
        ...defaultProfile
      };
    }
    
    const profileData = profileDoc.data() as Omit<ExtendedUserProfile, keyof User>;
    
    // Fetch related data (recent posts, badges, communities) if needed
    const [recentPosts, badges, communities] = await Promise.all([
      fetchUserRecentPosts(userId),
      fetchUserBadges(userId),
      fetchUserCommunities(userId)
    ]);
    
    // Combine basic user info with extended profile data
    return {
      ...basicUserInfo,
      ...profileData,
      recentPosts,
      badges,
      communities,
      numFollowers: profileData.followers?.length || 0,
      numFollowing: profileData.following?.length || 0,
    };
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw new Error('Failed to fetch user profile');
  }
};

/**
 * Update a user's profile
 * @param userId - The ID of the user to update
 * @param updates - Object containing the fields to update
 * @returns Promise resolving to success status or updated imageUrl if profile image is updated
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
    const profileDocRef = doc(db, 'user_profiles', userId);
    
    // If there's a profile image to upload
    if (updates.profileImage && updates.fileName) {
      // Upload image to Firebase Storage
      const storageRef = ref(storage, `profile_images/${updates.fileName}`);
      await uploadBytes(storageRef, updates.profileImage);
      
      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRef);
      
      // Update the profile document with the new image URL
      await updateDoc(profileDocRef, {
        profileImage: downloadUrl
      });
      
      // Update basic user info if needed (this would use your existing API)
      if (updates.name || updates.username) {
        // This would depend on your backend API structure
        // Example: await authService.updateUserProfile(userId, { name: updates.name });
      }
      
      return downloadUrl;
    }
    
    // Remove the blob and filename from updates
    const updateData = { ...updates };
    delete updateData.profileImage;
    delete updateData.fileName;
    
    // Update the profile document in Firestore
    await updateDoc(profileDocRef, updateData);
    
    // Update basic user info if needed (this would use your existing API)
    if (updates.name || updates.username) {
      // This would depend on your backend API structure
      // Example: await authService.updateUserProfile(userId, { name: updates.name });
    }
    
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error('Failed to update user profile');
  }
};

/**
 * Follow a user
 * @param followerId - ID of the user who is following
 * @param targetUserId - ID of the user to follow
 * @returns Promise resolving to success status
 */
export const followUser = async (followerId: string, targetUserId: string): Promise<boolean> => {
  try {
    const followerDocRef = doc(db, 'user_profiles', followerId);
    const targetUserDocRef = doc(db, 'user_profiles', targetUserId);
    
    // Add targetUserId to follower's following array
    await updateDoc(followerDocRef, {
      following: arrayUnion(targetUserId)
    });
    
    // Add followerId to target user's followers array
    await updateDoc(targetUserDocRef, {
      followers: arrayUnion(followerId)
    });
    
    return true;
  } catch (error) {
    console.error('Error following user:', error);
    throw new Error('Failed to follow user');
  }
};

/**
 * Unfollow a user
 * @param followerId - ID of the user who is unfollowing
 * @param targetUserId - ID of the user to unfollow
 * @returns Promise resolving to success status
 */
export const unfollowUser = async (followerId: string, targetUserId: string): Promise<boolean> => {
  try {
    const followerDocRef = doc(db, 'user_profiles', followerId);
    const targetUserDocRef = doc(db, 'user_profiles', targetUserId);
    
    // Remove targetUserId from follower's following array
    await updateDoc(followerDocRef, {
      following: arrayRemove(targetUserId)
    });
    
    // Remove followerId from target user's followers array
    await updateDoc(targetUserDocRef, {
      followers: arrayRemove(followerId)
    });
    
    return true;
  } catch (error) {
    console.error('Error unfollowing user:', error);
    throw new Error('Failed to unfollow user');
  }
};

/**
 * Check if a user is following another user
 * @param userId - ID of the user to check
 * @param targetId - ID of the target user
 * @returns Promise resolving to follow status
 */
export const checkIfFollowing = async (userId: string, targetId: string): Promise<boolean> => {
  try {
    const userProfileDocRef = doc(db, 'user_profiles', userId);
    const userProfileDoc = await getDoc(userProfileDocRef);
    
    if (!userProfileDoc.exists()) {
      return false;
    }
    
    const userData = userProfileDoc.data();
    return userData.following?.includes(targetId) || false;
  } catch (error) {
    console.error('Error checking follow status:', error);
    return false;
  }
};

/**
 * Fetch a user's recent posts
 * @param userId - ID of the user
 * @returns Promise resolving to array of recent posts
 */
const fetchUserRecentPosts = async (userId: string): Promise<Post[]> => {
  try {
    const postsQuery = query(
      collection(db, 'posts'),
      where('userId', '==', userId)
    );
    
    const postsSnapshot = await getDocs(postsQuery);
    const posts: Post[] = [];
    
    postsSnapshot.forEach(doc => {
      posts.push({
        id: doc.id,
        ...doc.data() as Omit<Post, 'id'>
      });
    });
    
    // Sort by created date, most recent first
    return posts.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).slice(0, 5); // Only return the 5 most recent posts
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return [];
  }
};

/**
 * Fetch a user's badges
 * @param userId - ID of the user
 * @returns Promise resolving to array of badges
 */
const fetchUserBadges = async (userId: string): Promise<Badge[]> => {
  try {
    const badgesQuery = query(
      collection(db, 'user_badges'),
      where('userId', '==', userId)
    );
    
    const badgesSnapshot = await getDocs(badgesQuery);
    const badges: Badge[] = [];
    
    badgesSnapshot.forEach(doc => {
      badges.push({
        id: doc.id,
        ...doc.data() as Omit<Badge, 'id'>
      });
    });
    
    return badges;
  } catch (error) {
    console.error('Error fetching user badges:', error);
    return [];
  }
};

/**
 * Fetch a user's communities
 * @param userId - ID of the user
 * @returns Promise resolving to array of communities
 */
const fetchUserCommunities = async (userId: string): Promise<Community[]> => {
  try {
    const membershipsQuery = query(
      collection(db, 'community_members'),
      where('userId', '==', userId)
    );
    
    const membershipsSnapshot = await getDocs(membershipsQuery);
    const communityIds: string[] = [];
    
    membershipsSnapshot.forEach(doc => {
      communityIds.push(doc.data().communityId);
    });
    
    // If user isn't in any communities, return empty array
    if (communityIds.length === 0) {
      return [];
    }
    
    // Fetch the community details
    const communities: Community[] = [];
    
    for (const communityId of communityIds) {
      const communityDocRef = doc(db, 'communities', communityId);
      const communityDoc = await getDoc(communityDocRef);
      
      if (communityDoc.exists()) {
        communities.push({
          id: communityId,
          ...communityDoc.data() as Omit<Community, 'id'>
        });
      }
    }
    
    return communities;
  } catch (error) {
    console.error('Error fetching user communities:', error);
    return [];
  }
};

/**
 * Add a badge to a user
 * @param userId - ID of the user
 * @param badgeId - ID of the badge
 * @returns Promise resolving to success status
 */
export const addBadgeToUser = async (userId: string, badgeId: string): Promise<boolean> => {
  try {
    // First check if badge exists
    const badgeDocRef = doc(db, 'badges', badgeId);
    const badgeDoc = await getDoc(badgeDocRef);
    
    if (!badgeDoc.exists()) {
      console.error(`Badge with ID ${badgeId} does not exist`);
      return false;
    }
    
    // Create user_badge record
    const userBadgeRef = doc(collection(db, 'user_badges'));
    await setDoc(userBadgeRef, {
      userId,
      badgeId,
      badgeName: badgeDoc.data().name,
      icon: badgeDoc.data().icon,
      awardedAt: new Date().toISOString()
    });
    
    // Add to recent activity
    const userProfileRef = doc(db, 'user_profiles', userId);
    await updateDoc(userProfileRef, {
      recentActivity: arrayUnion({
        type: 'badge_earned',
        description: `Earned the ${badgeDoc.data().name} badge`,
        timestamp: new Date().toISOString(),
        badgeId
      })
    });
    
    return true;
  } catch (error) {
    console.error('Error adding badge to user:', error);
    throw new Error('Failed to add badge to user');
  }
};

/**
 * Log an activity for a user
 * @param userId - ID of the user
 * @param activity - Activity object to log
 * @returns Promise resolving to success status
 */
export const logUserActivity = async (
  userId: string,
  activity: {
    type: string;
    description: string;
    timestamp?: string;
    goalId?: number;
    communityId?: string;
    postId?: string;
    badgeId?: string;
  }
): Promise<boolean> => {
  try {
    const userProfileRef = doc(db, 'user_profiles', userId);
    
    // Add timestamp if not provided
    if (!activity.timestamp) {
      activity.timestamp = new Date().toISOString();
    }
    
    await updateDoc(userProfileRef, {
      recentActivity: arrayUnion(activity)
    });
    
    return true;
  } catch (error) {
    console.error('Error logging user activity:', error);
    throw new Error('Failed to log user activity');
  }
};

/**
 * Get a user's followers
 * @param userId - ID of the user
 * @returns Promise resolving to array of user IDs
 */
export const getUserFollowers = async (userId: string): Promise<string[]> => {
  try {
    const userProfileRef = doc(db, 'user_profiles', userId);
    const userProfileDoc = await getDoc(userProfileRef);
    
    if (!userProfileDoc.exists()) {
      return [];
    }
    
    return userProfileDoc.data().followers || [];
  } catch (error) {
    console.error('Error getting user followers:', error);
    return [];
  }
};

/**
 * Get a user's following
 * @param userId - ID of the user
 * @returns Promise resolving to array of user IDs
 */
export const getUserFollowing = async (userId: string): Promise<string[]> => {
  try {
    const userProfileRef = doc(db, 'user_profiles', userId);
    const userProfileDoc = await getDoc(userProfileRef);
    
    if (!userProfileRef.exists()) {
      return [];
    }
    
    return userProfileDoc.data().following || [];
  } catch (error) {
    console.error('Error getting user following:', error);
    return [];
  }
};