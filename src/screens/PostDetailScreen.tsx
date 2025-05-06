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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { Post, Comment } from "../types";

// Mock data for a single post
const MOCK_POST: Post = {
  id: "1",
  communityId: "2",
  communityName: "Tech Learners",
  userId: "user1",
  userName: "Alex Johnson",
  userAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
  content:
    "Just completed my first React Native app! It's a simple todo list but I'm really proud of it. Anyone have suggestions for what I should build next?",
  image: "https://via.placeholder.com/400x300/5E6CE7/FFFFFF?text=My+First+App",
  createdAt: "2025-05-01T10:30:00Z",
  likes: 24,
  comments: 8,
  isLiked: false,
};

// Mock data for comments
const MOCK_COMMENTS: Comment[] = [
  {
    id: "c1",
    postId: "1",
    userId: "user2",
    userName: "Sarah Miller",
    userAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
    content:
      "Congratulations! That's a great first project. I'd recommend trying a weather app next - it's a good way to practice API integration.",
    createdAt: "2025-05-01T11:15:00Z",
    likes: 5,
    isLiked: true,
  },
  {
    id: "c2",
    postId: "1",
    userId: "user3",
    userName: "David Chen",
    userAvatar: "https://randomuser.me/api/portraits/men/62.jpg",
    content:
      "Nice work! Maybe try building a simple game next? Something like Tic-Tac-Toe could help you understand state management better.",
    createdAt: "2025-05-01T12:45:00Z",
    likes: 3,
    isLiked: false,
  },
  {
    id: "c3",
    postId: "1",
    userId: "user4",
    userName: "Priya Sharma",
    userAvatar: "https://randomuser.me/api/portraits/women/28.jpg",
    content:
      "Great job on your first app! I'd suggest a note-taking app with local storage - it'll teach you about persisting data between sessions.",
    createdAt: "2025-05-01T14:20:00Z",
    likes: 2,
    isLiked: false,
  },
  {
    id: "c4",
    postId: "1",
    userId: "user5",
    userName: "Marcus Wright",
    userAvatar: "https://randomuser.me/api/portraits/men/22.jpg",
    content:
      "Congrats! How about a habit tracker? It would be perfect for this community and you could add some nice charts for visualization.",
    createdAt: "2025-05-01T15:10:00Z",
    likes: 7,
    isLiked: true,
  },
];

const PostDetailScreen = () => {
  const { currentUser } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const { postId } = route.params as { postId: string };
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentInputRef = useRef<TextInput>(null);

  // Fetch post and comments
  useEffect(() => {
    const fetchPostData = async () => {
      setIsLoading(true);
      try {
        // In a real app, these would be API calls
        // Simulating API calls with timeouts
        await new Promise((resolve) => setTimeout(resolve, 800));

        // For now, using mock data
        setPost(MOCK_POST);
        setComments(MOCK_COMMENTS);
      } catch (error) {
        console.error("Error fetching post details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPostData();
  }, [postId]);

  // Toggle like on post
  const toggleLikePost = () => {
    if (!post) return;

    setPost({
      ...post,
      isLiked: !post.isLiked,
      likes: post.isLiked ? post.likes - 1 : post.likes + 1,
    });
  };

  // Toggle like on comment
  const toggleLikeComment = (commentId: string) => {
    setComments((prevComments) =>
      prevComments.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: !comment.isLiked,
              likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
            }
          : comment
      )
    );
  };

  // Submit new comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser || !post) return;

    setIsSubmitting(true);

    try {
      // In a real app, this would be an API call to create a comment
      // Simulate API request with timeout
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Create new comment
      const newCommentObj: Comment = {
        id: `c${comments.length + 1}`,
        postId: post.id,
        userId: currentUser.id,
        userName: currentUser.username || "Anonymous User",
        userAvatar: "https://via.placeholder.com/150",
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
      };

      // Add to comment list and update post comment count
      setComments([...comments, newCommentObj]);
      setPost({
        ...post,
        comments: post.comments + 1,
      });

      // Clear input
      setNewComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setIsSubmitting(false);
      // Dismiss keyboard
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
      <Image
        source={{ uri: item.userAvatar }}
        style={styles.commentAvatar}
        defaultSource={require("../assets/default-avatar.png")}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUserName}>{item.userName}</Text>
          <Text style={styles.commentTime}>{formatDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{item.content}</Text>
        <View style={styles.commentActions}>
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => toggleLikeComment(item.id)}
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
          <TouchableOpacity style={styles.commentAction}>
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color={COLORS.textSecondary}
            />
            <Text style={styles.commentActionText}>Reply</Text>
          </TouchableOpacity>
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
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={comments}
          renderItem={renderCommentItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={() => (
            <View style={styles.postContainer}>
              {/* Post Header */}
              <View style={styles.postHeader}>
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
                  onPress={toggleLikePost}
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
              uri: "https://via.placeholder.com/150",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
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
});

export default PostDetailScreen;
