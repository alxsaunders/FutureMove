import React from "react";
import { View, StyleSheet, FlatList } from "react-native";
import { RoutineListItem } from "./RoutineListItem";
import { Routine } from "../types";

interface RoutinesListProps {
  routines: Routine[];
  onItemPress?: (routine: Routine) => void;
}

export const RoutinesList: React.FC<RoutinesListProps> = ({
  routines,
  onItemPress,
}) => {
  return (
    <View style={styles.container}>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <RoutineListItem
            routine={item}
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
    height: 8,
  },
  listContent: {
    paddingVertical: 4,
  },
});

export default RoutinesList;
