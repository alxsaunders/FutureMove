import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { Goal } from "../types";

interface GoalListItemProps {
  goal: Goal;
  onPress: () => void;
  onToggleCompletion: () => void;
}

export const GoalListItem: React.FC<GoalListItemProps> = ({
  goal,
  onPress,
  onToggleCompletion,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.container,
        goal.isCompleted ? styles.completedContainer : {},
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, goal.isCompleted ? styles.completedText : {}]}
            numberOfLines={2}
          >
            {goal.title}
          </Text>
          {goal.category && (
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: goal.color || COLORS.primary },
              ]}
            >
              <Text style={styles.categoryText}>{goal.category}</Text>
            </View>
          )}
        </View>

        {goal.description && (
          <Text
            style={[
              styles.description,
              goal.isCompleted ? styles.completedText : {},
            ]}
            numberOfLines={2}
          >
            {goal.description}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.checkButton,
          goal.isCompleted ? styles.completedCheckButton : {},
        ]}
        onPress={onToggleCompletion}
      >
        {goal.isCompleted ? (
          <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
        ) : (
          <Ionicons name="ellipse-outline" size={28} color={COLORS.textLight} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: COLORS.cardBackground,
    borderRadius: 10,
    padding: 12,
    marginVertical: 4,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  completedContainer: {
    borderLeftColor: COLORS.success,
    backgroundColor: COLORS.lightBackground,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  completedText: {
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 4,
  },
  categoryText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  checkButton: {
    padding: 5,
    marginLeft: 8,
  },
  completedCheckButton: {
    opacity: 0.9,
  },
});

export default GoalListItem;
