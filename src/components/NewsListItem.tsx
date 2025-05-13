import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Image */}
      <View style={styles.imageContainer}>
        <Image
          source={
            news.imageUrl
              ? { uri: news.imageUrl }
              : require("../assets/images/news-placeholder.png")
          }
          style={styles.image}
        />
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
  },
  imageContainer: {
    width: 100,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  summary: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  source: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.primary,
  },
  date: {
    fontSize: 12,
    color: COLORS.textLight,
  },
});

export default NewsListItem;
