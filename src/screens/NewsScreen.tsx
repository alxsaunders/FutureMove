import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  FlatList,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { News } from "../types";
import {
  fetchNews,
  fetchNewsByCategory,
  searchNews,
  NEWS_CATEGORIES,
} from "../services/NewsService";
import { NewsListItem } from "../components/NewsListItem";

interface NewsScreenProps {
  navigation: any;
  route?: {
    params?: {
      selectedNews?: News;
    };
  };
}

const { width } = Dimensions.get("window");

const NewsScreen: React.FC<NewsScreenProps> = ({ navigation, route }) => {
  const [selectedNews, setSelectedNews] = useState<News | null>(
    route?.params?.selectedNews || null
  );
  const [allNews, setAllNews] = useState<News[]>([]);
  const [filteredNews, setFilteredNews] = useState<News[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // State for category scroll
  const [categoryScrollIndex, setCategoryScrollIndex] = useState(0);
  const categoryListRef = useRef<FlatList>(null);

  // Category scroll functions
  const scrollCategoriesLeft = () => {
    if (categoryScrollIndex > 0) {
      const newIndex = Math.max(0, categoryScrollIndex - 1);
      setCategoryScrollIndex(newIndex);
      categoryListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
    }
  };

  const scrollCategoriesRight = () => {
    const categories = ["all", ...NEWS_CATEGORIES];
    if (categoryScrollIndex < categories.length - 1) {
      const newIndex = Math.min(categories.length - 1, categoryScrollIndex + 1);
      setCategoryScrollIndex(newIndex);
      categoryListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
    }
  };

  // Load news data
  const loadNews = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const newsData = await fetchNews(8); // Reduced from 50 to 8 articles
      setAllNews(newsData);
      setFilteredNews(newsData);
    } catch (error) {
      console.error("Error loading news:", error);
      Alert.alert("Error", "Failed to load news. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter news by category
  const filterByCategory = async (category: string) => {
    setSelectedCategory(category);
    setLoading(true);

    try {
      if (category === "all") {
        setFilteredNews(allNews);
      } else {
        const categoryNews = await fetchNewsByCategory(category, 1); // Limit to 1 article per category
        setFilteredNews(categoryNews);
      }
    } catch (error) {
      console.error("Error filtering news:", error);
      setFilteredNews(allNews);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Open news article in browser
  const openArticle = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Cannot open this URL");
      }
    } catch (error) {
      console.error("Error opening URL:", error);
      Alert.alert("Error", "Failed to open article");
    }
  };

  // Handle news item press
  const handleNewsPress = (news: News) => {
    setSelectedNews(news);
  };

  // Handle back button
  const handleBack = () => {
    if (selectedNews) {
      setSelectedNews(null);
    } else {
      navigation.goBack();
    }
  };

  // Load initial data
  useEffect(() => {
    loadNews();
  }, []);

  // Render category filter with scroll buttons
  const renderCategoryFilter = () => {
    const categories = ["all", ...NEWS_CATEGORIES];

    return (
      <View style={styles.categoryContainer}>
        <View style={styles.categoryScrollContainer}>
          {/* Left scroll button */}
          <TouchableOpacity
            style={[
              styles.categoryScrollButton,
              styles.categoryScrollButtonLeft,
            ]}
            onPress={scrollCategoriesLeft}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <FlatList
            ref={categoryListRef}
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.categoryButton,
                  selectedCategory === item && styles.categoryButtonActive,
                ]}
                onPress={() => filterByCategory(item)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === item &&
                      styles.categoryButtonTextActive,
                  ]}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.categoryList}
            onScrollToIndexFailed={(info) => {
              // Handle scroll to index failure
              setTimeout(() => {
                categoryListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: true,
                });
              }, 100);
            }}
          />

          {/* Right scroll button */}
          <TouchableOpacity
            style={[
              styles.categoryScrollButton,
              styles.categoryScrollButtonRight,
            ]}
            onPress={scrollCategoriesRight}
          >
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render news list
  const renderNewsList = () => (
    <FlatList
      data={filteredNews}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <NewsListItem news={item} onPress={() => handleNewsPress(item)} />
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadNews(true)}
          colors={[COLORS.primary]}
        />
      }
      ListEmptyComponent={() => (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="newspaper-outline"
            size={48}
            color={COLORS.textSecondary}
          />
          <Text style={styles.emptyText}>No news articles found</Text>
        </View>
      )}
    />
  );

  // Render detailed news view
  const renderNewsDetail = () => {
    if (!selectedNews) return null;

    return (
      <ScrollView
        style={styles.detailContainer}
        contentContainerStyle={styles.detailContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNews(true)}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* News Image */}
        <View style={styles.imageContainer}>
          <Image
            source={
              selectedNews.imageUrl
                ? { uri: selectedNews.imageUrl }
                : require("../assets/images/news-placeholder.png")
            }
            style={styles.detailImage}
          />
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {selectedNews.category}
            </Text>
          </View>
        </View>

        {/* News Content */}
        <View style={styles.contentContainer}>
          <Text style={styles.detailTitle}>{selectedNews.title}</Text>

          <View style={styles.metaContainer}>
            <Text style={styles.source}>{selectedNews.source}</Text>
            <Text style={styles.date}>
              {formatDate(selectedNews.timestamp)}
            </Text>
          </View>

          <Text style={styles.summary}>{selectedNews.summary}</Text>

          {/* Read Full Article Button */}
          <TouchableOpacity
            style={styles.readFullButton}
            onPress={() => openArticle(selectedNews.url)}
          >
            <Ionicons name="open-outline" size={20} color={COLORS.white} />
            <Text style={styles.readFullButtonText}>Read Full Article</Text>
          </TouchableOpacity>

          {/* Related News Section */}
          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>
              More from {selectedNews.category}
            </Text>
            {filteredNews
              .filter(
                (news) =>
                  news.id !== selectedNews.id &&
                  news.category === selectedNews.category
              )
              .slice(0, 3)
              .map((news) => (
                <TouchableOpacity
                  key={news.id}
                  style={styles.relatedItem}
                  onPress={() => setSelectedNews(news)}
                >
                  <Text style={styles.relatedItemTitle} numberOfLines={2}>
                    {news.title}
                  </Text>
                  <Text style={styles.relatedItemSource}>{news.source}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <ImageBackground
      source={require("../assets/images/futuremove-bg.jpg")}
      style={styles.backgroundImage}
      imageStyle={styles.backgroundImageStyle}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.backgroundOverlay} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons
              name={selectedNews ? "arrow-back" : "close"}
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {selectedNews ? "Article" : "News"}
          </Text>

          <View style={styles.headerRight}>
            {selectedNews && (
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => openArticle(selectedNews.url)}
              >
                <Ionicons name="share-outline" size={24} color={COLORS.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Content */}
        {selectedNews ? (
          renderNewsDetail()
        ) : (
          <View style={styles.newsListContainer}>
            {renderCategoryFilter()}

            {loading && !refreshing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.loadingText}>Loading news...</Text>
              </View>
            ) : (
              renderNewsList()
            )}
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  backgroundImageStyle: {
    opacity: 0.4,
  },
  backgroundOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  headerRight: {
    width: 40,
    alignItems: "flex-end",
  },
  shareButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  newsListContainer: {
    flex: 1,
  },
  categoryContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoryScrollContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryScrollButton: {
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryScrollButtonLeft: {
    marginLeft: 16,
  },
  categoryScrollButtonRight: {
    marginRight: 16,
  },
  categoryList: {
    paddingHorizontal: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 20,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
  },
  categoryButtonTextActive: {
    color: COLORS.white,
  },
  listContent: {
    padding: 16,
  },
  separator: {
    height: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  detailContainer: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 32,
  },
  imageContainer: {
    position: "relative",
    height: 250,
  },
  detailImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },
  contentContainer: {
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    margin: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
    lineHeight: 32,
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  source: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.text,
    marginBottom: 24,
  },
  readFullButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  readFullButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  relatedSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 20,
  },
  relatedTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 16,
  },
  relatedItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(0, 0, 0, 0.02)",
    borderRadius: 8,
    marginBottom: 8,
  },
  relatedItemTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  relatedItemSource: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

export default NewsScreen;
