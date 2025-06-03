import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { fetchJoinedCommunities } from "../services/CommunityService";
import { createPost } from "../services/CommunityPostService";
import { Community } from "../types";
import { auth } from "../config/firebase";
import ImageService from "../services/ImageService"; // Import our new service

// Fixed user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyoNT5R2";

// Define interface for route params
interface RouteParams {
  communityId?: string;
}

// Define adapter function to convert API Community to UI Community
// Export this function so it can be used in other components
export const adaptCommunity = (apiCommunity: any): Community => {
  return {
    id: apiCommunity.id || apiCommunity.community_id,
    name: apiCommunity.name,
    description: apiCommunity.description || "",
    category: apiCommunity.category || "",
    image: apiCommunity.image_url || apiCommunity.image || "",
    members: apiCommunity.members_count || apiCommunity.members || 0,
    posts: apiCommunity.posts_count || apiCommunity.posts || 0,
    createdBy: apiCommunity.created_by || apiCommunity.createdBy || "",
    isJoined: apiCommunity.is_joined || apiCommunity.isJoined || false,
  };
};

const CreatePostScreen = () => {
  const { currentUser } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  // Properly type the route params
  const { communityId: preselectedCommunityId } =
    (route.params as RouteParams) || {};

  const [postContent, setPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined
  );
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(
    undefined
  ); // Track uploaded URL
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(
    null
  );
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Track upload progress

  // Authentication check effect
  useEffect(() => {
    let resolvedUserId = null;

    if (currentUser && currentUser.id) {
      resolvedUserId = currentUser.id;
      console.log(`User found from AuthContext: ${resolvedUserId}`);
    } else if (auth.currentUser) {
      resolvedUserId = auth.currentUser.uid;
      console.log(`User found from Firebase: ${resolvedUserId}`);
    } else {
      resolvedUserId = FALLBACK_USER_ID;
      console.log(`No user ID found, using fallback: ${FALLBACK_USER_ID}`);
    }

    setUserId(resolvedUserId);
    setAuthChecked(true);
  }, [currentUser]);

  // Fetch joined communities
  const fetchUserCommunities = useCallback(async () => {
    if (!authChecked) return;
    if (!userId) {
      console.log("No user ID resolved, skipping community fetch");
      setCommunities([]);
      setSelectedCommunity(null);
      setIsLoadingCommunities(false);
      return;
    }

    setIsLoadingCommunities(true);
    try {
      console.log(`Fetching joined communities for user ${userId}`);
      const joinedCommunitiesApi = await fetchJoinedCommunities();
      console.log(
        `Retrieved ${joinedCommunitiesApi.length} joined communities`
      );

      if (joinedCommunitiesApi.length === 0) {
        console.log("User hasn't joined any communities");
        setCommunities([]);
        setSelectedCommunity(null);
        setIsLoadingCommunities(false);
        return;
      }

      const adaptedCommunities = joinedCommunitiesApi.map(adaptCommunity);
      setCommunities(adaptedCommunities);

      if (preselectedCommunityId) {
        console.log(
          `Looking for preselected community ID: ${preselectedCommunityId}`
        );
        const preselectedCommunity = adaptedCommunities.find(
          (community) => String(community.id) === String(preselectedCommunityId)
        );

        if (preselectedCommunity) {
          console.log(
            `Found preselected community: ${preselectedCommunity.name}`
          );
          setSelectedCommunity(preselectedCommunity);
        } else {
          console.log("Preselected community not found, using first community");
          setSelectedCommunity(adaptedCommunities[0]);
        }
      } else if (adaptedCommunities.length > 0) {
        console.log(`Setting default community: ${adaptedCommunities[0].name}`);
        setSelectedCommunity(adaptedCommunities[0]);
      }
    } catch (error) {
      console.error("Error fetching joined communities:", error);
      Alert.alert("Error", "Failed to load your communities");
      setCommunities([]);
    } finally {
      setIsLoadingCommunities(false);
    }
  }, [userId, authChecked, preselectedCommunityId]);

  // Initial load
  useEffect(() => {
    if (authChecked) {
      fetchUserCommunities();
    }
  }, [fetchUserCommunities, authChecked]);

  // Handle image picking with Firebase upload
  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to grant permission to access your photos"
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      setSelectedImage(imageUri);

      // Upload image to Firebase Storage
      await uploadImageToFirebase(imageUri);
    }
  };

  // Handle camera access with Firebase upload
  const takePicture = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();

    if (cameraPermission.granted === false) {
      Alert.alert(
        "Permission Required",
        "You need to grant permission to access your camera"
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      setSelectedImage(imageUri);

      // Upload image to Firebase Storage
      await uploadImageToFirebase(imageUri);
    }
  };

  // Upload image to Firebase Storage
  const uploadImageToFirebase = async (imageUri: string) => {
    if (!userId) {
      Alert.alert("Error", "You need to be logged in to upload images");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log("🔄 Starting image upload to Firebase Storage");

      // Validate image first
      await ImageService.validateImage(imageUri);

      // Upload to Firebase Storage
      const downloadURL = await ImageService.uploadImage(
        imageUri,
        "posts", // folder
        userId,
        ImageService.generateUniqueFileName("post")
      );

      setUploadedImageUrl(downloadURL);
      setUploadProgress(100);

      console.log("✅ Image uploaded successfully:", downloadURL);
    } catch (error) {
      console.error("❌ Error uploading image:", error);
      Alert.alert(
        "Upload Failed",
        error.message || "Failed to upload image. Please try again.",
        [{ text: "OK", onPress: () => removeImage() }]
      );
    } finally {
      setIsUploading(false);
    }
  };

  // Remove selected image and delete from Firebase if uploaded
  const removeImage = async () => {
    // If image was uploaded to Firebase, delete it
    if (uploadedImageUrl) {
      try {
        await ImageService.deleteImage(uploadedImageUrl);
        console.log("🗑️ Uploaded image deleted from Firebase Storage");
      } catch (error) {
        console.error("❌ Error deleting image from Firebase:", error);
      }
    }

    setSelectedImage(undefined);
    setUploadedImageUrl(undefined);
    setUploadProgress(0);
  };

  // Submit post with Firebase Storage URL
  const handleSubmitPost = async () => {
    if (!postContent.trim()) {
      Alert.alert("Error", "Please enter some content for your post");
      return;
    }

    if (!selectedCommunity) {
      Alert.alert("Error", "Please select a community to post in");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "You need to be logged in to post");
      return;
    }

    // Check if image is still uploading
    if (isUploading) {
      Alert.alert(
        "Please wait",
        "Image is still uploading. Please wait for it to complete."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      console.log(
        `Creating post in community: ${selectedCommunity.id} as user: ${userId}`
      );

      // Use the uploaded Firebase Storage URL instead of local URI
      const imageUrlToSubmit = uploadedImageUrl || undefined;

      const response = await createPost(
        String(selectedCommunity.id),
        postContent,
        imageUrlToSubmit // This is now a Firebase Storage URL
      );

      if (response) {
        console.log("Post created successfully");

        // Clear form
        setPostContent("");
        setSelectedImage(undefined);
        setUploadedImageUrl(undefined);
        setUploadProgress(0);

        // Navigate back
        navigation.goBack();

        // Show success message
        Alert.alert("Success", "Your post has been published!");
      } else {
        throw new Error("Failed to create post");
      }
    } catch (error) {
      console.error("Error submitting post:", error);
      Alert.alert("Error", "Failed to publish your post. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clean up uploaded image if user navigates away without posting
  useEffect(() => {
    return () => {
      // Cleanup function when component unmounts
      if (uploadedImageUrl && !isSubmitting) {
        // Only delete if we're not in the middle of submitting
        ImageService.deleteImage(uploadedImageUrl).catch(console.error);
      }
    };
  }, [uploadedImageUrl, isSubmitting]);

  // Login required view
  const LoginRequiredView = () => (
    <View style={styles.loginRequiredContainer}>
      <Ionicons name="person-outline" size={60} color={COLORS.textSecondary} />
      <Text style={styles.loginRequiredTitle}>Login Required</Text>
      <Text style={styles.loginRequiredText}>
        You need to be logged in to create posts.
      </Text>
      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => {
          navigation.navigate("Login");
        }}
      >
        <Text style={styles.loginButtonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );

  // Render community selection modal
  const renderCommunityModal = () => (
    <Modal
      visible={showCommunityModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCommunityModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Community</Text>
            <TouchableOpacity onPress={() => setShowCommunityModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {isLoadingCommunities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>
                Loading your communities...
              </Text>
            </View>
          ) : communities.length > 0 ? (
            <FlatList
              data={communities}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.communityItem,
                    selectedCommunity?.id === item.id &&
                      styles.selectedCommunityItem,
                  ]}
                  onPress={() => {
                    setSelectedCommunity(item);
                    setShowCommunityModal(false);
                  }}
                >
                  <Image
                    source={{ uri: item.image || undefined }}
                    style={styles.communityImage}
                    defaultSource={require("../assets/placeholder.png")}
                  />
                  <Text
                    style={[
                      styles.communityName,
                      selectedCommunity?.id === item.id &&
                        styles.selectedCommunityName,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {selectedCommunity?.id === item.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.communityList}
            />
          ) : (
            <View style={styles.emptyCommunityMessage}>
              <Ionicons
                name="people-outline"
                size={40}
                color={COLORS.textSecondary}
              />
              <Text style={styles.emptyCommunityText}>
                You haven't joined any communities yet
              </Text>
              <TouchableOpacity
                style={styles.joinCommunityButton}
                onPress={() => {
                  setShowCommunityModal(false);
                  navigation.navigate("Home");
                }}
              >
                <Text style={styles.joinCommunityButtonText}>
                  Find Communities
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // Render image preview with upload status
  const renderImagePreview = () => {
    if (!selectedImage) return null;

    return (
      <View style={styles.imagePreviewContainer}>
        <Image source={{ uri: selectedImage }} style={styles.imagePreview} />

        {/* Upload overlay */}
        {isUploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.uploadText}>Uploading...</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${uploadProgress}%` }]}
              />
            </View>
          </View>
        )}

        {/* Success indicator */}
        {uploadedImageUrl && !isUploading && (
          <View style={styles.uploadSuccessIndicator}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={COLORS.success}
            />
          </View>
        )}

        {/* Remove button */}
        <TouchableOpacity
          style={styles.removeImageButton}
          onPress={removeImage}
          disabled={isUploading}
        >
          <Ionicons
            name="close-circle"
            size={24}
            color={isUploading ? COLORS.textSecondary : COLORS.white}
          />
        </TouchableOpacity>
      </View>
    );
  };

  // If not authenticated, show login screen
  if (!authChecked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking authentication...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <LoginRequiredView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!postContent.trim() || !selectedCommunity || isUploading) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitPost}
          disabled={
            !postContent.trim() ||
            !selectedCommunity ||
            isSubmitting ||
            isUploading
          }
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentContainer}>
        {/* Community Selection */}
        <TouchableOpacity
          style={styles.communitySelector}
          onPress={() => {
            if (communities.length > 0) {
              setShowCommunityModal(true);
            } else if (!isLoadingCommunities) {
              Alert.alert(
                "No Communities",
                "You need to join a community before posting",
                [
                  {
                    text: "Find Communities",
                    onPress: () => navigation.navigate("Home"),
                  },
                  { text: "Cancel", style: "cancel" },
                ]
              );
            }
          }}
        >
          {isLoadingCommunities ? (
            <View style={styles.selectedCommunityContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[styles.selectCommunityText, { marginLeft: 8 }]}>
                Loading communities...
              </Text>
            </View>
          ) : selectedCommunity ? (
            <View style={styles.selectedCommunityContainer}>
              <Image
                source={{ uri: selectedCommunity.image || undefined }}
                style={styles.selectedCommunityImage}
                defaultSource={require("../assets/placeholder.png")}
              />
              <Text style={styles.selectedCommunityName}>
                {selectedCommunity.name}
              </Text>
            </View>
          ) : (
            <View style={styles.selectedCommunityContainer}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
              <Text style={styles.selectCommunityText}>
                {communities.length > 0
                  ? "Select Community"
                  : "Join a community first"}
              </Text>
            </View>
          )}
          <Ionicons
            name="chevron-down"
            size={20}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>

        {/* Post Content Input */}
        <TextInput
          style={styles.contentInput}
          placeholder={
            selectedCommunity
              ? `Share something with ${selectedCommunity.name}...`
              : "Join a community to start posting..."
          }
          placeholderTextColor={COLORS.textSecondary}
          multiline
          value={postContent}
          onChangeText={setPostContent}
          autoFocus={selectedCommunity !== null}
          editable={selectedCommunity !== null}
        />

        {/* Image Preview with Upload Status */}
        {renderImagePreview()}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={pickImage}
          disabled={!selectedCommunity || isUploading}
        >
          <Ionicons
            name="image"
            size={24}
            color={
              selectedCommunity && !isUploading
                ? COLORS.primary
                : COLORS.textSecondary
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={takePicture}
          disabled={!selectedCommunity || isUploading}
        >
          <Ionicons
            name="camera"
            size={24}
            color={
              selectedCommunity && !isUploading
                ? COLORS.primary
                : COLORS.textSecondary
            }
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          disabled={!selectedCommunity}
        >
          <Ionicons
            name="attach"
            size={24}
            color={selectedCommunity ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          disabled={!selectedCommunity}
        >
          <Ionicons
            name="flag"
            size={24}
            color={selectedCommunity ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.goalText,
              !selectedCommunity && { color: COLORS.textSecondary },
            ]}
          >
            Link Goal
          </Text>
        </TouchableOpacity>
      </View>

      {/* Community Selection Modal */}
      {renderCommunityModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  submitButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  communitySelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedCommunityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectedCommunityImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  selectedCommunityName: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
  },
  selectCommunityText: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.primary,
    marginLeft: 8,
  },
  contentInput: {
    minHeight: 120,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  imagePreviewContainer: {
    position: "relative",
    marginBottom: 16,
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  uploadText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 16,
  },
  progressBar: {
    width: "80%",
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 2,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  uploadSuccessIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 16,
    padding: 4,
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
  },
  goalText: {
    marginLeft: 4,
    fontSize: 14,
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  communityList: {
    padding: 16,
  },
  communityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedCommunityItem: {
    backgroundColor: `${COLORS.primary}15`,
  },
  communityImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  communityName: {
    fontSize: 16,
    color: COLORS.text,
    flex: 1,
  },
  selectedCommunityName: {
    color: COLORS.primary,
    fontWeight: "500",
  },
  loadingContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.textSecondary,
  },
  emptyCommunityMessage: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyCommunityText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  joinCommunityButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  joinCommunityButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  loginRequiredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loginRequiredTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  loginRequiredText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 16,
  },
});

export default CreatePostScreen;
