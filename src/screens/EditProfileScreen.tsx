// src/screens/EditProfileScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import {
  updateUserProfile,
  ExtendedUserProfile,
} from "../services/ProfileService";
import { auth } from "../config/firebase"; // Import Firebase auth directly

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { profileData, userId } = route.params as {
    profileData: ExtendedUserProfile;
    userId: string;
  };

  const { currentUser } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);

  // Only name and username are saved in the database
  const [name, setName] = useState(profileData?.name || "");
  const [username, setUsername] = useState(profileData?.username || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if the user is authenticated on mount
    const user = auth.currentUser;
    setFirebaseUser(user);

    if (!user) {
      console.log("[EDIT_PROFILE] No Firebase user found");
      Alert.alert(
        "Authentication Required",
        "You must be logged in to edit your profile",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } else {
      console.log("[EDIT_PROFILE] Firebase user authenticated:", user.uid);
      console.log("[EDIT_PROFILE] Editing name and username in database");
    }

    // Set up an auth state change listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      if (!user) {
        console.log("[EDIT_PROFILE] User signed out during edit");
        Alert.alert(
          "Session Expired",
          "Your login session has expired. Please log in again.",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  const handleSave = async () => {
    // First check Firebase auth directly
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Error", "You must be logged in to edit your profile");
      return;
    }

    // Validate fields
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!username.trim()) {
      newErrors.username = "Username is required";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("[EDIT_PROFILE] Saving name and username to database");
      const userIdToUse = user.uid; // Use direct Firebase auth ID

      // Update only name and username in the database
      await updateUserProfile(userIdToUse, {
        name,
        username,
      });

      console.log("[EDIT_PROFILE] Profile updated successfully");

      // Important: Set isSubmitting to false BEFORE showing the alert
      setIsSubmitting(false);

      Alert.alert(
        "Profile Updated",
        "Your name and username have been updated successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              navigation.goBack();

              // After a slight delay, pass refresh info to the previous screen
              setTimeout(() => {
                if (navigation.canGoBack()) {
                  try {
                    navigation.getParent()?.setParams({
                      profileUpdated: true,
                      lastUpdated: Date.now(),
                    });
                  } catch (e) {
                    console.log(
                      "[EDIT_PROFILE] Could not set parent params:",
                      e
                    );
                  }
                }
              }, 300);
            },
          },
        ]
      );
    } catch (error) {
      console.error("[EDIT_PROFILE] Error updating profile:", error);
      Alert.alert(
        "Update Error",
        "Failed to update your profile. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no Firebase user, don't render the form content
  if (!firebaseUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorMessage}>
            Authentication required to edit profile.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Data indicator */}
          <View style={styles.dataIndicator}>
            <Ionicons name="person" size={16} color={COLORS.primary} />
            <Text style={styles.dataText}>Edit Profile Info</Text>
          </View>

          {/* Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="words"
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Username */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>
            <TextInput
              style={[styles.input, errors.username && styles.inputError]}
              value={username}
              onChangeText={setUsername}
              placeholder="Your username"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
            />
            {errors.username && (
              <Text style={styles.errorText}>{errors.username}</Text>
            )}
          </View>

          {/* Centered Save Button */}
          <View style={styles.saveButtonContainer}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                isSubmitting && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={20} color={COLORS.white} />
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

         
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  dataIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  dataText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primary,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 2,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  saveButtonContainer: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 180,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  noteText: {
    fontSize: 14,
    fontStyle: "italic",
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
});

export default EditProfileScreen;
