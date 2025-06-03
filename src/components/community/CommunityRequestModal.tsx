// src/components/community/CommunityRequestModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import CommunityRequestService from "../../services/CommunityRequestService";

interface CommunityRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CommunityRequestModal: React.FC<CommunityRequestModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    communityName: "",
    description: "",
    category: "General",
    reason: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [charCounts, setCharCounts] = useState({
    communityName: 0,
    description: 0,
    reason: 0,
  });

  const categories = CommunityRequestService.getAvailableCategories();

  // Update character counts when form data changes
  useEffect(() => {
    setCharCounts({
      communityName: formData.communityName.length,
      description: formData.description.length,
      reason: formData.reason.length,
    });
  }, [formData]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setFormData({
        communityName: "",
        description: "",
        category: "General",
        reason: "",
      });
      setErrors([]);
    }
  }, [visible]);

  // Handle form input changes
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setErrors([]);

      // Check rate limit first
      const rateLimitCheck = await CommunityRequestService.checkRateLimit();
      if (!rateLimitCheck.canSubmit) {
        Alert.alert(
          "Request Limit Reached",
          rateLimitCheck.reason ||
            "You have reached the daily request limit. Please try again tomorrow.",
          [{ text: "OK" }]
        );
        return;
      }

      // Validate form data
      const validation = CommunityRequestService.validateRequestData(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      // Submit the request
      const result = await CommunityRequestService.submitCommunityRequest(
        formData
      );

      if (result.success) {
        Alert.alert(
          "Request Submitted",
          "Your community request has been submitted successfully. We will review it and get back to you soon!",
          [
            {
              text: "OK",
              onPress: () => {
                onSuccess?.();
                onClose();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Submission Failed",
          result.message || "Failed to submit your request. Please try again.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error submitting community request:", error);
      Alert.alert("Error", "An unexpected error occurred. Please try again.", [
        { text: "OK" },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render category selector
  const renderCategorySelector = () => (
    <View style={styles.sectionContainer}>
      <Text style={styles.label}>Category *</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScrollView}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              formData.category === category.id && styles.selectedCategoryChip,
            ]}
            onPress={() => handleInputChange("category", category.id)}
          >
            <Text
              style={[
                styles.categoryChipText,
                formData.category === category.id &&
                  styles.selectedCategoryChipText,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Request New Community</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.formContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Community Name */}
            <View style={styles.sectionContainer}>
              <Text style={styles.label}>Community Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter community name..."
                value={formData.communityName}
                onChangeText={(value) =>
                  handleInputChange("communityName", value)
                }
                maxLength={255}
                editable={!isSubmitting}
              />
              <Text style={styles.charCount}>
                {charCounts.communityName}/255
              </Text>
            </View>

            {/* Category */}
            {renderCategorySelector()}

            {/* Description */}
            <View style={styles.sectionContainer}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Describe what this community is about..."
                value={formData.description}
                onChangeText={(value) =>
                  handleInputChange("description", value)
                }
                multiline
                numberOfLines={4}
                maxLength={1000}
                editable={!isSubmitting}
              />
              <Text style={styles.charCount}>
                {charCounts.description}/1000
              </Text>
            </View>

            {/* Reason */}
            <View style={styles.sectionContainer}>
              <Text style={styles.label}>Why is this community needed? *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Explain why this community would be valuable..."
                value={formData.reason}
                onChangeText={(value) => handleInputChange("reason", value)}
                multiline
                numberOfLines={4}
                maxLength={1000}
                editable={!isSubmitting}
              />
              <Text style={styles.charCount}>{charCounts.reason}/1000</Text>
            </View>

            {/* Errors */}
            {errors.length > 0 && (
              <View style={styles.errorContainer}>
                {errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    • {error}
                  </Text>
                ))}
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle"
                size={20}
                color={COLORS.primary}
              />
              <Text style={styles.infoText}>
                Your request will be reviewed by our team. We'll notify you once
                it's processed.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    minHeight: "60%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  formContainer: {
    flex: 1,
    padding: 20,
  },
  sectionContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.cardBackground,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },
  categoryScrollView: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  selectedCategoryChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: COLORS.text,
  },
  selectedCategoryChipText: {
    color: COLORS.white,
    fontWeight: "500",
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    marginBottom: 4,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    marginLeft: 8,
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    marginLeft: 8,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.white,
  },
});

export default CommunityRequestModal;
