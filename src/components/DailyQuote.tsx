import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Assuming you're using Expo
import { COLORS } from "../common/constants/colors";

interface DailyQuoteProps {
  quote?: string;
  author?: string;
  onSave?: () => void;
}

export const DailyQuote: React.FC<DailyQuoteProps> = ({
  quote = "The only way to do great work is to love what you do.",
  author = "Steve Jobs",
  onSave,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.quoteTitle}>Daily Quote:</Text>
      <Text style={styles.quoteText}>{quote}</Text>
      <View style={styles.footer}>
        <Text style={styles.authorText}>— {author}</Text>
        {onSave && (
          <TouchableOpacity style={styles.saveButton} onPress={onSave}>
            <Ionicons
              name="bookmark-outline"
              size={18}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    // Add a subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  quoteTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
    color: COLORS.text,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  authorText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  saveButton: {
    padding: 4,
  },
});

export default DailyQuote;
