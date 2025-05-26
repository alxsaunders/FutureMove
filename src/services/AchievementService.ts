import { Platform, Alert } from "react-native";
import axios, { AxiosError } from 'axios';
import { auth } from "../config/firebase";

// Debug flag - set to true to enable detailed logging
const DEBUG_ACHIEVEMENTS = true;

// Achievement milestones
export const ACHIEVEMENT_MILESTONES = [7, 14, 30, 90];

// Achievement categories
export const ACHIEVEMENT_CATEGORIES = [
  "Personal",
  "Work", 
  "Learning",
  "Health",
  "Repair",
  "Finance"
];

// Achievement interface
export interface Achievement {
  id: string;
  category: string;
  milestone: number;
  isUnlocked: boolean;
  completedGoals: number;
  title: string;
  description: string;
  coverImage: any;
  badgeImage: any;
  unlockedAt?: Date;
}

// Achievement stats interface
export interface AchievementStats {
  categories: Record<string, { completed: number; total: number }>;
  totalAchievements: number;
  unlockedAchievements: number;
}

// API Response interfaces
export interface AchievementCheckResponse {
  success: boolean;
  message: string;
  newAchievements: Achievement[];
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
  success?: boolean;
  message?: string;
}

// Fallback user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

// Utility function for logging
const logDebug = (message: string, data?: any) => {
  if (DEBUG_ACHIEVEMENTS) {
    if (data) {
      console.log(`[ACHIEVEMENTS] ${message}`, data);
    } else {
      console.log(`[ACHIEVEMENTS] ${message}`);
    }
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
    logDebug(`Using authenticated user ID: ${currentUser.uid}`);
    return currentUser.uid;
  }
  
  logDebug(`No current user, using fallback ID: ${FALLBACK_USER_ID}`);
  return FALLBACK_USER_ID;
};

// Get API base URL based on platform
export const getApiBaseUrl = (): string => {
  if (Platform.OS === "android") {
    logDebug("Using Android API base URL");
    return 'http://10.0.2.2:3001/api';
  } else {
    logDebug("Using iOS/Mac API base URL");
    return 'http://192.168.1.207:3001/api';
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
      logDebug("Added auth token to headers");
    } catch (error) {
      logDebug('Failed to get auth token:', error);
    }
  } else {
    logDebug('No current user for token, using headerless request');
  }
  
  return headers;
};

// Achievement titles mapping
const ACHIEVEMENT_TITLES: Record<string, Record<number, string>> = {
  Personal: {
    7: "Personal Pioneer",
    14: "Self Sovereign",
    30: "Identity Architect",
    90: "Legendary Life Curator",
  },
  Work: {
    7: "Productivity Prodigy",
    14: "Workflow Wizard",
    30: "Career Cornerstone",
    90: "Executive Excellence",
  },
  Learning: {
    7: "Knowledge Seeker",
    14: "Wisdom Weaver",
    30: "Skill Sculptor",
    90: "Grand Scholar",
  },
  Health: {
    7: "Vitality Voyager",
    14: "Wellness Warrior",
    30: "Health Harmonizer",
    90: "Peak Performance Paragon",
  },
  Repair: {
    7: "Fixer Fledgling",
    14: "Restoration Ranger",
    30: "Mending Master",
    90: "Legendary Rebuilder",
  },
  Finance: {
    7: "Fiscal Foundling",
    14: "Wealth Warden",
    30: "Money Maestro",
    90: "Fortune Forger",
  },
};

// Achievement images mapping
const ACHIEVEMENT_IMAGES: Record<string, Record<number, { cover: any; badge: any }>> = {
  Personal: {
    7: {
      cover: require("../assets/images/achivements-futuremove/Personal/Personal_Pioneer.png"),
      badge: require("../assets/images/achivements-futuremove/Personal/Personal_Pioneer_Badge.png"),
    },
    14: {
      cover: require("../assets/images/achivements-futuremove/Personal/Self_Sovereign.png"),
      badge: require("../assets/images/achivements-futuremove/Personal/Self_Sovereign_Badge.png"),
    },
    30: {
      cover: require("../assets/images/achivements-futuremove/Personal/Identity_Architect.png"),
      badge: require("../assets/images/achivements-futuremove/Personal/Identity_Architect_Badge.png"),
    },
    90: {
      cover: require("../assets/images/achivements-futuremove/Personal/Legendary_Life_Curator.png"),
      badge: require("../assets/images/achivements-futuremove/Personal/Legendary_Life_Curator_Badge.png"),
    },
  },
  Work: {
    7: {
      cover: require("../assets/images/achivements-futuremove/Work/Productivity_Prodigy.png"),
      badge: require("../assets/images/achivements-futuremove/Work/Productivity_Prodigy_Badge.png"),
    },
    14: {
      cover: require("../assets/images/achivements-futuremove/Work/Workflow_Wizard.png"),
      badge: require("../assets/images/achivements-futuremove/Work/Workflow_Wizard_Badge.png"),
    },
    30: {
      cover: require("../assets/images/achivements-futuremove/Work/Career_Cornerstone.png"),
      badge: require("../assets/images/achivements-futuremove/Work/Career_Cornerstone_Badge.png"),
    },
    90: {
      cover: require("../assets/images/achivements-futuremove/Work/Executive_Excellence.png"),
      badge: require("../assets/images/achivements-futuremove/Work/Executive_Excellence_Badge.png"),
    },
  },
  Learning: {
    7: {
      cover: require("../assets/images/achivements-futuremove/Learning/Knowledge_Seeker.png"),
      badge: require("../assets/images/achivements-futuremove/Learning/Knowledge_Seeker_Badge.png"),
    },
    14: {
      cover: require("../assets/images/achivements-futuremove/Learning/Wisdom_Weaver.png"),
      badge: require("../assets/images/achivements-futuremove/Learning/Wisdom_Weaver_Badge.png"),
    },
    30: {
      cover: require("../assets/images/achivements-futuremove/Learning/Skill_Sculptor.png"),
      badge: require("../assets/images/achivements-futuremove/Learning/Skill_Sculptor_Badge.png"),
    },
    90: {
      cover: require("../assets/images/achivements-futuremove/Learning/Grand_Scholar.png"),
      badge: require("../assets/images/achivements-futuremove/Learning/Grand_Scholar_Badge.png"),
    },
  },
  Health: {
    7: {
      cover: require("../assets/images/achivements-futuremove/Health/Vitality_Voyager.png"),
      badge: require("../assets/images/achivements-futuremove/Health/Vitality_Voyager_Badge.png"),
    },
    14: {
      cover: require("../assets/images/achivements-futuremove/Health/Wellness_Warrior.png"),
      badge: require("../assets/images/achivements-futuremove/Health/Wellness_Warrior_Badge.png"),
    },
    30: {
      cover: require("../assets/images/achivements-futuremove/Health/Health_Harmonizer.png"),
      badge: require("../assets/images/achivements-futuremove/Health/Health_Harmonizer_Badge.png"),
    },
    90: {
      cover: require("../assets/images/achivements-futuremove/Health/Peak_Performance_Paragon.png"),
      badge: require("../assets/images/achivements-futuremove/Health/Peak_Performance_Paragon_Badge.png"),
    },
  },
  Repair: {
    7: {
      cover: require("../assets/images/achivements-futuremove/Repair/Fixer_Fledgling.png"),
      badge: require("../assets/images/achivements-futuremove/Repair/Fixer_Fledgling_Badge.png"),
    },
    14: {
      cover: require("../assets/images/achivements-futuremove/Repair/Restoration_Ranger.png"),
      badge: require("../assets/images/achivements-futuremove/Repair/Restoration_Ranger_Badge.png"),
    },
    30: {
      cover: require("../assets/images/achivements-futuremove/Repair/Mending_Master.png"),
      badge: require("../assets/images/achivements-futuremove/Repair/Mending_Master_Badge.png"),
    },
    90: {
      cover: require("../assets/images/achivements-futuremove/Repair/Legendary_Rebuilder.png"),
      badge: require("../assets/images/achivements-futuremove/Repair/Legendary_Rebuilder_Badge.png"),
    },
  },
  Finance: {
    7: {
      cover: require("../assets/images/achivements-futuremove/Finance/Fiscal_Foundling.png"),
      badge: require("../assets/images/achivements-futuremove/Finance/Fiscal_Foundling_Badge.png"),
    },
    14: {
      cover: require("../assets/images/achivements-futuremove/Finance/Wealth_Warden.png"),
      badge: require("../assets/images/achivements-futuremove/Finance/Wealth_Warden_Badge.png"),
    },
    30: {
      cover: require("../assets/images/achivements-futuremove/Finance/Money_Maestro.png"),
      badge: require("../assets/images/achivements-futuremove/Finance/Money_Maestro_Badge.png"),
    },
    90: {
      cover: require("../assets/images/achivements-futuremove/Finance/Fortune_Forger.png"),
      badge: require("../assets/images/achivements-futuremove/Finance/Fortune_Forger_Badge.png"),
    },
  },
};

// Test endpoint connectivity
export const testAchievementConnection = async (): Promise<boolean> => {
  try {
    logDebug('Testing achievement connection...');
    const response = await axios.get(`${getApiBaseUrl()}/achievements/test`, {
      timeout: 5000,
    });
    logDebug('✅ Achievement connection successful:', response.data);
    return true;
  } catch (error) {
    logDebug('❌ Achievement connection failed:', error);
    return false;
  }
};

// Fetch user's achievement statistics
export const fetchUserAchievements = async (userId?: string): Promise<AchievementStats> => {
  try {
    const validUserId = userId || await getCurrentUserId();
    logDebug(`Fetching achievements for user: ${validUserId}`);
    
    const headers = await getAuthHeaders();
    // ✅ FIXED: Now using correct endpoint
    const response = await axios.get(`${getApiBaseUrl()}/achievements/users/${validUserId}/achievements`, {
      headers,
      timeout: 10000,
    });

    logDebug(`✅ Achievement stats received:`, response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching user achievements:", error);
    logDebug(`❌ Error fetching achievements: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    
    // Return default stats if API fails
    const defaultStats: AchievementStats = {
      categories: {},
      totalAchievements: ACHIEVEMENT_CATEGORIES.length * ACHIEVEMENT_MILESTONES.length,
      unlockedAchievements: 0,
    };

    ACHIEVEMENT_CATEGORIES.forEach(category => {
      defaultStats.categories[category] = { completed: 0, total: 0 };
    });

    return defaultStats;
  }
};

// Check for new achievements when a goal is completed
export const checkForNewAchievements = async (
  goalCategory: string,
  userId?: string
): Promise<Achievement[]> => {
  try {
    const validUserId = userId || await getCurrentUserId();
    
    if (!goalCategory || goalCategory.trim() === '') {
      logDebug('Empty goal category provided');
      return [];
    }
    
    logDebug(`Checking for new achievements in category: ${goalCategory} for user: ${validUserId}`);
    
    const headers = await getAuthHeaders();
    // ✅ FIXED: Now using correct endpoint
    const response = await axios.post(`${getApiBaseUrl()}/achievements/users/${validUserId}/achievements/check`, {
      category: goalCategory
    }, {
      headers,
      timeout: 10000,
    });

    logDebug(`✅ Achievement check response:`, response.data);
    return response.data.newAchievements || [];
  } catch (error) {
    console.error("Error checking for new achievements:", error);
    logDebug(`❌ Error checking achievements: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    
    return [];
  }
};

// Get achievement summary for dashboard
export const getAchievementSummary = async (userId?: string): Promise<{
  unlockedAchievements: number;
  totalAchievements: number;
  progressPercentage: number;
  recentAchievements: Achievement[];
}> => {
  try {
    const validUserId = userId || await getCurrentUserId();
    logDebug(`Fetching achievement summary for user: ${validUserId}`);
    
    const headers = await getAuthHeaders();
    // ✅ FIXED: Now using correct endpoint
    const response = await axios.get(`${getApiBaseUrl()}/achievements/users/${validUserId}/achievements/summary`, {
      headers,
      timeout: 5000,
    });

    logDebug(`✅ Achievement summary response:`, response.data);
    
    // Transform recent achievements to match our Achievement interface
    const recentAchievements = (response.data.recentAchievements || []).map((achievement: any) => ({
      id: achievement.id || achievement.achievement_id,
      category: achievement.category,
      milestone: achievement.milestone,
      isUnlocked: true,
      completedGoals: 0,
      title: achievement.title,
      description: achievement.description,
      coverImage: getAchievementImages(achievement.category, achievement.milestone).cover,
      badgeImage: getAchievementImages(achievement.category, achievement.milestone).badge,
      unlockedAt: achievement.unlocked_at ? new Date(achievement.unlocked_at) : undefined,
    }));

    return {
      unlockedAchievements: response.data.unlockedAchievements || 0,
      totalAchievements: response.data.totalAchievements || 24,
      progressPercentage: response.data.progressPercentage || 0,
      recentAchievements
    };
  } catch (error) {
    console.error("Error fetching achievement summary:", error);
    logDebug(`❌ Error fetching summary: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    
    return {
      unlockedAchievements: 0,
      totalAchievements: 24,
      progressPercentage: 0,
      recentAchievements: []
    };
  }
};

// Get user's achievement progress for a specific category
export const getCategoryProgress = async (
  category: string,
  userId?: string
): Promise<{ completed: number; total: number }> => {
  try {
    const validUserId = userId || await getCurrentUserId();
    
    if (!category || category.trim() === '') {
      logDebug('Empty category for progress fetch');
      return { completed: 0, total: 0 };
    }
    
    logDebug(`Fetching progress for category: ${category}, user: ${validUserId}`);
    
    const headers = await getAuthHeaders();
    // ✅ FIXED: Now using correct endpoint
    const response = await axios.get(`${getApiBaseUrl()}/achievements/users/${validUserId}/achievements/category/${category}`, {
      headers,
      timeout: 5000,
    });

    logDebug(`✅ Category progress response:`, response.data);
    return {
      completed: response.data.completedGoals || 0,
      total: response.data.totalAchievements || 4
    };
  } catch (error) {
    console.error(`Error fetching progress for category ${category}:`, error);
    logDebug(`❌ Error fetching category progress: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    
    return { completed: 0, total: 0 };
  }
};

// Get achievements for a specific category
export const getCategoryAchievements = async (
  category: string,
  userId?: string
): Promise<Achievement[]> => {
  try {
    const validUserId = userId || await getCurrentUserId();
    
    if (!category || category.trim() === '') {
      logDebug('Empty category for achievements fetch');
      return [];
    }
    
    logDebug(`Fetching achievements for category: ${category}, user: ${validUserId}`);
    
    const headers = await getAuthHeaders();
    // ✅ FIXED: Now using correct endpoint
    const response = await axios.get(`${getApiBaseUrl()}/achievements/users/${validUserId}/achievements/category/${category}`, {
      headers,
      timeout: 5000,
    });

    logDebug(`✅ Category achievements response:`, response.data);
    
    // Transform the response to our Achievement interface
    const achievements = (response.data.achievements || []).map((achievement: any) => ({
      id: achievement.id || `${category.toLowerCase()}_${achievement.milestone}`,
      category: achievement.category || category,
      milestone: achievement.milestone,
      isUnlocked: achievement.isUnlocked || false,
      completedGoals: achievement.completedGoals || response.data.completedGoals || 0,
      title: achievement.title || getAchievementTitle(category, achievement.milestone),
      description: achievement.description || getAchievementDescription(category, achievement.milestone),
      coverImage: getAchievementImages(category, achievement.milestone).cover,
      badgeImage: getAchievementImages(category, achievement.milestone).badge,
      unlockedAt: achievement.unlockedAt ? new Date(achievement.unlockedAt) : undefined,
    }));

    return achievements;
  } catch (error) {
    console.error(`Error fetching achievements for category ${category}:`, error);
    logDebug(`❌ Error fetching category achievements: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    
    // Return default achievements for category
    return ACHIEVEMENT_MILESTONES.map(milestone => 
      createAchievement(category, milestone, false, 0)
    );
  }
};

// Get achievement system structure
export const getAchievementStructure = async (): Promise<{
  categories: string[];
  milestones: number[];
  titles: Record<string, Record<number, string>>;
  totalAchievements: number;
}> => {
  try {
    logDebug(`Fetching achievement system structure`);
    
    // ✅ FIXED: Now using correct endpoint
    const response = await axios.get(`${getApiBaseUrl()}/achievements/structure`, {
      timeout: 5000,
    });

    logDebug(`✅ Achievement structure response:`, response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching achievement structure:", error);
    logDebug(`❌ Error fetching structure: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return local structure as fallback
    return {
      categories: ACHIEVEMENT_CATEGORIES,
      milestones: ACHIEVEMENT_MILESTONES,
      titles: ACHIEVEMENT_TITLES,
      totalAchievements: ACHIEVEMENT_CATEGORIES.length * ACHIEVEMENT_MILESTONES.length
    };
  }
};

// Get all achievements for a user (used by AchievementsScreen)
export const getAllUserAchievements = async (userId?: string): Promise<Achievement[]> => {
  try {
    const validUserId = userId || await getCurrentUserId();
    logDebug(`Fetching all achievements for user: ${validUserId}`);
    
    const headers = await getAuthHeaders();
    const response = await axios.get(`${getApiBaseUrl()}/achievements/users/${validUserId}/achievements`, {
      headers,
      timeout: 10000,
    });

    logDebug(`✅ User achievements response:`, response.data);
    
    // ✅ NEW: Backend now returns ALL achievements with their status
    if (response.data.achievements && Array.isArray(response.data.achievements)) {
      const achievements = response.data.achievements.map((achievement: any) => ({
        id: achievement.id || `${achievement.category.toLowerCase()}_${achievement.milestone}`,
        category: achievement.category,
        milestone: achievement.milestone,
        isUnlocked: achievement.isUnlocked === true, // Ensure boolean
        completedGoals: achievement.completedGoals || 0,
        title: achievement.title || getAchievementTitle(achievement.category, achievement.milestone),
        description: achievement.description || getAchievementDescription(achievement.category, achievement.milestone),
        coverImage: getAchievementImages(achievement.category, achievement.milestone).cover,
        badgeImage: getAchievementImages(achievement.category, achievement.milestone).badge,
        unlockedAt: achievement.unlockedAt ? new Date(achievement.unlockedAt) : undefined,
      }));
      
      logDebug(`Transformed ${achievements.length} achievements (${achievements.filter(a => a.isUnlocked).length} unlocked)`);
      return achievements;
    }
    
    // Fallback: build ALL achievements from category stats
    const stats = response.data;
    const achievements: Achievement[] = [];

    ACHIEVEMENT_CATEGORIES.forEach((category) => {
      const categoryStats = stats.categories[category] || { completed: 0, total: 0 };
      
      ACHIEVEMENT_MILESTONES.forEach((milestone) => {
        const isUnlocked = categoryStats.completed >= milestone;
        const achievement = createAchievement(
          category,
          milestone,
          isUnlocked,
          categoryStats.completed
        );
        achievements.push(achievement);
      });
    });

    logDebug(`Created ${achievements.length} achievement objects from stats (${achievements.filter(a => a.isUnlocked).length} unlocked)`);
    return achievements;
  } catch (error) {
    console.error("Error getting all user achievements:", error);
    logDebug(`❌ Error getting all achievements: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logDebug(`Response status: ${error.response.status}`);
      logDebug(`Response data:`, error.response.data);
    }
    
    // Return ALL achievements as locked if API fails
    const defaultAchievements: Achievement[] = [];
    
    ACHIEVEMENT_CATEGORIES.forEach((category) => {
      ACHIEVEMENT_MILESTONES.forEach((milestone) => {
        const achievement = createAchievement(category, milestone, false, 0);
        defaultAchievements.push(achievement);
      });
    });

    logDebug(`Returning ${defaultAchievements.length} default locked achievements`);
    return defaultAchievements;
  }
};

// UTILITY FUNCTIONS

// Get achievement title
export const getAchievementTitle = (category: string, milestone: number): string => {
  return ACHIEVEMENT_TITLES[category]?.[milestone] || `${category} Achievement`;
};

// Get achievement description
export const getAchievementDescription = (category: string, milestone: number): string => {
  return `Complete ${milestone} goals in ${category}`;
};

// Get achievement images
export const getAchievementImages = (category: string, milestone: number): { cover: any; badge: any } => {
  const defaultImages = {
    cover: require("../assets/images/achivements-futuremove/Personal/Personal_Pioneer.png"), // fallback
    badge: require("../assets/images/achivements-futuremove/Personal/Personal_Pioneer_Badge.png"), // fallback
  };

  return ACHIEVEMENT_IMAGES[category]?.[milestone] || defaultImages;
};

// Create achievement object with all data
export const createAchievement = (
  category: string,
  milestone: number,
  isUnlocked: boolean = false,
  completedGoals: number = 0
): Achievement => {
  const images = getAchievementImages(category, milestone);
  
  return {
    id: `${category.toLowerCase()}_${milestone}`,
    category,
    milestone,
    isUnlocked,
    completedGoals,
    title: getAchievementTitle(category, milestone),
    description: getAchievementDescription(category, milestone),
    coverImage: images.cover,
    badgeImage: images.badge,
  };
};

// Check if user qualifies for a specific achievement
export const checkAchievementQualification = (
  completedGoals: number,
  milestone: number
): boolean => {
  return completedGoals >= milestone;
};

// Calculate overall achievement progress percentage
export const calculateAchievementProgress = (stats: AchievementStats): number => {
  if (stats.totalAchievements === 0) return 0;
  return Math.round((stats.unlockedAchievements / stats.totalAchievements) * 100);
};

// Get achievements by category
export const getAchievementsByCategory = (achievements: Achievement[], category: string): Achievement[] => {
  return achievements.filter(achievement => 
    achievement.category.toLowerCase() === category.toLowerCase()
  );
};

// Get unlocked achievements
export const getUnlockedAchievements = (achievements: Achievement[]): Achievement[] => {
  return achievements.filter(achievement => achievement.isUnlocked);
};

// Get locked achievements
export const getLockedAchievements = (achievements: Achievement[]): Achievement[] => {
  return achievements.filter(achievement => !achievement.isUnlocked);
};

// Get next milestone for category
export const getNextMilestone = (category: string, currentCompleted: number): number | null => {
  const nextMilestone = ACHIEVEMENT_MILESTONES.find(milestone => milestone > currentCompleted);
  return nextMilestone || null;
};

// Get category progress percentage
export const getCategoryProgressPercentage = (completed: number, nextMilestone: number): number => {
  if (nextMilestone === 0) return 100;
  return Math.min(Math.round((completed / nextMilestone) * 100), 100);
};

// Get category color for UI
export const getCategoryColor = (category: string): string => {
  switch (category.toLowerCase()) {
    case 'personal':
      return '#8E24AA';
    case 'work':
      return '#1976D2';
    case 'learning':
      return '#388E3C';
    case 'health':
      return '#D32F2F';
    case 'repair':
      return '#F57C00';
    case 'finance':
      return '#00796B';
    default:
      return '#424242';
  }
};

// NOTIFICATION FUNCTIONS

// Show achievement notification with custom image
export const showAchievementNotification = (achievement: Achievement): void => {
  Alert.alert(
    "🏆 Achievement Unlocked!",
    `${achievement.title}\n\n${achievement.description}\n\nYou've completed ${achievement.milestone} goals in ${achievement.category}!`,
    [
      { 
        text: "Awesome!", 
        style: "default",
        onPress: () => logDebug("Achievement notification acknowledged")
      }
    ]
  );
};

// Process new achievements and show notifications
export const processNewAchievements = (newAchievements: Achievement[]): void => {
  logDebug(`Processing ${newAchievements.length} new achievements`);
  
  newAchievements.forEach((achievement, index) => {
    setTimeout(() => {
      showAchievementNotification(achievement);
    }, index * 1000); // Stagger notifications by 1 second each
  });
};