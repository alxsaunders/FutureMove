// src/components/community/CommunityPostItem.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import { Post } from "../../types";

// Get screen dimensions
const { width } = Dimensions.get("window");
const MAX_IMAGE_HEIGHT = 300;

type CommunityPostItemProps = {
  post: Post;
  onLikePress: () => void;
  onCommentPress: () => void;
  onPostPress: () => void;
};

const CommunityPostItem: React.FC<CommunityPostItemProps> = ({
  post,
  onLikePress,
  onCommentPress,
  onPostPress,
}) => {
  // Format the date for display
  const formatPostDate = (dateString: string) => {
    const postDate = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - postDate.getTime());
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
      return postDate.toLocaleDateString();
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPostPress}
      activeOpacity={0.9}
    >
      {/* Post Header */}
      <View style={styles.header}>
        <Image
          source={{ uri: post.userAvatar }}
          style={styles.avatar}
          defaultSource={require("../../assets/default-avatar.png")}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.userName}>{post.userName}</Text>
          <View style={styles.postContext}>
            <Text style={styles.communityName}>in {post.communityName}</Text>
            <Text style={styles.timeAgo}>
              {" "}
              • {formatPostDate(post.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Post Content */}
      <Text style={styles.content}>{post.content}</Text>

      {/* Post Image (if any) */}
      {post.image && (
        <Image
          source={{ uri: post.image }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Post Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={onLikePress}>
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

        <TouchableOpacity style={styles.actionButton} onPress={onCommentPress}>
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
  },
  headerInfo: {
    flex: 1,
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
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  timeAgo: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  content: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  image: {
    width: width - 32 - 32, // screen width - horizontal margins - container padding
    height: MAX_IMAGE_HEIGHT,
    borderRadius: 8,
    marginBottom: 12,
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
  },
  actionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 6,
  },
});

export default CommunityPostItem;
