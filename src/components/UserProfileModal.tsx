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
  commendUser,
  removeCommend,
  ExtendedUserProfile,
  Community,
} from "../services/ProfileService";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

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
  const [badges, setBadges] = useState<any[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommending, setIsCommending] = useState(false);

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
      // Load profile, badges, stats, and communities in parallel
      const [
        profileResponse,
        badgesResponse,
        statsResponse,
        communitiesResponse,
      ] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserBadges(userId),
        fetchUserStats(userId),
        fetchUserCommunities(userId),
      ]);

      setProfileData(profileResponse);
      setBadges(badgesResponse || []);
      setStats(statsResponse);
      setCommunities(communitiesResponse || []);
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

              <Text style={styles.userName}>{profileData.name || "User"}</Text>

              <Text style={styles.userUsername}>
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
                        profileData.hasCommended ? COLORS.primary : COLORS.white
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

            {/* Stats Section */}
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="flame" size={24} color={COLORS.primary} />
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
                <Ionicons name="thumbs-up" size={24} color="#FF9500" />
                <Text style={styles.statValue}>
                  {profileData.commends || 0}
                </Text>
                <Text style={styles.statLabel}>Commends</Text>
              </View>

              <View style={styles.statItem}>
                <Ionicons name="ribbon" size={24} color="#5E6CE7" />
                <Text style={styles.statValue}>
                  {profileData.badgeCount || 0}
                </Text>
                <Text style={styles.statLabel}>Badges</Text>
              </View>
            </View>

            {/* Badges Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Badges & Achievements</Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.badgesContainer}
              >
                {badges.length > 0 ? (
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
                      {stats.longest_streak || 0}
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
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: COLORS.cardBackground,
  },
  profileImage: {
    height: 80,
    width: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: 12,
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
