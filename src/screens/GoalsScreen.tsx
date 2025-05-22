import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  TextInput,
  Switch,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { GoalsScreenProps } from "../types/navigaton";
import { GoalListItem } from "../components/GoalListItem";
import { Goal } from "../types";
import { COLORS } from "../common/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchUserGoals,
  updateGoalProgress,
  createGoal,
  getUserStreaks,
  getUserFutureCoins,
  getCategoryColor,
  updateUserCoins,
  updateUserXP,
  deleteGoal,
} from "../services/GoalService";

// Define types for filters and sorting
type GoalFilterType = "all" | "active" | "routine" | "completed";
type GoalSortType = "default" | "date" | "category" | "progress";

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

const GoalsScreen: React.FC<GoalsScreenProps> = ({ navigation, route }) => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || "default_user";

  const [goals, setGoals] = useState<Goal[]>([]);
  const [filteredGoals, setFilteredGoals] = useState<Goal[]>([]);
  const [filterType, setFilterType] = useState<GoalFilterType>("active");
  const [sortType, setSortType] = useState<GoalSortType>("default");
  const [futureCoins, setFutureCoins] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [userExp, setUserExp] = useState(0);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");
  const [newGoalCategory, setNewGoalCategory] = useState("Personal");
  const [newGoalIsDaily, setNewGoalIsDaily] = useState(false);
  const [newGoalSelectedDays, setNewGoalSelectedDays] = useState<number[]>([]);
  const [routineDays, setRoutineDays] = useState<Record<number, number[]>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<number | null>(null);

  // Categories with colors
  const categories = [
    { name: "Personal", color: COLORS.primary },
    { name: "Work", color: "#4CAF50" },
    { name: "Learning", color: "#5E6CE7" },
    { name: "Health", color: "#F44336" },
    { name: "Repair", color: "#56C3B6" },
    { name: "Finance", color: "#FF9800" },
  ];

  // Helper to check if a goal should be active today
  const isGoalActiveToday = (goal: Goal) => {
    if (!goal.isDaily) return true; // Non-daily goals are always active

    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.

    // First check the goal's own routineDays property (from the database)
    if (goal.routineDays && goal.routineDays.length > 0) {
      return goal.routineDays.includes(today);
    }

    // Fall back to the local state if available
    const goalDays = routineDays[goal.id];

    // If no days are specified in either place, show it on all days
    if (
      (!goalDays || goalDays.length === 0) &&
      (!goal.routineDays || goal.routineDays.length === 0)
    ) {
      return true;
    }

    // Otherwise, check if today is in the routine days
    return goalDays && goalDays.includes(today);
  };

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

  // Check if goal rewards can be claimed
  const canClaimRewardsForGoal = (goal: Goal): boolean => {
    // For one-time goals, check if they're completed on or before the assigned day
    if (!goal.isDaily) {
      const today = new Date();
      const goalDate = new Date(
        goal.targetDate || goal.startDate || Date.now()
      );

      // If the goal was due in the past, don't allow claiming rewards
      if (
        goalDate < today &&
        goalDate.toDateString() !== today.toDateString()
      ) {
        return false;
      }
    }

    // All daily goals can claim rewards when completed
    return true;
  };

  // Process goal rewards
  const processGoalRewards = async (goal: Goal) => {
    try {
      // Add XP and coins
      const newXP = userExp + GOAL_COMPLETION_XP;
      const levelUpResult = handleLevelUp(newXP, userLevel);

      // Update XP in database
      await updateUserXP(userId, GOAL_COMPLETION_XP, levelUpResult.newLevel);

      // Update coins in database
      await updateUserCoins(userId, GOAL_COMPLETION_COINS);

      // Update local state
      setUserLevel(levelUpResult.newLevel);
      setUserExp(levelUpResult.finalXP);
      setFutureCoins(futureCoins + GOAL_COMPLETION_COINS);

      // Show completion message
      Alert.alert(
        "Goal Completed!",
        `Great job! You've earned ${GOAL_COMPLETION_XP} XP and ${GOAL_COMPLETION_COINS} coins.`,
        [{ text: "Nice!", style: "default" }]
      );
    } catch (error) {
      console.error("Error processing rewards:", error);
    }
  };

  // Load user data (goals, streaks, coins)
  const loadUserData = async () => {
    try {
      setIsLoading(true);

      // Fetch goals
      const goalsData = await fetchUserGoals();
      setGoals(goalsData);

      // For now, mock routine days since we don't have them in the backend yet
      const mockRoutineDays: Record<number, number[]> = {};
      goalsData.forEach((goal) => {
        if (goal.isDaily) {
          if (goal.routineDays && goal.routineDays.length > 0) {
            mockRoutineDays[goal.id] = goal.routineDays;
          } else {
            // Assign every day routine for daily goals
            mockRoutineDays[goal.id] = [0, 1, 2, 3, 4, 5, 6]; // All days
          }
        }
      });
      setRoutineDays(mockRoutineDays);

      // Make sure we always apply "active" filter first when data loads
      applyFilters(goalsData, "active", sortType, searchQuery);

      // Fetch streak count
      const streak = await getUserStreaks();
      setStreakCount(streak);

      // Fetch coins balance
      const coins = await getUserFutureCoins();
      setFutureCoins(coins);

      // Fetch user level and XP
      try {
        const apiUrl = "http://10.0.2.2:3001/api";
        const response = await fetch(`${apiUrl}/users/${userId}`);
        if (response.ok) {
          const userData = await response.json();
          setUserLevel(userData.level || 1);
          setUserExp(userData.xp_points || 0);
        }
      } catch (error) {
        console.error("Error fetching user level and XP:", error);
      }

      setIsLoading(false);
      setIsRefreshing(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      Alert.alert("Error", "Failed to load data. Please try again later.");
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  

  // Check if route params request to open create goal form
  useEffect(() => {
    if (route.params?.openCreateGoal) {
      setCreateModalVisible(true);
      // Reset the param to avoid reopening
      navigation.setParams({ openCreateGoal: undefined });
    }
    
  }, [route.params?.openCreateGoal]);
  

  // Use the useFocusEffect hook to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset to active tab whenever the screen is focused
      setFilterType("active");
      loadUserData();
      return () => {
        // Cleanup function if needed
      };
    }, [userId]) // Add userId as a dependency
  );

  // Initial data load on mount
  useEffect(() => {
    // Ensure we start with the active tab
    setFilterType("active");
    loadUserData();
  }, [userId]);

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUserData();
  };

  // Apply filters and sorting to goals
  const applyFilters = (
    goalsList: Goal[],
    filter: GoalFilterType = filterType,
    sort: GoalSortType = sortType,
    search: string = searchQuery
  ) => {
    // Filter based on completion status and routine type
    let result = [...goalsList];

    if (filter === "active") {
      // Get today's day of week (0=Sunday, 1=Monday, etc.)
      const today = new Date().getDay();

      // Active goals are incomplete goals that are scheduled for today
      result = result.filter((goal) => {
        // Must be incomplete
        if (goal.isCompleted) return false;

        // If it's not a daily goal, include it
        if (!goal.isDaily) return true;

        // For daily goals, check if today is in the routine days
        if (goal.routineDays && goal.routineDays.length > 0) {
          return goal.routineDays.includes(today);
        }

        // Fall back to the local state if available
        const goalDays = routineDays[goal.id];
        if (goalDays && goalDays.length > 0) {
          return goalDays.includes(today);
        }

        // If no days are specified in either place, show it on all days
        return true;
      });
    } else if (filter === "routine") {
      // Show only daily/routine goals
      result = result.filter((goal) => goal.isDaily);
    } else if (filter === "completed") {
      result = result.filter((goal) => goal.isCompleted);
    }

    // Apply search query
    if (search.trim() !== "") {
      const lowerCaseQuery = search.toLowerCase();
      result = result.filter(
        (goal) =>
          goal.title.toLowerCase().includes(lowerCaseQuery) ||
          (goal.description &&
            goal.description.toLowerCase().includes(lowerCaseQuery)) ||
          (goal.category &&
            goal.category.toLowerCase().includes(lowerCaseQuery))
      );
    }

    // Apply sorting
    switch (sort) {
      case "date":
        result.sort((a, b) => {
          // Sort by date (newest first)
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case "category":
        result.sort((a, b) => {
          // Sort by category
          return (a.category || "").localeCompare(b.category || "");
        });
        break;
      case "progress":
        // Sort by progress (highest first)
        result.sort((a, b) => b.progress - a.progress);
        break;
      default:
        // Default sorting (active goals first, then by date)
        result.sort((a, b) => {
          if (a.isCompleted && !b.isCompleted) return 1;
          if (!a.isCompleted && b.isCompleted) return -1;
          const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
          const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
          return dateB - dateA;
        });
    }

    setFilteredGoals(result);
  };

  const toggleGoalCompletion = async (goalId: number) => {
    try {
      // Find the goal to toggle
      const goalToToggle = goals.find((g) => g.id === goalId);

      if (!goalToToggle) return;

      const wasCompleted = goalToToggle.isCompleted;

      // For daily/routine goals, we just mark as completed for today
      // For one-time goals, we mark as completed permanently
      let newProgress = 0;

      if (!wasCompleted) {
        // Completing the goal
        newProgress = 100;
      } else {
        // Uncompleting the goal - reset progress
        newProgress = 0;
      }

      // Update goal progress in the database
      const updatedGoal = await updateGoalProgress(goalId, newProgress);

      if (!updatedGoal) {
        throw new Error("Failed to update goal");
      }

      // If this is a completion (not unchecking) and goal wasn't previously completed,
      // process rewards only if eligible
      if (!wasCompleted && newProgress === 100) {
        if (canClaimRewardsForGoal(goalToToggle)) {
          await processGoalRewards(goalToToggle);
        }
      }

      // Reload all data to get updated streaks, coins, and goals
      loadUserData();
    } catch (error) {
      console.error("Error updating goal:", error);
      Alert.alert("Error", "Failed to update goal. Please try again.");
    }
  };

  // Toggle day selection for routine
  const toggleDaySelection = (dayId: number) => {
    if (newGoalSelectedDays.includes(dayId)) {
      setNewGoalSelectedDays(newGoalSelectedDays.filter((id) => id !== dayId));
    } else {
      setNewGoalSelectedDays([...newGoalSelectedDays, dayId]);
    }
  };

  const handleCreateGoal = async () => {
    if (newGoalTitle.trim() === "") {
      Alert.alert("Error", "Please enter a goal title");
      return;
    }

    // For routine goals, at least one day must be selected
    if (newGoalIsDaily && newGoalSelectedDays.length === 0) {
      // If no days are selected for a daily goal, default to all days
      setNewGoalSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }

    try {
      // Create a new goal using the service
      const newGoal = await createGoal(
        {
          title: newGoalTitle,
          description: newGoalDescription,
          category: newGoalCategory,
          isCompleted: false,
          isDaily: newGoalIsDaily,
          color: getCategoryColor(newGoalCategory),
          startDate: new Date().toISOString().split("T")[0],
          progress: 0,
          userId: userId,
          coinReward: 10, // Default reward
          routineDays: newGoalIsDaily
            ? newGoalSelectedDays.length > 0
              ? newGoalSelectedDays
              : [0, 1, 2, 3, 4, 5, 6]
            : [],
        },
      );

      // Store the selected days for this goal
      if (newGoalIsDaily && newGoal.id) {
        setRoutineDays((prev) => ({
          ...prev,
          [newGoal.id]: [...newGoalSelectedDays],
        }));
      }

      // Reload goals
      loadUserData();

      // Reset modal and form
      setCreateModalVisible(false);
      setNewGoalTitle("");
      setNewGoalDescription("");
      setNewGoalCategory("Personal");
      setNewGoalIsDaily(false);
      setNewGoalSelectedDays([]);
    } catch (error) {
      console.error("Error creating goal:", error);
      Alert.alert("Error", "Failed to create goal. Please try again.");
    }
  };

  // Function to handle goal deletion
  const handleDeleteGoal = async () => {
    if (goalToDelete === null) return;

    try {
      await deleteGoal(goalToDelete);

      // Reload goals after deletion
      loadUserData();

      // Reset state
      setGoalToDelete(null);
      setDeleteModalVisible(false);
    } catch (error) {
      console.error("Error deleting goal:", error);
      Alert.alert("Error", "Failed to delete goal. Please try again.");
    }
  };

  // Render header with FutureCoins and streak
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>My Goals</Text>
      <View style={styles.headerActions}>
        <View style={styles.streakContainer}>
          <Ionicons name="flame" size={24} color={COLORS.accent2} />
          <Text style={styles.streakText}>{streakCount}</Text>
        </View>
        <View style={styles.coinsContainer}>
          <Ionicons name="star" size={22} color={COLORS.accent1} />
          <Text style={styles.coinsText}>{futureCoins}</Text>
        </View>
      </View>
    </View>
  );

  // Render filter tab bar
  const renderFilterTabs = () => (
    <View style={styles.filterTabContainer}>
      <TouchableOpacity
        style={[
          styles.filterTab,
          filterType === "active" && styles.activeFilterTab,
        ]}
        onPress={() => {
          setFilterType("active");
          applyFilters(goals, "active");
        }}
      >
        <Text
          style={[
            styles.filterTabText,
            filterType === "active" && styles.activeFilterTabText,
          ]}
        >
          Today
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterTab,
          filterType === "routine" && styles.activeFilterTab,
        ]}
        onPress={() => {
          setFilterType("routine");
          applyFilters(goals, "routine");
        }}
      >
        <Text
          style={[
            styles.filterTabText,
            filterType === "routine" && styles.activeFilterTabText,
          ]}
        >
          Routines
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterTab,
          filterType === "all" && styles.activeFilterTab,
        ]}
        onPress={() => {
          setFilterType("all");
          applyFilters(goals, "all");
        }}
      >
        <Text
          style={[
            styles.filterTabText,
            filterType === "all" && styles.activeFilterTabText,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterTab,
          filterType === "completed" && styles.activeFilterTab,
        ]}
        onPress={() => {
          setFilterType("completed");
          applyFilters(goals, "completed");
        }}
      >
        <Text
          style={[
            styles.filterTabText,
            filterType === "completed" && styles.activeFilterTabText,
          ]}
        >
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render search and filter bar
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search goals..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            applyFilters(goals, filterType, sortType, text);
          }}
        />
        {searchQuery !== "" && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery("");
              applyFilters(goals, filterType, sortType, "");
            }}
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setFilterModalVisible(true)}
      >
        <Ionicons name="options-outline" size={22} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  const renderGoalItem = ({ item }: { item: Goal }) => {
    // First check if goal has routineDays property from database
    let daysToShow = item.routineDays || [];

    // If empty, fall back to local state
    if (daysToShow.length === 0) {
      daysToShow = routineDays[item.id] || [];
    }

    // If both are empty and it's a daily goal, default to all days
    if (daysToShow.length === 0 && item.isDaily) {
      daysToShow = [0, 1, 2, 3, 4, 5, 6]; // All days
    }

    return (
      <View style={styles.goalItemContainer}>
        <TouchableOpacity
          style={[
            styles.goalItem,
            { borderLeftColor: item.color || COLORS.primary },
          ]}
          onPress={() => {
            // Navigate to goal details
            navigation.navigate("GoalDetail", { goalId: item.id });
          }}
          onLongPress={() => {
            // Set the goal to delete and show confirmation modal
            setGoalToDelete(item.id);
            setDeleteModalVisible(true);
          }}
        >
          <View style={styles.goalContent}>
            <View style={styles.goalHeader}>
              <Text
                style={[
                  styles.goalTitle,
                  item.isCompleted && styles.completedText,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.isDaily && (
                <View style={styles.dailyBadge}>
                  <Text style={styles.dailyBadgeText}>Daily</Text>
                </View>
              )}
            </View>

            {item.description && (
              <Text
                style={[
                  styles.goalDescription,
                  item.isCompleted && styles.completedText,
                ]}
                numberOfLines={2}
              >
                {item.description}
              </Text>
            )}

            {/* Progress bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${item.progress}%`,
                      backgroundColor: item.isCompleted
                        ? COLORS.success
                        : COLORS.primary,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{item.progress}%</Text>
            </View>

            {/* Routine days indicator */}
            {item.isDaily && (
              <View style={styles.routineDaysContainer}>
                {DAYS_OF_WEEK.map((day) => (
                  <View
                    key={day.id}
                    style={[
                      styles.dayIndicator,
                      daysToShow.includes(day.id)
                        ? { backgroundColor: item.color || COLORS.primary }
                        : { backgroundColor: COLORS.lightBackground },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayIndicatorText,
                        daysToShow.includes(day.id)
                          ? { color: COLORS.white }
                          : { color: COLORS.textSecondary },
                      ]}
                    >
                      {day.name[0]}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.goalFooter}>
              {item.category && (
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: item.color || COLORS.primary },
                  ]}
                >
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              )}
              <Text style={styles.dateText}>
                {item.startDate &&
                  new Date(item.startDate).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkButton}
            onPress={() => toggleGoalCompletion(item.id)}
          >
            {item.isCompleted ? (
              <Ionicons
                name="checkmark-circle"
                size={28}
                color={COLORS.success}
              />
            ) : (
              <Ionicons
                name="ellipse-outline"
                size={28}
                color={COLORS.textLight}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  };

  // Filter modal
  const renderFilterModal = () => (
    <Modal
      visible={isFilterModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setFilterModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterModalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Sort & Filter</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>Sort By</Text>
            <View style={styles.sortOptions}>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortType === "default" && styles.activeSortOption,
                ]}
                onPress={() => {
                  setSortType("default");
                  applyFilters(goals, filterType, "default");
                }}
              >
                <Text style={styles.sortOptionText}>Default</Text>
                {sortType === "default" && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortType === "date" && styles.activeSortOption,
                ]}
                onPress={() => {
                  setSortType("date");
                  applyFilters(goals, filterType, "date");
                }}
              >
                <Text style={styles.sortOptionText}>Date</Text>
                {sortType === "date" && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortType === "category" && styles.activeSortOption,
                ]}
                onPress={() => {
                  setSortType("category");
                  applyFilters(goals, filterType, "category");
                }}
              >
                <Text style={styles.sortOptionText}>Category</Text>
                {sortType === "category" && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortType === "progress" && styles.activeSortOption,
                ]}
                onPress={() => {
                  setSortType("progress");
                  applyFilters(goals, filterType, "progress");
                }}
              >
                <Text style={styles.sortOptionText}>Progress</Text>
                {sortType === "progress" && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSectionTitle}>Filter By Category</Text>
            <View style={styles.categoryFilterOptions}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryFilterOption,
                    { borderColor: category.color },
                  ]}
                  onPress={() => {
                    // Filter by this category
                    const filtered = goals.filter(
                      (goal) => goal.category === category.name
                    );
                    setFilteredGoals(filtered);
                    setFilterModalVisible(false);
                  }}
                >
                  <View
                    style={[
                      styles.categoryColorDot,
                      { backgroundColor: category.color },
                    ]}
                  />
                  <Text style={styles.categoryFilterText}>{category.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                // Reset all filters but keep active tab
                setFilterType("active");
                setSortType("default");
                setSearchQuery("");
                applyFilters(goals, "active", "default", "");
                setFilterModalVisible(false);
              }}
            >
              <Text style={styles.resetButtonText}>Reset Filters</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Create goal modal with routine days selection
  const renderCreateModal = () => (
    <Modal
      visible={isCreateModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setCreateModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Goal</Text>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter goal title"
              value={newGoalTitle}
              onChangeText={setNewGoalTitle}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput]}
              placeholder="Enter goal description"
              value={newGoalDescription}
              onChangeText={setNewGoalDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categoryOptions}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryOption,
                    newGoalCategory === category.name && {
                      borderColor: category.color,
                      backgroundColor: `${category.color}15`,
                    },
                  ]}
                  onPress={() => setNewGoalCategory(category.name)}
                >
                  <View
                    style={[
                      styles.categoryColorDot,
                      { backgroundColor: category.color },
                    ]}
                  />
                  <Text
                    style={[
                      styles.categoryOptionText,
                      newGoalCategory === category.name && {
                        color: category.color,
                        fontWeight: "600",
                      },
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Daily Goal</Text>
              <Switch
                value={newGoalIsDaily}
                onValueChange={setNewGoalIsDaily}
                trackColor={{ false: "#ccc", true: `${COLORS.primary}50` }}
                thumbColor={newGoalIsDaily ? COLORS.primary : "#f4f3f4"}
              />
            </View>

            {/* Routine days selection */}
            {newGoalIsDaily && (
              <View style={styles.routineDaysSection}>
                <Text style={styles.inputLabel}>Repeat on these days:</Text>
                <View style={styles.daysContainer}>
                  {DAYS_OF_WEEK.map((day) => (
                    <TouchableOpacity
                      key={day.id}
                      style={[
                        styles.dayButton,
                        newGoalSelectedDays.includes(day.id) && {
                          backgroundColor: COLORS.primary,
                        },
                      ]}
                      onPress={() => toggleDaySelection(day.id)}
                    >
                      <Text
                        style={[
                          styles.dayButtonText,
                          newGoalSelectedDays.includes(day.id) && {
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

            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreateGoal}
            >
              <Text style={styles.createButtonText}>Create Goal</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Delete confirmation modal
  const renderDeleteModal = () => (
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
  );

  // Render loading, empty, or error state
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.emptyStateTitle}>Loading goals...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons
          name="clipboard-outline"
          size={60}
          color={COLORS.textSecondary}
        />
        <Text style={styles.emptyStateTitle}>No Goals Found</Text>
        <Text style={styles.emptyStateText}>
          {searchQuery
            ? "No goals match your search criteria."
            : filterType === "completed"
            ? "You haven't completed any goals yet."
            : filterType === "active"
            ? "You don't have any active goals for today."
            : filterType === "routine"
            ? "You don't have any routine goals set up."
            : "You don't have any goals. Create one to get started!"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      {renderFilterTabs()}
      {renderSearchBar()}

      {filteredGoals.length > 0 ? (
        <FlatList
          data={filteredGoals}
          renderItem={renderGoalItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
      ) : (
        renderEmptyState()
      )}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setCreateModalVisible(true)}
      >
        <Ionicons name="add" size={30} color={COLORS.white} />
      </TouchableOpacity>

      {renderCreateModal()}
      {renderFilterModal()}
      {renderDeleteModal()}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightBackground,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 10,
  },
  streakText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.accent2,
    marginLeft: 5,
  },
  coinsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightBackground,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  coinsText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.accent1,
    marginLeft: 5,
  },
  filterTabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeFilterTab: {
    borderBottomColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
  },
  activeFilterTabText: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingHorizontal: 8,
  },
  filterButton: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  goalItemContainer: {
    marginBottom: 12,
  },
  goalItem: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  goalContent: {
    flex: 1,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  goalDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 3,
    marginRight: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 35,
    textAlign: "right",
  },
  routineDaysContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dayIndicatorText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "600",
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dailyBadge: {
    backgroundColor: COLORS.accent2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dailyBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "600",
  },
  checkButton: {
    justifyContent: "center",
    paddingLeft: 12,
  },
  completedText: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%", // Increased height for routine selection
  },
  filterModalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
  },
  deleteModalContainer: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    width: "85%",
    alignSelf: "center",
    marginTop: "50%", // Center in screen
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
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    color: COLORS.text,
  },
  textAreaInput: {
    minHeight: 100,
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
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
  sortOptions: {
    marginBottom: 20,
  },
  sortOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activeSortOption: {
    backgroundColor: `${COLORS.primary}10`,
  },
  sortOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  categoryFilterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  categoryFilterOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryFilterText: {
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginVertical: 10,
  },
  resetButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
  },
  deleteConfirmText: {
    fontSize: 16,
    color: COLORS.text,
    marginVertical: 20,
    textAlign: "center",
  },
  deleteButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
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

export default GoalsScreen;
