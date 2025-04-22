// src/services/CommunityService.ts
import { Community } from "../types";

const API_URL = 'http://10.0.2.2:3001/api'; // Emulator localhost

// Fetch all communities
export const fetchCommunities = async (userId: string = 'default_user'): Promise<Community[]> => {
  try {
    const res = await fetch(`${API_URL}/communities`);
    if (!res.ok) throw new Error('Failed to fetch communities');
    const data = await res.json();
    
    // Handle different response formats
    if (Array.isArray(data)) {
      return data.map(community => ({
        id: community.community_id || community.id,
        name: community.name,
        category: community.category,
        members: community.members_count || community.members || 0,
        posts: community.posts_count || community.posts || 0,
        image: community.image_url || community.image || `https://via.placeholder.com/150/${getCategoryColor(community.category)}/FFFFFF`,
        description: community.description || "",
        isJoined: community.is_joined === 1 || community.isJoined === true,
      }));
    }
    
    // If it's in the { communities: [] } format
    if (data.communities && Array.isArray(data.communities)) {
      return data.communities.map(community => ({
        id: community.community_id || community.id,
        name: community.name,
        category: community.category,
        members: community.members_count || community.members || 0,
        posts: community.posts_count || community.posts || 0,
        image: community.image_url || community.image || `https://via.placeholder.com/150/${getCategoryColor(community.category)}/FFFFFF`,
        description: community.description || "",
        isJoined: community.is_joined === 1 || community.isJoined === true,
      }));
    }
    
    // If no valid format is found
    return [];
  } catch (err) {
    console.error('Error fetching communities:', err);
    
    // Return mock data for development
    return MOCK_COMMUNITIES;
  }
};

// Join a community
export const joinCommunity = async (communityId: string, userId: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_URL}/communities/${communityId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    if (!res.ok) throw new Error('Failed to join community');
    return true;
  } catch (err) {
    console.error('Error joining community:', err);
    
    // For development, just return success
    return true;
  }
};

// Leave a community
export const leaveCommunity = async (communityId: string, userId: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_URL}/communities/${communityId}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    if (!res.ok) throw new Error('Failed to leave community');
    return true;
  } catch (err) {
    console.error('Error leaving community:', err);
    
    // For development, just return success
    return true;
  }
};

// Get community by ID
export const getCommunityById = async (communityId: string): Promise<Community | null> => {
  try {
    const res = await fetch(`${API_URL}/communities/${communityId}`);
    if (!res.ok) throw new Error('Failed to fetch community');
    
    const community = await res.json();
    
    return {
      id: community.community_id || community.id,
      name: community.name,
      category: community.category,
      members: community.members_count || community.members || 0,
      posts: community.posts_count || community.posts || 0,
      image: community.image_url || community.image || `https://via.placeholder.com/150/${getCategoryColor(community.category)}/FFFFFF`,
      description: community.description || "",
      isJoined: community.is_joined === 1 || community.isJoined === true,
    };
  } catch (err) {
    console.error('Error fetching community:', err);
    
    // For development, return a mock community
    const mockCommunity = MOCK_COMMUNITIES.find(c => c.id === communityId);
    return mockCommunity || null;
  }
};

// Helper function to get hex color for a category without # prefix
const getCategoryColor = (category?: string): string => {
  const categoryColors: Record<string, string> = {
    'Health': 'F44336', // Red
    'Learning': '5E6CE7', // Purple
    'Work': '4CAF50', // Green
    'Finance': 'FF9800', // Orange
    'Wellness': '9C27B0', // Deep Purple
    'Repair': '56C3B6', // Teal
  };
  
  return category && categoryColors[category] ? categoryColors[category] : '3B82F6'; // Default blue
};

// Mock data for development
const MOCK_COMMUNITIES: Community[] = [
  {
    id: "1",
    name: "Weight Loss Warriors",
    category: "Health",
    members: 3245,
    posts: 1203,
    image: "https://via.placeholder.com/150/F44336/FFFFFF",
    description: "Supporting each other on our weight loss journeys.",
    isJoined: false,
  },
  {
    id: "2",
    name: "Tech Learners",
    category: "Learning",
    members: 1876,
    posts: 864,
    image: "https://via.placeholder.com/150/5E6CE7/FFFFFF",
    description: "Sharing resources and tips for learning programming and tech skills.",
    isJoined: true,
  },
  {
    id: "3",
    name: "Morning Runners",
    category: "Health",
    members: 2134,
    posts: 1521,
    image: "https://via.placeholder.com/150/F44336/FFFFFF",
    description: "For those who start their day with a refreshing run.",
    isJoined: false,
  },
  {
    id: "4",
    name: "Budget Masters",
    category: "Finance",
    members: 945,
    posts: 432,
    image: "https://via.placeholder.com/150/FF9800/FFFFFF",
    description: "Tips and support for better financial management.",
    isJoined: false,
  },
  {
    id: "5",
    name: "Mindfulness Meditators",
    category: "Wellness",
    members: 1432,
    posts: 876,
    image: "https://via.placeholder.com/150/9C27B0/FFFFFF",
    description: "Finding peace and focus through daily meditation practices.",
    isJoined: true,
  },
  {
    id: "6",
    name: "Home DIY Projects",
    category: "Repair",
    members: 1765,
    posts: 1230,
    image: "https://via.placeholder.com/150/56C3B6/FFFFFF",
    description: "Share your home improvement projects and get inspiration.",
    isJoined: false,
  },
  {
    id: "7",
    name: "Career Growth",
    category: "Work",
    members: 2543,
    posts: 1421,
    image: "https://via.placeholder.com/150/4CAF50/FFFFFF",
    description: "Strategies and support for advancing your career.",
    isJoined: false,
  },
  {
    id: "8",
    name: "Book Reading Challenge",
    category: "Learning",
    members: 1284,
    posts: 654,
    image: "https://via.placeholder.com/150/5E6CE7/FFFFFF",
    description: "Join the challenge to read more books this year.",
    isJoined: true,
  },
];