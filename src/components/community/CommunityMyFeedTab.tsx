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
  toggleLikePost as toggleLikePostAPI,
} from "../../services/CommunityPostService";
import { fetchJoinedCommunities } from "../../services/CommunityService";
import { adaptCommunity } from "../../screens/CreatePostScreen";
import { auth } from "../../config/firebase";

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

  // Enhanced image URL validation and cleaning
  const validateAndCleanImageUrl = useCallback(
    (url: string | undefined): string | undefined => {
      if (!url) return undefined;

      // Remove local file paths completely - they won't work
      if (
        url.includes("/ImagePicker/") ||
        url.includes("file://") ||
        url.includes("/data/user/")
      ) {
        console.warn("🚫 Removing invalid local image path:", url);
        return undefined;
      }

      // Handle Firebase Storage URLs
      if (url.includes("firebasestorage.googleapis.com")) {
        try {
          // Validate that it's a proper Firebase Storage URL
          const urlObj = new URL(url);

          // Check if it has the correct Firebase Storage domain
          if (!urlObj.hostname.includes("firebasestorage.googleapis.com")) {
            console.warn("🚫 Invalid Firebase Storage domain:", url);
            return undefined;
          }

          // Check if it has the required path structure
          if (
            !urlObj.pathname.includes("/v0/b/") ||
            !urlObj.pathname.includes("/o/")
          ) {
            console.warn("🚫 Invalid Firebase Storage path structure:", url);
            return undefined;
          }

          // Remove potentially problematic parameters but keep the auth token
          const cleanUrl = new URL(url);
          // Keep alt=media and token parameters, remove others that might cause issues
          const allowedParams = ["alt", "token"];
          for (const [key] of cleanUrl.searchParams) {
            if (!allowedParams.includes(key)) {
              cleanUrl.searchParams.delete(key);
            }
          }

          // Ensure alt=media is present for direct image access
          if (!cleanUrl.searchParams.get("alt")) {
            cleanUrl.searchParams.set("alt", "media");
          }

          const finalUrl = cleanUrl.toString();
          console.log("✅ Cleaned Firebase Storage URL:", finalUrl);
          return finalUrl;
        } catch (error) {
          console.error("❌ Error processing Firebase Storage URL:", error);
          return undefined;
        }
      }

      // For other valid URLs (like https:// URLs), return as-is
      if (url.startsWith("https://") || url.startsWith("http://")) {
        return url;
      }

      // Invalid URL format
      console.warn("🚫 Invalid URL format:", url);
      return undefined;
    },
    []
  );

  // Enhanced post data cleaning with better image handling
  const cleanPostData = useCallback(
    (posts: Post[]) => {
      return posts.map((post) => {
        const cleanedPost = {
          ...post,
          // Clean image URLs with enhanced validation
          image: validateAndCleanImageUrl(post.image),
          userAvatar: validateAndCleanImageUrl(post.userAvatar),
        };

        // Log image cleaning results for debugging
        if (post.image !== cleanedPost.image) {
          console.log(`🧹 Post ${post.id} image cleaned:`, {
            original: post.image,
            cleaned: cleanedPost.image,
          });
        }

        return cleanedPost;
      });
    },
    [validateAndCleanImageUrl]
  );

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

  // Authentication check effect - NO FALLBACK USER
  useEffect(() => {
    let resolvedUserId = null;

    // First try to get from context
    if (currentUser && currentUser.id) {
      resolvedUserId = currentUser.id;
      console.log(`✅ User found from AuthContext: ${resolvedUserId}`);
    }
    // Then try to get directly from Firebase
    else if (auth.currentUser) {
      resolvedUserId = auth.currentUser.uid;
      console.log(`✅ User found from Firebase: ${resolvedUserId}`);
    }
    // NO FALLBACK USER - must be authenticated
    else {
      console.log(`❌ No authenticated user found`);
      resolvedUserId = null;
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

  // Enhanced fetch posts with better error handling and image processing
  const fetchPosts = useCallback(async () => {
    if (!userId) {
      console.log("❌ No authenticated user, cannot fetch posts");
      setPosts([]);
      setAllPosts([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log(`🔄 Fetching posts for authenticated user: ${userId}`);

      // First check if user has joined any communities
      const communities = await checkJoinedCommunities();

      if (communities.length === 0) {
        console.log("User hasn't joined any communities, no posts to show");
        setPosts([]);
        setAllPosts([]);
        setIsLoading(false);
        return;
      }

      let rawPosts: Post[] = [];

      try {
        // Use fetchFeedPosts with the resolved user ID
        console.log(`📡 Fetching feed posts for user ${userId}`);
        const feedPosts = await fetchFeedPosts(userId);
        console.log(`✅ Fetched ${feedPosts.length} feed posts`);
        rawPosts = feedPosts;
      } catch (feedError) {
        console.warn(
          "Feed API failed, trying alternative approach:",
          feedError
        );
        rawPosts = [];
      }

      // If the backend feed API isn't working or returns no posts, try to fetch posts manually
      if (rawPosts.length === 0) {
        console.log(
          "No posts from feed API, fetching from individual communities"
        );
        let allPostsData: Post[] = [];

        for (const community of communities) {
          try {
            console.log(
              `📡 Fetching posts from community: ${community.name} (${community.id})`
            );
            const communityPosts = await fetchCommunityPosts(
              String(community.id)
            );
            console.log(
              `✅ Fetched ${communityPosts.length} posts from ${community.name}`
            );
            allPostsData = [...allPostsData, ...communityPosts];
          } catch (err) {
            console.error(
              `❌ Error fetching posts for community ${community.id}:`,
              err
            );
          }
        }

        console.log(
          `✅ Total posts fetched from individual communities: ${allPostsData.length}`
        );
        rawPosts = allPostsData;
      }

      // Clean and validate all post data, especially images
      console.log(`🧹 Cleaning ${rawPosts.length} posts...`);
      const cleanedPosts = cleanPostData(rawPosts);

      // Log statistics about image cleaning
      const postsWithImages = cleanedPosts.filter((post) => post.image).length;
      const originalPostsWithImages = rawPosts.filter(
        (post) => post.image
      ).length;
      console.log(`📊 Image cleaning stats:`, {
        totalPosts: cleanedPosts.length,
        originalImagesCount: originalPostsWithImages,
        cleanedImagesCount: postsWithImages,
        imagesRemoved: originalPostsWithImages - postsWithImages,
      });

      // Sort posts by creation date (newest first)
      const sortedPosts = cleanedPosts.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      setAllPosts(sortedPosts);
      console.log(`✅ Successfully processed ${sortedPosts.length} posts`);
    } catch (error) {
      console.error("❌ Error fetching posts:", error);
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

  // FIXED: Like/unlike a post with proper API integration
  const toggleLikePost = useCallback(
    async (postId: string) => {
      console.log(`🔄 Toggling like for post: ${postId}`);

      // Find the current post to get its like status
      const currentPost = [...posts, ...allPosts].find(
        (post) => post.id === postId
      );
      if (!currentPost) {
        console.warn(`⚠️ Post ${postId} not found in current posts`);
        return;
      }

      const isCurrentlyLiked = currentPost.isLiked;
      console.log(`📝 Post ${postId} currently liked: ${isCurrentlyLiked}`);

      // Optimistic update - update UI immediately
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

      try {
        // Call the API to toggle like
        const success = await toggleLikePostAPI(postId, isCurrentlyLiked);

        if (success) {
          console.log(`✅ Successfully toggled like for post: ${postId}`);
        } else {
          console.warn(
            `⚠️ Failed to toggle like for post: ${postId}, reverting changes`
          );

          // Revert the optimistic update if API call failed
          const revertPosts = (prevPosts: Post[]) =>
            prevPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    isLiked: isCurrentlyLiked,
                    likes: isCurrentlyLiked ? post.likes + 1 : post.likes - 1,
                  }
                : post
            );

          setPosts(revertPosts);
          setAllPosts(revertPosts);
        }
      } catch (error) {
        console.error(`❌ Error toggling like for post: ${postId}`, error);

        // Revert the optimistic update on error
        const revertPosts = (prevPosts: Post[]) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: isCurrentlyLiked,
                  likes: isCurrentlyLiked ? post.likes + 1 : post.likes - 1,
                }
              : post
          );

        setPosts(revertPosts);
        setAllPosts(revertPosts);
      }
    },
    [posts, allPosts]
  );

  // Handle user profile navigation
  const handleUserPress = useCallback((userId: string) => {
    if (userId) {
      console.log(`Navigating to user profile: ${userId}`);
      // navigation.navigate("UserProfile", { userId });
    }
  }, []);

  // REMOVED: handleSharePost function (no longer needed)

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

  // Enhanced render post item with better error handling and debugging
  const renderPostItem = ({ item }: { item: Post }) => {
    // Log post image info for debugging
    if (item.image) {
      console.log(`🖼️ Rendering post ${item.id} with image:`, item.image);
    }

    return (
      <CommunityPostItem
        post={item}
        onLikePress={() => toggleLikePost(item.id)}
        onCommentPress={() => navigateToPostDetail(item.id)}
        onPostPress={() => navigateToPostDetail(item.id)}
        onUserPress={handleUserPress}
        // Share button enabled for MyFeed view
      />
    );
  };

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
          // Remove getItemLayout as post heights vary with images
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
