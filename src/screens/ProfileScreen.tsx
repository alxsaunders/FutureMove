import React, { useState, useEffect, useRef } from "react";
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
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchUserProfile,
  updateUserProfile,
  fetchUserBadges,
  fetchUserStats,
  fetchUserCommunities,
  fetchUserEquippedItems,
  ExtendedUserProfile,
  Community,
  Badge,
} from "../services/ProfileService";
import { getItemImage, hasItemImage } from "../utils/itemImageMapping";

// EMERGENCY FALLBACK - replace with a valid user ID from your database
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

// Interfaces
interface EquippedItem {
  item_id: number;
  name: string;
  description: string;
  image_url: string | null;
  category: string;
  price: number;
  is_equipped: number;
}

interface EquippedItems {
  theme?: EquippedItem;
  profile_ring?: EquippedItem;
  badges: EquippedItem[];
}

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, logout } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [stats, setStats] = useState({
    streakCount: 0,
    completedGoalsCount: 0,
    totalGoals: 0,
    completionRate: 0,
  });
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [returnedFromEdit, setReturnedFromEdit] = useState(false);

  // New state for equipped items
  const [equippedItems, setEquippedItems] = useState<EquippedItems>({
    badges: [],
  });
  const [loadingEquippedItems, setLoadingEquippedItems] = useState(false);

  // Get userId from route params, current user, or use fallback
  const userId =
    route.params?.userId || (currentUser ? currentUser.id : FALLBACK_USER_ID);

  // Check if this is the user's own profile
  const isOwnProfile =
    !route.params?.userId || (currentUser && currentUser.id === userId);

  // Use useFocusEffect for handling screen focus events
  useFocusEffect(
    React.useCallback(() => {
      console.log("[PROFILE] Screen focused - refreshing data");

      const forceRefresh = route.params?.forceRefresh;
      if (forceRefresh) {
        console.log(`[PROFILE] Force refresh triggered: ${forceRefresh}`);
        loadProfileData();
        loadUserCommunities();
        loadUserBadges();
        loadEquippedItems();
      } else {
        loadProfileData();
        loadUserCommunities();
        loadUserBadges();
        loadEquippedItems();
      }

      return () => {};
    }, [route.params?.forceRefresh, userId])
  );

  useEffect(() => {
    console.log(
      `[PROFILE] Using userId: ${userId}, currentUser: ${
        currentUser?.id || "none"
      }, isOwnProfile: ${isOwnProfile}`
    );
  }, [userId, isOwnProfile]);

  const loadUserCommunities = async () => {
    if (!userId) return;

    setLoadingCommunities(true);
    try {
      console.log("[PROFILE] Loading communities for user:", userId);
      const userCommunities = await fetchUserCommunities(userId);
      setCommunities(userCommunities);
    } catch (error) {
      console.error("[PROFILE] Error loading communities:", error);
    } finally {
      setLoadingCommunities(false);
    }
  };

  const loadUserBadges = async () => {
    if (!userId) return;

    setLoadingBadges(true);
    try {
      console.log("[PROFILE] Loading achievement badges for user:", userId);
      const userBadges = await fetchUserBadges(userId);
      console.log(`[PROFILE] Loaded ${userBadges.length} badges:`, userBadges);
      setBadges(userBadges);
    } catch (error) {
      console.error("[PROFILE] Error loading badges:", error);
      setBadges([]);
    } finally {
      setLoadingBadges(false);
    }
  };

  // New function to load equipped items
  const loadEquippedItems = async () => {
    if (!userId) return;

    setLoadingEquippedItems(true);
    try {
      console.log("[PROFILE] Loading equipped items for user:", userId);
      const equipped = await fetchUserEquippedItems(userId);
      setEquippedItems(equipped);
    } catch (error) {
      console.error("[PROFILE] Error loading equipped items:", error);
    } finally {
      setLoadingEquippedItems(false);
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
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Request timeout after 15 seconds")),
          15000
        )
      );

      const userDataPromise = fetchUserProfile(userId);
      const userData = (await Promise.race([
        userDataPromise,
        timeoutPromise,
      ])) as ExtendedUserProfile;

      if (!userData) {
        throw new Error("Failed to fetch user profile data");
      }

      setProfileData(userData);

      const statsData = await Promise.race([
        fetchUserStats(userId),
        timeoutPromise,
      ]);

      setStats({
        streakCount: statsData?.currentStreak || 0,
        completedGoalsCount: statsData?.completedGoals || 0,
        totalGoals: statsData?.totalGoals || 0,
        completionRate: statsData?.completionRate || 0,
      });
    } catch (error) {
      console.error("[PROFILE] Error loading profile data:", error);
      setLoadingError((error as Error).message || "Unknown error");
      Alert.alert(
        "Error Loading Profile",
        "We're having trouble loading your profile data. Please try again.",
        [
          { text: "Try Again", onPress: loadProfileData },
          { text: "Continue", onPress: () => setIsLoading(false) },
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = async () => {
    if (!isOwnProfile) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library."
      );
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
            {
              text: "Update",
              onPress: () => uploadProfileImage(result.assets[0].uri),
            },
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
      const response = await fetch(uri);
      const blob = await response.blob();

      if (blob.size > 5 * 1024 * 1024) {
        throw new Error(
          "Image is too large. Please select an image under 5MB."
        );
      }

      const fileNameParts = uri.split("/");
      const fileName = fileNameParts[fileNameParts.length - 1];
      const fileType = fileName.split(".").pop()?.toLowerCase() || "jpg";
      const finalFileName = `profile_${userId}_${Date.now()}.${fileType}`;

      const imageUrl = await updateUserProfile(userId, {
        profileImage: blob,
        fileName: finalFileName,
      });

      if (profileData && typeof imageUrl === "string") {
        setProfileData({
          ...profileData,
          profileImage: imageUrl,
        });

        Alert.alert("Success", "Profile picture updated successfully!");
      } else {
        loadProfileData();
      }
    } catch (error) {
      console.error("[PROFILE] Error in image upload:", error);
      Alert.alert(
        "Error",
        (error as Error).message || "Failed to upload profile picture."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditProfile = () => {
    if (!isOwnProfile || !profileData) {
      return;
    }

    console.log("[PROFILE] Navigating to EditProfile");

    navigation.navigate("EditProfile", {
      userId: userId,
      profileData: profileData,
    });
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            console.log("[PROFILE] Logging out user");
            await logout();

            navigation.reset({
              index: 0,
              routes: [{ name: "Splash" }],
            });

            console.log(
              "[PROFILE] User logged out and redirected to Splash screen"
            );
          } catch (error) {
            console.error("[PROFILE] Logout error:", error);
            Alert.alert("Error", "Failed to log out. Please try again.");
          }
        },
      },
    ]);
  };

  const navigateToCommunityDetail = (communityId: string | number) => {
    navigation.navigate("Community", {
      screen: "CommunityDetail",
      params: {
        communityId: String(communityId),
        fromProfile: true,
      },
    });
  };

  const handleBadgePress = (badge: Badge) => {
    Alert.alert(
      `🏆 ${badge.name}`,
      `${badge.description}\n\nCategory: ${badge.category}\nMilestone: ${
        badge.milestone
      } goals${
        badge.earned_at
          ? "\n\nEarned: " + new Date(badge.earned_at).toLocaleDateString()
          : ""
      }`,
      [{ text: "Awesome!", style: "default" }]
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
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.errorText}>Could not load profile data</Text>
        <TouchableOpacity style={styles.actionButton} onPress={loadProfileData}>
          <Text style={styles.actionButtonText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Header with Theme Background */}
        <View style={styles.profileHeaderContainer}>
          {/* Theme Background */}
          {equippedItems.theme &&
            hasItemImage(equippedItems.theme.image_url) && (
              <Image
                source={getItemImage(equippedItems.theme.image_url)}
                style={styles.themeBackground}
                resizeMode="cover"
              />
            )}

          {/* Overlay for better text visibility */}
          <View style={styles.themeOverlay} />

          {/* Profile Header Content */}
          <View style={styles.profileHeader}>
            {/* Profile Image with Ring */}
            <TouchableOpacity
              onPress={isOwnProfile ? handlePickImage : undefined}
              activeOpacity={isOwnProfile ? 0.6 : 1}
              style={styles.profileImageWrapper}
            >
              {/* Profile Ring */}
              {equippedItems.profile_ring &&
                hasItemImage(equippedItems.profile_ring.image_url) && (
                  <Image
                    source={getItemImage(equippedItems.profile_ring.image_url)}
                    style={styles.profileRing}
                    resizeMode="contain"
                  />
                )}

              {/* Profile Image Container */}
              <View style={styles.profileImageContainer}>
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
                {isOwnProfile && (
                  <View style={styles.editImageButton}>
                    <Ionicons name="camera" size={14} color={COLORS.white} />
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Profile Name with Edit and Logout Buttons */}
            <View style={styles.nameContainer}>
              <Text style={styles.userName}>{profileData.name || "User"}</Text>
            </View>

            <Text style={styles.userUsername}>
              @{profileData.username || "user"}
            </Text>

            {/* Explicit Edit and Logout Buttons */}
            {isOwnProfile && (
              <View style={styles.explicitButtonsContainer}>
                <TouchableOpacity
                  onPress={handleEditProfile}
                  style={styles.explicitButton}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="create-outline"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.buttonText}>Edit Profile</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleLogout}
                  style={[styles.explicitButton, styles.logoutButton]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="log-out-outline"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.buttonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
            <Image
              source={require("../assets/images/future_coin.png")}
              style={styles.coinIconStat}
            />
            <Text style={styles.statValue}>{profileData.future_coins}</Text>
            <Text style={styles.statLabel}>FutureCoins</Text>
          </View>
        </View>

        {/* Goal Progress Section */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Goal Progress</Text>

          <View style={styles.goalStatsContainer}>
            <View style={styles.goalStatItem}>
              <Text style={styles.goalStatValue}>
                {stats.completedGoalsCount}
              </Text>
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

        {/* UPDATED Badges Section - Combine Achievement Badges with Shop Badges */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <View style={styles.badgeCountContainer}>
              <Text style={styles.badgeCount}>
                {badges.length + equippedItems.badges.length}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("Achievements")}
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {loadingBadges || loadingEquippedItems ? (
            <View style={styles.loadingBadgesContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading badges...</Text>
            </View>
          ) : (badges && badges.length > 0) ||
            equippedItems.badges.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgesContainer}
            >
              {/* Shop Badges First (Equipped) */}
              {equippedItems.badges.map((badge, index) => (
                <TouchableOpacity
                  key={`shop-badge-${badge.item_id || index}`}
                  style={[styles.badgeItem, styles.shopBadgeItem]}
                  onPress={() =>
                    Alert.alert(
                      `🎖️ ${badge.name}`,
                      `${badge.description}\n\nType: Shop Badge (Equipped)`,
                      [{ text: "Cool!", style: "default" }]
                    )
                  }
                  activeOpacity={0.7}
                >
                  {hasItemImage(badge.image_url) ? (
                    <Image
                      source={getItemImage(badge.image_url)}
                      style={styles.badgeIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={[styles.badgeIcon, styles.badgePlaceholder]}>
                      <Text style={styles.badgePlaceholderText}>B</Text>
                    </View>
                  )}
                  <Text style={styles.badgeName} numberOfLines={2}>
                    {badge.name}
                  </Text>
                  <Text style={styles.shopBadgeLabel}>Shop</Text>
                </TouchableOpacity>
              ))}

              {/* Achievement Badges */}
              {badges.map((badge, index) => (
                <TouchableOpacity
                  key={badge.id || index}
                  style={styles.badgeItem}
                  onPress={() => handleBadgePress(badge)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={badge.icon}
                    style={styles.badgeIcon}
                    resizeMode="contain"
                  />
                  <Text style={styles.badgeName} numberOfLines={2}>
                    {badge.name}
                  </Text>
                  {badge.category && (
                    <Text style={styles.badgeCategory}>{badge.category}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="ribbon-outline"
                size={32}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyText}>
                Complete goals to earn achievement badges
              </Text>
              <TouchableOpacity
                style={[styles.viewAllButton, { marginTop: 16 }]}
                onPress={() => navigation.navigate("Achievements")}
              >
                <Text style={styles.viewAllButtonText}>View Achievements</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Communities Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Communities</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("Community", { screen: "CommunityMain" })
              }
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {loadingCommunities ? (
            <View style={styles.loadingCommunitiesContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : communities.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communitiesContainer}
            >
              {communities.map((community) => (
                <TouchableOpacity
                  key={community.community_id}
                  style={styles.communityItem}
                  onPress={() =>
                    navigateToCommunityDetail(community.community_id)
                  }
                >
                  <View style={styles.communityIconContainer}>
                    {community.image_url ? (
                      <Image
                        source={{ uri: community.image_url }}
                        style={styles.communityIcon}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.communityIconPlaceholder}>
                        <Ionicons
                          name="people"
                          size={24}
                          color={COLORS.primary}
                        />
                      </View>
                    )}
                  </View>
                  <Text style={styles.communityName} numberOfLines={1}>
                    {community.name}
                  </Text>
                  <Text style={styles.communityMembers}>
                    {community.members_count || 0} members
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="people-outline"
                size={32}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyText}>
                Join communities to connect with others
              </Text>
              <TouchableOpacity
                style={[styles.viewAllButton, { marginTop: 16 }]}
                onPress={() =>
                  navigation.navigate("Community", { screen: "CommunityMain" })
                }
              >
                <Text style={styles.viewAllButtonText}>Browse Communities</Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>
          )}
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
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  // Profile header with theme
  profileHeaderContainer: {
    position: "relative",
  },
  themeBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    width: "100%",
  },
  themeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: 20,
  },
  profileImageWrapper: {
    position: "relative",
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  profileRing: {
    position: "absolute",
    width: 120,
    height: 120,
    zIndex: 1,
  },
  profileImageContainer: {
    height: 90,
    width: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: "#E1E5F2",
    overflow: "hidden",
  },
  profileImage: {
    height: 90,
    width: 90,
    borderRadius: 45,
  },
  imageLoading: {
    height: 90,
    width: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  editImageButton: {
    position: "absolute",
    right: -5,
    bottom: -5,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  // Name and username
  nameContainer: {
    alignItems: "center",
    marginBottom: 4,
  },
  coinIconStat: {
    width: 24,
    height: 24,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.white,
  },
  userUsername: {
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 16,
    opacity: 0.8,
  },
  // Explicit buttons
  explicitButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 16,
  },
  explicitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    flex: 1,
    maxWidth: 150,
  },
  logoutButton: {
    backgroundColor: "#FF375F",
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
  // Stats section
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: 16,
    borderRadius: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
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
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  // Badge count
  badgeCountContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeCount: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginRight: 12,
  },
  // Goal stats
  goalStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  goalStatItem: {
    alignItems: "center",
  },
  goalStatValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  goalStatLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginBottom: 8,
  },
  viewAllButtonText: {
    color: COLORS.primary,
    fontWeight: "600",
    marginRight: 8,
  },
  // Badges
  badgesContainer: {
    paddingBottom: 8,
  },
  badgeItem: {
    alignItems: "center",
    marginRight: 16,
    width: 90,
  },
  badgeIcon: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    textAlign: "center",
    color: COLORS.text,
    fontWeight: "600",
    marginBottom: 2,
  },
  badgeCategory: {
    fontSize: 10,
    textAlign: "center",
    color: COLORS.textSecondary,
    fontStyle: "italic",
  },
  loadingBadgesContainer: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  // Shop badge specific
  shopBadgeItem: {
    backgroundColor: "rgba(106, 90, 205, 0.1)",
    borderRadius: 8,
    padding: 8,
  },
  shopBadgeLabel: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  badgePlaceholder: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  badgePlaceholderText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#757575",
  },
  // Communities
  communitiesContainer: {
    paddingBottom: 8,
  },
  communityItem: {
    width: 120,
    marginRight: 16,
    alignItems: "center",
  },
  communityIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },
  communityIcon: {
    width: 80,
    height: 80,
  },
  communityIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  communityName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
  communityMembers: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Empty states
  emptyContainer: {
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
  loadingCommunitiesContainer: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ProfileScreen;
