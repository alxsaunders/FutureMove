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
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchCommunities,
  joinCommunity,
  leaveCommunity,
} from "../../services/CommunityService";
import { Community } from "../../types";
import { auth } from "../../config/firebase.js";
import CommunityRequestModal from "./CommunityRequestModal";

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
  const [loadingCommunityIds, setLoadingCommunityIds] = useState<Set<string>>(
    new Set()
  );
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
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

  // Check Firebase auth status when component mounts
  useEffect(() => {
    const checkFirebaseAuth = () => {
      const firebaseUser = auth.currentUser;
      console.log(
        "Firebase auth user:",
        firebaseUser ? firebaseUser.uid : "not logged in"
      );

      if (!firebaseUser) {
        if (__DEV__) {
          console.warn(
            "No Firebase user available. Some features may not work."
          );
        }
      }
    };

    checkFirebaseAuth();

    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log(
        "Firebase auth state changed:",
        user ? user.uid : "signed out"
      );
    });

    return () => unsubscribe();
  }, []);

  // Function to navigate to CommunityDetail
  const navigateToCommunityDetail = (communityId: string | number) => {
    navigation.navigate("Community", {
      screen: "CommunityDetail",
      params: { communityId: String(communityId) },
    });
  };

  // Function to navigate to CreatePost
  const navigateToCreatePost = (communityId?: string | number) => {
    navigation.getParent()?.navigate("CreatePost", {
      communityId: communityId ? String(communityId) : undefined,
    });
  };

  // Handle community request button press
  const handleRequestCommunity = () => {
    const firebaseUser = auth.currentUser;

    if (!firebaseUser) {
      Alert.alert(
        "Authentication Required",
        "Please sign in to request a new community.",
        [{ text: "OK" }]
      );
      return;
    }

    setIsRequestModalVisible(true);
  };

  // Handle successful community request submission
  const handleRequestSuccess = () => {
    // Optionally refresh the communities list or show a success message
    console.log("Community request submitted successfully");
  };

  // Fetch communities with enhanced error handling
  const fetchCommunityData = useCallback(async () => {
    setIsLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      console.log(
        "Firebase auth user when fetching communities:",
        firebaseUser ? firebaseUser.uid : "not logged in"
      );

      if (!firebaseUser) {
        console.warn("Cannot fetch communities: No Firebase user");
        if (__DEV__) {
          console.log("Using mock data for development");
          const mockCommunities = [
            {
              id: "1",
              name: "Health & Fitness",
              description: "Share health tips and fitness routines",
              category: "Health",
              imageUrl: "https://via.placeholder.com/150",
              createdBy: "dev-user",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              memberCount: 24,
              isJoined: false,
            },
            {
              id: "2",
              name: "Learning Together",
              description: "A community for continuous education",
              category: "Learning",
              imageUrl: "https://via.placeholder.com/150",
              createdBy: "dev-user",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              memberCount: 18,
              isJoined: true,
            },
          ];

          const mappedMockCommunities = mockCommunities.map((community) => ({
            id: String(community.id),
            name: community.name,
            description: community.description,
            category: community.category,
            members: community.memberCount,
            posts: 0,
            image: community.imageUrl,
            isJoined: community.isJoined,
          }));

          setCommunities(mappedMockCommunities);
          setFilteredCommunities(mappedMockCommunities);
        } else {
          setCommunities([]);
          setFilteredCommunities([]);
        }
        setIsLoading(false);
        return;
      }

      const serviceData = await fetchCommunities();
      console.log("Fetched service data:", serviceData.length, "communities");

      const mappedCommunities = serviceData.map((community) => ({
        id: String(community.id),
        name: community.name || "",
        description: community.description || "",
        category: community.category || "General",
        members: community.memberCount || 0,
        // FIXED: Use the actual posts_count from the API response instead of hardcoded 0
        posts: community.posts_count || community.postsCount || 0,
        image: community.imageUrl || "https://via.placeholder.com/150",
        isJoined: Boolean(community.isJoined),
      }));

      console.log("Mapped communities:", mappedCommunities.length);

      setCommunities(mappedCommunities);
      setFilteredCommunities(mappedCommunities);
    } catch (error) {
      console.error("Error fetching communities:", error);
      setCommunities([]);
      setFilteredCommunities([]);

      if (__DEV__) {
        Alert.alert(
          "Error Fetching Communities",
          "Check your connection and Firebase auth status."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Apply filters
  const applyFilters = useCallback(() => {
    let result = [...communities];

    if (selectedCategory !== "All") {
      result = result.filter(
        (community) => community.category === selectedCategory
      );
    }

    if (showJoinedOnly) {
      result = result.filter((community) => community.isJoined);
    }

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

      const refreshTimer = setInterval(() => {
        fetchCommunityData();
      }, 60000);

      return () => {
        clearInterval(refreshTimer);
      };
    }, [fetchCommunityData])
  );

  // Apply filters when filter conditions change
  useEffect(() => {
    applyFilters();
  }, [applyFilters, selectedCategory, showJoinedOnly, searchQuery]);

  // Join or leave a community with improved Firebase auth handling
  const toggleJoinCommunity = async (
    id: string | number,
    isCurrentlyJoined: boolean
  ) => {
    const firebaseUser = auth.currentUser;
    const idStr = String(id);

    if (!firebaseUser) {
      console.log("Cannot join/leave: No Firebase user");

      if (__DEV__) {
        Alert.alert(
          "Authentication Required",
          "Please sign in to join or leave communities."
        );
      }
      return;
    }

    console.log(
      `Attempting to ${isCurrentlyJoined ? "leave" : "join"} community:`,
      idStr
    );
    console.log("Using Firebase user ID:", firebaseUser.uid);

    setLoadingCommunityIds((prev) => {
      const updated = new Set(prev);
      updated.add(idStr);
      return updated;
    });

    try {
      // Optimistic update
      setCommunities((prevCommunities) =>
        prevCommunities.map((community) =>
          String(community.id) === idStr
            ? {
                ...community,
                isJoined: !isCurrentlyJoined,
                members: isCurrentlyJoined
                  ? Math.max(0, community.members - 1)
                  : community.members + 1,
              }
            : community
        )
      );

      setFilteredCommunities((prevFiltered) =>
        prevFiltered.map((community) =>
          String(community.id) === idStr
            ? {
                ...community,
                isJoined: !isCurrentlyJoined,
                members: isCurrentlyJoined
                  ? Math.max(0, community.members - 1)
                  : community.members + 1,
              }
            : community
        )
      );

      let success;
      if (isCurrentlyJoined) {
        console.log("Calling leaveCommunity API...");
        success = await leaveCommunity(idStr);
      } else {
        console.log("Calling joinCommunity API...");
        success = await joinCommunity(idStr);
      }

      console.log("API call result:", success);

      if (!success) {
        console.warn("API call failed, reverting UI");
        // Revert changes
        setCommunities((prevCommunities) =>
          prevCommunities.map((community) =>
            String(community.id) === idStr
              ? {
                  ...community,
                  isJoined: isCurrentlyJoined,
                  members: isCurrentlyJoined
                    ? community.members + 1
                    : Math.max(0, community.members - 1),
                }
              : community
          )
        );

        setFilteredCommunities((prevFiltered) =>
          prevFiltered.map((community) =>
            String(community.id) === idStr
              ? {
                  ...community,
                  isJoined: isCurrentlyJoined,
                  members: isCurrentlyJoined
                    ? community.members + 1
                    : Math.max(0, community.members - 1),
                }
              : community
          )
        );

        if (__DEV__) {
          Alert.alert(
            "Error",
            `Failed to ${
              isCurrentlyJoined ? "leave" : "join"
            } community. Please try again.`
          );
        }
      } else {
        console.log(
          `Successfully ${
            isCurrentlyJoined ? "left" : "joined"
          } community ${idStr}`
        );
      }
    } catch (error) {
      console.error("Error toggling community membership:", error);

      // Revert changes on error
      setCommunities((prevCommunities) =>
        prevCommunities.map((community) =>
          String(community.id) === idStr
            ? {
                ...community,
                isJoined: isCurrentlyJoined,
                members: isCurrentlyJoined
                  ? community.members + 1
                  : Math.max(0, community.members - 1),
              }
            : community
        )
      );

      setFilteredCommunities((prevFiltered) =>
        prevFiltered.map((community) =>
          String(community.id) === idStr
            ? {
                ...community,
                isJoined: isCurrentlyJoined,
                members: isCurrentlyJoined
                  ? community.members + 1
                  : Math.max(0, community.members - 1),
              }
            : community
        )
      );

      if (__DEV__) {
        Alert.alert(
          "Error",
          `Failed to ${
            isCurrentlyJoined ? "leave" : "join"
          } community. Please try again.`
        );
      }
    } finally {
      setLoadingCommunityIds((prev) => {
        const updated = new Set(prev);
        updated.delete(idStr);
        return updated;
      });
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
              { width: category.width },
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
  const renderCommunityItem = ({ item }: { item: Community }) => {
    const isLoading = loadingCommunityIds.has(String(item.id));

    return (
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
                <Ionicons
                  name="people"
                  size={14}
                  color={COLORS.textSecondary}
                />
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
              item.isJoined ? styles.leaveButton : null,
            ]}
            onPress={() => toggleJoinCommunity(item.id, item.isJoined)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={item.isJoined ? COLORS.primary : COLORS.white}
              />
            ) : (
              <Text
                style={[
                  styles.joinButtonText,
                  item.isJoined ? styles.leaveButtonText : null,
                ]}
              >
                {item.isJoined ? "Leave" : "Join"}
              </Text>
            )}
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
  };

  // Helper function to get category color
  const getCategoryColor = (category: string) => {
    const categoryColors: Record<string, string> = {
      Health: "#F44336",
      Learning: "#5E6CE7",
      Work: "#4CAF50",
      Finance: "#FF9800",
      Wellness: "#9C27B0",
      Repair: "#56C3B6",
    };

    return categoryColors[category] || COLORS.primary;
  };

  return (
    <View style={styles.container}>
      {/* Updated filter header with request button */}
      <View style={styles.filterHeader}>
        <TouchableOpacity
          style={styles.requestButton}
          onPress={handleRequestCommunity}
        >
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.requestButtonText}>Request</Text>
        </TouchableOpacity>

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
          keyExtractor={(item) => String(item.id)}
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

      {/* Community Request Modal */}
      <CommunityRequestModal
        visible={isRequestModalVisible}
        onClose={() => setIsRequestModalVisible(false)}
        onSuccess={handleRequestSuccess}
      />
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  requestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  requestButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
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
    height: 50,
    marginBottom: 8,
  },
  categoryContainer: {
    paddingHorizontal: 16,
  },
  categoryPill: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 4,
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
