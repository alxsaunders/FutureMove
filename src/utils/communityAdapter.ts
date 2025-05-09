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
    image: apiCommunity.image_url || apiCommunity.image || "",
    members: apiCommunity.members_count || apiCommunity.members || 0,
    posts: apiCommunity.posts_count || apiCommunity.posts || 0,
    
    // Add any other required properties from your Community interface
    // If you need to map createdBy or created_by, make sure to use the correct property name
    // that exists in your Community interface
  };
};