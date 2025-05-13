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

const EditProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { profileData, onUpdateProfile } = route.params as { 
    profileData: ExtendedUserProfile,
    onUpdateProfile: () => Promise<void>
  };
  const { currentUser } = useAuth();
  
  // We only allow editing certain fields in the profile
  const [name, setName] = useState(profileData?.name || "");
  const [username, setUsername] = useState(profileData?.username || "");
  const [bio, setBio] = useState(profileData?.bio || "");
  const [location, setLocation] = useState(profileData?.location || "");
  const [website, setWebsite] = useState(profileData?.website || "");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    if (!currentUser) {
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
      // Update profile data in Firestore
      await updateUserProfile(currentUser.id, {
        name,
        username,
        bio,
        location,
        website,
      });
      
      // Call the callback function to refresh profile data on the previous screen
      if (onUpdateProfile) {
        onUpdateProfile();
      }
      
      // Note: In a real app, you would also update the basic user profile in MySQL
      // For now, we're just storing extended profile data in Firestore
      
      Alert.alert("Success", "Profile updated successfully!");
      navigation.goBack();
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
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
            Note: Some profile information may require verification or may be synced with your account settings.
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
});

export default EditProfileScreen;