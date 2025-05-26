// src/screens/PostDetailScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { Post, Comment } from "../types";
import {
  fetchPost,
  fetchComments,
  createComment,
  toggleLikePost,
  toggleLikeComment,
  fetchCommunityPosts,
} from "../services/CommunityPostService";
import { fetchJoinedCommunities } from "../services/CommunityService";
import UserProfileModal from "../components/UserProfileModal";

const PostDetailScreen = () => {
  const { currentUser } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { postId: rawPostId } = route.params as { postId: string | number };

  // Ensure postId is always a string
  const postId = String(rawPostId);
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  // Modal state
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch post and comments
  useEffect(() => {
    fetchPostData();
  }, [postId]);

  const fetchPostData = async () => {
    setIsLoading(true);
    try {
      console.log(`Fetching post data for postId: ${postId}`);

      // Fetch post and comments in parallel
      const [postData, commentsData] = await Promise.all([
        fetchPost(postId),
        fetchComments(postId),
      ]);

      if (postData) {
        setPost(postData);
        console.log(`Successfully fetched post: ${postData.id}`);
      } else {
        console.warn(`Post not found for ID: ${postId}`);
        Alert.alert(
          "Post Not Found",
          "This post may have been deleted or doesn't exist.",
          [
            {
              text: "Go Back",
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }

      setComments(commentsData);
      console.log(`Successfully fetched ${commentsData.length} comments`);
    } catch (error) {
      console.error("Error fetching post details:", error);
      Alert.alert("Error", "Failed to load post details. Please try again.", [
        {
          text: "Retry",
          onPress: fetchPostData,
        },
        {
          text: "Go Back",
          onPress: () => navigation.goBack(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchPostData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle user profile click
  const handleUserProfileClick = (userId: string) => {
    if (!userId) return;
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  // Toggle like on post
  const handleToggleLikePost = async () => {
    if (!post) return;

    // Optimistic update
    const wasLiked = post.isLiked;
    const newLikesCount = wasLiked ? post.likes - 1 : post.likes + 1;

    setPost({
      ...post,
      isLiked: !wasLiked,
      likes: newLikesCount,
    });

    try {
      const success = await toggleLikePost(post.id, wasLiked);

      if (!success) {
        // Revert optimistic update on failure
        setPost({
          ...post,
          isLiked: wasLiked,
          likes: post.likes,
        });
        Alert.alert("Error", "Failed to update like. Please try again.");
      }
    } catch (error) {
      // Revert optimistic update on error
      setPost({
        ...post,
        isLiked: wasLiked,
        likes: post.likes,
      });
      console.error("Error toggling post like:", error);
    }
  };

  // Toggle like on comment
  const handleToggleLikeComment = async (commentId: string) => {
    const commentIndex = comments.findIndex((c) => c.id === commentId);
    if (commentIndex === -1) return;

    const comment = comments[commentIndex];
    const wasLiked = comment.isLiked;
    const newLikesCount = wasLiked ? comment.likes - 1 : comment.likes + 1;

    // Optimistic update
    const updatedComments = [...comments];
    updatedComments[commentIndex] = {
      ...comment,
      isLiked: !wasLiked,
      likes: newLikesCount,
    };
    setComments(updatedComments);

    try {
      const success = await toggleLikeComment(commentId, wasLiked);

      if (!success) {
        // Revert optimistic update on failure
        updatedComments[commentIndex] = comment;
        setComments(updatedComments);
        Alert.alert("Error", "Failed to update like. Please try again.");
      }
    } catch (error) {
      // Revert optimistic update on error
      updatedComments[commentIndex] = comment;
      setComments(updatedComments);
      console.error("Error toggling comment like:", error);
    }
  };

  // Submit new comment
  const handleSubmitComment = async () => {
    // if (!newComment.trim() || !currentUser || !post) return;

    setIsSubmitting(true);

    try {
      const comment = await createComment(post.id, newComment.trim());

      if (comment) {
        // Add new comment to the list
        setComments((prevComments) => [...prevComments, comment]);

        // Update post comment count
        setPost((prevPost) =>
          prevPost
            ? {
                ...prevPost,
                comments: prevPost.comments + 1,
              }
            : null
        );

        // Clear input
        setNewComment("");

        // Show success feedback
        console.log("Comment posted successfully");
      } else {
        Alert.alert("Error", "Failed to post comment. Please try again.");
      }
    } catch (error) {
      console.error("Error posting comment:", error);
      Alert.alert("Error", "Failed to post comment. Please try again.");
    } finally {
      setIsSubmitting(false);
      Keyboard.dismiss();
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes} min ago`;
      }
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Render comment item
  const renderCommentItem = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <TouchableOpacity
        onPress={() => handleUserProfileClick(item.userId)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.userAvatar }}
          style={styles.commentAvatar}
          defaultSource={require("../assets/default-avatar.png")}
        />
      </TouchableOpacity>
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <TouchableOpacity
            onPress={() => handleUserProfileClick(item.userId)}
            activeOpacity={0.7}
          >
            <Text style={styles.commentUserName}>{item.userName}</Text>
          </TouchableOpacity>
          <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => handleToggleLikeComment(item.id)}
          >
            <Ionicons
              name={item.isLiked ? "heart" : "heart-outline"}
              size={16}
              color={item.isLiked ? COLORS.primary : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.commentActionText,
                item.isLiked && { color: COLORS.primary },
              ]}
            >
              {item.likes}
            </Text>
          </TouchableOpacity>
          {/* <TouchableOpacity style={styles.commentAction}>
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading post...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={COLORS.textSecondary}
        />
        <Text style={styles.errorText}>Post not found</Text>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{post.communityName}</Text>
          <TouchableOpacity onPress={handleRefresh}>
            <Ionicons
              name="refresh"
              size={20}
              color={isRefreshing ? COLORS.primary : COLORS.text}
            />
          </TouchableOpacity>
        </View>

        <FlatList
          data={comments}
          renderItem={renderCommentItem}
          keyExtractor={(item) => item.id}
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          ListHeaderComponent={() => (
            <View style={styles.postContainer}>
              {/* Post Header */}
              <View style={styles.postHeader}>
                <TouchableOpacity
                  onPress={() => handleUserProfileClick(post.userId)}
                  activeOpacity={0.7}
                  style={styles.postHeaderClickable}
                >
                  <Image
                    source={{ uri: post.userAvatar }}
                    style={styles.avatar}
                    defaultSource={require("../assets/default-avatar.png")}
                  />
                  <View style={styles.postHeaderInfo}>
                    <Text style={styles.userName}>{post.userName}</Text>
                    <Text style={styles.postTime}>
                      {formatDate(post.createdAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Post Content */}
              <Text style={styles.postContent}>{post.content}</Text>

              {/* Post Image (if exists) */}
              {post.image && (
                <Image
                  source={{ uri: post.image }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}

              {/* Post Actions */}
              <View style={styles.postActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleToggleLikePost}
                >
                  <Ionicons
                    name={post.isLiked ? "heart" : "heart-outline"}
                    size={22}
                    color={post.isLiked ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.actionText,
                      post.isLiked && { color: COLORS.primary },
                    ]}
                  >
                    {post.likes}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => commentInputRef.current?.focus()}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                  <Text style={styles.actionText}>{post.comments}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons
                    name="share-social-outline"
                    size={20}
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Comments Section Divider */}
              {comments.length > 0 && (
                <View style={styles.commentsHeader}>
                  <Text style={styles.commentsTitle}>
                    Comments ({comments.length})
                  </Text>
                </View>
              )}
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyComments}>
              <Ionicons
                name="chatbubbles-outline"
                size={40}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyCommentsText}>No comments yet</Text>
              <Text style={styles.emptyCommentsSubtext}>
                Be the first to comment!
              </Text>
            </View>
          )}
        />

        {/* Comment Input */}
        <View style={styles.commentInputContainer}>
          <Image
            source={{
              uri:
                currentUser?.profileImage || "https://via.placeholder.com/150",
            }}
            style={styles.currentUserAvatar}
            defaultSource={require("../assets/default-avatar.png")}
          />
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !newComment.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSubmitComment}
            disabled={!newComment.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={16} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* User Profile Modal */}
        <UserProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          userId={selectedUserId}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
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
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 12,
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
  listContent: {
    paddingBottom: 80,
  },
  postContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    marginBottom: 8,
  },
  postHeader: {
    marginBottom: 12,
  },
  postHeaderClickable: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  postHeaderInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  postTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  postContent: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  postImage: {
    width: "100%",
    height: 250,
    borderRadius: 8,
    marginBottom: 16,
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "flex-start",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  actionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
  commentsHeader: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 16,
    paddingTop: 16,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  commentItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  commentTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  commentText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: "row",
  },
  commentAction: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  commentActionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  emptyComments: {
    padding: 24,
    alignItems: "center",
    backgroundColor: COLORS.cardBackground,
  },
  emptyCommentsText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyCommentsSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  currentUserAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    backgroundColor: COLORS.background,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  loginPromptContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  loginPromptText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },
  debugInfo: {
    position: "absolute",
    bottom: -30,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    padding: 4,
  },
  debugText: {
    fontSize: 10,
    color: "red",
  },
});

export default PostDetailScreen;
