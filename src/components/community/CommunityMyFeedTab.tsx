// src/components/community/CommunityMyFeedTab.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import { useAuth } from "../../contexts/AuthContext";
import CommunityPostItem from "./CommunityPostItem";
import { Post, Community } from "../../types";
import {
  fetchFeedPosts,
  fetchCommunityPosts,
} from "../../services/CommunityPostService";
import { fetchJoinedCommunities } from "../../services/CommunityService";
import { adaptCommunity } from "../../screens/CreatePostScreen";
import { auth } from "../../config/firebase";

// Fixed user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyoNT5R2";

const CommunityMyFeedTab = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasJoinedCommunities, setHasJoinedCommunities] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const navigation = useNavigation();

  // Clean and validate post data to handle image errors
  const cleanPostData = useCallback((posts: Post[]) => {
    return posts.map((post) => ({
      ...post,
      // Clean up image URLs - remove local file paths and validate Firebase URLs
      image: cleanImageUrl(post.image),
      userAvatar: cleanImageUrl(post.userAvatar),
    }));
  }, []);

  // Clean and validate image URLs
  const cleanImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;

    // Remove local file paths (they won't work after app restart)
    if (url.includes("/ImagePicker/") || url.includes("file://")) {
      console.warn("Removing local image path:", url);
      return undefined;
    }

    // Validate Firebase Storage URLs
    if (url.includes("firebasestorage.googleapis.com")) {
      // Remove any extra parameters that might cause 404s
      try {
        const urlObj = new URL(url);
        // Remove the width/height parameters that might be causing issues
        urlObj.searchParams.delete("width");
        urlObj.searchParams.delete("height");
        return urlObj.toString();
      } catch (error) {
        console.warn("Invalid Firebase Storage URL:", url);
        return undefined;
      }
    }

    // For other URLs, return as-is
    return url;
  };

  // Check if user has joined any communities
  const checkJoinedCommunities = useCallback(async () => {
    try {
      console.log("Checking joined communities");
      const communitiesFromApi = await fetchJoinedCommunities();
      console.log(`Fetched ${communitiesFromApi.length} joined communities`);

      // Convert API communities to UI communities using the adapter
      const adaptedCommunities = communitiesFromApi.map(adaptCommunity);

      setJoinedCommunities(adaptedCommunities);
      setHasJoinedCommunities(adaptedCommunities.length > 0);

      // Initialize selected communities to include all communities
      if (selectedCommunities.length === 0) {
        setSelectedCommunities(adaptedCommunities.map((c) => String(c.id)));
      }

      return adaptedCommunities;
    } catch (error) {
      console.error("Error checking joined communities:", error);
      setJoinedCommunities([]);
      setHasJoinedCommunities(false);
      return [];
    }
  }, [selectedCommunities.length]);

  // Authentication check effect
  useEffect(() => {
    let resolvedUserId = null;

    // First try to get from context
    if (currentUser && currentUser.id) {
      resolvedUserId = currentUser.id;
      console.log(`User found from AuthContext: ${resolvedUserId}`);
    }
    // Then try to get directly from Firebase
    else if (auth.currentUser) {
      resolvedUserId = auth.currentUser.uid;
      console.log(`User found from Firebase: ${resolvedUserId}`);
    }
    // As a last resort, use the fallback ID
    else {
      resolvedUserId = FALLBACK_USER_ID;
      console.log(`No user ID found, using fallback: ${FALLBACK_USER_ID}`);
    }

    setUserId(resolvedUserId);
    setAuthChecked(true);
  }, [currentUser]);

  // Filter posts based on selected communities
  const filterPosts = useCallback(() => {
    if (selectedCommunities.length === 0) {
      setPosts(allPosts);
      return;
    }

    const filteredPosts = allPosts.filter((post) =>
      selectedCommunities.includes(String(post.communityId))
    );
    setPosts(filteredPosts);
  }, [allPosts, selectedCommunities]);

  // Apply filters when selection changes
  useEffect(() => {
    filterPosts();
  }, [filterPosts]);

  // Fetch posts from joined communities
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!userId) {
        console.log("No user ID resolved, skipping post fetch");
        setPosts([]);
        setAllPosts([]);
        setIsLoading(false);
        return;
      }

      // First check if user has joined any communities
      const communities = await checkJoinedCommunities();

      if (communities.length === 0) {
        console.log("User hasn't joined any communities, no posts to show");
        setPosts([]);
        setAllPosts([]);
        setIsLoading(false);
        return;
      }

      // Use fetchFeedPosts with the resolved user ID
      console.log(`Fetching feed posts for user ${userId}`);
      const feedPosts = await fetchFeedPosts(userId);
      console.log(`Fetched ${feedPosts.length} feed posts`);

      if (feedPosts.length === 0) {
        // If the backend feed API isn't working, try to fetch posts manually
        console.log(
          "No posts returned from feed API, trying alternative approach"
        );
        let allPostsData: Post[] = [];

        for (const community of communities) {
          try {
            const communityPosts = await fetchCommunityPosts(
              String(community.id)
            );
            allPostsData = [...allPostsData, ...communityPosts];
          } catch (err) {
            console.error(
              `Error fetching posts for community ${community.id}:`,
              err
            );
          }
        }

        console.log(
          `Fetched ${allPostsData.length} posts from individual communities`
        );

        // Clean the post data to handle image errors
        const cleanedPosts = cleanPostData(allPostsData);
        setAllPosts(cleanedPosts);
      } else {
        // Clean the post data to handle image errors
        const cleanedPosts = cleanPostData(feedPosts);
        setAllPosts(cleanedPosts);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setPosts([]);
      setAllPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, checkJoinedCommunities, authChecked, cleanPostData]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchPosts();
    setIsRefreshing(false);
  }, [fetchPosts]);

  // Like/unlike a post with optimistic updates
  const toggleLikePost = useCallback((postId: string) => {
    const updatePosts = (prevPosts: Post[]) =>
      prevPosts.map((post) =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      );

    setPosts(updatePosts);
    setAllPosts(updatePosts);
  }, []);

  // Handle user profile navigation
  const handleUserPress = useCallback((userId: string) => {
    if (userId) {
      console.log(`Navigating to user profile: ${userId}`);
      // navigation.navigate("UserProfile", { userId });
    }
  }, []);

  // Handle post sharing
  const handleSharePost = useCallback((post: Post) => {
    console.log(`Sharing post: ${post.id}`);
    // Custom share logic here if needed
  }, []);

  // Toggle community selection
  const toggleCommunitySelection = (communityId: string) => {
    setSelectedCommunities((prev) => {
      if (prev.includes(communityId)) {
        return prev.filter((id) => id !== communityId);
      } else {
        return [...prev, communityId];
      }
    });
  };

  // Select all communities
  const selectAllCommunities = () => {
    setSelectedCommunities(joinedCommunities.map((c) => String(c.id)));
  };

  // Deselect all communities
  const deselectAllCommunities = () => {
    setSelectedCommunities([]);
  };

  // Load data when screen is focused and auth is ready
  useFocusEffect(
    useCallback(() => {
      if (authChecked) {
        fetchPosts();
      }

      // Set up a refresh interval when screen is active
      const refreshTimer = setInterval(() => {
        if (authChecked && userId) {
          fetchPosts();
        }
      }, 60000); // Refresh every 60 seconds

      return () => {
        clearInterval(refreshTimer);
      };
    }, [fetchPosts, authChecked, userId])
  );

  // Create post navigation with community selector
  const navigateToCreatePost = () => {
    if (joinedCommunities.length === 1) {
      navigation.navigate("CreatePost", {
        communityId: joinedCommunities[0].id,
      });
    } else {
      navigation.navigate("CreatePost");
    }
  };

  // Navigate to post detail with proper string conversion
  const navigateToPostDetail = useCallback(
    (postId: string | number) => {
      const stringPostId = String(postId);
      console.log(`Navigating to PostDetail with postId: ${stringPostId}`);
      navigation.navigate("PostDetail", { postId: stringPostId });
    },
    [navigation]
  );

  // Render filter modal
  const renderFilterModal = () => (
    <Modal
      visible={isFilterModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsFilterModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter by Communities</Text>
            <TouchableOpacity
              onPress={() => setIsFilterModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={selectAllCommunities}
            >
              <Text style={styles.actionButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={deselectAllCommunities}
            >
              <Text style={styles.actionButtonText}>Deselect All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.communitiesList}>
            {joinedCommunities.map((community) => (
              <TouchableOpacity
                key={community.id}
                style={styles.communityItem}
                onPress={() => toggleCommunitySelection(String(community.id))}
              >
                <View style={styles.communityItemContent}>
                  <View style={styles.communityInfo}>
                    <Text style={styles.communityName}>{community.name}</Text>
                    <Text style={styles.communityDescription} numberOfLines={2}>
                      {community.description}
                    </Text>
                  </View>
                  <View style={styles.checkbox}>
                    {selectedCommunities.includes(String(community.id)) ? (
                      <Ionicons
                        name="checkbox"
                        size={24}
                        color={COLORS.primary}
                      />
                    ) : (
                      <Ionicons
                        name="square-outline"
                        size={24}
                        color={COLORS.textSecondary}
                      />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setIsFilterModalVisible(false)}
            >
              <Text style={styles.applyButtonText}>
                Apply ({selectedCommunities.length} selected)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Login View for unauthenticated users
  const LoginRequiredView = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="person-outline" size={60} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>Login Required</Text>
      <Text style={styles.emptyText}>
        You need to be logged in to view and interact with communities.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => {
          navigation.navigate("Login");
        }}
      >
        <Text style={styles.emptyButtonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );

  // Empty feed view when user has joined communities but there are no posts
  const EmptyFeedView = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="newspaper-outline"
        size={60}
        color={COLORS.textSecondary}
      />
      <Text style={styles.emptyTitle}>No Posts Yet</Text>
      <Text style={styles.emptyText}>
        {selectedCommunities.length === 0
          ? "Select communities to see posts from them."
          : "Your selected communities don't have any posts yet. Be the first to post!"}
      </Text>
      {selectedCommunities.length > 0 && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={navigateToCreatePost}
        >
          <Text style={styles.emptyButtonText}>Create Post</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // No communities view
  const NoCommunitiesView = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={60} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>Join Communities</Text>
      <Text style={styles.emptyText}>
        You need to join communities to see posts in your feed.
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => {
          navigation.navigate("Home");
        }}
      >
        <Text style={styles.emptyButtonText}>Find Communities</Text>
      </TouchableOpacity>
    </View>
  );

  // Render post item with enhanced error handling
  const renderPostItem = ({ item }: { item: Post }) => (
    <CommunityPostItem
      post={item}
      onLikePress={() => toggleLikePost(item.id)}
      onCommentPress={() => navigateToPostDetail(item.id)}
      onPostPress={() => navigateToPostDetail(item.id)}
      onUserPress={handleUserPress}
      onSharePress={handleSharePost}
    />
  );

  return (
    <View style={styles.container}>
      {/* Filter button - only show if user has joined communities */}
      {userId && hasJoinedCommunities && joinedCommunities.length > 1 && (
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setIsFilterModalVisible(true)}
          >
            <Ionicons name="filter" size={20} color={COLORS.primary} />
            <Text style={styles.filterButtonText}>
              Filter ({selectedCommunities.length}/{joinedCommunities.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading your feed...</Text>
        </View>
      ) : !authChecked ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Checking authentication...</Text>
        </View>
      ) : !userId ? (
        <LoginRequiredView />
      ) : !hasJoinedCommunities ? (
        <NoCommunitiesView />
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          // Add performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 200, // Approximate item height
            offset: 200 * index,
            index,
          })}
        />
      ) : (
        <EmptyFeedView />
      )}

      {/* Floating action button for creating a new post */}
      {userId && hasJoinedCommunities && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={navigateToCreatePost}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* Filter Modal */}
      {renderFilterModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  filterButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 80,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    margin: 20,
    maxHeight: "80%",
    width: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
  },
  communitiesList: {
    maxHeight: 300,
  },
  communityItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  communityItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  communityInfo: {
    flex: 1,
    marginRight: 12,
  },
  communityName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  communityDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  checkbox: {
    padding: 4,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  applyButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  applyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default CommunityMyFeedTab;
