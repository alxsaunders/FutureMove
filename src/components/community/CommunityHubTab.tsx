// src/components/community/CommunityHubTab.tsx
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
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native"; // 👈 Import CommonActions
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchCommunities,
  joinCommunity,
  leaveCommunity,
} from "../../services/CommunityService";
import { Community } from "../../types";


// Get screen width for category pills
const { width } = Dimensions.get("window");
// Calculate pill width based on screen size
const PILL_WIDTH = (width - 32 - 40) / 3; // 32 = padding, 40 = margins between pills

const CommunityHubTab = () => {
  const { currentUser } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [filteredCommunities, setFilteredCommunities] = useState<Community[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showJoinedOnly, setShowJoinedOnly] = useState(false);
  const navigation = useNavigation();

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

  // Function to navigate to CommunityDetail
  const navigateToCommunityDetail = (communityId: string | number) => {
    // Use CommonActions to navigate to a screen in a parent navigator
    navigation.dispatch(
      CommonActions.navigate({
        name: "CommunityDetail",
        params: { communityId },
      })
    );
  };

  // Function to navigate to CreatePost
  const navigateToCreatePost = (communityId?: string | number) => {
    // Use CommonActions to navigate to a screen in a parent navigator
    navigation.dispatch(
      CommonActions.navigate({
        name: "CreatePost",
        params: { communityId },
      })
    );
  };

  // Fetch communities
  const fetchCommunityData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch communities and map to the expected format
      const serviceData = await fetchCommunities();
    } catch (error) {
      console.error("Error fetching communities:", error);
      // Set empty arrays to avoid errors
      setCommunities([]);
      setFilteredCommunities([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

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
          (community.description?.toLowerCase() || "").includes(lowerCaseQuery)
      );
    }

    setFilteredCommunities(result);
  }, [communities, selectedCategory, showJoinedOnly, searchQuery]);

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchCommunityData();
    }, [fetchCommunityData])
  );

  // Apply filters when filter conditions change
  useEffect(() => {
    applyFilters();
  }, [applyFilters, selectedCategory, showJoinedOnly, searchQuery]);

  // Join or leave a community
  const toggleJoinCommunity = async (
    id: string,
    isCurrentlyJoined: boolean
  ) => {
    if (!currentUser) return;

    try {
      let success;
      if (isCurrentlyJoined) {
        success = await leaveCommunity(id);
      } else {
        success = await joinCommunity(id);
      }

      if (success) {
        // Update local state
        setCommunities((prevCommunities) =>
          prevCommunities.map((community) =>
            community.id === id
              ? { ...community, isJoined: !isCurrentlyJoined }
              : community
          )
        );
      }
    } catch (error) {
      console.error("Error toggling community membership:", error);
    }
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
          defaultSource={require("../../assets/placeholder.png")}
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
          onPress={() => toggleJoinCommunity(item.id, item.isJoined)}
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
          onPress={() => navigateToCommunityDetail(item.id)}
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
    <View style={styles.container}>
      <View style={styles.filterHeader}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowJoinedOnly(!showJoinedOnly)}
        >
          <Ionicons
            name={showJoinedOnly ? "checkmark-circle" : "filter"}
            size={20}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
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
    marginBottom: 12,
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
});

export default CommunityHubTab;
