// src/components/community/CommunityPostItem.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import { Post } from "../../types";
import FirebaseImage from "../common/FirebaseImage";

// Get screen dimensions
const { width } = Dimensions.get("window");
const MAX_IMAGE_HEIGHT = 300;
const CONTAINER_HORIZONTAL_PADDING = 16;
const SCREEN_HORIZONTAL_MARGIN = 16;

interface CommunityPostItemProps {
  post: Post;
  onLikePress: () => void;
  onCommentPress: () => void;
  onPostPress: () => void;
  onSharePress?: (post: Post) => void;
  onUserPress?: (userId: string) => void;
}

const CommunityPostItem: React.FC<CommunityPostItemProps> = ({
  post,
  onLikePress,
  onCommentPress,
  onPostPress,
  onSharePress,
  onUserPress,
}) => {
  // Format the date for display
  const formatPostDate = (dateString: string) => {
    try {
      const postDate = new Date(dateString);
      const now = new Date();

      // Check if date is valid
      if (isNaN(postDate.getTime())) {
        return "Recently";
      }

      const diffTime = Math.abs(now.getTime() - postDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        if (diffHours === 0) {
          const diffMinutes = Math.floor(diffTime / (1000 * 60));
          return diffMinutes <= 0 ? "Just now" : `${diffMinutes}m`;
        }
        return `${diffHours}h`;
      } else if (diffDays === 1) {
        return "1d";
      } else if (diffDays < 7) {
        return `${diffDays}d`;
      } else if (diffDays < 30) {
        const diffWeeks = Math.floor(diffDays / 7);
        return `${diffWeeks}w`;
      } else {
        return postDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Recently";
    }
  };

  // Handle user profile press
  const handleUserPress = () => {
    if (onUserPress && post.userId) {
      onUserPress(post.userId);
    }
  };

  // Handle share functionality
  const handleShare = async () => {
    try {
      if (onSharePress) {
        onSharePress(post);
        return;
      }

      // Default share behavior
      const shareContent =
        post.content.length > 100
          ? `${post.content.substring(0, 100)}...`
          : post.content;

      const shareOptions = {
        message: `Check out this post by ${post.userName} in ${post.communityName}:\n\n"${shareContent}"`,
        title: `Post from ${post.communityName}`,
        ...(post.image && { url: post.image }),
      };

      const result = await Share.share(shareOptions);

      if (result.action === Share.sharedAction) {
        console.log("Post shared successfully");
      }
    } catch (error) {
      console.error("Error sharing post:", error);
      Alert.alert("Error", "Failed to share post. Please try again.");
    }
  };

  // Calculate proper image width
  const imageWidth =
    width - SCREEN_HORIZONTAL_MARGIN * 2 - CONTAINER_HORIZONTAL_PADDING * 2;

  // Handle action button press to prevent event bubbling
  const handleActionPress = (action: () => void) => {
    return (event: any) => {
      event.stopPropagation();
      action();
    };
  };

  // Format counts for display
  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPostPress}
      activeOpacity={0.95}
      accessible={true}
      accessibilityLabel={`Post by ${post.userName} in ${post.communityName}`}
      accessibilityHint="Tap to view full post details"
    >
      {/* Post Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userSection}
          onPress={handleActionPress(handleUserPress)}
          activeOpacity={0.7}
          accessible={true}
          accessibilityLabel={`View ${post.userName}'s profile`}
          accessibilityRole="button"
        >
          <FirebaseImage
            uri={post.userAvatar}
            imageStyle={styles.avatar}
            defaultSource={require("../../assets/default-avatar.png")}
            optimizeSize={{ width: 80, height: 80 }}
            showLoading={false}
            showError={false}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {post.userName}
            </Text>
            <View style={styles.postContext}>
              <Text style={styles.communityName} numberOfLines={1}>
                {post.communityName}
              </Text>
              <Text style={styles.separator}>•</Text>
              <Text style={styles.timeAgo}>
                {formatPostDate(post.createdAt)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* More options button */}
        <TouchableOpacity
          style={styles.moreButton}
          onPress={handleActionPress(() => {
            console.log("More options for post:", post.id);
          })}
          accessible={true}
          accessibilityLabel="More options"
          accessibilityRole="button"
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.content} numberOfLines={10}>
        {post.content}
      </Text>

      {/* Post Image using FirebaseImage */}
      {post.image && (
        <View style={styles.imageContainer}>
          <FirebaseImage
            uri={post.image}
            imageStyle={[styles.image, { width: imageWidth }]}
            containerStyle={styles.imageWrapper}
            optimizeSize={{
              width: Math.floor(imageWidth * 2),
              height: MAX_IMAGE_HEIGHT * 2,
            }}
            resizeMode="cover"
            showLoading={true}
            showError={true}
            placeholder={
              <View style={[styles.imagePlaceholder, { width: imageWidth }]}>
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={COLORS.textSecondary}
                />
                <Text style={styles.imagePlaceholderText}>
                  Loading image...
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          {/* Like Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleActionPress(onLikePress)}
            accessible={true}
            accessibilityLabel={post.isLiked ? "Unlike post" : "Like post"}
            accessibilityRole="button"
          >
            <Ionicons
              name={post.isLiked ? "heart" : "heart-outline"}
              size={22}
              color={post.isLiked ? COLORS.primary : COLORS.textSecondary}
            />
            {post.likes > 0 && (
              <Text
                style={[
                  styles.actionText,
                  post.isLiked && { color: COLORS.primary },
                ]}
              >
                {formatCount(post.likes)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleActionPress(onCommentPress)}
            accessible={true}
            accessibilityLabel={`View ${post.comments} comments`}
            accessibilityRole="button"
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color={COLORS.textSecondary}
            />
            {post.comments > 0 && (
              <Text style={styles.actionText}>
                {formatCount(post.comments)}
              </Text>
            )}
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleActionPress(handleShare)}
            accessible={true}
            accessibilityLabel="Share post"
            accessibilityRole="button"
          >
            <Ionicons
              name="share-social-outline"
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Bookmark Button */}
        <TouchableOpacity
          style={styles.bookmarkButton}
          onPress={handleActionPress(() => {
            console.log("Bookmark post:", post.id);
          })}
          accessible={true}
          accessibilityLabel="Bookmark post"
          accessibilityRole="button"
        >
          <Ionicons
            name="bookmark-outline"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Like summary (if there are likes) */}
      {post.likes > 0 && (
        <View style={styles.likeSummary}>
          <Text style={styles.likeSummaryText}>
            {post.likes === 1 ? "1 like" : `${formatCount(post.likes)} likes`}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
    paddingTop: CONTAINER_HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: COLORS.border,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  postContext: {
    flexDirection: "row",
    alignItems: "center",
  },
  communityName: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "500",
    flexShrink: 1,
  },
  separator: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginHorizontal: 6,
  },
  timeAgo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flexShrink: 0,
  },
  moreButton: {
    padding: 8,
    borderRadius: 20,
  },
  content: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
    marginBottom: 12,
  },
  imageContainer: {
    marginBottom: 12,
  },
  imageWrapper: {
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
  },
  image: {
    height: MAX_IMAGE_HEIGHT,
    borderRadius: 12,
    backgroundColor: COLORS.border,
  },
  imagePlaceholder: {
    height: 120,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 6,
    minHeight: 36,
  },
  bookmarkButton: {
    padding: 8,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
    fontWeight: "500",
  },
  likeSummary: {
    paddingHorizontal: CONTAINER_HORIZONTAL_PADDING,
    paddingBottom: CONTAINER_HORIZONTAL_PADDING,
  },
  likeSummaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
});

// Export as default
export default CommunityPostItem;
