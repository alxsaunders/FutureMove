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
// Import the adapter function from CreatePostScreen or create a utility file for it
import { adaptCommunity } from "../../screens/CreatePostScreen";

const CommunityMyFeedTab = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasJoinedCommunities, setHasJoinedCommunities] = useState(true);
  const navigation = useNavigation();

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

      return adaptedCommunities;
    } catch (error) {
      console.error("Error checking joined communities:", error);
      setJoinedCommunities([]);
      setHasJoinedCommunities(false);
      return [];
    }
  }, []);

  // Fetch posts from joined communities
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!currentUser) {
        console.log("No current user, skipping post fetch");
        setPosts([]);
        setIsLoading(false);
        return;
      }

      // First check if user has joined any communities
      const communities = await checkJoinedCommunities();

      if (communities.length === 0) {
        console.log("User hasn't joined any communities, no posts to show");
        setPosts([]);
        setIsLoading(false);
        return;
      }

      // Use fetchFeedPosts with the current user ID
      console.log(`Fetching feed posts for user ${currentUser.id}`);
      const feedPosts = await fetchFeedPosts(currentUser.id);
      console.log(`Fetched ${feedPosts.length} feed posts`);

      if (feedPosts.length === 0) {
        // If the backend feed API isn't working, we can try to fetch posts manually
        // from each joined community - this is a fallback approach
        console.log(
          "No posts returned from feed API, trying alternative approach"
        );
        let allPosts: Post[] = [];

        for (const community of communities) {
          try {
            // This assumes you have a function to fetch posts for a specific community
            const communityPosts = await fetchCommunityPosts(
              String(community.id)
            );
            allPosts = [...allPosts, ...communityPosts];
          } catch (err) {
            console.error(
              `Error fetching posts for community ${community.id}:`,
              err
            );
          }
        }

        console.log(
          `Fetched ${allPosts.length} posts from individual communities`
        );
        setPosts(allPosts);
      } else {
        setPosts(feedPosts);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, checkJoinedCommunities]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchPosts();
    setIsRefreshing(false);
  }, [fetchPosts]);

  // Like/unlike a post
  const toggleLikePost = (postId: string) => {
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
  };

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchPosts();

      // Set up a refresh interval when screen is active
      const refreshTimer = setInterval(() => {
        fetchPosts();
      }, 30000); // Refresh every 30 seconds

      return () => {
        clearInterval(refreshTimer);
      };
    }, [fetchPosts])
  );

  // Create post navigation with community selector
  const navigateToCreatePost = () => {
    if (joinedCommunities.length === 1) {
      // If user has only joined one community, navigate directly with that communityId
      navigation.navigate("CreatePost", {
        communityId: joinedCommunities[0].id,
      });
    } else {
      // If user has joined multiple communities, navigate to create post
      // without a pre-selected community (the user will choose on that screen)
      navigation.navigate("CreatePost");
    }
  };

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
        Your communities don't have any posts yet. Be the first to post!
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={navigateToCreatePost}
      >
        <Text style={styles.emptyButtonText}>Create Post</Text>
      </TouchableOpacity>
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
          // Update to use correct screen name
          navigation.navigate("Home"); // Update this to your actual hub screen name
        }}
      >
        <Text style={styles.emptyButtonText}>Find Communities</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loaderText}>Loading your feed...</Text>
        </View>
      ) : !hasJoinedCommunities ? (
        <NoCommunitiesView />
      ) : posts.length > 0 ? (
        <FlatList
          data={posts}
          renderItem={({ item }) => (
            <CommunityPostItem
              post={item}
              onLikePress={() => toggleLikePost(item.id)}
              onCommentPress={() => {
                navigation.navigate("PostDetail", { postId: item.id });
              }}
              onPostPress={() => {
                navigation.navigate("PostDetail", { postId: item.id });
              }}
            />
          )}
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
        />
      ) : (
        <EmptyFeedView />
      )}

      {/* Floating action button for creating a new post */}
      {hasJoinedCommunities && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={navigateToCreatePost}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
});

export default CommunityMyFeedTab;
