// src/services/CommunityPostService.ts
import { Post, Comment } from "../types";
import { Platform } from "react-native";
import { auth } from "../config/firebase.js";
import { fetchJoinedCommunities } from "./CommunityService";

// Fallback user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

// Get API base URL based on platform
export const getApiBaseUrl = () => {
  if (Platform.OS === "android") {
    return 'http://10.0.2.2:3001/api';
  } else {
    // For iOS or development on Mac
    return 'http://192.168.1.207:3001/api';
  }
};

// Helper function to validate and normalize ID (handle both string and number)
const validateId = (id: string | number): string | null => {
  if (id === null || id === undefined) {
    return null;
  }
  
  const stringId = String(id).trim();
  if (stringId === '' || stringId === 'null' || stringId === 'undefined') {
    return null;
  }
  
  return stringId;
};

// Helper function to get current user ID from Firebase with fallback
export const getCurrentUserId = async (): Promise<string> => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    console.log(`Using authenticated user ID: ${currentUser.uid}`);
    return currentUser.uid;
  }
  
  console.log(`No current user, using fallback ID: ${FALLBACK_USER_ID}`);
  return FALLBACK_USER_ID; // Return fallback ID instead of throwing an error
};

// Helper function to transform API response into Post object
const transformPost = (post: any): Post | null => {
  // Validate input
  if (!post || typeof post !== 'object') {
    console.warn('Invalid post object received:', post);
    return null;
  }

  // Check for essential fields
  if (!post.post_id && !post.id) {
    console.warn('Post missing ID field:', post);
    return null;
  }

  try {
    // Transform the post with sensible defaults
    const transformedPost: Post = {
      id: String(post.post_id || post.id),
      communityId: String(post.community_id || post.communityId || ''),
      communityName: post.community_name || post.communityName || 'Unknown Community',
      userId: String(post.user_id || post.userId || ''),
      userName: post.user_name || post.userName || 'Anonymous User',
      userAvatar: post.user_avatar || post.userAvatar || post.profile_image || post.profileImage || "https://via.placeholder.com/150",
      content: post.content || post.text || '',
      image: post.image_url || post.image || null,
      createdAt: post.created_at || post.createdAt || new Date().toISOString(),
      likes: typeof post.likes_count === 'number' ? post.likes_count : 
             typeof post.likes === 'number' ? post.likes : 0,
      comments: typeof post.comments_count === 'number' ? post.comments_count : 
                typeof post.comments === 'number' ? post.comments : 0,
      isLiked: post.is_liked === 1 || post.isLiked === true,
    };

    return transformedPost;
  } catch (error) {
    console.error('Error transforming post data:', error);
    return null;
  }
};

// Helper function to transform API response into Comment object
const transformComment = (comment: any): Comment | null => {
  // Validate input
  if (!comment || typeof comment !== 'object') {
    console.warn('Invalid comment object received:', comment);
    return null;
  }

  // Check for essential fields - be more flexible with field names
  const commentId = comment.comment_id || comment.id;
  if (!commentId) {
    console.warn('Comment missing ID field:', comment);
    return null;
  }

  try {
    // Transform the comment with sensible defaults
    const transformedComment: Comment = {
      id: String(commentId),
      postId: String(comment.post_id || comment.postId || ''),
      userId: String(comment.user_id || comment.userId || ''),
      userName: comment.user_name || comment.userName || comment.username || 'Anonymous User',
      userAvatar: comment.user_avatar || comment.userAvatar || comment.profile_image || comment.profileImage || "https://via.placeholder.com/150",
      content: comment.content || comment.text || '',
      createdAt: comment.created_at || comment.createdAt || new Date().toISOString(),
      likes: typeof comment.likes_count === 'number' ? comment.likes_count : 
             typeof comment.likes === 'number' ? comment.likes : 0,
      isLiked: comment.is_liked === 1 || comment.isLiked === true,
    };

    console.log('Transformed comment:', transformedComment);
    return transformedComment;
  } catch (error) {
    console.error('Error transforming comment data:', error);
    return null;
  }
};

// Get authorization headers with fallback handling
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }
  } else {
    console.log('No current user for token, using headerless request');
  }
  
  return headers;
};

// New helper function to fetch posts from joined communities
const fetchPostsFromJoinedCommunities = async (userId: string): Promise<Post[]> => {
  try {
    console.log("Fetching posts from joined communities");
    const joinedCommunities = await fetchJoinedCommunities();
    
    if (joinedCommunities.length === 0) {
      console.log("User hasn't joined any communities");
      return [];
    }
    
    console.log(`User has joined ${joinedCommunities.length} communities`);
    
    let allPosts: Post[] = [];
    
    // Fetch posts for each joined community
    for (const community of joinedCommunities) {
      try {
        console.log(`Fetching posts for community: ${community.id}`);
        const communityPosts = await fetchCommunityPosts(String(community.id));
        allPosts = [...allPosts, ...communityPosts];
      } catch (communityError) {
        console.error(`Error fetching posts for community ${community.id}:`, communityError);
      }
    }
    
    // Sort posts by createdAt (newest first)
    allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log(`Fetched ${allPosts.length} total posts from all joined communities`);
    return allPosts;
  } catch (error) {
    console.error("Error fetching posts from joined communities:", error);
    return [];
  }
};

// Fetch all posts for a user's feed (includes joined communities)
export const fetchFeedPosts = async (userId?: string): Promise<Post[]> => {
  try {
    // Get current user ID if not provided, with fallback
    const currentUserId = userId || await getCurrentUserId();
    console.log(`Fetching feed posts for user: ${currentUserId}`);
    
    // If no auth.currentUser and using fallback ID, directly get posts from joined communities
    if (currentUserId === FALLBACK_USER_ID && !auth.currentUser) {
      console.log(`Using fallback ID, skipping API call and fetching from joined communities directly`);
      return fetchPostsFromJoinedCommunities(currentUserId);
    }
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/feed?userId=${currentUserId}`, {
      signal: controller.signal,
      headers: await getAuthHeaders()
    });
    
    clearTimeout(timeoutId);
    
    // Process the response
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      
      // Better fallback: If the feed endpoint fails, fetch posts from each joined community
      return fetchPostsFromJoinedCommunities(currentUserId);
    }
    
    const data = await res.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // Transform posts and filter out any null values
      const validPosts = data.map(transformPost).filter(post => post !== null) as Post[];
      console.log(`Fetched ${validPosts.length} valid posts from API`);
      return validPosts;
    } else {
      console.log("No posts returned from API, falling back to joined communities");
      return fetchPostsFromJoinedCommunities(currentUserId);
    }
  } catch (err) {
    console.error('Error fetching feed posts:', err);
    // Get current user ID with fallback
    const currentUserId = userId || await getCurrentUserId();
    return fetchPostsFromJoinedCommunities(currentUserId);
  }
};

// Fetch posts for a specific community
export const fetchCommunityPosts = async (communityId: string | number): Promise<Post[]> => {
  try {
    const validCommunityId = validateId(communityId);
    if (!validCommunityId) {
      console.warn('Invalid community ID for post fetch:', communityId);
      return [];
    }
    
    // Get user ID with fallback
    const userId = await getCurrentUserId();
    console.log(`Fetching posts for community: ${validCommunityId} with userId: ${userId}`);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const apiUrl = getApiBaseUrl();
    
    // Make sure we're using the right endpoint format
    const res = await fetch(`${apiUrl}/posts/community/${validCommunityId}?userId=${userId}`, {
      signal: controller.signal,
      headers: await getAuthHeaders()
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error fetching posts: ${res.status} ${res.statusText}`);
      
      if (res.status === 404) {
        console.warn(`Community ${validCommunityId} might not exist`);
      }
      
      throw new Error(`Failed to fetch community posts: ${res.status}`);
    }
    
    const data = await res.json();
    console.log(`Raw data for community ${validCommunityId}:`, data);
    
    // Transform posts and filter out any null values
    const validPosts = Array.isArray(data) 
      ? data.map(transformPost).filter(post => post !== null) as Post[]
      : [];
      
    console.log(`Successfully fetched ${validPosts.length} posts for community ${validCommunityId}`);
    return validPosts;
  } catch (err) {
    console.error(`Error fetching posts for community: ${communityId}`, err);
    // Return empty array for better UX
    return [];
  }
};

// Fetch a single post by ID
export const fetchPost = async (postId: string | number): Promise<Post | null> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn(`Invalid post ID: ${postId}`);
      return null;
    }
    
    console.log(`Fetching post with ID: ${validPostId}`);
    
    // Get user ID for the request
    const userId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/${validPostId}?userId=${userId}`, {
      signal: controller.signal,
      headers: await getAuthHeaders()
    });
    
    clearTimeout(timeoutId);
    
    // Handle different response status codes
    if (res.status === 404) {
      console.warn(`Post not found with ID: ${validPostId}`);
      return null;
    }
    
    if (!res.ok) {
      console.warn(`Error response from API: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to fetch post: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log(`Raw post data for ID ${validPostId}:`, data);
    
    const postData = data.post || data;
    
    // Enhanced validation: try to transform the post
    const post = transformPost(postData);
    
    if (!post) {
      console.warn(`Invalid post data returned for ID: ${validPostId}`);
      return null;
    }
    
    console.log(`Successfully fetched post: ${validPostId}`);
    return post;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for post ${postId} timed out`);
    } else {
      console.error(`Error fetching post by ID: ${postId}`, err);
    }
    
    return null;
  }
};

// Create a new post
export const createPost = async (
  communityId: string | number,
  content: string,
  imageUri?: string | null
): Promise<Post | null> => {
  try {
    const validCommunityId = validateId(communityId);
    if (!validCommunityId) {
      console.warn('Invalid community ID for post creation:', communityId);
      return null;
    }
    
    if (!content || content.trim() === '') {
      console.warn('Empty content for post creation');
      return null;
    }
    
    console.log(`Creating new post in community: ${validCommunityId}`);
    
    // Get current user ID
    const currentUserId = await getCurrentUserId();
    
    // In a real app, handle image upload first if imageUri exists
    let finalImageUrl = imageUri;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (longer for uploads)
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        user_id: currentUserId,
        community_id: validCommunityId,
        content: content,
        image_url: finalImageUrl || null,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error creating post: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to create post: ${res.status} ${res.statusText}`);
    }
    
    try {
      const data = await res.json();
      const postData = data.post || data;
      
      // Transform post data
      const post = transformPost(postData);
      
      if (!post) {
        console.warn('Invalid data returned from post creation');
        return null;
      }
      
      return post;
    } catch (parseError) {
      console.error('Error parsing post creation response:', parseError);
      return null;
    }
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for post creation timed out');
    } else {
      console.error('Error creating post:', err);
    }
    
    return null;
  }
};

// Toggle like on a post
export const toggleLikePost = async (
  postId: string | number,
  isCurrentlyLiked: boolean
): Promise<boolean> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn('Invalid post ID for like toggle:', postId);
      return false;
    }
    
    console.log(`Toggling like for post: ${validPostId}, currently liked: ${isCurrentlyLiked}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Determine endpoint based on current like status
    const endpoint = isCurrentlyLiked
      ? `${getApiBaseUrl()}/posts/${validPostId}/unlike`
      : `${getApiBaseUrl()}/posts/${validPostId}/like`;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ userId: currentUserId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error toggling like: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during like toggle, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Successfully toggled like for post: ${validPostId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for like toggle on post ${postId} timed out`);
    } else {
      console.error(`Error toggling like for post: ${postId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Fetch comments for a post
export const fetchComments = async (postId: string | number): Promise<Comment[]> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn(`Invalid post ID for comment fetch: ${postId}`);
      return [];
    }
    
    console.log(`Fetching comments for post: ${validPostId}`);
    
    // Get user ID for the request
    const userId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/${validPostId}/comments?userId=${userId}`, {
      signal: controller.signal,
      headers: await getAuthHeaders()
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error fetching comments: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to fetch comments: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log(`Raw comments data for post ${validPostId}:`, data);
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // Transform comments and filter out any null values
      const validComments = data.map(transformComment).filter(comment => comment !== null) as Comment[];
      console.log(`Successfully fetched ${validComments.length} comments for post ${validPostId}`);
      return validComments;
    }
    
    // If it's in the { comments: [] } format
    if (data.comments && Array.isArray(data.comments)) {
      // Transform comments and filter out any null values
      const validComments = data.comments.map(transformComment).filter(comment => comment !== null) as Comment[];
      console.log(`Successfully fetched ${validComments.length} comments for post ${validPostId}`);
      return validComments;
    }
    
    // If no valid format is found
    console.warn('Invalid format for comments data:', data);
    return [];
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for comments on post ${postId} timed out`);
    } else {
      console.error(`Error fetching comments for post: ${postId}`, err);
    }
    
    // Return empty array instead of mock comments
    return [];
  }
};

// Create a comment on a post
export const createComment = async (
  postId: string | number,
  content: string
): Promise<Comment | null> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn('Invalid post ID for comment creation:', postId);
      return null;
    }
    
    if (!content || content.trim() === '') {
      console.warn('Empty content for comment creation');
      return null;
    }
    
    console.log(`Creating new comment on post: ${validPostId}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/${validPostId}/comments`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        user_id: currentUserId,
        content: content.trim(),
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error creating comment: ${res.status} ${res.statusText}`);
      
      // Log the response text for debugging
      try {
        const errorText = await res.text();
        console.error(`Comment creation error response: ${errorText}`);
      } catch (e) {
        console.error('Could not read error response');
      }
      
      throw new Error(`Failed to create comment: ${res.status} ${res.statusText}`);
    }
    
    try {
      const data = await res.json();
      console.log('Comment creation response:', data);
      
      // The backend might return the comment directly or wrapped in a response object
      const commentData = data.comment || data;
      
      // Transform comment data
      const comment = transformComment(commentData);
      
      if (!comment) {
        console.warn('Invalid data returned from comment creation');
        return null;
      }
      
      console.log('Successfully created comment:', comment);
      return comment;
    } catch (parseError) {
      console.error('Error parsing comment creation response:', parseError);
      return null;
    }
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for comment on post ${postId} creation timed out`);
    } else {
      console.error(`Error creating comment on post: ${postId}`, err);
    }
    
    return null;
  }
};

// Toggle like on a comment
export const toggleLikeComment = async (
  commentId: string | number,
  isCurrentlyLiked: boolean
): Promise<boolean> => {
  try {
    const validCommentId = validateId(commentId);
    if (!validCommentId) {
      console.warn('Invalid comment ID for like toggle:', commentId);
      return false;
    }
    
    console.log(`Toggling like for comment: ${validCommentId}, currently liked: ${isCurrentlyLiked}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Determine endpoint based on current like status
    const endpoint = isCurrentlyLiked
      ? `${getApiBaseUrl()}/comments/${validCommentId}/unlike`
      : `${getApiBaseUrl()}/comments/${validCommentId}/like`;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ userId: currentUserId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error toggling comment like: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during comment like toggle, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Successfully toggled like for comment: ${validCommentId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for comment like toggle ${commentId} timed out`);
    } else {
      console.error(`Error toggling like for comment: ${commentId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Delete a post (owner or admin only)
export const deletePost = async (postId: string | number): Promise<boolean> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn('Invalid post ID for deletion:', postId);
      return false;
    }
    
    console.log(`Deleting post: ${validPostId}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/${validPostId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ userId: currentUserId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error deleting post: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during deletion, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Post deleted successfully: ${validPostId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for post deletion ${postId} timed out`);
    } else {
      console.error(`Error deleting post: ${postId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Delete a comment (owner or admin only)
export const deleteComment = async (commentId: string | number): Promise<boolean> => {
  try {
    const validCommentId = validateId(commentId);
    if (!validCommentId) {
      console.warn('Invalid comment ID for deletion:', commentId);
      return false;
    }
    
    console.log(`Deleting comment: ${validCommentId}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/comments/${validCommentId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ userId: currentUserId }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error deleting comment: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for optimistic UI update
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during comment deletion, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Comment deleted successfully: ${validCommentId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for comment deletion ${commentId} timed out`);
    } else {
      console.error(`Error deleting comment: ${commentId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Edit a post (owner only)
export const editPost = async (
  postId: string | number, 
  content: string,
  imageUri?: string | null
): Promise<Post | null> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn('Invalid post ID for edit:', postId);
      return null;
    }
    
    if (!content || content.trim() === '') {
      console.warn('Empty content for post edit');
      return null;
    }
    
    console.log(`Editing post: ${validPostId}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // In a real app, handle image upload first if imageUri changes
    let finalImageUrl = imageUri;
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/${validPostId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        userId: currentUserId,
        content: content,
        image_url: finalImageUrl || null,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error editing post: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to edit post: ${res.status} ${res.statusText}`);
    }
    
    try {
      const data = await res.json();
      const postData = data.post || data;
      
      // Transform post data
      const post = transformPost(postData);
      
      if (!post) {
        console.warn('Invalid data returned from post edit');
        return null;
      }
      
      return post;
    } catch (parseError) {
      console.error('Error parsing post edit response:', parseError);
      return null;
    }
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for post edit ${postId} timed out`);
    } else {
      console.error(`Error editing post: ${postId}`, err);
    }
    
    return null;
  }
};

// Edit a comment (owner only)
export const editComment = async (
  commentId: string | number, 
  content: string
): Promise<Comment | null> => {
  try {
    const validCommentId = validateId(commentId);
    if (!validCommentId) {
      console.warn('Invalid comment ID for edit:', commentId);
      return null;
    }
    
    if (!content || content.trim() === '') {
      console.warn('Empty content for comment edit');
      return null;
    }
    
    console.log(`Editing comment: ${validCommentId}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/comments/${validCommentId}`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        userId: currentUserId,
        content: content,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error editing comment: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to edit comment: ${res.status} ${res.statusText}`);
    }
    
    try {
      const data = await res.json();
      const commentData = data.comment || data;
      
      // Transform comment data
      const comment = transformComment(commentData);
      
      if (!comment) {
        console.warn('Invalid data returned from comment edit');
        return null;
      }
      
      return comment;
    } catch (parseError) {
      console.error('Error parsing comment edit response:', parseError);
      return null;
    }
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for comment edit ${commentId} timed out`);
    } else {
      console.error(`Error editing comment: ${commentId}`, err);
    }
    
    return null;
  }
};

// Report a post for inappropriate content
export const reportPost = async (
  postId: string | number,
  reason: string
): Promise<boolean> => {
  try {
    const validPostId = validateId(postId);
    if (!validPostId) {
      console.warn('Invalid post ID for reporting:', postId);
      return false;
    }
    
    if (!reason || reason.trim() === '') {
      console.warn('Empty reason for reporting post');
      return false;
    }
    
    console.log(`Reporting post: ${validPostId} with reason: ${reason}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/${validPostId}/report`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        userId: currentUserId,
        reason: reason,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error reporting post: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for UI feedback
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during post reporting, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Post reported successfully: ${validPostId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for post report ${postId} timed out`);
    } else {
      console.error(`Error reporting post: ${postId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Report a comment for inappropriate content
export const reportComment = async (
  commentId: string | number,
  reason: string
): Promise<boolean> => {
  try {
    const validCommentId = validateId(commentId);
    if (!validCommentId) {
      console.warn('Invalid comment ID for reporting:', commentId);
      return false;
    }
    
    if (!reason || reason.trim() === '') {
      console.warn('Empty reason for reporting comment');
      return false;
    }
    
    console.log(`Reporting comment: ${validCommentId} with reason: ${reason}`);
    
    // Get user ID
    const currentUserId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/comments/${validCommentId}/report`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        userId: currentUserId,
        reason: reason,
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error reporting comment: ${res.status} ${res.statusText}`);
      
      // For connectivity issues, still return success for UI feedback
      if (res.status === 0 || res.status >= 500) {
        console.log('Server error during comment reporting, using optimistic update');
        return true;
      }
      
      return false;
    }
    
    console.log(`Comment reported successfully: ${validCommentId}`);
    return true;
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error(`Fetch request for comment report ${commentId} timed out`);
    } else {
      console.error(`Error reporting comment: ${commentId}`, err);
    }
    
    // For network errors, still return success for optimistic UI update
    return true;
  }
};

// Get trending posts across all communities
export const getTrendingPosts = async (limit: number = 10): Promise<Post[]> => {
  try {
    // Get user ID with fallback
    const userId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/trending?userId=${userId}&limit=${limit}`, {
      signal: controller.signal,
      headers: await getAuthHeaders()
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error fetching trending posts: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to fetch trending posts: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // Transform posts and filter out any null values
      const validPosts = data.map(transformPost).filter(post => post !== null) as Post[];
      return validPosts.slice(0, limit);
    }
    
    // If it's in the { posts: [] } format
    if (data.posts && Array.isArray(data.posts)) {
      // Transform posts and filter out any null values
      const validPosts = data.posts.map(transformPost).filter(post => post !== null) as Post[];
      return validPosts.slice(0, limit);
    }
    
    // If no valid format is found
    console.warn('Invalid format for trending posts data:', data);
    return [];
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for trending posts timed out');
    } else {
      console.error('Error fetching trending posts:', err);
    }
    
    return [];
  }
};

// Search posts by keyword
export const searchPosts = async (query: string): Promise<Post[]> => {
  try {
    if (!query || query.trim() === '') {
      return [];
    }
    
    // Get user ID with fallback
    const userId = await getCurrentUserId();
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/posts/search?userId=${userId}&q=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: await getAuthHeaders()
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`Error searching posts: ${res.status} ${res.statusText}`);
      throw new Error(`Failed to search posts: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      // Transform posts and filter out any null values
      const validPosts = data.map(transformPost).filter(post => post !== null) as Post[];
      return validPosts;
    }
    
    // If it's in the { posts: [] } format
    if (data.posts && Array.isArray(data.posts)) {
      // Transform posts and filter out any null values
      const validPosts = data.posts.map(transformPost).filter(post => post !== null) as Post[];
      return validPosts;
    }
    
    // If no valid format is found
    console.warn('Invalid format for post search data:', data);
    return [];
  } catch (err) {
    // Handle fetch timeout/abort error specifically
    if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
      console.error('Fetch request for post search timed out');
    } else {
      console.error('Error searching posts:', err);
    }
    
    return [];
  }
};