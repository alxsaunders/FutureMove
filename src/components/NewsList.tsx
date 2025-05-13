import React from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { NewsListItem } from "./NewsListItem";
import { News } from "../types";

interface NewsListProps {
  news: News[];
  onItemPress?: (news: News) => void;
}

export const NewsList: React.FC<NewsListProps> = ({ news, onItemPress }) => {
  return (
    <View style={styles.container}>
      <FlatList
        data={news}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <NewsListItem
            news={item}
            onPress={() => onItemPress && onItemPress(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false} // Disable scrolling within this component since it's in a ScrollView
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
  },
  separator: {
    height: 12,
  },
  listContent: {
    paddingVertical: 4,
  },
});

export default NewsList;
