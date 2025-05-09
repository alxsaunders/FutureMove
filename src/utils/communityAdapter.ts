// src/utils/communityAdapter.ts
import { Community } from "../types";

/**
 * Adapts the community data from API format to UI format
 * This ensures that all required properties from the UI Community type are present
 */
export const adaptCommunity = (apiCommunity: any): Community => {
  // Create the adapted community object based on your actual Community type structure
  return {
    id: apiCommunity.id || apiCommunity.community_id,
    name: apiCommunity.name,
    description: apiCommunity.description || "",
    category: apiCommunity.category || "",
    image: apiCommunity.image_url || apiCommunity.image || null,
    members: apiCommunity.members_count || apiCommunity.member_count || apiCommunity.members || 0,
    posts: apiCommunity.posts_count || apiCommunity.posts || 0,
    
    // Add the missing isJoined property with proper fallbacks
    isJoined: apiCommunity.is_joined === true || 
              apiCommunity.is_joined === 1 || 
              apiCommunity.is_joined === "1" || 
              apiCommunity.isJoined === true ||
              apiCommunity.isJoined === 1 || 
              apiCommunity.isJoined === "1" || 
              false
  };
};