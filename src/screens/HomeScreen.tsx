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
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { GoalsScreenNavigationProp, HomeScreenProps } from "../types/navigaton";
import { ProgressCircle } from "../components/ProgressCircle";
import { DailyQuote } from "../components/DailyQuote";
import { RoutinesList } from "../components/RoutinesList";
import { NewsList } from "../components/NewsList";
import { GoalListItem } from "../components/GoalListItem";
import { fetchDailyQuote } from "../services/QuoteService";
import { fetchUserGoals, updateGoalProgress } from "../services/GoalService";
import { fetchUserRoutines } from "../services/RoutineService";
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

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, route }) => {
  // Use tabNavigation for navigating to bottom tab screens
  const tabNavigation = useNavigation<GoalsScreenNavigationProp>();

  const { currentUser } = useAuth();
  const userId = currentUser?.id || "default_user";

  const username = route.params?.username || currentUser?.name || "User";
  const [quote, setQuote] = useState<Quote | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [userLevel, setUserLevel] = useState(5);
  const [userExp, setUserExp] = useState(75);
  const [streakCount, setStreakCount] = useState(7);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quoteLoaded, setQuoteLoaded] = useState(false);

  // Ref for the main SectionList
  const sectionListRef = useRef(null);

  // Function to fetch all user data EXCEPT quote
  const fetchUserData = async () => {
    try {
      setIsRefreshing(true);

      // Get user goals
      const goalsData = await fetchUserGoals(userId);

      // Sort goals - incomplete first, then completed
      const sortedGoals = [...goalsData].sort((a, b) => {
        if (a.isCompleted && !b.isCompleted) return 1;
        if (!a.isCompleted && b.isCompleted) return -1;
        return 0;
      });

      setGoals(sortedGoals);

      // Calculate overall progress
      const completedGoals = goalsData.filter(
        (goal) => goal.isCompleted
      ).length;
      const totalGoals = goalsData.length;
      const progressPercentage =
        totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
      setOverallProgress(progressPercentage);

      // Get user routines
      const routinesData = await fetchUserRoutines();
      setRoutines(routinesData);

      // Get relevant news
      const newsData = await fetchNews();
      setNews(newsData);

      // Set user level and experience
      setUserLevel(currentUser?.level || 5);
      setUserExp(currentUser?.xp_points || 75);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsRefreshing(false);
    }
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
    }, [userId])
  );

  // Initial data load on mount
  useEffect(() => {
    fetchUserData();
  }, [userId]);

  // Toggle goal completion with database update
  const toggleGoalCompletion = async (goalId: number) => {
    try {
      // Find the goal we're toggling
      const goalToToggle = goals.find((goal) => goal.id === goalId);

      if (!goalToToggle) return;

      // Calculate new progress value
      const newProgress = !goalToToggle.isCompleted ? 100 : 0;

      // Update the goal in the database
      await updateGoalProgress(goalId, newProgress);

      // Optimistically update the UI
      setGoals((prevGoals) => {
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
        const newOverallProgress = Math.round(
          (completedGoals / totalGoals) * 100
        );
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

  // Create header component with company name
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.companyName}>FutureMove</Text>
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
              {goals.filter((goal) => goal.isCompleted).length}/{goals.length}
            </Text>
            <Text style={styles.goalCompletedLabel}>Goals</Text>
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
      style={styles.goalCard}
      onPress={() => {
        // Navigate to the Goals tab
        tabNavigation.navigate("Goals");
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
      data={goals}
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
          onPress={() => {
            // Navigate to the Goals tab
            tabNavigation.navigate("Goals");
          }}
        >
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {goals.length > 0 ? (
        renderHorizontalGoalList()
      ) : (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.noGoalsText}>You have 0 active goals.</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => {
          // Navigate to the Goals tab
          tabNavigation.navigate("Goals");
        }}
      >
        <Text style={styles.actionButtonText}>Create New Goal</Text>
      </TouchableOpacity>
    </View>
  );

  // Horizontal routine card render
  const renderRoutineItem = ({ item }: { item: Routine }) => (
    <TouchableOpacity
      style={styles.routineCard}
      onPress={() =>
        Alert.alert("View Routine", `Viewing routine: ${item.title}`)
      }
      activeOpacity={0.8}
    >
      <View style={styles.routineCardContent}>
        <View style={styles.routineCardHeader}>
          <Text style={styles.routineCardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.routineCardFrequency}>{item.frequency}</Text>
        </View>

        <View style={styles.routineProgressContainer}>
          <View style={styles.routineProgressBar}>
            <View
              style={[
                styles.routineProgressFill,
                {
                  width: `${(item.completedTasks / item.totalTasks) * 100}%`,
                  backgroundColor:
                    item.completedTasks === item.totalTasks
                      ? COLORS.success
                      : COLORS.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.routineProgressText}>
            {item.completedTasks}/{item.totalTasks}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
            Alert.alert(
              "View All Routines",
              "All routines screen would open here"
            )
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
        onPress={() =>
          Alert.alert(
            "Create Routine",
            "Create new routine screen would open here"
          )
        }
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
  },
  companyName: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 4,
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
    borderLeftColor: COLORS.primary,
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
    borderLeftColor: COLORS.accent1,
    overflow: "hidden",
  },
  routineCardContent: {
    padding: 16,
    flex: 1,
  },
  routineCardHeader: {
    marginBottom: 12,
  },
  routineCardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  routineCardFrequency: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
