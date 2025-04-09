import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { COLORS } from "../common/constants/colors";

interface ProgressCircleProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  circleColor?: string;
  progressColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
  showGradient?: boolean;
}

export const ProgressCircle: React.FC<ProgressCircleProps> = ({
  progress,
  size = 120,
  strokeWidth = 12,
  circleColor = COLORS.lightBackground,
  progressColor = COLORS.primary,
  gradientStart = COLORS.primary,
  gradientEnd = COLORS.accent1,
  showGradient = true,
}) => {
  // Ensure progress is between 0-100
  const validProgress = Math.min(Math.max(progress, 0), 100);

  // Calculate dimensions
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset =
    circumference - (validProgress / 100) * circumference;

  // Create unique id for the gradient
  const gradientId = `progress-gradient-${Math.random()
    .toString(36)
    .substring(2, 11)}`;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          {showGradient && (
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientStart} />
              <Stop offset="100%" stopColor={gradientEnd} />
            </LinearGradient>
          )}
        </Defs>

        {/* Background Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={circleColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress Circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={showGradient ? `url(#${gradientId})` : progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
          // Remove the style prop that's causing the error
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ProgressCircle;
