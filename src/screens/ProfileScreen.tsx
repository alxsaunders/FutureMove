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
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchUserProfile,
  updateUserProfile,
  fetchUserBadges,
  commendUser,
  removeCommend,
  fetchUserStats,
  ExtendedUserProfile
} from "../services/ProfileService";
import { getUserStreaks } from "../services/GoalService";

// EMERGENCY FALLBACK - replace with a valid user ID from your database
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, logout } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [badges, setBadges] = useState([]);
  const [stats, setStats] = useState({
    streakCount: 0,
    completedGoalsCount: 0,
    totalGoals: 0,
    completionRate: 0
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Add refresh key for force reloading

  // Get userId from route params, current user, or use fallback - same logic as ItemShopScreen
  const userId = route.params?.userId || (currentUser ? currentUser.id : FALLBACK_USER_ID);

  useEffect(() => {
    // Log the user ID being used
    console.log(`[PROFILE] Using userId: ${userId}, currentUser: ${currentUser?.id || 'none'}`);

    // Add a focus listener to refresh when the screen comes into focus
    const unsubscribe = navigation.addListener("focus", () => {
      console.log("[PROFILE] Screen focused - refreshing data");
      loadProfileData();
    });

    // Clean up the listener when component unmounts
    return unsubscribe;
  }, [navigation, userId]);

  // Fetch profile data when userId or refreshKey changes
  useEffect(() => {
    loadProfileData();
  }, [userId, route.params?.forceRefresh, refreshKey]);

  const loadProfileData = async () => {
    if (!userId) {
      console.log("[PROFILE] No userId available, skipping fetch");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingError(null);
    console.log(`[PROFILE] Loading profile data for user: ${userId}`);

    try {
      // Create timeout promise to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
      );

      console.log("[PROFILE] Fetching user profile data");
      // Fetch user profile with timeout race
      const userDataPromise = fetchUserProfile(userId);
      const userData = await Promise.race([userDataPromise, timeoutPromise]) as ExtendedUserProfile;
      console.log("[PROFILE] User profile data received:", JSON.stringify(userData));

      if (!userData) {
        throw new Error("Failed to fetch user profile data");
      }

      // Update state with profile data
      setProfileData(userData);

      console.log("[PROFILE] Fetching badges and stats");
      // Fetch badges and stats in parallel
      const [badgesData, statsData] = await Promise.all([
        Promise.race([fetchUserBadges(userId), timeoutPromise]),
        Promise.race([fetchUserStats(userId), timeoutPromise])
      ]);

      console.log("[PROFILE] Stats data received:", JSON.stringify(statsData));
      console.log("[PROFILE] Badges and stats received:",
        badgesData ? "badges success" : "badges failed",
        statsData ? "stats success" : "stats failed"
      );

      // Update state with secondary data
      setBadges(badgesData || []);

      // Map the stats from the server format to our local format
      setStats({
        streakCount: statsData?.currentStreak || 0,
        completedGoalsCount: statsData?.completedGoals || 0,
        totalGoals: statsData?.totalGoals || 0,
        completionRate: statsData?.completionRate || 0
      });

    } catch (error) {
      console.error("[PROFILE] Error loading profile data:", error);
      setLoadingError((error as Error).message || "Unknown error");
      Alert.alert(
        "Error Loading Profile",
        "We're having trouble loading your profile data. Please check your internet connection and try again.",
        [
          { text: "Try Again", onPress: loadProfileData },
          { text: "Continue", onPress: () => setIsLoading(false) }
        ]
      );
    } finally {
      console.log("[PROFILE] Finished loading profile data");
      setIsLoading(false);
    }
  };

  // Function to force a screen refresh
  const refreshScreen = () => {
    setRefreshKey((prevKey) => prevKey + 1);
  };

  // Modified image handling with error handling for Firebase
  const handlePickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to change your profile picture.");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        Alert.alert(
          "Update Profile Picture",
          "Do you want to use this image as your profile picture?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Update",
              onPress: () => uploadProfileImage(result.assets[0].uri)
            }
          ]
        );
      }
    } catch (error) {
      console.error("[PROFILE] Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!userId) return;

    setIsUploading(true);
    try {
      console.log("[PROFILE] Starting image upload process");

      // Get file info
      const fileNameParts = uri.split('/');
      const fileName = fileNameParts[fileNameParts.length - 1];

      // Get file type
      const fileType = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      console.log(`[PROFILE] Image file type: ${fileType}`);

      // Create a blob from the file
      const response = await fetch(uri);
      const blob = await response.blob();
      console.log(`[PROFILE] Created blob of size: ${blob.size} bytes`);

      // Size validation
      if (blob.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error("Image is too large. Please select an image under 5MB.");
      }

      // Upload to firebase and update profile
      const finalFileName = `profile_${userId}_${Date.now()}.${fileType}`;
      console.log(`[PROFILE] Uploading as: ${finalFileName}`);

      try {
        const imageUrl = await updateUserProfile(userId, {
          profileImage: blob,
          fileName: finalFileName
        });

        // Update local state
        if (profileData && typeof imageUrl === 'string') {
          console.log(`[PROFILE] Upload successful, new URL: ${imageUrl}`);
          setProfileData({
            ...profileData,
            profileImage: imageUrl,
          });
          Alert.alert("Success", "Profile picture updated successfully!");
        } else {
          // Even though the upload failed, the Firebase Storage operation might have succeeded
          // Refresh data to get the latest profile
          console.log("[PROFILE] Profile update response unclear, refreshing data");
          loadProfileData();
        }
      } catch (uploadError) {
        console.error("[PROFILE] Firebase upload error:", uploadError);

        // Handle Firebase specific errors
        let errorMessage = "Failed to upload profile picture. Please try again.";
        if (uploadError.message && uploadError.message.includes("Firebase Storage")) {
          // Handle specific Firebase errors
          if (uploadError.message.includes("not authorized")) {
            errorMessage = "You don't have permission to upload images. Please contact support.";
          } else if (uploadError.message.includes("retry limit exceeded")) {
            errorMessage = "Network issue while uploading. Please check your connection and try again.";
          }
        }

        Alert.alert("Upload Error", errorMessage);
      }
    } catch (error) {
      console.error("[PROFILE] Error in image upload process:", error);
      Alert.alert("Error", (error as Error).message || "Failed to upload profile picture. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditProfile = () => {
    if (profileData) {
      navigation.navigate("EditProfile", {
        profileData,
        onUpdateProfile: loadProfileData
      });
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
              console.error("[PROFILE] Error logging out:", error);
              Alert.alert("Error", "Failed to log out. Please try again.");
            }
          }
        },
      ]
    );
  };

  // Special case: If still loading after 20 seconds, show stuck loading alert
  useEffect(() => {
    let stuckLoadingTimer: NodeJS.Timeout;
    if (isLoading) {
      stuckLoadingTimer = setTimeout(() => {
        Alert.alert(
          "Still Loading...",
          "It's taking longer than expected to load your profile. Would you like to try again?",
          [
            { text: "Keep Waiting", style: "cancel" },
            { text: "Try Again", onPress: loadProfileData }
          ]
        );
      }, 20000);
    }

    return () => {
      if (stuckLoadingTimer) clearTimeout(stuckLoadingTimer);
    };
  }, [isLoading]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
        {loadingError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{loadingError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadProfileData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // If we don't have profile data, show error state
  if (!profileData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>Could not load profile data</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={loadProfileData}
        >
          <Text style={styles.backButtonText}>Try Again</Text>
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
          {currentUser && (
            <TouchableOpacity onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            {isUploading ? (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="small" color={COLORS.white} />
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => currentUser && currentUser.id === userId ? handlePickImage() : null}
                activeOpacity={currentUser && currentUser.id === userId ? 0.6 : 1}
              >
                <Image
                  source={
                    profileData.profileImage
                      ? { uri: profileData.profileImage }
                      : require("../assets/default-avatar.png")
                  }
                  style={styles.profileImage}
                />
                {currentUser && currentUser.id === userId && (
                  <View style={styles.editImageButton}>
                    <Ionicons name="camera" size={14} color={COLORS.white} />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.userName}>
            {profileData.name || "User"}
          </Text>

          <Text style={styles.userUsername}>
            @{profileData.username || (userId ? userId.substring(0, 8) : "user")}
          </Text>

          {currentUser && currentUser.id === userId && (
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={16} color={COLORS.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{stats.streakCount}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="trophy" size={28} color="#FFD700" />
            <Text style={styles.statValue}>{profileData.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="logo-bitcoin" size={28} color="#FF9500" />
            <Text style={styles.statValue}>{profileData.future_coins}</Text>
            <Text style={styles.statLabel}>FutureCoins</Text>
          </View>
        </View>

        {/* Goal Stats Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Goal Progress</Text>
          </View>

          <View style={styles.goalStatsRow}>
            <View style={styles.goalStatItem}>
              <Text style={styles.goalStatValue}>{stats.completedGoalsCount}</Text>
              <Text style={styles.goalStatLabel}>Completed</Text>
            </View>

            <View style={styles.goalStatItem}>
              <Text style={styles.goalStatValue}>{stats.totalGoals}</Text>
              <Text style={styles.goalStatLabel}>Total Goals</Text>
            </View>

            <View style={styles.goalStatItem}>
              <Text style={styles.goalStatValue}>{stats.completionRate}%</Text>
              <Text style={styles.goalStatLabel}>Completion Rate</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={() => navigation.navigate("Goals")}
          >
            <Text style={styles.viewAllButtonText}>View All Goals</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Badges & Achievements Section */}
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
            {badges && badges.length > 0 ? (
              badges.map((badge, index) => (
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

        {/* Communities Section - Placeholder until implemented */}
        <View style={[styles.sectionContainer, { marginBottom: 20 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Communities</Text>
            <TouchableOpacity onPress={() => navigation.navigate("Communities")}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.emptyCommunities}>
            <Ionicons name="people-outline" size={32} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Join communities to connect with others</Text>
            <TouchableOpacity
              style={[styles.viewAllButton, { marginTop: 16 }]}
              onPress={() => navigation.navigate("Communities")}
            >
              <Text style={styles.viewAllButtonText}>Browse Communities</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  errorContainer: {
    marginTop: 16,
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontWeight: "600",
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
  goalStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  goalStatItem: {
    alignItems: "center",
    flex: 1,
  },
  goalStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  goalStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  viewAllButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
    marginRight: 8,
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
  emptyCommunities: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    width: "100%",
  }
});

export default ProfileScreen;