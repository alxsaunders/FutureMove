import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Platform,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { auth } from "../config/firebase";
import { COLORS } from "../common/constants/colors";
import {
  getAllUserAchievements,
  Achievement,
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_MILESTONES,
} from "../services/AchievementService";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Category colors mapping
const CATEGORY_COLORS: Record<string, string> = {
  Personal: COLORS.primary,
  Work: "#2563eb",
  Learning: "#059669",
  Health: "#dc2626",
  Repair: "#7c3aed",
  Finance: "#ea580c",
};

const AchievementsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  // Fetch user achievements
  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const achievementData = await getAllUserAchievements();
      console.log(
        `[ACHIEVEMENTS SCREEN] Loaded ${achievementData.length} achievements`
      );
      console.log(
        `[ACHIEVEMENTS SCREEN] Unlocked: ${
          achievementData.filter((a) => a.isUnlocked).length
        }`
      );
      console.log(
        `[ACHIEVEMENTS SCREEN] Locked: ${
          achievementData.filter((a) => !a.isUnlocked).length
        }`
      );
      setAchievements(achievementData);
    } catch (error) {
      console.error("Error fetching achievements:", error);
      Alert.alert("Error", "Failed to load achievements. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  // Handle achievement press - show badge for unlocked, progress for locked
  const handleAchievementPress = (achievement: Achievement) => {
    setSelectedAchievement(achievement);

    if (achievement.isUnlocked) {
      // Show badge modal for unlocked achievements
      setShowBadgeModal(true);
    } else {
      // Show progress alert for locked achievements
      const progress = achievement.completedGoals;
      const needed = achievement.milestone - progress;
      Alert.alert(
        "🔒 Achievement Locked",
        `${achievement.title}\n\n${achievement.description}\n\nProgress: ${progress}/${achievement.milestone}\nYou need ${needed} more goals to unlock this achievement!`,
        [{ text: "Keep Going!", style: "default" }]
      );
    }
  };

  // Close badge modal
  const closeBadgeModal = () => {
    setShowBadgeModal(false);
    setSelectedAchievement(null);
  };

  // Render achievement item with custom images
  const renderAchievement = (achievement: Achievement, index: number) => {
    const categoryColor =
      CATEGORY_COLORS[achievement.category] || COLORS.primary;

    return (
      <TouchableOpacity
        key={achievement.id}
        style={styles.achievementCard}
        onPress={() => handleAchievementPress(achievement)}
        activeOpacity={0.7}
      >
        {/* Achievement Image */}
        <View style={styles.achievementImageContainer}>
          <Image
            source={
              achievement.isUnlocked
                ? achievement.coverImage
                : achievement.coverImage
            }
            style={[
              styles.achievementImage,
              !achievement.isUnlocked && styles.lockedImage,
            ]}
            resizeMode="cover"
          />

          {/* Overlay for locked achievements */}
          {!achievement.isUnlocked && (
            <View style={styles.lockedOverlay}>
              <Ionicons
                name="lock-closed"
                size={16}
                color={COLORS.white}
                style={styles.lockIcon}
              />
            </View>
          )}

          {/* Progress indicator for locked achievements */}
          {!achievement.isUnlocked && achievement.completedGoals > 0 && (
            <View style={styles.progressIndicator}>
              <Text style={styles.progressText}>
                {achievement.completedGoals}/{achievement.milestone}
              </Text>
            </View>
          )}
        </View>

        {/* Unlocked Badge */}
        {achievement.isUnlocked && (
          <View
            style={[styles.unlockedBadge, { backgroundColor: categoryColor }]}
          >
            <Ionicons name="checkmark" size={12} color={COLORS.white} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Group achievements by category for display
  const groupedAchievements = ACHIEVEMENT_CATEGORIES.map((category) => ({
    category: category,
    color: CATEGORY_COLORS[category],
    achievements: achievements.filter((a) => a.category === category),
  }));

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Achievements</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading achievements...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={fetchAchievements}
        >
          <Ionicons name="refresh" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Achievement Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryTitle}>Your Progress</Text>
            <Text style={styles.summaryText}>
              {achievements.filter((a) => a.isUnlocked).length} of{" "}
              {achievements.length} achievements unlocked
            </Text>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        achievements.length > 0
                          ? (achievements.filter((a) => a.isUnlocked).length /
                              achievements.length) *
                            100
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Achievement Grid by Category */}
          {groupedAchievements.map((group, categoryIndex) => (
            <View key={group.category} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View
                  style={[
                    styles.categoryIndicator,
                    { backgroundColor: group.color },
                  ]}
                />
                <Text style={styles.categoryTitle}>{group.category}</Text>
                <Text style={styles.categoryProgress}>
                  {group.achievements.filter((a) => a.isUnlocked).length}/
                  {group.achievements.length}
                </Text>
              </View>

              <View style={styles.achievementGrid}>
                {group.achievements.map((achievement, index) =>
                  renderAchievement(achievement, index)
                )}
              </View>
            </View>
          ))}

          {/* Achievement Legend */}
          <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Achievement Levels</Text>
            <View style={styles.legendGrid}>
              {ACHIEVEMENT_MILESTONES.map((milestone, index) => {
                const levelNames = [
                  "Starter",
                  "Enthusiast",
                  "Achiever",
                  "Master",
                ];
                return (
                  <View key={milestone} style={styles.legendItem}>
                    <Text style={styles.legendMilestone}>
                      {milestone} Goals
                    </Text>
                    <Text style={styles.legendLevel}>{levelNames[index]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Badge Modal */}
      <Modal
        visible={showBadgeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeBadgeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeBadgeModal}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closeBadgeModal}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>

            {selectedAchievement && (
              <>
                {/* Badge Image */}
                <View style={styles.badgeContainer}>
                  <Image
                    source={selectedAchievement.badgeImage}
                    style={styles.badgeImage}
                    resizeMode="contain"
                  />
                </View>

                {/* Achievement Details */}
                <View style={styles.achievementDetails}>
                  <Text style={styles.achievementTitle}>
                    🏆 {selectedAchievement.title}
                  </Text>
                  <Text style={styles.achievementCategory}>
                    {selectedAchievement.category} •{" "}
                    {selectedAchievement.milestone} Goals
                  </Text>
                  <Text style={styles.achievementDescription}>
                    {selectedAchievement.description}
                  </Text>

                  {selectedAchievement.unlockedAt && (
                    <Text style={styles.unlockedDate}>
                      Unlocked on{" "}
                      {selectedAchievement.unlockedAt.toLocaleDateString()}
                    </Text>
                  )}

                  <Text style={styles.congratsText}>
                    Congratulations! You've completed{" "}
                    {selectedAchievement.completedGoals} goals in{" "}
                    {selectedAchievement.category}!
                  </Text>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  refreshButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  scrollContainer: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  summaryContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "center",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  progressBarContainer: {
    width: "100%",
    alignItems: "center",
  },
  progressBar: {
    width: "80%",
    height: 8,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryIndicator: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
  },
  categoryProgress: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: "500",
  },
  achievementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  achievementCard: {
    width: "23%", // 4 columns
    aspectRatio: 1, // Perfect square
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
  },
  achievementImageContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  achievementImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  lockedImage: {
    opacity: 0.3, // More grayed out
  },
  lockedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lockIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  progressIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  progressText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: "bold",
  },
  unlockedBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  legendContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  legendGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendItem: {
    alignItems: "center",
    flex: 1,
  },
  legendMilestone: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  legendLevel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    maxWidth: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
    position: "relative",
  },
  modalCloseButton: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  badgeContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  badgeImage: {
    width: 120,
    height: 120,
  },
  achievementDetails: {
    alignItems: "center",
    maxWidth: 280,
  },
  achievementTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  achievementCategory: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
    marginBottom: 8,
  },
  achievementDescription: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 12,
  },
  unlockedDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: "italic",
    marginBottom: 12,
  },
  congratsText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default AchievementsScreen;
