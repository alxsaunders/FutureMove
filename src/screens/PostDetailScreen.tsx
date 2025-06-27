// src/screens/PostDetailScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  Image,
  Dimensions,
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
} from "../services/CommunityPostService";
import UserProfileModal from "../components/UserProfileModal";

const { width } = Dimensions.get("window");

// Enhanced Image Component with Firebase Storage support
const EnhancedImage: React.FC<{
  uri?: string;
  style: any;
  defaultIcon?: string;
  showLoading?: boolean;
  preventReload?: boolean;
}> = ({
  uri,
  style,
  defaultIcon = "person",
  showLoading = true,
  preventReload = false,
}) => {
  const [imageLoading, setImageLoading] = useState(!!uri);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const previousUri = useRef(uri);

  // Validate and clean Firebase Storage URL
  const validateFirebaseUrl = (url: string): string => {
    try {
      if (!url.includes("firebasestorage.googleapis.com")) {
        return url;
      }

      const urlObj = new URL(url);

      // Ensure alt=media is present for direct image access
      if (!urlObj.searchParams.get("alt")) {
        urlObj.searchParams.set("alt", "media");
      }

      return urlObj.toString();
    } catch (error) {
      return url;
    }
  };

  // Only reset loading state if URI actually changed
  useEffect(() => {
    if (previousUri.current !== uri && !preventReload) {
      setImageLoading(!!uri);
      setImageError(false);
      setImageLoaded(false);
      previousUri.current = uri;
    }
  }, [uri, preventReload]);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
    setImageLoaded(true);
  };

  const handleImageError = (error: any) => {
    setImageLoading(false);
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoadStart = () => {
    if (!preventReload || !imageLoaded) {
      setImageLoading(true);
      setImageError(false);
    }
  };

  // If no URI or error, show default icon
  if (!uri || imageError) {
    return (
      <View style={[style, styles.defaultImageContainer]}>
        <Ionicons
          name={defaultIcon as any}
          size={style.width ? style.width * 0.5 : 20}
          color={COLORS.textSecondary}
        />
      </View>
    );
  }

  const validatedUri = validateFirebaseUrl(uri);

  return (
    <View style={{ position: "relative" }}>
      <Image
        source={{ uri: validatedUri }}
        style={[style, imageError && { opacity: 0 }]}
        onLoadStart={handleImageLoadStart}
        onLoad={handleImageLoad}
        onError={handleImageError}
        resizeMode="cover"
      />

      {/* Loading Indicator */}
      {imageLoading && showLoading && !imageError && !imageLoaded && (
        <View style={[styles.imageLoadingOverlay, style]}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
};

// Enhanced Post Image Component
const PostImage: React.FC<{
  uri: string;
  style: any;
  preventReload?: boolean;
}> = ({ uri, style, preventReload = false }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const previousUri = useRef(uri);

  const validateFirebaseUrl = (url: string): string => {
    try {
      if (!url.includes("firebasestorage.googleapis.com")) {
        return url;
      }

      const urlObj = new URL(url);
      if (!urlObj.searchParams.get("alt")) {
        urlObj.searchParams.set("alt", "media");
      }
      return urlObj.toString();
    } catch (error) {
      return url;
    }
  };

  // Only reset loading state if URI actually changed
  useEffect(() => {
    if (previousUri.current !== uri && !preventReload) {
      setImageLoading(true);
      setImageError(false);
      setImageLoaded(false);
      previousUri.current = uri;
    }
  }, [uri, preventReload]);

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
    setImageLoaded(true);
  };

  const handleImageError = (error: any) => {
    setImageLoading(false);
    setImageError(true);
    setImageLoaded(false);
  };

  const handleImageLoadStart = () => {
    if (!preventReload || !imageLoaded) {
      setImageLoading(true);
      setImageError(false);
    }
  };

  const validatedUri = validateFirebaseUrl(uri);

  return (
    <View style={{ position: "relative" }}>
      {/* Main Image */}
      <Image
        source={{ uri: validatedUri }}
        style={[style, imageError && { opacity: 0 }]}
        onLoadStart={handleImageLoadStart}
        onLoad={handleImageLoad}
        onError={handleImageError}
        resizeMode="cover"
      />

      {/* Loading State */}
      {imageLoading && !imageError && !imageLoaded && (
        <View style={[styles.postImageLoadingContainer, style]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.postImageLoadingText}>Loading image...</Text>
        </View>
      )}

      {/* Error State */}
      {imageError && (
        <View style={[styles.postImageErrorContainer, style]}>
          <Ionicons
            name="image-outline"
            size={40}
            color={COLORS.textSecondary}
          />
          <Text style={styles.postImageErrorText}>Failed to load image</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setImageError(false);
              setImageLoading(true);
              setImageLoaded(false);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

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

  // Track if user is actively typing
  const [isTypingComment, setIsTypingComment] = useState(false);
  const [commentInputFocused, setCommentInputFocused] = useState(false);

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
        // Clean the post image URL
        const cleanedPost = {
          ...postData,
          image: cleanImageUrl(postData.image),
          userAvatar: cleanImageUrl(postData.userAvatar),
        };
        setPost(cleanedPost);
        console.log(`Successfully fetched post: ${cleanedPost.id}`);
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

      // Clean comment image URLs
      const cleanedComments = commentsData.map((comment) => ({
        ...comment,
        userAvatar: cleanImageUrl(comment.userAvatar),
      }));
      setComments(cleanedComments);
      console.log(`Successfully fetched ${cleanedComments.length} comments`);
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

  // Clean image URL function
  const cleanImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;

    // Remove local file paths
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
        const urlObj = new URL(url);
        if (!urlObj.searchParams.get("alt")) {
          urlObj.searchParams.set("alt", "media");
        }
        return urlObj.toString();
      } catch (error) {
        console.warn("🚫 Invalid Firebase Storage URL:", url);
        return undefined;
      }
    }

    return url;
  };

  // Check if refresh should be blocked
  const shouldBlockRefresh = () => {
    return (
      isTypingComment || commentInputFocused || newComment.trim().length > 0
    );
  };

  // Refresh data - but only if not typing
  const handleRefresh = async () => {
    // Block refresh if user is actively typing
    if (shouldBlockRefresh()) {
      console.log("🚫 Blocking refresh - user is typing comment");
      return;
    }

    setIsRefreshing(true);
    try {
      await fetchPostData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle comment input changes
  const handleCommentChange = (text: string) => {
    setNewComment(text);

    // Set typing state based on whether there's text
    if (text.length > 0 && !isTypingComment) {
      setIsTypingComment(true);
    } else if (text.length === 0 && isTypingComment) {
      setIsTypingComment(false);
    }
  };

  // Handle comment input focus
  const handleCommentFocus = () => {
    setCommentInputFocused(true);
  };

  // Handle comment input blur
  const handleCommentBlur = () => {
    setCommentInputFocused(false);
    // If no text, also clear typing state
    if (newComment.trim().length === 0) {
      setIsTypingComment(false);
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

  // Submit new comment
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !post) return;

    setIsSubmitting(true);

    try {
      const comment = await createComment(post.id, newComment.trim());

      if (comment) {
        // Clean the comment image URL
        const cleanedComment = {
          ...comment,
          userAvatar: cleanImageUrl(comment.userAvatar),
        };

        // Add new comment to the list
        setComments((prevComments) => [...prevComments, cleanedComment]);

        // Update post comment count
        setPost((prevPost) =>
          prevPost
            ? {
                ...prevPost,
                comments: prevPost.comments + 1,
              }
            : null
        );

        // Clear input and reset typing states
        setNewComment("");
        setIsTypingComment(false);
        setCommentInputFocused(false);

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
        <EnhancedImage
          uri={item.userAvatar}
          style={styles.commentAvatar}
          defaultIcon="person"
          showLoading={false}
          preventReload={shouldBlockRefresh()}
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
          <TouchableOpacity
            onPress={handleRefresh}
            disabled={shouldBlockRefresh()}
          >
            <Ionicons
              name="refresh"
              size={20}
              color={
                shouldBlockRefresh()
                  ? COLORS.border
                  : isRefreshing
                  ? COLORS.primary
                  : COLORS.text
              }
            />
          </TouchableOpacity>
        </View>

        {/* Show typing indicator when refresh is blocked */}
    
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
                  <EnhancedImage
                    uri={post.userAvatar}
                    style={styles.avatar}
                    defaultIcon="person"
                    showLoading={false}
                    preventReload={shouldBlockRefresh()}
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

              {/* Post Image with Enhanced Error Handling */}
              {post.image && (
                <PostImage
                  uri={post.image}
                  style={styles.postImage}
                  preventReload={shouldBlockRefresh()}
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

                {/* Comment button that focuses the input */}
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
          <EnhancedImage
            uri={currentUser?.profileImage}
            style={styles.currentUserAvatar}
            defaultIcon="person"
            showLoading={false}
            preventReload={shouldBlockRefresh()}
          />
          <TextInput
            ref={commentInputRef}
            style={styles.commentInput}
            placeholder="Add a comment..."
            value={newComment}
            onChangeText={handleCommentChange}
            onFocus={handleCommentFocus}
            onBlur={handleCommentBlur}
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
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.primary + "15",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary + "30",
  },
  typingText: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 6,
    fontStyle: "italic",
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
  defaultImageContainer: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  imageLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 20,
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
    backgroundColor: COLORS.border,
  },
  postImageLoadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
  },
  postImageLoadingText: {
    color: COLORS.white,
    fontSize: 14,
    marginTop: 8,
    fontWeight: "500",
  },
  postImageErrorContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  postImageErrorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
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
