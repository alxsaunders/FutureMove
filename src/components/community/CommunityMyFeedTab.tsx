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
import { Post } from "../../types";
import { fetchFeedPosts } from "../../services/CommunityPostService";
import { fetchJoinedCommunities } from "../../services/CommunityService";

const CommunityMyFeedTab = () => {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasJoinedCommunities, setHasJoinedCommunities] = useState(true);
  const navigation = useNavigation();

  // Check if user has joined any communities
  const checkJoinedCommunities = useCallback(async () => {
    try {
      const communities = await fetchJoinedCommunities();
      setHasJoinedCommunities(communities.length > 0);
    } catch (error) {
      console.error("Error checking joined communities:", error);
      setHasJoinedCommunities(false);
    }
  }, []);

  // Fetch posts from joined communities
  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      if (currentUser) {
        // First check if user has joined any communities
        await checkJoinedCommunities();

        // Then fetch the feed posts
        const feedPosts = await fetchFeedPosts(currentUser.id);
        setPosts(feedPosts);
      } else {
        // If not logged in, use empty array
        setPosts([]);
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
    }, [fetchPosts])
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
        Your communities don't have any posts yet. Be the first to post!
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => {
          // @ts-ignore - Ignoring type checking for navigation
          navigation.navigate("CreatePost");
        }}
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
          // @ts-ignore - Ignoring type checking for navigation
          navigation.navigate("Hub");
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
                // @ts-ignore - Ignoring type checking for navigation with params
                navigation.navigate("PostDetail", { postId: item.id });
              }}
              onPostPress={() => {
                // @ts-ignore - Ignoring type checking for navigation with params
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
          onPress={() => {
            // @ts-ignore - Ignoring type checking for navigation
            navigation.navigate("CreatePost");
          }}
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
