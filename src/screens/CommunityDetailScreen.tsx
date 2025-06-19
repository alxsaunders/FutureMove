// src/screens/CommunityDetailScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import {
  getCommunityById,
  joinCommunity,
  leaveCommunity,
} from "../services/CommunityService";
import {
  fetchCommunityPosts,
  toggleLikePost as toggleLikePostAPI,
} from "../services/CommunityPostService";
import { Community, Post } from "../types";
import CommunityPostItem from "../components/community/CommunityPostItem";

const CommunityDetailScreen = () => {
  const { currentUser } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const { communityId } = route.params as { communityId: string };

  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch community details
  const fetchCommunityDetails = useCallback(async () => {
    if (!communityId) return;

    setIsLoading(true);
    try {
      console.log("Fetching community details for ID:", communityId);
      const communityData = await getCommunityById(communityId);
      console.log(
        "Community data received:",
        JSON.stringify(communityData, null, 2)
      );

      if (communityData) {
        // Transform API Community type to component Community type
        const transformedCommunity: Community = {
          id: String(communityData.id),
          name: communityData.name,
          category: communityData.category || "General",
          members: communityData.memberCount || 0,
          posts: 0, // Default since API doesn't provide this
          image: communityData.imageUrl || "https://via.placeholder.com/150",
          description: communityData.description || "",
          isJoined: !!communityData.isJoined, // Ensure boolean conversion
        };

        console.log(
          "Setting community with isJoined:",
          transformedCommunity.isJoined
        );
        setCommunity(transformedCommunity);

        // Fetch posts
        const postsData = await fetchCommunityPosts(communityId);
        setPosts(postsData);
      } else {
        console.warn("No community data returned from API");
        setCommunity(null);
      }
    } catch (error) {
      console.error("Error fetching community details:", error);
      setCommunity(null);
    } finally {
      setIsLoading(false);
    }
  }, [communityId]);

  // Load data on initial render and when focused
  useFocusEffect(
    useCallback(() => {
      fetchCommunityDetails();

      // Set up a refresh interval when screen is active
      const refreshTimer = setInterval(() => {
        fetchCommunityDetails();
      }, 30000); // Refresh every 30 seconds

      return () => {
        clearInterval(refreshTimer);
      };
    }, [fetchCommunityDetails])
  );

  // Add a refresh function to reload data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchCommunityDetails();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchCommunityDetails]);

  // Handle joining/leaving community
  const handleToggleMembership = async () => {
    if (!community || !currentUser) return;

    setIsJoining(true);
    try {
      console.log(
        `Attempting to ${
          community.isJoined ? "leave" : "join"
        } community ${communityId}`
      );

      // Update UI optimistically for immediate feedback
      setCommunity({
        ...community,
        isJoined: !community.isJoined,
        members: community.isJoined
          ? Math.max(0, community.members - 1)
          : community.members + 1,
      });

      // Use correct ID parameter
      let success;
      if (community.isJoined) {
        success = await leaveCommunity(communityId);
      } else {
        success = await joinCommunity(communityId);
      }

      console.log(
        `Community ${community.isJoined ? "join" : "leave"} operation result:`,
        success
      );

      if (!success) {
        // If API call failed, revert the UI changes
        console.warn("Failed to toggle community membership, reverting UI");
        setCommunity({
          ...community,
          isJoined: community.isJoined,
          members: community.isJoined
            ? community.members - 1
            : community.members + 1,
        });
      } else {
        console.log(
          `Successfully ${
            community.isJoined ? "joined" : "left"
          } community: ${communityId}`
        );

        // Refresh community data after successful join/leave
        await fetchCommunityDetails();

        // Refresh posts after joining (optional)
        if (!community.isJoined) {
          console.log("Refreshing posts after joining community");
          const postsData = await fetchCommunityPosts(communityId);
          setPosts(postsData);
        }
      }
    } catch (error) {
      console.error("Error toggling membership:", error);

      // Revert UI changes on error
      setCommunity({
        ...community,
        isJoined: community.isJoined,
        members: community.isJoined
          ? community.members - 1
          : community.members + 1,
      });
    } finally {
      setIsJoining(false);
    }
  };

  // FIXED: Toggle like on a post with proper API integration
  const handleLikePost = useCallback(
    async (postId: string) => {
      console.log(`🔄 Toggling like for post: ${postId}`);

      // Find the current post to get its like status
      const currentPost = posts.find((post) => post.id === postId);
      if (!currentPost) {
        console.warn(`⚠️ Post ${postId} not found in current posts`);
        return;
      }

      const isCurrentlyLiked = currentPost.isLiked;
      console.log(`📝 Post ${postId} currently liked: ${isCurrentlyLiked}`);

      // Optimistic update - update UI immediately
      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !post.isLiked,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
              }
            : post
        )
      );

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
          setPosts((prevPosts) =>
            prevPosts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    isLiked: isCurrentlyLiked,
                    likes: isCurrentlyLiked ? post.likes + 1 : post.likes - 1,
                  }
                : post
            )
          );
        }
      } catch (error) {
        console.error(`❌ Error toggling like for post: ${postId}`, error);

        // Revert the optimistic update on error
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: isCurrentlyLiked,
                  likes: isCurrentlyLiked ? post.likes + 1 : post.likes - 1,
                }
              : post
          )
        );
      }
    },
    [posts]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading community...</Text>
      </SafeAreaView>
    );
  }

  if (!community) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={60}
          color={COLORS.textSecondary}
        />
        <Text style={styles.errorTitle}>Community Not Found</Text>
        <Text style={styles.errorMessage}>
          Sorry, we couldn't find this community.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{community.name}</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Community Details */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommunityPostItem
            post={item}
            onLikePress={() => handleLikePost(item.id)}
            onCommentPress={() => {
              navigation.navigate("PostDetail", { postId: item.id });
            }}
            onPostPress={() => {
              navigation.navigate("PostDetail", { postId: item.id });
            }}
            // Share button enabled for community detail view
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={() => (
          <View style={styles.communityInfo}>
            <View style={styles.communityHeader}>
              <Image
                source={{ uri: community.image }}
                style={styles.communityImage}
                defaultSource={require("../assets/placeholder.png")}
              />
              <View style={styles.headerContent}>
                <Text style={styles.communityName}>{community.name}</Text>
                <View style={styles.communityStats}>
                  <View style={styles.stat}>
                    <Ionicons
                      name="people"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.statText}>
                      {community.members} members
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons
                      name="chatbubbles"
                      size={16}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.statText}>{posts.length} posts</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: getCategoryColor(community.category) },
                  ]}
                >
                  <Text style={styles.categoryText}>{community.category}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.description}>{community.description}</Text>

            <TouchableOpacity
              style={[
                styles.joinButton,
                community.isJoined ? styles.leaveButton : null,
              ]}
              onPress={handleToggleMembership}
              disabled={isJoining}
            >
              {isJoining ? (
                <ActivityIndicator
                  size="small"
                  color={community.isJoined ? COLORS.primary : COLORS.white}
                />
              ) : (
                <Text
                  style={[
                    styles.joinButtonText,
                    community.isJoined ? styles.leaveButtonText : null,
                  ]}
                >
                  {community.isJoined ? "Leave Community" : "Join Community"}
                </Text>
              )}
            </TouchableOpacity>

            {posts.length > 0 && (
              <View style={styles.postsHeader}>
                <Text style={styles.postsTitle}>Latest Posts</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyPostsContainer}>
            <Ionicons
              name="newspaper-outline"
              size={60}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyTitle}>No Posts Yet</Text>
            <Text style={styles.emptyText}>
              Be the first to post in this community!
            </Text>
            <TouchableOpacity
              style={styles.createPostButton}
              onPress={() => {
                navigation.navigate("CreatePost", {
                  communityId: community.id,
                });
              }}
              disabled={!community.isJoined}
            >
              <Text style={styles.createPostText}>
                {community.isJoined ? "Create Post" : "Join to Post"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.contentContainer}
      />

      {/* Floating Action Button for creating posts - only shown if member */}
      {posts.length > 0 && community.isJoined && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            navigation.navigate("CreatePost", { communityId: community.id });
          }}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

// Helper function to get color for a category
const getCategoryColor = (category: string) => {
  const categoryColors: Record<string, string> = {
    Personal: "#3B82F6", // Blue
    Work: "#4CAF50", // Green
    Learning: "#5E6CE7", // Purple
    Health: "#F44336", // Red
    Finance: "#FF9800", // Orange
    Wellness: "#9C27B0", // Deep Purple
    Repair: "#56C3B6", // Teal
  };

  return categoryColors[category] || "#3B82F6";
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
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  communityInfo: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  communityHeader: {
    flexDirection: "row",
    marginBottom: 16,
  },
  communityImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
    justifyContent: "center",
  },
  communityName: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  communityStats: {
    flexDirection: "row",
    marginBottom: 8,
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    alignSelf: "flex-start",
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
  },
  description: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  joinButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
  leaveButton: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  leaveButtonText: {
    color: COLORS.primary,
  },
  postsHeader: {
    marginTop: 8,
    marginBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  emptyPostsContainer: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  createPostButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createPostText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default CommunityDetailScreen;
