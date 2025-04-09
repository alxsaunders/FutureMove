import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { COLORS } from "../common/constants/colors";
import { Routine } from "../types";

interface RoutineListItemProps {
  routine: Routine;
  onPress?: () => void;
}

export const RoutineListItem: React.FC<RoutineListItemProps> = ({
  routine,
  onPress,
}) => {
  // Calculate the completion percentage
  const completionPercentage =
    (routine.completedTasks / (routine.totalTasks || 1)) * 100;

  // Determine status color based on completion
  const getStatusColor = () => {
    if (completionPercentage === 100) return COLORS.success;
    if (completionPercentage >= 50) return COLORS.warning;
    return COLORS.danger;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon or Image */}
      <View style={styles.iconContainer}>
        <Image
          source={
            routine.icon
              ? { uri: routine.icon }
              : require("../assets/images/routine-default.png")
          }
          style={styles.icon}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {routine.title}
        </Text>

        <View style={styles.detailsRow}>
          <Text style={styles.schedule}>{routine.frequency}</Text>

          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${completionPercentage}%`,
                  backgroundColor: getStatusColor(),
                },
              ]}
            />
          </View>

          <Text style={styles.progressText}>
            {routine.completedTasks}/{routine.totalTasks}
          </Text>
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
    padding: 12,
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.lightBackground,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  schedule: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.lightBackground,
    borderRadius: 2,
    overflow: "hidden",
    marginRight: 8,
  },
  progressBar: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

export default RoutineListItem;
