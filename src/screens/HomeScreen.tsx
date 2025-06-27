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
  ImageBackground,
  Image,
  ActivityIndicator,
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
import {
  fetchUserStreak,
  checkAndUpdateStreak,
} from "../services/StreakService";
// ADDED: Achievement service import
import {
  checkForNewAchievements,
  processNewAchievements,
} from "../services/AchievementService";
import { Goal, Routine, News, Quote } from "../types";
import { COLORS } from "../common/constants/colors";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../config/firebase"; // Import Firebase auth

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

// Extended Routine type to include the properties we need
interface ExtendedRoutine extends Omit<Routine, "frequency"> {
  routine_days?: number[];
  category: string;
  isCompleted?: boolean;
  completedTasks: number;
  totalTasks: number;
  frequency?: string;
}

// Category background images mapping
const CATEGORY_BACKGROUNDS: Record<string, any> = {
  Personal: require("../assets/images/personal_background.png"),
  Work: require("../assets/images/work_background.png"),
  Learning: require("../assets/images/learning_background.png"),
  Health: require("../assets/images/health_background.png"),
  Repair: require("../assets/images/repair_background.png"),
  Finance: require("../assets/images/finance_background.png"),
};

// Helper function to get API base URL
const getApiBaseUrl = () => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return "http://192.168.1.207:3001/api";
  }
};

// Helper function to update user stats in the database
const updateUserStats = async (
  userId: string,
  xpToAdd: number,
  coinsToAdd: number
): Promise<any> => {
  try {
    // Ensure we have a valid user ID from Firebase
    if (!userId || userId === "default_user") {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found");
      }
      userId = currentUser.uid;
    }

    const apiUrl = getApiBaseUrl();

    const response = await fetch(`${apiUrl}/users/${userId}/stats`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
      },
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
    // Ensure we have a valid user ID from Firebase
    if (!userId || userId === "default_user") {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("No authenticated user found");
      }
      userId = currentUser.uid;
    }

    const apiUrl = getApiBaseUrl();

    const response = await fetch(`${apiUrl}/users/${userId}/streak`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
      },
      body: JSON.stringify({ increment }),
    });

    if (!response.ok) throw new Error("Failed to update user streak");
    return await response.json();
  } catch (error) {
    console.error("Error updating user streak:", error);
    throw error;
  }
};

// UPDATED: Helper function to check if goal rewards can be claimed
// Now allows all goals to receive rewards regardless of due date
const canClaimRewardsForGoal = async (goal: Goal) => {
  console.log(
    `Checking rewards eligibility for goal: ${goal.title}, Type: ${goal.type}`
  );

  // Allow rewards for all goals regardless of completion date or type
  console.log(`Goal is eligible for rewards: all goals can earn rewards`);
  return true;
};

// Define XP and coin rewards
const GOAL_COMPLETION_XP = 10;
const ROUTINE_COMPLETION_XP = 5;
const STREAK_MILESTONE_XP = 25; // XP for reaching streak milestones (7, 30, etc)
const GOAL_COMPLETION_COINS = 5;
const ROUTINE_COMPLETION_COINS = 2;
const STREAK_MILESTONE_COINS = 20;

// Helper function to get background image for a category
const getCategoryBackground = (category: string) => {
  // Default to Personal if category doesn't exist in our mapping
  return CATEGORY_BACKGROUNDS[category] || CATEGORY_BACKGROUNDS["Personal"];
};

// UPDATED: Helper function to parse routine days array from goal data
const parseRoutineDays = (goal: any): number[] => {
  let routineDays: number[] = [];

  // Check if we have routine_days as a string that needs parsing
  if (goal.routine_days) {
    if (typeof goal.routine_days === "string") {
      try {
        routineDays = JSON.parse(goal.routine_days);
      } catch (e) {
        console.error("Error parsing routine days:", e);
        routineDays = [];
      }
    } else if (Array.isArray(goal.routine_days)) {
      routineDays = goal.routine_days;
    }
  }

  return routineDays;
};

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  // Use tabNavigation for navigating to bottom tab screens
  const tabNavigation = useNavigation<GoalsScreenNavigationProp>();

  const { currentUser } = useAuth();
  // Get Firebase user ID, with fallback
  const userId = auth.currentUser?.uid || currentUser?.id || "default_user";

  // Updated to prioritize route params for username
  const username =
    route.params?.username ||
    currentUser?.name ||
    auth.currentUser?.displayName ||
    "User";

  // Updated state initialization to use route params first
  const [quote, setQuote] = useState<Quote | null>(null);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [todayGoals, setTodayGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Goal[]>([]);
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

  // SECURITY FIX: Add state to track which goals are being processed
  const [processingGoals, setProcessingGoals] = useState<Set<number>>(
    new Set()
  );

  // Ref for the main SectionList
  const sectionListRef = useRef(null);

  // Function to fetch all user data EXCEPT quote
  const fetchUserData = async () => {
    try {
      setIsRefreshing(true);

      // Ensure we have the latest Firebase user ID
      const firebaseUserId = auth.currentUser?.uid;
      const effectiveUserId = firebaseUserId || userId;

      console.log(`Fetching data for user: ${effectiveUserId}`);

      // Get all user goals
      const goalsData = await fetchUserGoals();
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

      // Get user routines - just filter daily goals from all goals
      const routinesData = goalsData.filter((goal) => goal.isDaily);
      setRoutines(routinesData);

      // Get relevant news
      const newsData = await fetchNews();
      setNews(newsData);

      // Fetch user stats from the database
      try {
        const apiUrl = getApiBaseUrl();
        const idToken = await auth.currentUser?.getIdToken();
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };

        if (idToken) {
          headers["Authorization"] = `Bearer ${idToken}`;
        }

        const response = await fetch(`${apiUrl}/users/${effectiveUserId}`, {
          headers,
        });

        if (response.ok) {
          const userData = await response.json();
          setUserLevel(userData.level || userLevel);
          setUserExp(userData.xp_points || userExp);
          setUserCoins(userData.future_coins || userCoins);

          // Fetch streak data using the dedicated streak service
          const streakData = await fetchUserStreak(effectiveUserId);
          setStreakCount(streakData.current_streak || 0);

          // Check if streak needs to be updated (new day, etc)
          await checkAndUpdateStreak(effectiveUserId);
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

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log(`Firebase auth state changed, user: ${user.uid}`);
        // User is signed in, refresh data
        fetchUserData();
      } else {
        console.log("No user is signed in with Firebase");
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

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

  // SECURITY FIX: Toggle goal completion with button freezing protection
  const toggleGoalCompletion = async (goalId: number) => {
    // Prevent multiple clicks if already processing
    if (processingGoals.has(goalId)) {
      return;
    }

    try {
      console.log(`Toggling goal completion for goal ID: ${goalId}`);

      // Add goal to processing set to disable button
      setProcessingGoals((prev) => new Set(prev).add(goalId));

      // Ensure we have the latest Firebase user ID
      const firebaseUserId = auth.currentUser?.uid;
      const effectiveUserId = firebaseUserId || userId;

      // Find the goal we're toggling
      const goalToToggle = todayGoals.find((goal) => goal.id === goalId);

      if (!goalToToggle) {
        console.log(`Goal not found with ID: ${goalId}`);
        return;
      }

      console.log(
        `Found goal: ${goalToToggle.title}, Type: ${goalToToggle.type}, Category: ${goalToToggle.category}`
      );

      // Calculate new progress value
      const newProgress = !goalToToggle.isCompleted ? 100 : 0;
      const wasCompleted = goalToToggle.isCompleted;

      console.log(
        `Current progress: ${goalToToggle.progress}, New progress: ${newProgress}`
      );

      // Update the goal in the database
      await updateGoalProgress(goalId, newProgress);

      // If this is a completion (not unchecking), handle rewards and achievements
      if (!wasCompleted && newProgress === 100) {
        console.log(
          `Goal is being completed, granting rewards and checking achievements`
        );

        try {
          console.log(`Updating user stats for user: ${effectiveUserId}`);

          // Update database with XP and coins
          const updatedStats = await updateUserStats(
            effectiveUserId,
            GOAL_COMPLETION_XP,
            GOAL_COMPLETION_COINS
          );

          // Update streak in database
          const updatedStreak = await updateUserStreak(effectiveUserId);

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

          // Check for new achievements
          console.log(
            `Checking for achievements in category: ${
              goalToToggle.category || "Personal"
            }`
          );
          const newAchievements = await checkForNewAchievements(
            goalToToggle.category || "Personal",
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
                      `Found ${newAchievements.length} new achievements!`
                    );
                    processNewAchievements(newAchievements);
                  }
                },
              },
            ]
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

          // Still try to check achievements even if stats update failed
          try {
            const newAchievements = await checkForNewAchievements(
              goalToToggle.category || "Personal",
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
    } finally {
      // Remove goal from processing set to re-enable button
      setProcessingGoals((prev) => {
        const newSet = new Set(prev);
        newSet.delete(goalId);
        return newSet;
      });
    }
  };

  // UPDATED: Toggle routine completion function without checkboxes
  const toggleRoutineCompletion = async (routineId: number) => {
    try {
      console.log(`Toggling routine completion for ID: ${routineId}`);

      // Ensure we have the latest Firebase user ID
      const firebaseUserId = auth.currentUser?.uid;
      const effectiveUserId = firebaseUserId || userId;

      // Find the routine we're toggling
      const routineToToggle = routines.find(
        (routine) => routine.id === routineId
      );

      if (!routineToToggle) {
        console.log(`Routine not found with ID: ${routineId}`);
        return;
      }

      // Calculate new completion state
      const newIsCompleted = !routineToToggle.isCompleted;

      // Update the routine in the database
      await updateGoalProgress(routineId, newIsCompleted ? 100 : 0);

      // If this is a completion (not unchecking), handle rewards
      if (newIsCompleted) {
        try {
          // Update database with XP and coins
          const updatedStats = await updateUserStats(
            effectiveUserId,
            ROUTINE_COMPLETION_XP,
            ROUTINE_COMPLETION_COINS
          );

          // Process level-up if needed
          const levelUpResult = handleLevelUp(
            updatedStats.xp_points,
            updatedStats.level
          );

          // Update local state with values from database
          setUserLevel(levelUpResult.newLevel);
          setUserExp(levelUpResult.finalXP);
          setUserCoins(updatedStats.future_coins);

          // Show completion message
          Alert.alert(
            "Routine Completed!",
            `Great job! You've earned ${ROUTINE_COMPLETION_XP} XP and ${ROUTINE_COMPLETION_COINS} coins.`,
            [{ text: "Nice!", style: "default" }]
          );
        } catch (error) {
          console.error("Error updating user stats in database:", error);

          // Fall back to local state updates if database update fails
          const newXP = userExp + ROUTINE_COMPLETION_XP;
          const levelUpResult = handleLevelUp(newXP, userLevel);

          setUserLevel(levelUpResult.newLevel);
          setUserExp(levelUpResult.finalXP);
          setUserCoins(userCoins + ROUTINE_COMPLETION_COINS);
        }
      }

      // Optimistically update the UI
      setRoutines((prevRoutines) => {
        return prevRoutines.map((routine) => {
          if (routine.id === routineId) {
            return {
              ...routine,
              isCompleted: newIsCompleted,
              progress: newIsCompleted ? 100 : 0,
            };
          }
          return routine;
        });
      });
    } catch (error) {
      console.error("Error toggling routine completion:", error);
      Alert.alert("Error", "Failed to update routine. Please try again.");

      // If there was an error, refresh the data
      fetchUserData();
    }
  };

  // Navigation functions
  const navigateToGoalsScreen = () => {
    navigation.navigate("Goals", {
      screen: "Goals",
    });
  };

  const navigateToCreateGoal = () => {
    // Navigate to Goals tab with param to trigger create form
    tabNavigation.navigate("Goals", { openCreateGoal: true });
  };

  // UPDATED: Create header component with achievement icon and larger coin icon
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Achievement Icon */}
      <TouchableOpacity
        style={styles.achievementButton}
        onPress={() => {
          // Navigate to achievements screen
          navigation.navigate("Achievements");
        }}
      >
        <Ionicons name="trophy" size={24} color={COLORS.accent2} />
      </TouchableOpacity>

      <Text style={styles.companyName}>Future Move</Text>

      <View style={styles.userCoinsContainer}>
        <Image
          source={require("../assets/images/future_coin.png")}
          style={styles.coinIcon}
        />
        <Text style={styles.userCoinsText}>{userCoins}</Text>
      </View>
    </View>
  );

  // Progress section with welcome message, streak, and progress circle
  const renderProgressSection = () => (
    <View style={styles.progressSection}>
      {/* Welcome and Streak */}
      <View style={styles.welcomeRow}>
        <Text style={styles.welcomeText}>
          Welcome Back, <Text style={styles.username}>{username}!</Text>
        </Text>
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
  const renderDailyQuote = () => {
    // Ensure we have string values for text and author
    const quoteText = quote?.text !== undefined ? quote.text : "";
    const quoteAuthor = quote?.author !== undefined ? quote.author : "";

    return <DailyQuote quote={quoteText} author={quoteAuthor} />;
  };

  // SECURITY FIX: Render individual goal item for goals section with improved background and processing state
  const renderGoalItem = ({ item }: { item: Goal }) => {
    // Check if this goal is currently being processed
    const isProcessing = processingGoals.has(item.id);

    // Get background image based on category
    const backgroundImage = getCategoryBackground(item.category);

    return (
      <TouchableOpacity
        style={[
          styles.goalCard,
          { borderLeftColor: item.color || COLORS.primary },
        ]}
        onPress={() => {
          // Navigate to the Goals tab first, then to the GoalDetail screen
          navigation.navigate("Goals", {
            params: { goalId: item.id },
          });
        }}
        activeOpacity={0.8}
      >
        <ImageBackground
          source={backgroundImage}
          style={styles.goalCardBackground}
          imageStyle={styles.goalCardBackgroundImage}
        >
          {/* Add a semi-transparent overlay to darken the image */}
          <View style={styles.cardOverlay}>
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

              {/* SECURITY FIX: Updated check button with disabled state and loading indicator */}
              <TouchableOpacity
                style={[
                  styles.checkButton,
                  item.isCompleted ? styles.completedCheckButton : {},
                  isProcessing && styles.checkButtonDisabled,
                ]}
                onPress={(event) => {
                  // Stop event propagation to prevent navigation when toggling completion
                  event.stopPropagation();
                  toggleGoalCompletion(item.id);
                }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : item.isCompleted ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={24}
                    color={COLORS.success}
                  />
                ) : (
                  <Ionicons
                    name="ellipse-outline"
                    size={24}
                    color={COLORS.white}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

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
        onPress={() => {
          // Navigate to Goals tab with param to trigger create form using nested navigation
          navigation.navigate("Goals", {
            params: { openCreateGoal: true },
          });
        }}
      >
        <Text style={styles.actionButtonText}>Create New Goal</Text>
      </TouchableOpacity>
    </View>
  );

  // UPDATED: Render individual routine item with improved day count display
  const renderRoutineItem = ({ item }: { item: ExtendedRoutine }) => {
    // Get color based on routine category
    const categoryColor =
      getCategoryColor(item.category || "Personal") || COLORS.accent1;

    // Use dedicated routine background
    const backgroundImage = require("../assets/images/routinepic.png");

    // Get routine days
    const routineDays = item.routine_days || [];
    const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.

    // Calculate weekly progress
    const totalDaysThisWeek = routineDays.length > 0 ? routineDays.length : 1;

    // Count how many scheduled days have passed this week (including today)
    const daysPassed = routineDays.filter((day) => {
      // For days that have already passed this week (including today)
      return day <= today;
    }).length;

    // For simplicity, assume completion tracking per day
    // In a real app, you'd track completion per day from your backend
    const completedDaysThisWeek = item.isCompleted
      ? Math.min(daysPassed, 1)
      : 0;

    // Calculate progress percentage based on days passed so far
    const progressPercentage =
      daysPassed > 0
        ? Math.round((completedDaysThisWeek / daysPassed) * 100)
        : 0;

    return (
      <TouchableOpacity
        style={[styles.routineCard, { borderLeftColor: categoryColor }]}
        onPress={() => {
          // Navigate to the Goals tab first, then to the GoalDetail screen
          navigation.navigate("Goals", {
            params: { goalId: item.id },
          });
        }}
        activeOpacity={0.8}
      >
        <ImageBackground
          source={backgroundImage}
          style={styles.goalCardBackground}
          imageStyle={styles.goalCardBackgroundImage}
        >
          {/* Add a semi-transparent overlay to darken the image */}
          <View style={styles.cardOverlay}>
            <View style={styles.routineCardContent}>
              <View style={styles.routineCardHeader}>
                <Text
                  style={[
                    styles.routineCardTitle,
                    item.isCompleted ? styles.completedText : {},
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                {/* Show routine frequency badge */}
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: categoryColor },
                  ]}
                >
                  <Text style={styles.categoryText}>
                    {totalDaysThisWeek}/week
                  </Text>
                </View>
              </View>

              <View style={styles.routineProgressBarContainer}>
                <View style={styles.routineProgressBar}>
                  <View
                    style={[
                      styles.routineProgressFill,
                      {
                        width: `${progressPercentage}%`,
                        backgroundColor:
                          progressPercentage === 100
                            ? COLORS.success
                            : categoryColor,
                      },
                    ]}
                  />
                </View>
                {/* Display weekly progress */}
                <Text style={styles.routineProgressText}>
                  {completedDaysThisWeek}/
                  {daysPassed > 0 ? daysPassed : totalDaysThisWeek}
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>
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
          onPress={() => {
            // Navigate to Goals tab and switch to the routines tab
            navigation.navigate("Goals", {
              params: {
                filterType: "routine",
                activeTab: "routine", // Add this parameter to explicitly switch to routines tab
              },
            });
          }}
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
          // Navigate to create goal as daily/routine using nested navigation
          navigation.navigate("Goals", {
            params: {
              openCreateGoal: true,
              createAsRoutine: true,
              activeTab: "routines", // Also add this to ensure we're on the routines tab
            },
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
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>News</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={() => {
            // Navigate to NewsScreen to see all news
            navigation.navigate("NewsScreen" as never);
          }}
        >
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      <NewsList
        news={news}
        onItemPress={(selectedNews) => {
          // Navigate to NewsScreen with the selected news item
          navigation.navigate("NewsScreen" as never, { selectedNews } as never);
        }}
      />
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
    <ImageBackground
      source={require("../assets/images/futuremove-bg.jpg")}
      style={styles.backgroundImage}
      imageStyle={styles.backgroundImageStyle}
    >
      <SafeAreaView style={styles.container}>
        {/* Light overlay to make the background subtle */}
        <View style={styles.backgroundOverlay} />

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
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  // Background image styles
  backgroundImage: {
    flex: 1,
  },
  backgroundImageStyle: {
    opacity: 0.4, // Increased opacity for more visible background
  },
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.7)", // Reduced white overlay for more visible background
  },
  container: {
    flex: 1,
    backgroundColor: "transparent", // Changed from COLORS.background to transparent
  },
  sectionListContent: {
    paddingBottom: 20,
  },
  username: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  header: {
    padding: 16,
    marginTop: 40, // INCREASED from 20 to 40 to prevent logo cutoff on various devices
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  // ADDED: Achievement button style
  achievementButton: {
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Slightly transparent
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  companyName: {
    fontSize: 24,
    color: COLORS.primary,
    fontFamily: "FutureMoveLogo",
    marginLeft: 8,
    marginBottom: 4,
    flex: 1, // UPDATED: Centers title between trophy and coins
    textAlign: "center", // UPDATED: Centers the text
  },
  userCoinsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Slightly transparent
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  coinIcon: {
    width: 32, // UPDATED: Increased size from 24
    height: 32, // UPDATED: Increased size from 24
    marginRight: 8,
  },
  userCoinsText: {
    fontSize: 18, // UPDATED: Increased from 16
    fontWeight: "bold",
    color: COLORS.accent2,
  },
  progressSection: {
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)", // Slightly transparent white
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
    backgroundColor: "rgba(255, 255, 255, 0.85)", // Slightly transparent
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
    backgroundColor: "rgba(0, 0, 0, 0.1)", // Transparent dark for contrast
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
    backgroundColor: "rgba(255, 255, 255, 0.9)", // Slightly transparent
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  // Updated card styles with background
  goalCard: {
    width: CARD_WIDTH,
    height: 120, // Reduced height to be more compact
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
  goalCardBackground: {
    width: "100%",
    height: "100%",
  },
  goalCardBackgroundImage: {
    borderRadius: 12,
  },
  cardOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)", // Darker overlay for better visibility
    borderRadius: 12,
  },
  goalCardContent: {
    padding: 12,
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalCardHeader: {
    flex: 1,
  },
  goalCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    color: "rgba(255,255,255,0.6)",
    textDecorationLine: "line-through",
  },
  checkButton: {
    padding: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
  },
  completedCheckButton: {
    opacity: 0.9,
  },
  // SECURITY FIX: Add disabled style for check button
  checkButtonDisabled: {
    opacity: 0.5,
  },

  // Routine card specific styles - UPDATED
  routineCard: {
    width: CARD_WIDTH,
    height: 120, // Match goal card height
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
    padding: 12,
    flex: 1,
    justifyContent: "space-between", // Space out header and progress bar
  },
  routineCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16, // Space between header and progress bar
  },
  routineCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
    flex: 1,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  routineProgressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    padding: 8,
    borderRadius: 8,
  },
  routineProgressBar: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
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
    color: COLORS.white,
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
