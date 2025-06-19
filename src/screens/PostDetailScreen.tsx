// src/screens/PostDetailScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import {
  fetchPost,
  fetchComments,
  createComment,
  toggleLikePost as toggleLikePostAPI,
  toggleLikeComment,
} from "../services/CommunityPostService";
import { Post, Comment } from "../types";
import CommunityPostItem from "../components/community/CommunityPostItem";

const PostDetailScreen = () => {
  const { currentUser } = useAuth();
  const route = useRoute();
  const navigation = useNavigation();
  const { postId } = route.params as { postId: string };

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Fetch post and comments
  const fetchPostData = useCallback(async () => {
    if (!postId) return;

    setIsLoading(true);
    try {
      console.log("Fetching post details for ID:", postId);

      // Fetch post and comments in parallel
      const [postData, commentsData] = await Promise.all([
        fetchPost(postId),
        fetchComments(postId),
      ]);

      if (postData) {
        setPost(postData);
        console.log(
          "Post data loaded:",
          postData.content.substring(0, 50) + "..."
        );
      } else {
        console.warn("No post data returned from API");
        setPost(null);
      }

      setComments(commentsData);
      console.log(`Loaded ${commentsData.length} comments`);
    } catch (error) {
      console.error("Error fetching post data:", error);
      setPost(null);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  // Load data on initial render and when focused
  useFocusEffect(
    useCallback(() => {
      fetchPostData();
    }, [fetchPostData])
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchPostData();
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchPostData]);

  // Handle post like
  const handleLikePost = useCallback(async () => {
    if (!post) return;

    console.log(`🔄 Toggling like for post: ${post.id}`);
    const isCurrentlyLiked = post.isLiked;

    // Optimistic update
    setPost((prevPost) => {
      if (!prevPost) return null;
      return {
        ...prevPost,
        isLiked: !prevPost.isLiked,
        likes: prevPost.isLiked ? prevPost.likes - 1 : prevPost.likes + 1,
      };
    });

    try {
      const success = await toggleLikePostAPI(post.id, isCurrentlyLiked);

      if (!success) {
        console.warn(
          `⚠️ Failed to toggle like for post: ${post.id}, reverting changes`
        );
        // Revert optimistic update
        setPost((prevPost) => {
          if (!prevPost) return null;
          return {
            ...prevPost,
            isLiked: isCurrentlyLiked,
            likes: isCurrentlyLiked ? prevPost.likes + 1 : prevPost.likes - 1,
          };
        });
      }
    } catch (error) {
      console.error(`❌ Error toggling like for post: ${post.id}`, error);
      // Revert optimistic update
      setPost((prevPost) => {
        if (!prevPost) return null;
        return {
          ...prevPost,
          isLiked: isCurrentlyLiked,
          likes: isCurrentlyLiked ? prevPost.likes + 1 : prevPost.likes - 1,
        };
      });
    }
  }, [post]);

  // Handle comment like
  const handleLikeComment = useCallback(
    async (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return;

      console.log(`🔄 Toggling like for comment: ${commentId}`);
      const isCurrentlyLiked = comment.isLiked;

      // Optimistic update
      setComments((prevComments) =>
        prevComments.map((c) =>
          c.id === commentId
            ? {
                ...c,
                isLiked: !c.isLiked,
                likes: c.isLiked ? c.likes - 1 : c.likes + 1,
              }
            : c
        )
      );

      try {
        const success = await toggleLikeComment(commentId, isCurrentlyLiked);

        if (!success) {
          console.warn(
            `⚠️ Failed to toggle like for comment: ${commentId}, reverting changes`
          );
          // Revert optimistic update
          setComments((prevComments) =>
            prevComments.map((c) =>
              c.id === commentId
                ? {
                    ...c,
                    isLiked: isCurrentlyLiked,
                    likes: isCurrentlyLiked ? c.likes + 1 : c.likes - 1,
                  }
                : c
            )
          );
        }
      } catch (error) {
        console.error(
          `❌ Error toggling like for comment: ${commentId}`,
          error
        );
        // Revert optimistic update
        setComments((prevComments) =>
          prevComments.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  isLiked: isCurrentlyLiked,
                  likes: isCurrentlyLiked ? c.likes + 1 : c.likes - 1,
                }
              : c
          )
        );
      }
    },
    [comments]
  );

  // Handle comment submission
  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim() || !post || !currentUser) return;

    setIsSubmittingComment(true);
    try {
      console.log("Submitting comment:", newComment.trim());

      const createdComment = await createComment(post.id, newComment.trim());

      if (createdComment) {
        // Add new comment to the list
        setComments((prevComments) => [createdComment, ...prevComments]);

        // Update post comment count
        setPost((prevPost) => {
          if (!prevPost) return null;
          return {
            ...prevPost,
            comments: prevPost.comments + 1,
          };
        });

        // Clear the input
        setNewComment("");
        console.log("✅ Comment added successfully");
      } else {
        Alert.alert("Error", "Failed to add comment. Please try again.");
      }
    } catch (error) {
      console.error("❌ Error submitting comment:", error);
      Alert.alert("Error", "Failed to add comment. Please try again.");
    } finally {
      setIsSubmittingComment(false);
    }
  }, [newComment, post, currentUser]);

  // Handle share post
  const handleSharePost = useCallback((postToShare: Post) => {
    console.log("Sharing post:", postToShare.id);
    // The CommunityPostItem component handles the sharing logic
  }, []);

  // Render comment item
  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <View style={styles.commentUser}>
          <View style={styles.commentAvatar}>
            <Ionicons name="person" size={16} color={COLORS.textSecondary} />
          </View>
          <Text style={styles.commentUserName}>{item.userName}</Text>
          <Text style={styles.commentTime}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <Text style={styles.commentContent}>{item.content}</Text>

      <View style={styles.commentActions}>
        <TouchableOpacity
          style={styles.commentLikeButton}
          onPress={() => handleLikeComment(item.id)}
        >
          <Ionicons
            name={item.isLiked ? "heart" : "heart-outline"}
            size={16}
            color={item.isLiked ? COLORS.primary : COLORS.textSecondary}
          />
          {item.likes > 0 && (
            <Text
              style={[
                styles.commentLikeText,
                item.isLiked && { color: COLORS.primary },
              ]}
            >
              {item.likes}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContent}>
          <Ionicons
            name="alert-circle-outline"
            size={60}
            color={COLORS.textSecondary}
          />
          <Text style={styles.errorTitle}>Post Not Found</Text>
          <Text style={styles.errorMessage}>
            Sorry, we couldn't find this post.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.headerTitle}>Post</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={() => (
            <View style={styles.postContainer}>
              {/* Main Post with Share Button Enabled */}
              <CommunityPostItem
                post={post}
                onLikePress={handleLikePost}
                onCommentPress={() => {}} // No action needed, already on detail screen
                onPostPress={() => {}} // No action needed, already on detail screen
                onSharePress={handleSharePost}
                showShareButton={false} // Share button removed from individual post view (not working)
              />

              {/* Comments Header */}
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>
                  Comments ({comments.length})
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyCommentsContainer}>
              <Ionicons
                name="chatbubble-outline"
                size={40}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyCommentsText}>
                No comments yet. Be the first to comment!
              </Text>
            </View>
          )}
          contentContainerStyle={styles.contentContainer}
        />

        {/* Comment Input */}
        {currentUser && (
          <View style={styles.commentInputContainer}>
            <View style={styles.commentInputWrapper}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={COLORS.textSecondary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!newComment.trim() || isSubmittingComment) &&
                    styles.submitButtonDisabled,
                ]}
                onPress={handleSubmitComment}
                disabled={!newComment.trim() || isSubmittingComment}
              >
                {isSubmittingComment ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="send" size={20} color={COLORS.white} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  loadingContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  keyboardContainer: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  postContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  commentsHeader: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  commentItem: {
    backgroundColor: COLORS.cardBackground,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
  },
  commentHeader: {
    marginBottom: 8,
  },
  commentUser: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  commentContent: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentLikeButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  commentLikeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  emptyCommentsContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyCommentsText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 12,
  },
  commentInputContainer: {
    backgroundColor: COLORS.cardBackground,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentInputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
});

export default PostDetailScreen;
