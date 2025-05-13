// src/screens/ProfileScreen.tsx
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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { fetchUserProfile, updateUserProfile, ExtendedUserProfile } from "../services/ProfileService";
import { getUserStreaks } from "../services/GoalService";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { currentUser, logout } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streakCount, setStreakCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    if (!currentUser) return;
    
    setIsLoading(true);
    try {
      // Fetch extended profile data
      const userData = await fetchUserProfile(currentUser.id);
      setProfileData(userData);
      
      // Get user's streaks
      const streaks = await getUserStreaks();
      setStreakCount(streaks);
    } catch (error) {
      console.error("Error loading profile data:", error);
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to change your profile picture.");
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    
    if (!result.canceled && result.assets[0]) {
      uploadProfileImage(result.assets[0].uri);
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!currentUser) return;
    
    setIsUploading(true);
    try {
      // Create a blob from the file
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Upload to firebase
      const fileName = `profile_${currentUser.id}_${Date.now()}`;
      const imageUrl = await updateUserProfile(currentUser.id, { profileImage: blob, fileName });
      
      // Update local state
      if (profileData && typeof imageUrl === 'string') {
        setProfileData({
          ...profileData,
          profileImage: imageUrl,
        });
      }
      
      Alert.alert("Success", "Profile picture updated successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert("Error", "Failed to upload profile picture. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditProfile = () => {
    if (profileData) {
      navigation.navigate("EditProfile", { profileData, onUpdateProfile: loadProfileData });
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Logout", 
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              // Navigation will be handled by the auth listener in App.js
            } catch (error) {
              console.error("Error logging out:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          }
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  // Ensure we have a user
  if (!currentUser || !profileData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Please log in to view your profile</Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.backButtonText}>Log In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {isUploading ? (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="small" color={COLORS.white} />
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickImage}>
                <Image
                  source={
                    profileData.profileImage
                      ? { uri: profileData.profileImage }
                      : require("../assets/default-avatar.png")
                  }
                  style={styles.profileImage}
                />
                <View style={styles.editImageButton}>
                  <Ionicons name="camera" size={14} color={COLORS.white} />
                </View>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.userName}>
            {profileData.name || "User"}
          </Text>
          
          <Text style={styles.userUsername}>
            @{profileData.username || currentUser.id.substring(0, 8) || "user"}
          </Text>
          
          <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
            <Ionicons name="create-outline" size={16} color={COLORS.white} />
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{streakCount}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="trophy" size={28} color="#FFD700" />
            <Text style={styles.statValue}>{currentUser.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="logo-bitcoin" size={28} color="#FF9500" />
            <Text style={styles.statValue}>{currentUser.future_coins}</Text>
            <Text style={styles.statLabel}>FutureCoins</Text>
          </View>
        </View>
        
        {/* Completed Goals Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges & Achievements</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Achievements")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
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
                    defaultSource={require("../assets/images/placeholder-badge.png")} 
                  />
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyBadges}>
                <Ionicons name="ribbon-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Complete goals to earn badges</Text>
              </View>
            )}
          </ScrollView>
        </View>
        
        {/* Activity Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate("ActivityHistory")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {profileData.recentActivity && profileData.recentActivity.length > 0 ? (
            profileData.recentActivity.map((activity, index) => (
              <View key={index} style={styles.activityItem}>
                <View style={styles.activityIconContainer}>
                  <Ionicons 
                    name={
                      activity.type === "goal_completed" 
                        ? "checkmark-circle" 
                        : activity.type === "level_up" 
                        ? "arrow-up-circle" 
                        : "star"
                    } 
                    size={24} 
                    color={COLORS.primary} 
                  />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityText}>{activity.description}</Text>
                  <Text style={styles.activityTime}>{formatTimeAgo(activity.timestamp)}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyActivity}>
              <Ionicons name="time-outline" size={32} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          )}
        </View>
        
        {/* Communities Section */}
        <View style={[styles.sectionContainer, { marginBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Communities</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Communities")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
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
                    defaultSource={require("../assets/images/placeholder-badge.png")} 
                  />
                  <Text style={styles.communityName}>{community.name}</Text>
                  <Text style={styles.communityMembers}>{community.memberCount} members</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCommunities}>
                <Ionicons name="people-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>Join communities to connect with others</Text>
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
    marginBottom: 16,
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
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: COLORS.cardBackground,
  },
  profileImageContainer: {
    height: 100,
    width: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileImage: {
    height: 100,
    width: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  imageLoading: {
    height: 100,
    width: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  editImageButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.cardBackground,
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
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    marginTop: 8,
    marginBottom: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    marginBottom: 8,
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
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
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
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyActivity: {
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
    width: 100,
  },
  communityIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  communityName: {
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  communityMembers: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  emptyCommunities: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    width: "100%",
  },
});

export default ProfileScreen;