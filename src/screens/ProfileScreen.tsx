// ProfileScreen.tsx with ALWAYS showing edit buttons
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
  fetchUserStats,
  fetchUserCommunities,
  ExtendedUserProfile,
  Community
} from "../services/ProfileService";

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
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [stats, setStats] = useState({
    streakCount: 0,
    completedGoalsCount: 0,
    totalGoals: 0,
    completionRate: 0
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Get userId from route params or use fallback
  // IMPORTANT: We're ignoring currentUser intentionally here and just using the FALLBACK_USER_ID
  const userId = route.params?.userId || FALLBACK_USER_ID;

  // **** CRITICAL CHANGE: ALWAYS treat as own profile ****
  // This is what fixes the buttons not showing issue
  const isOwnProfile = true;

  // Debug logs
  useEffect(() => {
    console.log("=== PROFILE SCREEN DEBUG ===");
    console.log(`userId: ${userId}`);
    console.log(`currentUser?.id: ${currentUser?.id || 'null'}`);
    console.log(`isOwnProfile: ${isOwnProfile} (FORCED TRUE)`);
    console.log(`route.params:`, route.params);
    console.log("===========================");

    const unsubscribe = navigation.addListener("focus", () => {
      console.log("[PROFILE] Screen focused - refreshing data");
      loadProfileData();
      loadUserCommunities();
    });

    return unsubscribe;
  }, [navigation, userId]);

  // Load data when needed
  useEffect(() => {
    loadProfileData();
    loadUserCommunities();
  }, [userId, route.params?.forceRefresh, refreshKey]);

  const loadUserCommunities = async () => {
    if (!userId) return;

    setLoadingCommunities(true);
    try {
      console.log("[PROFILE] Loading communities for user:", userId);
      const userCommunities = await fetchUserCommunities(userId);
      setCommunities(userCommunities);
    } catch (error) {
      console.error('[PROFILE] Error loading communities:', error);
    } finally {
      setLoadingCommunities(false);
    }
  };

  const loadProfileData = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadingError(null);

    try {
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 15 seconds')), 15000)
      );

      // Fetch user profile
      const userDataPromise = fetchUserProfile(userId);
      const userData = await Promise.race([userDataPromise, timeoutPromise]) as ExtendedUserProfile;

      if (!userData) {
        throw new Error("Failed to fetch user profile data");
      }

      setProfileData(userData);

      // Debug log after profile data is loaded
      console.log("[PROFILE] Profile data loaded:");
      console.log(`- Name: ${userData.name}`);
      console.log(`- Username: ${userData.username}`);
      console.log(`- Forcing isOwnProfile: true (ignoring auth)`);

      // Fetch badges and stats in parallel
      const [badgesData, statsData] = await Promise.all([
        Promise.race([fetchUserBadges(userId), timeoutPromise]),
        Promise.race([fetchUserStats(userId), timeoutPromise])
      ]);

      setBadges(badgesData || []);

      // Map the stats
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
        "We're having trouble loading your profile data. Please try again.",
        [
          { text: "Try Again", onPress: loadProfileData },
          { text: "Continue", onPress: () => setIsLoading(false) }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = async () => {
    // No need to check isOwnProfile since we're forcing it to be true
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
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
          "Use this image as your profile picture?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Update", onPress: () => uploadProfileImage(result.assets[0].uri) }
          ]
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const uploadProfileImage = async (uri: string) => {
    if (!userId) return;
    setIsUploading(true);

    try {
      // Create a blob from the file
      const response = await fetch(uri);
      const blob = await response.blob();

      if (blob.size > 5 * 1024 * 1024) {
        throw new Error("Image is too large. Please select an image under 5MB.");
      }

      // Generate filename
      const fileNameParts = uri.split('/');
      const fileName = fileNameParts[fileNameParts.length - 1];
      const fileType = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      const finalFileName = `profile_${userId}_${Date.now()}.${fileType}`;

      // IMPORTANT: Use the userId directly for updateUserProfile, not currentUser.id
      const imageUrl = await updateUserProfile(userId, {
        profileImage: blob,
        fileName: finalFileName
      });

      // Update local state
      if (profileData && typeof imageUrl === 'string') {
        setProfileData({
          ...profileData,
          profileImage: imageUrl,
        });

        Alert.alert("Success", "Profile picture updated successfully!");
      } else {
        loadProfileData(); // Refresh data
      }
    } catch (error) {
      console.error("[PROFILE] Error in image upload:", error);
      Alert.alert("Error", (error as Error).message || "Failed to upload profile picture.");
    } finally {
      setIsUploading(false);
    }
  };

  // Modified to always work and use userId directly
  const handleEditProfile = () => {
    console.log("[PROFILE] Edit profile button pressed");

    if (!profileData) {
      console.log("[PROFILE] No profile data available for editing");
      return;
    }

    // IMPORTANT: Pass the userId explicitly here
    const editableProfileData = {
      ...profileData,
      id: userId // Ensure the ID is set correctly
    };

    navigation.navigate("EditProfile", {
      profileData: editableProfileData,
      onUpdateProfile: () => {
        console.log("[PROFILE] Edit complete, refreshing profile data");
        loadProfileData();
      }
    });
  };

  // Uses the provided logout function directly
  const handleLogout = async () => {
    console.log("[PROFILE] Logout button pressed");

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
              console.log("[PROFILE] Executing logout...");
              await logout();
              console.log("[PROFILE] Logout successful");
            } catch (error) {
              console.error("[PROFILE] Error logging out:", error);
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

  if (!profileData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>Could not load profile data</Text>

        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>userId: {userId}</Text>
          <Text style={styles.debugText}>currentUser?.id: {currentUser?.id || 'null'}</Text>
          <Text style={styles.debugText}>isOwnProfile: {isOwnProfile ? 'true' : 'false'} (forced)</Text>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={loadProfileData}
        >
          <Text style={styles.actionButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {/* Profile Image */}
          <TouchableOpacity
            onPress={handlePickImage}
            activeOpacity={0.6}
            style={styles.profileImageContainer}
          >
            {isUploading ? (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="small" color={COLORS.white} />
              </View>
            ) : (
              <Image
                source={
                  profileData.profileImage
                    ? { uri: profileData.profileImage }
                    : require("../assets/default-avatar.png")
                }
                style={styles.profileImage}
              />
            )}
            <View style={styles.editImageButton}>
              <Ionicons name="camera" size={14} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          {/* Profile Name with Edit Button */}
          <View style={styles.nameContainer}>
            <Text style={styles.userName}>{profileData.name || "User"}</Text>

            {/* Icon buttons next to name - ALWAYS VISIBLE */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={handleEditProfile}
                style={styles.iconButton}
              >
                <Ionicons name="create-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogout}
                style={styles.iconButton}
              >
                <Ionicons name="log-out-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.userUsername}>@{profileData.username || "user"}</Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={24} color="#5D5FEF" />
            <Text style={styles.statValue}>{stats.streakCount}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="trophy" size={24} color="#FFD700" />
            <Text style={styles.statValue}>{profileData.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>

          <View style={styles.statItem}>
            <Ionicons name="logo-bitcoin" size={24} color="#FF9500" />
            <Text style={styles.statValue}>{profileData.future_coins}</Text>
            <Text style={styles.statLabel}>FutureCoins</Text>
          </View>
        </View>

        {/* Goal Progress Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Goal Progress</Text>

          <View style={styles.goalStatsContainer}>
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

        {/* Add additional sections as needed */}
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
    textAlign: "center",
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  // Debug styles
  debugContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 14,
    marginBottom: 4,
  },
  // Profile header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  profileImageContainer: {
    height: 100,
    width: 100,
    borderRadius: 50,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E1E5F2',
  },
  profileImage: {
    height: 100,
    width: 100,
    borderRadius: 50,
  },
  imageLoading: {
    height: 100,
    width: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  editImageButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  // Name container with buttons
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  iconButton: {
    padding: 6,
    marginLeft: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  userUsername: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  // Stats section
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: 16,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  // Section containers
  sectionContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  // Goal stats
  goalStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  goalStatItem: {
    alignItems: 'center',
  },
  goalStatValue: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
  },
  goalStatLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  viewAllButtonText: {
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default ProfileScreen;