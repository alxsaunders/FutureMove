import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { Goal } from "../types";
import {
  fetchGoalById,
  updateGoal,
  deleteGoal,
  getCategoryColor,
  updateGoalProgress,
  updateUserCoins,
  updateUserXP,
  isGoalActiveToday,
} from "../services/GoalService";
// ADDED: Achievement service import
import {
  checkForNewAchievements,
  processNewAchievements,
} from "../services/AchievementService";
import { GoalDetailScreenProps } from "../types/navigaton";
import { auth } from "../config/firebase.js";

// Days of the week for routines
const DAYS_OF_WEEK = [
  { id: 0, name: "Sun", fullName: "Sunday" },
  { id: 1, name: "Mon", fullName: "Monday" },
  { id: 2, name: "Tue", fullName: "Tuesday" },
  { id: 3, name: "Wed", fullName: "Wednesday" },
  { id: 4, name: "Thu", fullName: "Thursday" },
  { id: 5, name: "Fri", fullName: "Friday" },
  { id: 6, name: "Sat", fullName: "Saturday" },
];

// Define reward constants
const GOAL_COMPLETION_XP = 10;
const GOAL_COMPLETION_COINS = 5;

const GoalDetailScreen: React.FC<GoalDetailScreenProps> = ({
  navigation,
  route,
}) => {
  const { goalId } = route.params;

  // States
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Personal");
  const [isDaily, setIsDaily] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);
  const [goalType, setGoalType] = useState<"one-time" | "recurring">(
    "one-time"
  );

  // Categories with colors
  const categories = [
    { name: "Personal", color: COLORS.primary },
    { name: "Work", color: "#4CAF50" },
    { name: "Learning", color: "#5E6CE7" },
    { name: "Health", color: "#F44336" },
    { name: "Repair", color: "#56C3B6" },
    { name: "Finance", color: "#FF9800" },
  ];

  // Function to handle level up logic
  const handleLevelUp = (newXP: number, currentLevel: number) => {
    let newLevel = currentLevel;
    let finalXP = newXP;

    // Check if user leveled up (every 100 XP)
    if (newXP >= 100) {
      const levelsGained = Math.floor(newXP / 100);
      newLevel += levelsGained;
      finalXP = newXP % 100;

      // Show level up alert
      Alert.alert(
        "Level Up!",
        `Congratulations! You've reached level ${newLevel}!`,
        [{ text: "Awesome!", style: "default" }]
      );
    }

    return { newLevel, finalXP };
  };

  // ADDED: Process goal rewards with proper database updates
  const handleGoalRewards = async (
    goal: Goal,
    currentXP: number,
    currentLevel: number
  ) => {
    try {
      console.log(
        `[GOAL DETAIL] Processing rewards for goal: ${goal.title}, Category: ${goal.category}`
      );

      // Ensure we have the latest Firebase user ID
      const firebaseUserId = auth.currentUser?.uid;
      const effectiveUserId = firebaseUserId || goal.userId || "default_user";

      console.log(
        `[GOAL DETAIL] Updating user stats for user: ${effectiveUserId}`
      );

      try {
        // Add XP and handle level up
        const newXP = currentXP + GOAL_COMPLETION_XP;
        const levelUpResult = handleLevelUp(newXP, currentLevel);

        // Update XP in database
        await updateUserXP(
          effectiveUserId,
          GOAL_COMPLETION_XP,
          levelUpResult.newLevel
        );

        // Update coins in database
        await updateUserCoins(effectiveUserId, GOAL_COMPLETION_COINS);

        // Check for new achievements
        console.log(
          `[GOAL DETAIL] Checking for achievements in category: ${goal.category}`
        );
        const newAchievements = await checkForNewAchievements(
          goal.category,
          effectiveUserId
        );

        // Show completion message first
        Alert.alert(
          "Goal Completed!",
          `Great job! You've earned ${GOAL_COMPLETION_XP} XP and ${GOAL_COMPLETION_COINS} coins.`,
          [
            {
              text: "Nice!",
              style: "default",
              onPress: () => {
                // After the completion alert is dismissed, show achievement notifications
                if (newAchievements.length > 0) {
                  console.log(
                    `[GOAL DETAIL] Found ${newAchievements.length} new achievements!`
                  );
                  processNewAchievements(newAchievements);
                }
              },
            },
          ]
        );
      } catch (rewardError) {
        console.error("Error updating rewards in database:", rewardError);

        // Still try to check achievements even if stats update failed
        try {
          const newAchievements = await checkForNewAchievements(
            goal.category,
            effectiveUserId
          );

          // Show completion message
          Alert.alert(
            "Goal Completed!",
            `Great job! You've earned ${GOAL_COMPLETION_XP} XP and ${GOAL_COMPLETION_COINS} coins.`,
            [
              {
                text: "Nice!",
                style: "default",
                onPress: () => {
                  if (newAchievements.length > 0) {
                    processNewAchievements(newAchievements);
                  }
                },
              },
            ]
          );
        } catch (achievementError) {
          console.error("Error checking achievements:", achievementError);

          // Show basic completion message if achievement check also fails
          Alert.alert(
            "Goal Completed!",
            `Great job! You've earned ${GOAL_COMPLETION_XP} XP and ${GOAL_COMPLETION_COINS} coins.`,
            [{ text: "Nice!", style: "default" }]
          );
        }
      }
    } catch (error) {
      console.error("Error processing rewards:", error);

      // Show basic completion message if everything fails
      Alert.alert("Goal Completed!", "Great job completing your goal!", [
        { text: "Nice!", style: "default" },
      ]);
    }
  };

  // Load goal data
  useEffect(() => {
    loadGoalData();
  }, [goalId]);

  const loadGoalData = async () => {
    try {
      setIsLoading(true);
      const goalData = await fetchGoalById(goalId);

      if (goalData) {
        setGoal(goalData);

        // Initialize form state
        setTitle(goalData.title);
        setDescription(goalData.description || "");
        setCategory(goalData.category || "Personal");
        setIsDaily(goalData.isDaily || false);
        setSelectedDays(goalData.routineDays || []);
        setProgress(goalData.progress || 0);
        setGoalType(
          goalData.type || (goalData.isDaily ? "recurring" : "one-time")
        );
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading goal:", error);
      Alert.alert("Error", "Failed to load goal details. Please try again.");
      setIsLoading(false);
      navigation.goBack();
    }
  };

  // Toggle day selection for routine
  const toggleDaySelection = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter((id) => id !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  // Handle save changes
  const handleSaveChanges = async () => {
    if (title.trim() === "") {
      Alert.alert("Error", "Goal title cannot be empty");
      return;
    }

    try {
      if (!goal) return;

      // For routine goals, at least one day must be selected
      let finalSelectedDays = selectedDays;
      if (isDaily && selectedDays.length === 0) {
        // If no days are selected for a daily goal, default to all days
        finalSelectedDays = [0, 1, 2, 3, 4, 5, 6];
      }

      const updatedGoal: Goal = {
        ...goal,
        title,
        description,
        category,
        isDaily,
        routineDays: isDaily ? finalSelectedDays : [],
        color: getCategoryColor(category),
        type: isDaily ? "recurring" : "one-time",
        // Keep other properties intact
        isCompleted: goal.isCompleted,
        progress: goal.progress,
        startDate: goal.startDate,
        targetDate: goal.targetDate,
        userId: goal.userId,
        coinReward: goal.coinReward,
        lastCompleted: goal.lastCompleted,
      };

      // Update goal in the database
      const result = await updateGoal(updatedGoal);

      if (result) {
        setIsEditing(false);
        loadGoalData(); // Reload to get fresh data
        Alert.alert("Success", "Goal updated successfully");
      } else {
        throw new Error("Failed to update goal");
      }
    } catch (error) {
      console.error("Error updating goal:", error);
      Alert.alert("Error", "Failed to update goal. Please try again.");
    }
  };

  // Handle delete goal
  const handleDeleteGoal = async () => {
    try {
      if (!goal) return;

      const success = await deleteGoal(goalId);

      if (success) {
        setDeleteModalVisible(false);
        Alert.alert("Success", "Goal deleted successfully");
        navigation.goBack();
      } else {
        throw new Error("Failed to delete goal");
      }
    } catch (error) {
      console.error("Error deleting goal:", error);
      Alert.alert("Error", "Failed to delete goal. Please try again.");
    }
  };

  // FIXED: Handle progress update with rewards for completion
  const handleProgressUpdate = async (newProgress: number) => {
    try {
      if (!goal) return;

      const wasCompleted = goal.isCompleted;
      const isNowCompleted = newProgress === 100;

      const updatedGoal = await updateGoalProgress(goalId, newProgress);

      if (updatedGoal) {
        // Update local state
        setGoal(updatedGoal);
        setProgress(updatedGoal.progress);

        // If this is a completion (not unchecking) and goal wasn't previously completed,
        // process rewards
        if (!wasCompleted && isNowCompleted) {
          console.log(
            `[GOAL DETAIL] Goal is being completed, processing rewards`
          );

          // Get current user stats for level calculation
          try {
            const response = await fetch(
              `http://10.0.2.2:3001/api/users/${
                auth.currentUser?.uid || goal.userId
              }`,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
                },
              }
            );

            if (response.ok) {
              const userData = await response.json();
              await handleGoalRewards(
                updatedGoal,
                userData.xp_points || 0,
                userData.level || 1
              );
            } else {
              // Fallback with default values
              await handleGoalRewards(updatedGoal, 0, 1);
            }
          } catch (userFetchError) {
            console.error(
              "Error fetching user data for rewards:",
              userFetchError
            );
            // Fallback with default values
            await handleGoalRewards(updatedGoal, 0, 1);
          }
        }
      } else {
        // If it fails, show error but still update UI optimistically
        console.warn("Backend update failed, updating UI optimistically");
        setProgress(newProgress);
        setGoal({
          ...goal,
          progress: newProgress,
          isCompleted: newProgress === 100,
        });

        // Still process rewards if this was a completion
        if (!wasCompleted && isNowCompleted) {
          console.log(
            `[GOAL DETAIL] Goal completed (optimistic), processing rewards`
          );
          await handleGoalRewards(goal, 0, 1); // Use default values since backend failed
        }
      }
    } catch (error) {
      console.error("Error updating progress:", error);
      Alert.alert("Error", "Failed to update progress. Please try again.");
    }
  };

  // FIXED: Handle toggle completion with rewards
  const handleToggleCompletion = async () => {
    try {
      if (!goal) return;

      const wasCompleted = goal.isCompleted;
      const newProgress = wasCompleted ? 0 : 100;

      // Update progress (which will trigger rewards if completing)
      await handleProgressUpdate(newProgress);
    } catch (error) {
      console.error("Error toggling completion:", error);
      Alert.alert("Error", "Failed to update goal. Please try again.");
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading goal details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render goal not found
  if (!goal) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={60}
            color={COLORS.textSecondary}
          />
          <Text style={styles.errorTitle}>Goal Not Found</Text>
          <Text style={styles.errorText}>
            The goal you're looking for could not be found or may have been
            deleted.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backIcon}
            onPress={() => {
              if (isEditing) {
                Alert.alert(
                  "Discard Changes",
                  "Are you sure you want to discard your changes?",
                  [
                    { text: "Stay", style: "cancel" },
                    {
                      text: "Discard",
                      style: "destructive",
                      onPress: () => {
                        setIsEditing(false);
                        loadGoalData(); // Reset form
                        navigation.goBack();
                      },
                    },
                  ]
                );
              } else {
                navigation.goBack();
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? "Edit Goal" : "Goal Details"}
          </Text>
          <View style={styles.headerActions}>
            {!isEditing ? (
              <>
                <TouchableOpacity
                  style={styles.headerAction}
                  onPress={() => setIsEditing(true)}
                >
                  <Ionicons
                    name="create-outline"
                    size={24}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerAction}
                  onPress={() => setDeleteModalVisible(true)}
                >
                  <Ionicons name="trash-outline" size={24} color="#F44336" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.headerAction}
                onPress={handleSaveChanges}
              >
                <Ionicons name="checkmark" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Main Info Section */}
          <View style={styles.section}>
            {isEditing ? (
              /* Editing Mode */
              <>
                <Text style={styles.sectionTitle}>Title *</Text>
                <TextInput
                  style={styles.textInput}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter goal title"
                />

                <Text style={styles.sectionTitle}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textAreaInput]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Enter goal description"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                <Text style={styles.sectionTitle}>Category</Text>
                <View style={styles.categoryOptions}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.name}
                      style={[
                        styles.categoryOption,
                        category === cat.name && {
                          borderColor: cat.color,
                          backgroundColor: `${cat.color}15`,
                        },
                      ]}
                      onPress={() => setCategory(cat.name)}
                    >
                      <View
                        style={[
                          styles.categoryColorDot,
                          { backgroundColor: cat.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          category === cat.name && {
                            color: cat.color,
                            fontWeight: "600",
                          },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.switchContainer}>
                  <Text style={styles.switchLabel}>Routine</Text>
                  <Switch
                    value={isDaily}
                    onValueChange={setIsDaily}
                    trackColor={{ false: "#ccc", true: `${COLORS.primary}50` }}
                    thumbColor={isDaily ? COLORS.primary : "#f4f3f4"}
                  />
                </View>

                {/* Routine days selection */}
                {isDaily && (
                  <View style={styles.routineDaysSection}>
                    <Text style={styles.sectionTitle}>
                      Repeat on these days:
                    </Text>
                    <View style={styles.daysContainer}>
                      {DAYS_OF_WEEK.map((day) => (
                        <TouchableOpacity
                          key={day.id}
                          style={[
                            styles.dayButton,
                            selectedDays.includes(day.id) && {
                              backgroundColor: COLORS.primary,
                            },
                          ]}
                          onPress={() => toggleDaySelection(day.id)}
                        >
                          <Text
                            style={[
                              styles.dayButtonText,
                              selectedDays.includes(day.id) && {
                                color: COLORS.white,
                              },
                            ]}
                          >
                            {day.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              /* View Mode */
              <>
                <Text style={styles.goalTitle}>{goal.title}</Text>

                {goal.description && (
                  <Text style={styles.goalDescription}>{goal.description}</Text>
                )}

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Status</Text>
                    <View style={styles.statusBadge}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: goal.isCompleted
                              ? COLORS.success
                              : COLORS.primary,
                          },
                        ]}
                      />
                      <Text style={styles.statusText}>
                        {goal.isCompleted ? "Completed" : "In Progress"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Type</Text>
                    <View
                      style={[
                        styles.typeBadge,
                        {
                          backgroundColor: goal.isDaily
                            ? COLORS.accent2
                            : COLORS.accent1,
                        },
                      ]}
                    >
                      <Text style={styles.typeText}>
                        {goal.isDaily ? "Daily Routine" : "One-time Goal"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Category</Text>
                    <View
                      style={[
                        styles.categoryBadge,
                        { backgroundColor: goal.color || COLORS.primary },
                      ]}
                    >
                      <Text style={styles.categoryText}>
                        {goal.category || "Personal"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Created On</Text>
                    <Text style={styles.dateText}>
                      {goal.startDate
                        ? new Date(goal.startDate).toLocaleDateString()
                        : "Not specified"}
                    </Text>
                  </View>
                </View>

                {/* Reward info */}
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Reward</Text>
                    <View style={styles.rewardContainer}>
                      <Ionicons name="star" size={16} color={COLORS.accent1} />
                      <Text style={styles.rewardText}>
                        {goal.coinReward || 5} FutureCoins
                      </Text>
                    </View>
                  </View>

                  {goal.lastCompleted && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Last Completed</Text>
                      <Text style={styles.dateText}>
                        {new Date(goal.lastCompleted).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Active today status (for daily goals) */}
                {goal.isDaily && (
                  <View style={styles.activeTodayContainer}>
                    <Text style={styles.infoLabel}>Today's Status</Text>
                    <View
                      style={[
                        styles.activeTodayBadge,
                        isGoalActiveToday(goal)
                          ? { backgroundColor: COLORS.primary + "20" }
                          : { backgroundColor: COLORS.textSecondary + "20" },
                      ]}
                    >
                      <Ionicons
                        name={
                          isGoalActiveToday(goal)
                            ? "checkmark-circle" // Replace "calendar-check" with an available icon
                            : "calendar"
                        }
                        size={16}
                        color={
                          isGoalActiveToday(goal)
                            ? COLORS.primary
                            : COLORS.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.activeTodayText,
                          {
                            color: isGoalActiveToday(goal)
                              ? COLORS.primary
                              : COLORS.textSecondary,
                          },
                        ]}
                      >
                        {isGoalActiveToday(goal)
                          ? "Active Today"
                          : "Not Scheduled Today"}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Routine days display */}
                {goal.isDaily && (
                  <View style={styles.routineInfo}>
                    <Text style={styles.infoLabel}>Repeats On</Text>
                    <View style={styles.routineDays}>
                      {DAYS_OF_WEEK.map((day) => (
                        <View
                          key={day.id}
                          style={[
                            styles.dayIndicator,
                            goal.routineDays &&
                            goal.routineDays.includes(day.id)
                              ? {
                                  backgroundColor: goal.color || COLORS.primary,
                                }
                              : { backgroundColor: COLORS.lightBackground },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayIndicatorText,
                              goal.routineDays &&
                              goal.routineDays.includes(day.id)
                                ? { color: COLORS.white }
                                : { color: COLORS.textSecondary },
                            ]}
                          >
                            {day.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Progress Section (only in view mode) */}
          {!isEditing && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Progress</Text>

              {/* Progress bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${goal.progress}%`,
                        backgroundColor: goal.isCompleted
                          ? COLORS.success
                          : COLORS.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>{goal.progress}%</Text>
              </View>

              {/* Progress Adjustment */}
              <Text style={styles.progressLabel}>Update Progress</Text>
              <View style={styles.progressActions}>
                <TouchableOpacity
                  style={styles.progressButton}
                  onPress={() => handleProgressUpdate(0)}
                >
                  <Text style={styles.progressButtonText}>0%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.progressButton}
                  onPress={() => handleProgressUpdate(25)}
                >
                  <Text style={styles.progressButtonText}>25%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.progressButton}
                  onPress={() => handleProgressUpdate(50)}
                >
                  <Text style={styles.progressButtonText}>50%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.progressButton}
                  onPress={() => handleProgressUpdate(75)}
                >
                  <Text style={styles.progressButtonText}>75%</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.progressButton, styles.completeButton]}
                  onPress={() => handleProgressUpdate(100)}
                >
                  <Text style={styles.completeButtonText}>100%</Text>
                </TouchableOpacity>
              </View>

              {/* Complete or uncheck button */}
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  goal.isCompleted
                    ? styles.uncompleteButton
                    : styles.markCompleteButton,
                ]}
                onPress={handleToggleCompletion}
              >
                <Ionicons
                  name={goal.isCompleted ? "refresh" : "checkmark-circle"}
                  size={20}
                  color="white"
                />
                <Text style={styles.toggleButtonText}>
                  {goal.isCompleted ? "Unmark as Complete" : "Mark as Complete"}
                </Text>
              </TouchableOpacity>

              {/* REMOVED: Reward eligibility check - now all goals give rewards */}
              {!goal.isCompleted && (
                <View style={styles.rewardEligibilityContainer}>
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.rewardEligibilityText,
                      { color: COLORS.primary },
                    ]}
                  >
                    Completing this goal will earn {GOAL_COMPLETION_XP} XP and{" "}
                    {GOAL_COMPLETION_COINS} coins
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delete Goal</Text>
              <TouchableOpacity onPress={() => setDeleteModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.deleteConfirmText}>
                Are you sure you want to delete this goal? This action cannot be
                undone.
              </Text>

              <View style={styles.deleteButtonsContainer}>
                <TouchableOpacity
                  style={[styles.deleteButton, styles.cancelButton]}
                  onPress={() => setDeleteModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.deleteButton, styles.confirmButton]}
                  onPress={handleDeleteGoal}
                >
                  <Text style={styles.confirmButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    marginTop: 12,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginTop: 12,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backIcon: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
  },
  headerAction: {
    marginLeft: 16,
    padding: 4,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
  },
  goalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  goalDescription: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statusText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
  },
  typeBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  typeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  categoryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 16,
    color: COLORS.text,
  },
  routineInfo: {
    marginTop: 8,
  },
  routineDays: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dayIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 40,
    alignItems: "center",
  },
  dayIndicatorText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rewardContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rewardText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 5,
  },
  activeTodayContainer: {
    marginVertical: 8,
  },
  activeTodayBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  activeTodayText: {
    marginLeft: 5,
    fontWeight: "500",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 6,
    marginRight: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 6,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    width: 48,
    textAlign: "right",
  },
  progressLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  progressActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  progressButton: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  progressButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  completeButton: {
    backgroundColor: COLORS.success,
  },
  completeButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  markCompleteButton: {
    backgroundColor: COLORS.success,
  },
  uncompleteButton: {
    backgroundColor: COLORS.textSecondary,
  },
  toggleButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  rewardEligibilityContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  rewardEligibilityText: {
    marginLeft: 6,
    fontSize: 14,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textAreaInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  categoryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryOptionText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 6,
  },
  categoryColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
  },
  routineDaysSection: {
    marginBottom: 20,
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayButton: {
    width: "30%",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 10,
  },
  dayButtonText: {
    fontSize: 14,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteModalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    width: "85%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  modalContent: {
    padding: 16,
  },
  deleteConfirmText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 24,
    textAlign: "center",
  },
  deleteButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  deleteButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: COLORS.lightBackground,
  },
  confirmButton: {
    backgroundColor: "#F44336", // Red color for delete
  },
  cancelButtonText: {
    color: COLORS.text,
    fontWeight: "600",
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default GoalDetailScreen;
