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
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
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
  sendUserCommand,
  ExtendedUserProfile,
  Community,
  Badge,
} from "../services/ProfileService";
import { getItemImage, hasItemImage } from "../utils/itemImageMapping";

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

const ProfileViewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(
    null
  );
  const [badges, setBadges] = useState<Badge[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommending, setIsCommending] = useState(false);

  // Command feature states
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [isSendingCommand, setIsSendingCommand] = useState(false);

  // New state for equipped items
  const [equippedItems, setEquippedItems] = useState<EquippedItems>({
    badges: [],
  });

  useEffect(() => {
    if (!currentUser) {
      Alert.alert(
        "Authentication Required",
        "Please log in to view profiles.",
        [
          { text: "Cancel", onPress: () => navigation.goBack() },
          { text: "Sign In", onPress: () => navigation.navigate("Login") },
        ]
      );
      return;
    }
    loadProfileData();
  }, [userId, currentUser]);

  const loadProfileData = async () => {
    if (!userId || !currentUser) return;

    setIsLoading(true);
    try {
      console.log(
        `[PROFILE VIEW] Loading data for ${userId}, authenticated as ${currentUser.id}`
      );

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
      if (
        error instanceof Error &&
        error.message.includes("No authenticated user found")
      ) {
        Alert.alert(
          "Authentication Required",
          "Please log in to view profiles.",
          [
            { text: "Cancel", onPress: () => navigation.goBack() },
            { text: "Sign In", onPress: () => navigation.navigate("Login") },
          ]
        );
      } else {
        Alert.alert("Error", "Failed to load profile data. Please try again.");
      }
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
            onPress: () => navigation.navigate("Login"),
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

  const handleSendCommand = async () => {
    if (!currentUser) {
      Alert.alert(
        "Authentication Required",
        "You need to be logged in to send commands.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => {
              setShowCommandModal(false);
              navigation.navigate("Login");
            },
          },
        ]
      );
      return;
    }

    if (!commandText.trim()) {
      Alert.alert("Error", "Please enter a command message.");
      return;
    }

    setIsSendingCommand(true);
    try {
      const result = await sendUserCommand(userId, commandText.trim());
      if (result.success) {
        Alert.alert(
          "Command Sent!",
          `Your command has been sent to ${profileData?.name || "the user"}.`,
          [
            {
              text: "OK",
              onPress: () => {
                setShowCommandModal(false);
                setCommandText("");
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", result.message || "Failed to send command.");
      }
    } catch (error) {
      console.error("Error sending command:", error);
      Alert.alert("Error", "Failed to send command. Please try again.");
    } finally {
      setIsSendingCommand(false);
    }
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
    <>
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            {/* Command button in header */}
            {currentUser && currentUser.id !== userId && (
              <TouchableOpacity onPress={() => setShowCommandModal(true)}>
                <Ionicons name="send" size={20} color={COLORS.primary} />
              </TouchableOpacity>
            )}
            {(!currentUser || currentUser.id === userId) && (
              <TouchableOpacity>
                <Ionicons
                  name="ellipsis-vertical"
                  size={20}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            )}
          </View>

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

              {/* Action buttons for other users */}
              {currentUser && currentUser.id !== userId && (
                <View style={styles.actionButtonsContainer}>
                  {/* Commend Button */}
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

                  {/* Command Button */}
                  <TouchableOpacity
                    style={styles.commandButton}
                    onPress={() => setShowCommandModal(true)}
                  >
                    <Ionicons name="send" size={16} color={COLORS.white} />
                    <Text style={styles.commandButtonText}>Command</Text>
                  </TouchableOpacity>
                </View>
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
              <Text style={styles.statValue}>{profileData.commends || 0}</Text>
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
      </SafeAreaView>

      {/* Command Modal */}
      <Modal
        visible={showCommandModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCommandModal(false)}
      >
        <View style={styles.commandModalOverlay}>
          <View style={styles.commandModalContainer}>
            <View style={styles.commandModalHeader}>
              <Text style={styles.commandModalTitle}>
                Send Command to {profileData?.name || "User"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCommandModal(false)}
                style={styles.commandModalClose}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.commandModalContent}>
              <Text style={styles.commandInputLabel}>
                What would you like them to do?
              </Text>
              <TextInput
                style={styles.commandInput}
                placeholder="e.g., Check out this goal, Join my community challenge..."
                placeholderTextColor={COLORS.textSecondary}
                value={commandText}
                onChangeText={setCommandText}
                multiline
                maxLength={280}
                autoFocus
              />
              <Text style={styles.characterCount}>
                {commandText.length}/280
              </Text>
            </View>

            <View style={styles.commandModalActions}>
              <TouchableOpacity
                style={styles.commandModalCancelButton}
                onPress={() => setShowCommandModal(false)}
              >
                <Text style={styles.commandModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.commandModalSendButton,
                  (!commandText.trim() || isSendingCommand) &&
                    styles.commandModalSendButtonDisabled,
                ]}
                onPress={handleSendCommand}
                disabled={!commandText.trim() || isSendingCommand}
              >
                {isSendingCommand ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="send" size={16} color={COLORS.white} />
                    <Text style={styles.commandModalSendText}>Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
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
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 12,
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
  commandButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF9500",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  commandButtonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontWeight: "600",
    fontSize: 14,
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
  // Command Modal Styles
  commandModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  commandModalContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
  },
  commandModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commandModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
    marginRight: 16,
  },
  commandModalClose: {
    padding: 4,
  },
  commandModalContent: {
    padding: 16,
  },
  commandInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  commandInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    minHeight: 100,
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 8,
  },
  commandModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  commandModalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  commandModalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  commandModalSendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  commandModalSendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.6,
  },
  commandModalSendText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});

export default ProfileViewScreen;
