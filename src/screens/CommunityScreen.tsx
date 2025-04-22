// src/screens/CommunityScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";

// Get screen width for category pills
const { width } = Dimensions.get("window");
// Calculate pill width based on screen size
const PILL_WIDTH = (width - 32 - 40) / 3; // 32 = padding, 40 = margins between pills

// Mock data - In a real app, you would fetch this from an API
const MOCK_COMMUNITIES = [
  {
    id: "1",
    name: "Weight Loss Warriors",
    category: "Health",
    members: 3245,
    posts: 1203,
    image: "https://via.placeholder.com/150/4CAF50/FFFFFF",
    description: "Supporting each other on our weight loss journeys.",
    isJoined: false,
  },
  {
    id: "2",
    name: "Tech Learners",
    category: "Learning",
    members: 1876,
    posts: 864,
    image: "https://via.placeholder.com/150/5E6CE7/FFFFFF",
    description:
      "Sharing resources and tips for learning programming and tech skills.",
    isJoined: true,
  },
  {
    id: "3",
    name: "Morning Runners",
    category: "Health",
    members: 2134,
    posts: 1521,
    image: "https://via.placeholder.com/150/F44336/FFFFFF",
    description: "For those who start their day with a refreshing run.",
    isJoined: false,
  },
  {
    id: "4",
    name: "Budget Masters",
    category: "Finance",
    members: 945,
    posts: 432,
    image: "https://via.placeholder.com/150/FF9800/FFFFFF",
    description: "Tips and support for better financial management.",
    isJoined: false,
  },
  {
    id: "5",
    name: "Mindfulness Meditators",
    category: "Wellness",
    members: 1432,
    posts: 876,
    image: "https://via.placeholder.com/150/9C27B0/FFFFFF",
    description: "Finding peace and focus through daily meditation practices.",
    isJoined: true,
  },
  {
    id: "6",
    name: "Home DIY Projects",
    category: "Repair",
    members: 1765,
    posts: 1230,
    image: "https://via.placeholder.com/150/56C3B6/FFFFFF",
    description: "Share your home improvement projects and get inspiration.",
    isJoined: false,
  },
  {
    id: "7",
    name: "Career Growth",
    category: "Work",
    members: 2543,
    posts: 1421,
    image: "https://via.placeholder.com/150/4CAF50/FFFFFF",
    description: "Strategies and support for advancing your career.",
    isJoined: false,
  },
  {
    id: "8",
    name: "Book Reading Challenge",
    category: "Learning",
    members: 1284,
    posts: 654,
    image: "https://via.placeholder.com/150/5E6CE7/FFFFFF",
    description: "Join the challenge to read more books this year.",
    isJoined: true,
  },
];

// Types
type Community = {
  id: string;
  name: string;
  category: string;
  members: number;
  posts: number;
  image: string;
  description: string;
  isJoined: boolean;
};

const CommunityScreen = () => {
  const { currentUser } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showJoinedOnly, setShowJoinedOnly] = useState(false);

  // Available categories with fixed widths
  const categories = [
    { id: "All", name: "All", width: PILL_WIDTH },
    { id: "Health", name: "Health", width: PILL_WIDTH },
    { id: "Learning", name: "Learning", width: PILL_WIDTH },
    { id: "Work", name: "Work", width: PILL_WIDTH },
    { id: "Finance", name: "Finance", width: PILL_WIDTH },
    { id: "Wellness", name: "Wellness", width: PILL_WIDTH },
    { id: "Repair", name: "Repair", width: PILL_WIDTH },
  ];

  // Fetch communities
  const fetchCommunities = useCallback(() => {
    setIsLoading(true);
    // In a real app, this would be an API call
    setTimeout(() => {
      setCommunities(MOCK_COMMUNITIES);
      setFilteredCommunities(MOCK_COMMUNITIES);
      setIsLoading(false);
    }, 1000);
  }, []);

  // Apply filters
  const applyFilters = useCallback(() => {
    let result = [...communities];

    // Apply category filter
    if (selectedCategory !== "All") {
      result = result.filter(
        (community) => community.category === selectedCategory
      );
    }

    // Apply joined filter
    if (showJoinedOnly) {
      result = result.filter((community) => community.isJoined);
    }

    // Apply search
    if (searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      result = result.filter(
        (community) =>
          community.name.toLowerCase().includes(lowerCaseQuery) ||
          community.description.toLowerCase().includes(lowerCaseQuery)
      );
    }

    setFilteredCommunities(result);
  }, [communities, selectedCategory, showJoinedOnly, searchQuery]);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchCommunities();
    }, [fetchCommunities])
  );

  // Apply filters when filter conditions change
  useEffect(() => {
    applyFilters();
  }, [applyFilters, selectedCategory, showJoinedOnly, searchQuery]);

  // Join or leave a community
  const toggleJoinCommunity = (id: string) => {
    setCommunities((prevCommunities) =>
      prevCommunities.map((community) =>
        community.id === id
          ? { ...community, isJoined: !community.isJoined }
          : community
      )
    );
  };

  // Render category pills with fixed width
  const renderCategoryPills = () => (
    <View style={styles.categoryOuterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryPill,
              { width: category.width }, // Fixed width
              selectedCategory === category.id && styles.selectedCategoryPill,
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.selectedCategoryText,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Render community item
  const renderCommunityItem = ({ item }: { item: Community }) => (
    <View style={styles.communityCard}>
      <View style={styles.communityHeader}>
        <Image
          source={{ uri: item.image }}
          style={styles.communityImage}
          defaultSource={require("../assets/placeholder.png")}
        />
        <View style={styles.communityInfo}>
          <Text style={styles.communityName}>{item.name}</Text>
          <View style={styles.communityStats}>
            <View style={styles.stat}>
              <Ionicons name="people" size={14} color={COLORS.textSecondary} />
              <Text style={styles.statText}>{item.members}</Text>
            </View>
            <View style={styles.stat}>
              <Ionicons
                name="chatbubbles"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={styles.statText}>{item.posts}</Text>
            </View>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: getCategoryColor(item.category) },
              ]}
            >
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.communityDescription}>{item.description}</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[
            styles.joinButton,
            item.isJoined ? styles.leaveButton : styles.joinButton,
          ]}
          onPress={() => toggleJoinCommunity(item.id)}
        >
          <Text
            style={[
              styles.joinButtonText,
              item.isJoined ? styles.leaveButtonText : styles.joinButtonText,
            ]}
          >
            {item.isJoined ? "Leave" : "Join"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => {
            // Navigate to community detail screen (not implemented yet)
            // navigation.navigate('CommunityDetail', { communityId: item.id });
          }}
        >
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Helper function to get category color
  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      Health: "#F44336", // Red
      Learning: "#5E6CE7", // Purple
      Work: "#4CAF50", // Green
      Finance: "#FF9800", // Orange
      Wellness: "#9C27B0", // Deep Purple
      Repair: "#56C3B6", // Teal
    };

    return categoryColors[category] || COLORS.primary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community Hub</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowJoinedOnly(!showJoinedOnly)}
        >
          <Ionicons
            name={showJoinedOnly ? "checkmark-circle" : "filter"}
            size={24}
            color={showJoinedOnly ? COLORS.primary : COLORS.text}
          />
          <Text
            style={[
              styles.filterText,
              showJoinedOnly && { color: COLORS.primary },
            ]}
          >
            {showJoinedOnly ? "Joined" : "All"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search communities..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {renderCategoryPills()}

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading communities...</Text>
        </View>
      ) : filteredCommunities.length > 0 ? (
        <FlatList
          data={filteredCommunities}
          renderItem={renderCommunityItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="people-outline"
            size={60}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyTitle}>No Communities Found</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? "Try a different search term or filter."
              : showJoinedOnly
              ? "You haven't joined any communities yet."
              : "No communities available in this category."}
          </Text>
          {showJoinedOnly && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => setShowJoinedOnly(false)}
            >
              <Text style={styles.emptyButtonText}>Show All Communities</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.createButton}>
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>
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
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    color: COLORS.text,
  },
  categoryOuterContainer: {
    height: 50, // Fixed height for the category container
    marginBottom: 8,
  },
  categoryContainer: {
    paddingHorizontal: 16,
  },
  categoryPill: {
    height: 36, // Fixed height
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4, // Reduced padding to account for fixed width
  },
  selectedCategoryPill: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 14,
    textAlign: "center",
    color: COLORS.text,
  },
  selectedCategoryText: {
    color: COLORS.white,
    fontWeight: "500",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  communityCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  communityHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  communityImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  communityInfo: {
    flex: 1,
    justifyContent: "center",
  },
  communityName: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  communityStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.white,
  },
  communityDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: "center",
  },
  joinButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  leaveButton: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  leaveButtonText: {
    color: COLORS.primary,
  },
  viewButton: {
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  viewButtonText: {
    color: COLORS.text,
    fontWeight: "600",
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  createButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});

export default CommunityScreen;
