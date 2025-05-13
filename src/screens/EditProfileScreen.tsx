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
import { updateUserProfile, ExtendedUserProfile } from "../services/ProfileService";
import { auth } from "../config/firebase"; // Import Firebase auth directly

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  // Remove the onUpdateProfile from params as we'll handle navigation differently
  const { profileData, userId } = route.params as {
    profileData: ExtendedUserProfile,
    userId: string
  };

  const { currentUser } = useAuth();
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);

  // We only allow editing certain fields in the profile
  const [name, setName] = useState(profileData?.name || "");
  const [username, setUsername] = useState(profileData?.username || "");
  const [bio, setBio] = useState(profileData?.bio || "");
  const [location, setLocation] = useState(profileData?.location || "");
  const [website, setWebsite] = useState(profileData?.website || "");

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
      console.log("[EDIT_PROFILE] Editing profile data in both Firebase and MySQL");
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

    if (website.trim() && !isValidUrl(website)) {
      newErrors.website = "Please enter a valid URL (e.g., https://example.com)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      console.log("[EDIT_PROFILE] Saving profile changes to both Firebase and MySQL");
      const userIdToUse = user.uid; // Use direct Firebase auth ID

      // Update profile data in both Firebase and MySQL
      await updateUserProfile(userIdToUse, {
        name,
        username,
        bio,
        location,
        website,
      });

      console.log("[EDIT_PROFILE] Profile updated successfully in all systems");

      // Important: Set isSubmitting to false BEFORE showing the alert
      // This ensures the button is visible if the user cancels the alert
      setIsSubmitting(false);

      Alert.alert(
        "Profile Updated",
        "Your profile has been updated successfully!",
        [{
          text: "OK",
          onPress: () => {
            // Use goBack instead of navigate to prevent navigation stack issues
            navigation.goBack();

            // After a slight delay, pass refresh info to the previous screen via params
            // This approach preserves state better than navigate()
            setTimeout(() => {
              if (navigation.canGoBack()) {
                // If we can directly set params on the parent screen
                try {
                  navigation.getParent()?.setParams({
                    profileUpdated: true,
                    lastUpdated: Date.now()
                  });
                } catch (e) {
                  console.log("[EDIT_PROFILE] Could not set parent params:", e);
                }
              }
            }, 300);
          }
        }]
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

  // Helper function to validate URLs
  const isValidUrl = (urlString: string): boolean => {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
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
          <View style={{ width: 70 }} />
        </View>
        <View style={styles.centeredContainer}>
          <Text style={styles.errorMessage}>Authentication required to edit profile.</Text>
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
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Data indicator */}
          <View style={styles.dataIndicator}>
            <Ionicons name="server" size={16} color={COLORS.primary} />
            <Text style={styles.dataText}>Updating All Profile Data</Text>
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
            {errors.name && (
              <Text style={styles.errorText}>{errors.name}</Text>
            )}
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

          {/* Bio */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.textArea, errors.bio && styles.inputError]}
              value={bio}
              onChangeText={setBio}
              placeholder="Write a little about yourself"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {errors.bio && (
              <Text style={styles.errorText}>{errors.bio}</Text>
            )}
          </View>

          {/* Location */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Location</Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              value={location}
              onChangeText={setLocation}
              placeholder="Your location (e.g., New York, NY)"
              placeholderTextColor={COLORS.textSecondary}
            />
            {errors.location && (
              <Text style={styles.errorText}>{errors.location}</Text>
            )}
          </View>

          {/* Website */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Website</Text>
            <TextInput
              style={[styles.input, errors.website && styles.inputError]}
              value={website}
              onChangeText={setWebsite}
              placeholder="Your website (e.g., https://example.com)"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
            {errors.website && (
              <Text style={styles.errorText}>{errors.website}</Text>
            )}
          </View>

          <Text style={styles.noteText}>
            Note: Profile information is stored in both Firebase and MySQL databases.
          </Text>
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
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  saveButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  dataIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
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
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  textArea: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: COLORS.text,
    height: 100,
  },
  inputError: {
    borderColor: 'red',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  noteText: {
    marginTop: 20,
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
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
    fontWeight: '600',
  },
});

export default EditProfileScreen;