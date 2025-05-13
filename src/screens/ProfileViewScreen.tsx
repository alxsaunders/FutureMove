// src/screens/ProfileViewScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { 
  fetchUserProfile, 
  followUser, 
  unfollowUser, 
  checkIfFollowing,
  ExtendedUserProfile 
} from "../services/ProfileService";

const ProfileViewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, [userId]);

  const loadProfileData = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const userData = await fetchUserProfile(userId);
      setProfileData(userData);
      
      // Check if current user is following this user
      if (currentUser) {
        const followStatus = await checkIfFollowing(currentUser.id, userId);
        setIsFollowing(followStatus);
      }
    } catch (error) {
      console.error("Error loading profile data:", error);
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUser) {
      // Prompt user to log in or sign up
      Alert.alert(
        "Authentication Required",
        "You need to be logged in to follow users.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
      return;
    }
    
    setIsToggling(true);
    try {
      if (isFollowing) {
        // Unfollow
        await unfollowUser(currentUser.id, userId);
        setIsFollowing(false);
      } else {
        // Follow
        await followUser(currentUser.id, userId);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error("Error toggling follow status:", error);
      Alert.alert("Error", "Failed to update follow status. Please try again.");
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!profileData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={
              profileData.profileImage
                ? { uri: profileData.profileImage }
                : require("../assets/default-avatar.png")
            }
            style={styles.profileImage}
          />
          
          <Text style={styles.userName}>
            {profileData.name || "User"}
          </Text>
          
          <Text style={styles.userUsername}>
            @{profileData.username || userId.substring(0, 8) || "user"}
          </Text>
          
          <View style={styles.userStats}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profileData.numFollowers || 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            
            <View style={styles.statDivider} />
            
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profileData.numFollowing || 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
          
          {/* Don't show follow button for own profile */}
          {currentUser && currentUser.id !== userId && (
            <TouchableOpacity 
              style={[
                styles.followButton, 
                isFollowing ? styles.followingButton : null
              ]}
              onPress={handleToggleFollow}
              disabled={isToggling}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color={isFollowing ? COLORS.primary : COLORS.white} />
              ) : (
                <>
                  <Ionicons 
                    name={isFollowing ? "checkmark" : "add"} 
                    size={16} 
                    color={isFollowing ? COLORS.primary : COLORS.white} 
                  />
                  <Text 
                    style={[
                      styles.followButtonText,
                      isFollowing ? styles.followingButtonText : null
                    ]}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        {/* About Section */}
        {profileData.bio && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{profileData.bio}</Text>
          </View>
        )}
        
        {/* User Stats Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Stats</Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statGridItem}>
              <Ionicons name="trophy" size={28} color="#FFD700" />
              <Text style={styles.statValue}>{profileData.level}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            
            <View style={styles.statGridItem}>
              <Ionicons name="star" size={28} color="#5E6CE7" />
              <Text style={styles.statValue}>{profileData.xp_points || 0}</Text>
              <Text style={styles.statLabel}>XP Points</Text>
            </View>
            
            <View style={styles.statGridItem}>
              <Ionicons name="calendar" size={28} color="#4CAF50" />
              <Text style={styles.statValue}>
                {Math.floor((new Date().getTime() - new Date(profileData.created_at).getTime()) / (1000 * 60 * 60 * 24))}
              </Text>
              <Text style={styles.statLabel}>Days Active</Text>
            </View>
          </View>
        </View>
        
        {/* Badges & Achievements Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges & Achievements</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {profileData.badges && profileData.badges.length > 0 ? (
              profileData.badges.map((badge, index) => (
                <View key={index} style={styles.badgeItem}>
                  <Image 
                    source={{ uri: badge.icon }} 
                    style={styles.badgeIcon}
                    defaultSource={require("../assets/placeholder-badge.png")} 
                  />
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyBadges}>
                <Ionicons name="ribbon-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No badges yet</Text>
              </View>
            )}
          </ScrollView>
        </View>
        
        {/* Posts Section */}
        <View style={[styles.sectionContainer, { marginBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Posts</Text>
          </View>
          
          {profileData.recentPosts && profileData.recentPosts.length > 0 ? (
            profileData.recentPosts.map((post, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.postItem}
                onPress={() => navigation.navigate("PostDetail", { postId: post.id })}
              >
                <View style={styles.postHeader}>
                  <Text style={styles.postCommunity}>{post.communityName}</Text>
                  <Text style={styles.postTime}>{formatTimeAgo(post.createdAt)}</Text>
                </View>
                
                <Text style={styles.postContent} numberOfLines={2}>
                  {post.content}
                </Text>
                
                {post.image && (
                  <Image 
                    source={{ uri: post.image }} 
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                )}
                
                <View style={styles.postActions}>
                  <View style={styles.postAction}>
                    <Ionicons name="heart-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>{post.likes}</Text>
                  </View>
                  
                  <View style={styles.postAction}>
                    <Ionicons name="chatbubble-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>{post.comments}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyPosts}>
              <Ionicons name="document-text-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No posts yet</Text>
            </View>
          )}
        </View>
        
        {/* Communities Section */}
        <View style={[styles.sectionContainer, { marginBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Communities</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.communitiesContainer}
          >
            {profileData.communities && profileData.communities.length > 0 ? (
              profileData.communities.map((community, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.communityItem}
                  onPress={() => navigation.navigate("CommunityDetail", { communityId: community.id })}
                >
                  <Image 
                    source={{ uri: community.icon }} 
                    style={styles.communityIcon}
                    defaultSource={require("../assets/placeholder-community.png")} 
                  />
                  <Text style={styles.communityName}>{community.name}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCommunities}>
                <Ionicons name="people-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No communities joined</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper function to format timestamps
const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} days ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  
  return `${Math.floor(months / 12)} years ago`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: COLORS.cardBackground,
  },
  profileImage: {
    height: 100,
    width: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  userStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statColumn: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followingButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  followButtonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontWeight: "600",
  },
  followingButtonText: {
    color: COLORS.primary,
  },
  sectionContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statGridItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 16
  },
  badgesContainer: {
    paddingBottom: 8,
  },
  badgeItem: {
    alignItems: "center",
    marginRight: 16,
    width: 80,
  },
  badgeIcon: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    textAlign: "center",
    color: COLORS.text,
  },
  emptyBadges: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    width: "100%",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  postItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  postCommunity: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  postTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  postContent: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: "row",
  },
  postAction: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  actionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  emptyPosts: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  communitiesContainer: {
    paddingBottom: 8,
  },
  communityItem: {
    alignItems: "center",
    marginRight: 16,
    width: 80,
  },
  communityIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  communityName: {
    fontSize: 12,
    textAlign: "center",
    color: COLORS.text,
  },
  emptyCommunities: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    width: "100%",
  },
});

export default ProfileViewScreen;