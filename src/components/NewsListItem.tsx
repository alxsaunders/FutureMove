import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { News } from "../types";

interface NewsListItemProps {
  news: News;
  onPress?: () => void;
}

export const NewsListItem: React.FC<NewsListItemProps> = ({
  news,
  onPress,
}) => {
  // Format the timestamp to a readable date
  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Render news image with fallback
  const renderNewsImage = () => {
    if (news.imageUrl && news.imageUrl.trim() !== "") {
      return (
        <Image
          source={{ uri: news.imageUrl }}
          style={styles.image}
          onError={() => {
            console.log("Failed to load news image:", news.imageUrl);
          }}
          defaultSource={require("../assets/images/news-placeholder.png")}
        />
      );
    }
    return renderPlaceholderImage();
  };

  // Render placeholder when no image is available
  const renderPlaceholderImage = () => (
    <View style={[styles.image, styles.placeholderImage]}>
      <View style={styles.placeholderContent}>
        <Ionicons name="newspaper" size={24} color={COLORS.white} />
        <Text style={styles.placeholderText}>News</Text>
      </View>
    </View>
  );

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        {renderNewsImage()}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{news.category}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {news.title}
        </Text>

        <Text style={styles.summary} numberOfLines={2}>
          {news.summary}
        </Text>

        <View style={styles.footer}>
          <Text style={styles.source}>{news.source}</Text>
          <Text style={styles.date}>{formatDate(news.timestamp)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  imageContainer: {
    width: 100,
    height: 100, // Fixed height for consistency
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  placeholderImage: {
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
  },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  categoryText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 6,
    lineHeight: 22,
  },
  summary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  source: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: "500",
  },
});

export default NewsListItem;
