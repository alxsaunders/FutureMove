// src/components/UserProfileModal.tsx
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
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchUserProfile,
  fetchUserBadges,
  fetchUserStats,
  fetchUserCommunities,
  fetchUserEquippedItems,
  commendUser,
  removeCommend,
  ExtendedUserProfile,
  Community,
  Badge,
} from "../services/ProfileService";
import { getItemImage, hasItemImage } from "../utils/itemImageMapping";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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

interface UserProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(
    null
  );
  const [badges, setBadges] = useState<Badge[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommending, setIsCommending] = useState(false);

  // New state for equipped items
  const [equippedItems, setEquippedItems] = useState<EquippedItems>({
    badges: [],
  });

  // Check if this is the current user's profile
  const isOwnProfile = currentUser && currentUser.id === userId;

  useEffect(() => {
    if (visible && userId) {
      loadProfileData();
    }
  }, [visible, userId]);

  const loadProfileData = async () => {
    if (!userId) return;

    setIsLoading(true);
    try {
      // Load profile, badges, stats, communities, and equipped items in parallel
      const [
        profileResponse,
        badgesResponse,
        statsResponse,
        communitiesResponse,
        equippedResponse,
      ] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserBadges(userId),
        fetchUserStats(userId),
        fetchUserCommunities(userId),
        fetchUserEquippedItems(userId),
      ]);

      setProfileData(profileResponse);
      setBadges(badgesResponse || []);
      setStats(statsResponse);
      setCommunities(communitiesResponse || []);
      setEquippedItems(equippedResponse || { badges: [] });
    } catch (error) {
      console.error("Error loading profile data:", error);
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommend = async () => {
    if (!currentUser) {
      Alert.alert(
        "Authentication Required",
        "You need to be logged in to commend users.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => {
              onClose();
              navigation.navigate("Login");
            },
          },
        ]
      );
      return;
    }

    if (!profileData) return;

    setIsCommending(true);
    try {
      if (profileData.hasCommended) {
        // Remove commend
        const result = await removeCommend(userId);
        if (result.success) {
          setProfileData({
            ...profileData,
            commends: result.commends,
            hasCommended: false,
          });
        }
      } else {
        // Add commend
        const result = await commendUser(userId);
        if (result.success) {
          setProfileData({
            ...profileData,
            commends: result.commends,
            hasCommended: true,
          });
        }
      }
    } catch (error) {
      console.error("Error updating commend status:", error);
      Alert.alert(
        "Error",
        "Failed to update commend status. Please try again."
      );
    } finally {
      setIsCommending(false);
    }
  };

  const navigateToCommunityDetail = (communityId: string | number) => {
    onClose();
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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : !profileData ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle-outline"
              size={48}
              color={COLORS.textSecondary}
            />
            <Text style={styles.errorText}>User not found</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Section with Theme Background */}
            <View style={styles.profileSectionContainer}>
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

              <View style={styles.profileSection}>
                {/* Profile Image with Ring */}
                <View style={styles.profileImageWrapper}>
                  {/* Profile Ring */}
                  {equippedItems.profile_ring &&
                    hasItemImage(equippedItems.profile_ring.image_url) && (
                      <Image
                        source={getItemImage(
                          equippedItems.profile_ring.image_url
                        )}
                        style={styles.profileRing}
                        resizeMode="contain"
                      />
                    )}

                  <Image
                    source={
                      profileData.profileImage
                        ? { uri: profileData.profileImage }
                        : require("../assets/default-avatar.png")
                    }
                    style={styles.profileImage}
                  />
                </View>

                <Text
                  style={[
                    styles.userName,
                    equippedItems.theme && styles.userNameWithTheme,
                  ]}
                >
                  {profileData.name || "User"}
                </Text>

                <Text
                  style={[
                    styles.userUsername,
                    equippedItems.theme && styles.userUsernameWithTheme,
                  ]}
                >
                  @{profileData.username || userId.substring(0, 8) || "user"}
                </Text>

                {/* Commend Button - only shown when viewing another user's profile */}
                {currentUser && !isOwnProfile && (
                  <TouchableOpacity
                    style={[
                      styles.commendButton,
                      profileData.hasCommended ? styles.commendedButton : null,
                    ]}
                    onPress={handleCommend}
                    disabled={isCommending}
                  >
                    {isCommending ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          profileData.hasCommended
                            ? COLORS.primary
                            : COLORS.white
                        }
                      />
                    ) : (
                      <>
                        <Ionicons
                          name={
                            profileData.hasCommended
                              ? "thumbs-up"
                              : "thumbs-up-outline"
                          }
                          size={16}
                          color={
                            profileData.hasCommended
                              ? COLORS.primary
                              : COLORS.white
                          }
                        />
                        <Text
                          style={[
                            styles.commendButtonText,
                            profileData.hasCommended
                              ? styles.commendedButtonText
                              : null,
                          ]}
                        >
                          {profileData.hasCommended ? "Commended" : "Commend"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Stats Section */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="flame" size={24} color="#5D5FEF" />
                <Text style={styles.statValue}>
                  {profileData.streakCount || 0}
                </Text>
                <Text style={styles.statLabel}>Streak</Text>
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
                <Text style={styles.statValue}>
                  {profileData.future_coins || 0}
                </Text>
                <Text style={styles.statLabel}>FutureCoins</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="thumbs-up" size={24} color="#FF9500" />
                <Text style={styles.statValue}>
                  {profileData.commends || 0}
                </Text>
                <Text style={styles.statLabel}>Commends</Text>
              </View>
            </View>

            {/* Badges Section - Combined Achievement and Shop Badges */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Badges & Achievements</Text>

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
                {badges.length > 0
                  ? badges.map((badge, index) => (
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
                      </TouchableOpacity>
                    ))
                  : equippedItems.badges.length === 0 && (
                      <View style={styles.emptyBadges}>
                        <Ionicons
                          name="ribbon-outline"
                          size={32}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.emptyText}>No badges yet</Text>
                      </View>
                    )}
              </ScrollView>
            </View>

            {/* Communities Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Communities</Text>

              {communities.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.communitiesContainer}
                >
                  {communities.slice(0, 5).map((community) => (
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
                              size={20}
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
                <View style={styles.emptyBadges}>
                  <Ionicons
                    name="people-outline"
                    size={32}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.emptyText}>No communities joined</Text>
                </View>
              )}
            </View>

            {/* Progress Stats Section */}
            {stats && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Progress Stats</Text>

                <View style={styles.statsGrid}>
                  <View style={styles.statsCard}>
                    <View style={styles.statsCardHeader}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                      <Text style={styles.statsCardTitle}>Goals Completed</Text>
                    </View>
                    <Text style={styles.statsCardValue}>
                      {profileData.completedGoalsCount || 0}
                    </Text>
                  </View>

                  <View style={styles.statsCard}>
                    <View style={styles.statsCardHeader}>
                      <Ionicons name="trending-up" size={20} color="#FF9800" />
                      <Text style={styles.statsCardTitle}>Longest Streak</Text>
                    </View>
                    <Text style={styles.statsCardValue}>
                      {stats.longestStreak || 0}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  closeButton: {
    padding: 4,
  },
  headerRight: {
    width: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  content: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  // Profile section with theme
  profileSectionContainer: {
    position: "relative",
  },
  themeBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    width: "100%",
  },
  themeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
  },
  profileImageWrapper: {
    position: "relative",
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  profileRing: {
    position: "absolute",
    width: 100,
    height: 100,
    zIndex: 1,
  },
  profileImage: {
    height: 75,
    width: 75,
    borderRadius: 37.5,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  userNameWithTheme: {
    color: COLORS.white,
  },
  userUsername: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  userUsernameWithTheme: {
    color: COLORS.white,
    opacity: 0.8,
  },
  commendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  commendedButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  commendButtonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontWeight: "600",
    fontSize: 14,
  },
  commendedButtonText: {
    color: COLORS.primary,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: COLORS.cardBackground,
    marginTop: 8,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  coinIconStat: {
    width: 24,
    height: 24,
  },
  sectionContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  badgesContainer: {
    paddingBottom: 8,
  },
  badgeItem: {
    alignItems: "center",
    marginRight: 12,
    width: 60,
  },
  badgeIcon: {
    width: 40,
    height: 40,
    marginBottom: 6,
  },
  badgeName: {
    fontSize: 10,
    textAlign: "center",
    color: COLORS.text,
  },
  // Shop badge specific
  shopBadgeItem: {
    backgroundColor: "rgba(106, 90, 205, 0.1)",
    borderRadius: 8,
    padding: 6,
  },
  shopBadgeLabel: {
    fontSize: 9,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 2,
  },
  badgePlaceholder: {
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  badgePlaceholderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#757575",
  },
  emptyBadges: {
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  communitiesContainer: {
    paddingBottom: 8,
  },
  communityItem: {
    width: 80,
    marginRight: 12,
    alignItems: "center",
  },
  communityIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginBottom: 6,
    overflow: "hidden",
  },
  communityIcon: {
    width: 50,
    height: 50,
  },
  communityIconPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  communityName: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
  communityMembers: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    width: "48%",
  },
  statsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statsCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.text,
    marginLeft: 6,
  },
  statsCardValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
});

export default UserProfileModal;
