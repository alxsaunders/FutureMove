// src/components/community/CommunityPostItem.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import { Post } from "../../types";

// Get screen dimensions
const { width } = Dimensions.get("window");
const MAX_IMAGE_HEIGHT = 300;
const CONTAINER_HORIZONTAL_PADDING = 16;
const SCREEN_HORIZONTAL_MARGIN = 16;

type CommunityPostItemProps = {
  post: Post;
  onLikePress: () => void;
  onCommentPress: () => void;
  onPostPress: () => void;
  onSharePress?: (post: Post) => void; // Optional custom share handler
};

const CommunityPostItem: React.FC<CommunityPostItemProps> = ({
  post,
  onLikePress,
  onCommentPress,
  onPostPress,
  onSharePress,
}) => {
  const [imageError, setImageError] = useState(false);

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
          return diffMinutes <= 0 ? "Just now" : `${diffMinutes} min ago`;
        }
        return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
      } else {
        return postDate.toLocaleDateString();
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Recently";
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
      const shareOptions = {
        message: `Check out this post by ${post.userName} in ${post.communityName}: ${post.content}`,
        title: `Post from ${post.communityName}`,
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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPostPress}
      activeOpacity={0.9}
      accessible={true}
      accessibilityLabel={`Post by ${post.userName} in ${post.communityName}`}
      accessibilityHint="Tap to view full post details"
    >
      {/* Post Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: post.userAvatar }}
          style={styles.avatar}
          defaultSource={require("../../assets/default-avatar.png")}
          onError={() =>
            console.log("Avatar failed to load for:", post.userName)
          }
        />
        <View style={styles.headerInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {post.userName}
          </Text>
          <View style={styles.postContext}>
            <Text style={styles.communityName} numberOfLines={1}>
              in {post.communityName}
            </Text>
            <Text style={styles.timeAgo}>
              {" "}
              • {formatPostDate(post.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Post Content */}
      <Text style={styles.content} numberOfLines={10}>
        {post.content}
      </Text>

      {/* Post Image (if any) */}
      {post.image && !imageError && (
        <Image
          source={{ uri: post.image }}
          style={[styles.image, { width: imageWidth }]}
          resizeMode="cover"
          onError={(error) => {
            console.error(
              "Post image failed to load:",
              error.nativeEvent.error
            );
            setImageError(true);
          }}
          onLoad={() => setImageError(false)}
        />
      )}

      {/* Show placeholder if image failed to load */}
      {post.image && imageError && (
        <View style={[styles.imagePlaceholder, { width: imageWidth }]}>
          <Ionicons
            name="image-outline"
            size={40}
            color={COLORS.textSecondary}
          />
          <Text style={styles.imagePlaceholderText}>Image unavailable</Text>
        </View>
      )}

      {/* Post Actions */}
      <View style={styles.actions}>
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
          <Text style={styles.actionText}>{post.comments}</Text>
        </TouchableOpacity>

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
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    padding: CONTAINER_HORIZONTAL_PADDING,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Ensure the container is properly touchable
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: COLORS.border, // Fallback background
  },
  headerInfo: {
    flex: 1,
    minWidth: 0, // Allows text to truncate properly
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
    flexWrap: "wrap", // Allow wrapping if needed
  },
  communityName: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
    flexShrink: 1, // Allow shrinking if needed
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flexShrink: 0, // Don't shrink the time
  },
  content: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  image: {
    height: MAX_IMAGE_HEIGHT,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: COLORS.border, // Fallback background while loading
  },
  imagePlaceholder: {
    height: 120,
    borderRadius: 8,
    marginBottom: 12,
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
    justifyContent: "flex-start",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
    paddingVertical: 4, // Make touch target bigger
    paddingHorizontal: 4,
    borderRadius: 4,
    // Ensure buttons are properly touchable
    minHeight: 32,
    minWidth: 32,
  },
  actionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
});

export default CommunityPostItem;
