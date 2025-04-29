import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  FlatList,
  SectionList,
  Dimensions,
  Platform,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { GoalsScreenNavigationProp, HomeScreenProps } from "../types/navigaton";
import { ProgressCircle } from "../components/ProgressCircle";
import { DailyQuote } from "../components/DailyQuote";
import { RoutineListItem } from "../components/RoutineListItem";
import { NewsList } from "../components/NewsList";
import { GoalListItem } from "../components/GoalListItem";
import { fetchDailyQuote } from "../services/QuoteService";
import {
  fetchUserGoals,
  updateGoalProgress,
  isGoalActiveToday,
  getTodaysGoals,
  getCategoryColor,
} from "../services/GoalService";
import {
  fetchUserRoutines,
  toggleRoutineCompletion,
  isRoutineActiveToday,
} from "../services/RoutineService";
import { fetchNews } from "../services/NewsService";
import { Goal, Routine, News, Quote } from "../types";
import { COLORS } from "../common/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";

// Get screen width for card sizing
const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.7;
const CARD_SPACING = 12;

// Define section types for the SectionList
type SectionType = {
  title: string;
  data: any[];
  renderItem: (item: any) => React.ReactElement;
  keyExtractor: (item: any) => string;
};


// Helper function to get API base URL
const getApiBaseUrl = () => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return "http://localhost:3001/api";
  }
};

// Helper function to update user stats in the database
const updateUserStats = async (
  userId: string,
  xpToAdd: number,
  coinsToAdd: number
): Promise<any> => {
  try {
    const apiUrl = getApiBaseUrl();

    const response = await fetch(`${apiUrl}/users/${userId}/stats`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        xp_points_to_add: xpToAdd,
        future_coins_to_add: coinsToAdd,
      }),
    });

    if (!response.ok) throw new Error("Failed to update user stats");
    return await response.json();
  } catch (error) {
    console.error("Error updating user stats:", error);
    throw error;
  }
};

// Helper function to update user streak in the database
const updateUserStreak = async (
  userId: string,
  increment: boolean = true
): Promise<any> => {
  try {
    const apiUrl = getApiBaseUrl();

    const response = await fetch(`${apiUrl}/users/${userId}/streak`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ increment }),
    });

    if (!response.ok) throw new Error("Failed to update user streak");
    return await response.json();
  } catch (error) {
    console.error("Error updating user streak:", error);
    throw error;
  }
};

// Helper function to check if goal rewards can be claimed
const canClaimRewardsForGoal = async (goal: Goal) => {
  // For one-time goals, check if they're completed on the assigned day
  if (goal.type === "one-time") {
    const today = new Date();
    const goalDate = new Date(goal.targetDate || Date.now());

    // If the goal was due in the past, don't allow claiming rewards
    if (goalDate < today && goalDate.toDateString() !== today.toDateString()) {
      return false;
    }
  }

  // All other goals can claim rewards
  return true;
};

// Define XP and coin rewards
const GOAL_COMPLETION_XP = 10;
const ROUTINE_COMPLETION_XP = 5;
const STREAK_MILESTONE_XP = 25; // XP for reaching streak milestones (7, 30, etc)
const GOAL_COMPLETION_COINS = 5;
const ROUTINE_COMPLETION_COINS = 2;
const STREAK_MILESTONE_COINS = 20;

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  // Use tabNavigation for navigating to bottom tab screens
  const tabNavigation = useNavigation<GoalsScreenNavigationProp>();

  const { currentUser } = useAuth();
  const userId = currentUser?.id || "default_user";

  // Updated to prioritize route params for username
  const username = route.params?.username || currentUser?.name || "User";

  // Updated state initialization to use route params first
  const [quote, setQuote] = useState<Quote | null>(null);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [todayGoals, setTodayGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);

  // Use route params for user stats with appropriate fallbacks
  const [userLevel, setUserLevel] = useState(
    route.params?.userLevel || currentUser?.level || 1
  );
  const [userExp, setUserExp] = useState(
    route.params?.userExp || currentUser?.xp_points || 0
  );
  const [userCoins, setUserCoins] = useState(
    route.params?.userCoins || currentUser?.future_coins || 0
  );
  const [streakCount, setStreakCount] = useState(
    route.params?.streakCount || 0
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quoteLoaded, setQuoteLoaded] = useState(false);

  // Ref for the main SectionList
  const sectionListRef = useRef(null);

  // Function to fetch all user data EXCEPT quote
  const fetchUserData = async () => {
    try {
      setIsRefreshing(true);

      // Get all user goals
      const goalsData = await fetchUserGoals(userId);
      setAllGoals(goalsData);

      // Filter for today's goals only (not completed and active today)
      const todaysGoalsData = goalsData.filter(
        (goal) => !goal.isCompleted && isGoalActiveToday(goal)
      );

      // Sort goals - incomplete first, then completed
      const sortedGoals = [...todaysGoalsData].sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;
        return 0;
      });

      setTodayGoals(sortedGoals);

      // Calculate overall progress for today's goals
      const completedGoals = todaysGoalsData.filter(
        (goal) => goal.isCompleted
      ).length;
      const totalGoals = todaysGoalsData.length;
      const progressPercentage =
        totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
      setOverallProgress(progressPercentage);

      // Get user routines
      const routinesData = await fetchUserRoutines(userId);
      setRoutines(routinesData);

      // Get relevant news
      const newsData = await fetchNews();
      setNews(newsData);

      // Fetch user stats from the database
      try {
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/users/${userId}`);

        if (response.ok) {
          const userData = await response.json();
          setUserLevel(userData.level || userLevel);
          setUserExp(userData.xp_points || userExp);
          setUserCoins(userData.future_coins || userCoins);

          // Fetch streak data
          const streakResponse = await fetch(
            `${apiUrl}/users/${userId}/streak`
          );
          if (streakResponse.ok) {
            const streakData = await streakResponse.json();
            setStreakCount(streakData.current_streak || streakCount);
          }
        }
      } catch (error) {
        console.error("Error fetching user data from database:", error);
        // Fall back to route params or current state
        setUserLevel(
          route.params?.userLevel || currentUser?.level || userLevel
        );
        setUserExp(route.params?.userExp || currentUser?.xp_points || userExp);
        setUserCoins(
          route.params?.userCoins || currentUser?.future_coins || userCoins
        );
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsRefreshing(false);
    }
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

  // Load the quote only once (on initial mount)
  useEffect(() => {
    const loadQuote = async () => {
      if (!quoteLoaded) {
        try {
          const quoteData = await fetchDailyQuote();
          setQuote(quoteData);
          setQuoteLoaded(true);
        } catch (error) {
          console.error("Error fetching quote:", error);
        }
      }
    };

    loadQuote();
  }, [quoteLoaded]);

  // Use useFocusEffect to refresh data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Fetch data when screen comes into focus (except quote)
      fetchUserData();

      return () => {
        // Any cleanup if needed
      };
    }, [
      userId,
      route.params?.userLevel,
      route.params?.userExp,
      route.params?.userCoins,
      route.params?.streakCount,
    ])
  );

  // Initial data load on mount
  useEffect(() => {
    fetchUserData();
  }, [
    userId,
    route.params?.userLevel,
    route.params?.userExp,
    route.params?.userCoins,
    route.params?.streakCount,
  ]);

  // Toggle goal completion with database update
  const toggleGoalCompletion = async (goalId: number) => {
    try {
      // Find the goal we're toggling
      const goalToToggle = todayGoals.find((goal) => goal.id === goalId);

      if (!goalToToggle) return;

      // Calculate new progress value
      const newProgress = !goalToToggle.isCompleted ? 100 : 0;
      const wasCompleted = goalToToggle.isCompleted;

      // Update the goal in the database
      await updateGoalProgress(goalId, newProgress);

      // If this is a completion (not unchecking), handle rewards
      if (!wasCompleted && newProgress === 100) {
        // Check if user can claim rewards for this goal (one-day goals can't be claimed if expired)
        const canClaimRewards = await canClaimRewardsForGoal(goalToToggle);

        if (canClaimRewards) {
          try {
            // Update database with XP and coins
            const updatedStats = await updateUserStats(
              userId,
              GOAL_COMPLETION_XP,
              GOAL_COMPLETION_COINS
            );

            // Update streak in database
            const updatedStreak = await updateUserStreak(userId);

            // Process level-up if needed
            const levelUpResult = handleLevelUp(
              updatedStats.xp_points,
              updatedStats.level
            );

            // Update local state with values from database
            setUserLevel(levelUpResult.newLevel);
            setUserExp(levelUpResult.finalXP);
            setUserCoins(updatedStats.future_coins);
            setStreakCount(updatedStreak.current_streak || streakCount + 1);

            // Show completion message
            Alert.alert(
              "Goal Completed!",
              `Great job! You've earned ${GOAL_COMPLETION_XP} XP and ${GOAL_COMPLETION_COINS} coins.`,
              [{ text: "Nice!", style: "default" }]
            );
          } catch (error) {
            console.error("Error updating user stats in database:", error);

            // Fall back to local state updates if database update fails
            const newXP = userExp + GOAL_COMPLETION_XP;
            const levelUpResult = handleLevelUp(newXP, userLevel);

            setUserLevel(levelUpResult.newLevel);
            setUserExp(levelUpResult.finalXP);
            setUserCoins(userCoins + GOAL_COMPLETION_COINS);
            setStreakCount(streakCount + 1);

            // Show completion message
            Alert.alert(
              "Goal Completed!",
              `Great job! You've earned ${GOAL_COMPLETION_XP} XP and ${GOAL_COMPLETION_COINS} coins.`,
              [{ text: "Nice!", style: "default" }]
            );
          }
        }
      }

      // Optimistically update the UI
      setTodayGoals((prevGoals) => {
        const updatedGoals = prevGoals.map((goal) => {
          if (goal.id === goalId) {
            return {
              ...goal,
              isCompleted: !goal.isCompleted,
              progress: newProgress,
            };
          }
          return goal;
        });

        // Sort goals - incomplete first, then completed
        const sortedGoals = [...updatedGoals].sort((a, b) => {
          if (a.isCompleted && !b.isCompleted) return 1;
          if (!a.isCompleted && b.isCompleted) return -1;
          return 0;
        });

        // Recalculate progress percentage
        const completedGoals = updatedGoals.filter((g) => g.isCompleted).length;
        const totalGoals = updatedGoals.length;
        const newOverallProgress =
          totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
        setOverallProgress(newOverallProgress);

        return sortedGoals;
      });
    } catch (error) {
      console.error("Error toggling goal completion:", error);
      Alert.alert("Error", "Failed to update goal. Please try again.");

      // If there was an error, refresh the goals to make sure UI is in sync with database
      fetchUserData();
    }
  };

  // Toggle routine completion
  const handleToggleRoutine = async (routineId: number) => {
    try {
      // Find the routine
      const routineToToggle = routines.find(
        (routine) => routine.id === routineId
      );
      if (!routineToToggle) return;

      // Check if this is a completion (all tasks complete)
      const willBeCompleted =
        routineToToggle.completedTasks + 1 === routineToToggle.totalTasks;

      // Toggle the routine completion via service
      await toggleRoutineCompletion(routineId);

      // If routine is now complete, handle rewards
      if (willBeCompleted) {
        try {
          // Update database with XP and coins
          const updatedStats = await updateUserStats(
            userId,
            ROUTINE_COMPLETION_XP,
            ROUTINE_COMPLETION_COINS
          );

          // Update streak in database
          const updatedStreak = await updateUserStreak(userId);

          // Process level-up if needed
          const levelUpResult = handleLevelUp(
            updatedStats.xp_points,
            updatedStats.level
          );

          // Update local state with values from database
          setUserLevel(levelUpResult.newLevel);
          setUserExp(levelUpResult.finalXP);
          setUserCoins(updatedStats.future_coins);
          setStreakCount(updatedStreak.current_streak || streakCount + 1);

          // Show completion message
          Alert.alert(
            "Routine Completed!",
            `Well done! You've earned ${ROUTINE_COMPLETION_XP} XP and ${ROUTINE_COMPLETION_COINS} coins.`,
            [{ text: "Great!", style: "default" }]
          );
        } catch (error) {
          console.error("Error updating user stats in database:", error);

          // Fall back to local state updates if database update fails
          const newXP = userExp + ROUTINE_COMPLETION_XP;
          const levelUpResult = handleLevelUp(newXP, userLevel);

          setUserLevel(levelUpResult.newLevel);
          setUserExp(levelUpResult.finalXP);
          setUserCoins(userCoins + ROUTINE_COMPLETION_COINS);
          setStreakCount(streakCount + 1);

          // Show completion message
          Alert.alert(
            "Routine Completed!",
            `Well done! You've earned ${ROUTINE_COMPLETION_XP} XP and ${ROUTINE_COMPLETION_COINS} coins.`,
            [{ text: "Great!", style: "default" }]
          );
        }
      }

      // Refresh data to show updated state
      fetchUserData();
    } catch (error) {
      console.error("Error toggling routine completion:", error);
      Alert.alert("Error", "Failed to update routine. Please try again.");
    }
  };

  // Navigation functions
  const navigateToGoalsScreen = () => {
    tabNavigation.navigate("Goals");
  };

  const navigateToCreateGoal = () => {
    // Navigate to Goals tab with param to trigger create form
    tabNavigation.navigate("Goals", { openCreateGoal: true });
  };

  // Create header component with company name
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.companyName}> FutureMove</Text>
      <View style={styles.userCoinsContainer}>
        <Ionicons name="wallet-outline" size={20} color={COLORS.accent2} />
        <Text style={styles.userCoinsText}>{userCoins}</Text>
      </View>
    </View>
  );

  // Progress section with welcome message, streak, and progress circle
  const renderProgressSection = () => (
    <View style={styles.progressSection}>
      {/* Welcome and Streak */}
      <View style={styles.welcomeRow}>
        <Text style={styles.welcomeText}>Welcome Back, {username}!</Text>
        <View style={styles.streakContainer}>
          <Ionicons name="flame" size={24} color={COLORS.accent2} />
          <Text style={styles.streakText}>{streakCount}</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressCircleContainer}>
          <ProgressCircle
            progress={overallProgress}
            size={140}
            strokeWidth={15}
            progressColor={COLORS.primary}
          />
          <View style={styles.goalCountContainer}>
            <Text style={styles.goalCompletedText}>
              {todayGoals.filter((goal) => goal.isCompleted).length}/
              {todayGoals.length}
            </Text>
            <Text style={styles.goalCompletedLabel}>Today's Goals</Text>
          </View>
        </View>

        <View style={styles.levelContainer}>
          <View style={styles.levelHeader}>
            <Text style={styles.levelText}>Level {userLevel}</Text>
            <Text style={styles.expText}>{userExp}/100 XP</Text>
          </View>
          <View style={styles.expBarContainer}>
            <View style={[styles.expBar, { width: `${userExp}%` }]} />
          </View>
        </View>
      </View>
    </View>
  );

  // Daily quote component
  const renderDailyQuote = () => (
    <DailyQuote quote={quote?.text} author={quote?.author} />
  );

  // Render individual goal item for goals section (horizontal card)
  const renderGoalItem = ({ item }: { item: Goal }) => (
    <TouchableOpacity
      style={[
        styles.goalCard,
        { borderLeftColor: item.color || COLORS.primary },
      ]}
      onPress={() => {
        // Navigate to the Goals tab with specific goal ID
        tabNavigation.navigate("Goals", { viewGoalId: item.id });
      }}
      activeOpacity={0.8}
    >
      <View style={styles.goalCardContent}>
        <View style={styles.goalCardHeader}>
          <Text
            style={[
              styles.goalCardTitle,
              item.isCompleted ? styles.completedText : {},
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
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
        </View>

        {item.description && (
          <Text
            style={[
              styles.goalCardDescription,
              item.isCompleted ? styles.completedText : {},
            ]}
            numberOfLines={3}
          >
            {item.description}
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.checkButton,
            item.isCompleted ? styles.completedCheckButton : {},
          ]}
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
      </View>
    </TouchableOpacity>
  );

  // Render horizontal goal list
  const renderHorizontalGoalList = () => (
    <FlatList
      data={todayGoals}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderGoalItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalListContent}
      snapToInterval={CARD_WIDTH + CARD_SPACING}
      snapToAlignment="start"
      decelerationRate="fast"
    />
  );

  // Goals section with horizontal list of goals, create button
  const renderGoalsSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Goals</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={navigateToGoalsScreen}
        >
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {todayGoals.length > 0 ? (
        renderHorizontalGoalList()
      ) : (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.noGoalsText}>
            You have 0 active goals for today.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={navigateToCreateGoal}
      >
        <Text style={styles.actionButtonText}>Create New Goal</Text>
      </TouchableOpacity>
    </View>
  );

  // Render individual routine item with similar styling to goals
  const renderRoutineItem = ({ item }: { item: Routine }) => {
    // Get color based on routine type or use default
    const routineColor = COLORS.accent1;

    // Calculate progress percentage
    const progressPercentage =
      item.totalTasks > 0
        ? Math.round((item.completedTasks / item.totalTasks) * 100)
        : 0;

    return (
      <TouchableOpacity
        style={[styles.routineCard, { borderLeftColor: routineColor }]}
        onPress={() => {
          // Navigate to the Goals tab with routine filter
          tabNavigation.navigate("Goals", {
            filterType: "routine",
          });
        }}
        activeOpacity={0.8}
      >
        <View style={styles.routineCardContent}>
          <View style={styles.routineCardHeader}>
            <Text
              style={[
                styles.routineCardTitle,
                item.completedTasks === item.totalTasks
                  ? styles.completedText
                  : {},
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {/* Show frequency as a badge */}
            <View
              style={[styles.categoryBadge, { backgroundColor: routineColor }]}
            >
              <Text style={styles.categoryText}>{item.frequency}</Text>
            </View>
          </View>

          <View style={styles.routineFrequencyRow}>
            <Ionicons
              name="repeat-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.routineFrequencyText}>{item.frequency}</Text>
          </View>

          <View style={styles.routineProgressContainer}>
            <View style={styles.routineProgressBar}>
              <View
                style={[
                  styles.routineProgressFill,
                  {
                    width: `${progressPercentage}%`,
                    backgroundColor:
                      item.completedTasks === item.totalTasks
                        ? COLORS.success
                        : routineColor,
                  },
                ]}
              />
            </View>
            <Text style={styles.routineProgressText}>
              {item.completedTasks}/{item.totalTasks}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.checkButton,
              item.completedTasks === item.totalTasks
                ? styles.completedCheckButton
                : {},
            ]}
            onPress={() => handleToggleRoutine(item.id)}
            disabled={item.completedTasks === item.totalTasks}
          >
            {item.completedTasks === item.totalTasks ? (
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
        </View>
      </TouchableOpacity>
    );
  };

  // Render horizontal routines list
  const renderHorizontalRoutinesList = () => (
    <FlatList
      data={routines}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderRoutineItem}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalListContent}
      snapToInterval={CARD_WIDTH + CARD_SPACING}
      snapToAlignment="start"
      decelerationRate="fast"
    />
  );

  // Routines section
  const renderRoutinesSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Routines</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() =>
            tabNavigation.navigate("Goals", { filterType: "routine" })
          }
        >
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {routines.length > 0 ? (
        renderHorizontalRoutinesList()
      ) : (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.noGoalsText}>You have 0 active routines.</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => {
          // Navigate to create goal but set it as daily/routine
          tabNavigation.navigate("Goals", {
            openCreateGoal: true,
            createAsRoutine: true,
          });
        }}
      >
        <Text style={styles.actionButtonText}>Create New Routine</Text>
      </TouchableOpacity>
    </View>
  );

  // News section
  const renderNewsSection = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>News</Text>
      <NewsList news={news} />
    </View>
  );

  // Prepare sections for SectionList
  const sections: SectionType[] = [
    {
      title: "quote",
      data: [{ id: "quote" }],
      renderItem: () => renderDailyQuote(),
      keyExtractor: () => "quote",
    },
    {
      title: "progress",
      data: [{ id: "progress" }],
      renderItem: () => renderProgressSection(),
      keyExtractor: () => "progress",
    },
    {
      title: "goals",
      data: [{ id: "goals" }],
      renderItem: () => renderGoalsSection(),
      keyExtractor: () => "goals",
    },
    {
      title: "routines",
      data: [{ id: "routines" }],
      renderItem: () => renderRoutinesSection(),
      keyExtractor: () => "routines",
    },
    {
      title: "news",
      data: [{ id: "news" }],
      renderItem: () => renderNewsSection(),
      keyExtractor: () => "news",
    },
  ];

  // Render each section with no section headers
  const renderSection = ({ item }: { item: any }) => {
    // Find the section for this item
    const section = sections.find((s) => s.data[0].id === item.id);
    if (section) {
      return section.renderItem(item);
    }
    return null;
  };

  // Optional: Add pull-to-refresh functionality
  const handleRefresh = () => {
    fetchUserData();
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}

      <SectionList
        ref={sectionListRef}
        sections={sections}
        renderItem={renderSection}
        renderSectionHeader={() => null} // No section headers
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.sectionListContent}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  sectionListContent: {
    paddingBottom: 20,
  },
  header: {
    padding: 16,
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  companyName: {
    fontSize: 24,
    color: COLORS.primary,
    fontFamily: "FutureMoveLogo",
    marginLeft: 8,
    marginBottom: 4,
  },
  userCoinsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  userCoinsText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.accent2,
  },
  progressSection: {
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  welcomeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 12,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text,
  },
  streakContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightBackground,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.accent2,
    marginLeft: 5,
  },
  progressContainer: {
    alignItems: "center",
  },
  progressCircleContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  goalCountContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  goalCompletedText: {
    fontSize: 26,
    fontWeight: "bold",
    color: COLORS.text,
  },
  goalCompletedLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  levelContainer: {
    width: "100%",
    marginBottom: 10,
  },
  levelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  levelText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
  },
  expText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  expBarContainer: {
    height: 10,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 5,
    overflow: "hidden",
  },
  expBar: {
    height: "100%",
    backgroundColor: COLORS.accent1,
    borderRadius: 5,
  },
  section: {
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
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
  },
  horizontalListContent: {
    paddingLeft: 16,
    paddingRight: 40,
    paddingVertical: 8,
  },
  emptyStateContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  goalCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    marginRight: CARD_SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    overflow: "hidden",
  },
  goalCardContent: {
    padding: 16,
    flex: 1,
  },
  goalCardHeader: {
    marginBottom: 8,
  },
  goalCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  goalCardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
    flex: 1,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  categoryText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  completedText: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  checkButton: {
    alignSelf: "flex-end",
    padding: 5,
  },
  completedCheckButton: {
    opacity: 0.9,
  },
  routineCard: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 16,
    marginRight: CARD_SPACING,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    overflow: "hidden",
  },
  routineCardContent: {
    padding: 16,
    flex: 1,
  },
  routineCardHeader: {
    marginBottom: 8,
  },
  routineCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  routineFrequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  routineFrequencyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  routineProgressContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  routineProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 4,
    marginRight: 8,
    overflow: "hidden",
  },
  routineProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  routineProgressText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.textSecondary,
    width: 36,
    textAlign: "right",
  },
  noGoalsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 10,
    textAlign: "center",
    padding: 20,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  actionButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  viewAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewAllText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "500",
  },
});

export default HomeScreen;
