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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// Fixed user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyoNT5R2";

// Define interface for route params
interface RouteParams {
  communityId?: string;
}

// Define adapter function to convert API Community to UI Community
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
  const { communityId: preselectedCommunityId } =
    (route.params as RouteParams) || {};

  const [postContent, setPostContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | undefined>(
    undefined
  );
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(
    undefined
  );
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
  const [uploadProgress, setUploadProgress] = useState(0);

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

  // Enhanced URI to Blob conversion with React Native compatible approach
  const uriToBlob = async (uri: string): Promise<Blob> => {
    console.log("🔄 Converting URI to blob:", uri);

    try {
      // Use fetch API which works better with React Native file URIs
      const response = await fetch(uri);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Received empty blob from image");
      }

      console.log("✅ Blob conversion successful:", {
        size: blob.size,
        type: blob.type,
      });

      return blob;
    } catch (error) {
      console.error("❌ Error converting URI to blob:", error);
      throw new Error(`Failed to convert image: ${error.message}`);
    }
  };

  // Enhanced Firebase upload with better error handling and progress tracking
  const uploadImageToFirebase = async (imageUri: string) => {
    if (!userId) {
      Alert.alert("Error", "You need to be logged in to upload images");
      return;
    }

    console.log("🚀 Starting Firebase upload process");
    console.log("📁 Image URI:", imageUri);
    console.log("👤 User ID:", userId);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Convert URI to blob
      console.log("📤 Step 1: Converting image to blob...");
      const blob = await uriToBlob(imageUri);
      setUploadProgress(20);

      // Step 2: Validate blob
      if (!blob || blob.size === 0) {
        throw new Error("Image blob is empty or invalid");
      }

      if (blob.size > 5 * 1024 * 1024) {
        throw new Error("Image is too large (maximum 5MB allowed)");
      }

      console.log("✅ Blob validation passed:", {
        size: blob.size,
        type: blob.type,
      });
      setUploadProgress(30);

      // Step 3: Generate unique filename (matching current working format)
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const fileName = `post_${timestamp}_${randomSuffix}.jpg`;

      console.log("📝 Generated filename:", fileName);
      setUploadProgress(40);

      // Step 4: Get Firebase Storage instance and create reference
      // Structure: posts/userId/post_timestamp_random.jpg
      const storage = getStorage();
      const imagePath = `posts/${userId}/${fileName}`;
      const imageRef = ref(storage, imagePath);

      console.log("🗂️ Firebase reference created:", imagePath);
      setUploadProgress(50);

      // Step 5: Upload to Firebase Storage
      console.log("⬆️ Starting upload to Firebase Storage...");
      const uploadResult = await uploadBytes(imageRef, blob);

      console.log("✅ Upload completed:", {
        fullPath: uploadResult.metadata.fullPath,
        size: uploadResult.metadata.size,
        bucket: uploadResult.metadata.bucket,
        storagePath: imagePath,
      });
      setUploadProgress(80);

      // Step 6: Get download URL
      console.log("🔗 Getting download URL...");
      const downloadURL = await getDownloadURL(uploadResult.ref);

      console.log("✅ Download URL obtained:", downloadURL);
      setUploadProgress(100);

      // Validate the download URL
      if (
        !downloadURL ||
        !downloadURL.includes("firebasestorage.googleapis.com")
      ) {
        throw new Error("Invalid download URL received from Firebase");
      }

      // Step 7: Set the uploaded URL
      setUploadedImageUrl(downloadURL);

      console.log("🎉 Firebase upload process completed successfully!");
      console.log("🔗 Final URL:", downloadURL);
    } catch (error) {
      console.error("❌ Firebase upload failed:", error);

      // Provide specific error messages
      let errorMessage = "Failed to upload image. Please try again.";

      if (error.message.includes("storage/unauthorized")) {
        errorMessage =
          "Permission denied. Please check your Firebase settings.";
      } else if (error.message.includes("storage/canceled")) {
        errorMessage = "Upload was canceled.";
      } else if (error.message.includes("storage/unknown")) {
        errorMessage = "Unknown storage error occurred.";
      } else if (error.message.includes("Network")) {
        errorMessage = "Network error. Please check your connection.";
      } else if (error.message.includes("timeout")) {
        errorMessage = "Upload timed out. Please try again.";
      }

      Alert.alert("Upload Failed", errorMessage, [
        { text: "OK", onPress: () => removeImage() },
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  // Enhanced Firebase deletion with better error handling
  const deleteImageFromFirebase = async (imageUrl: string) => {
    try {
      if (!imageUrl || !imageUrl.includes("firebasestorage.googleapis.com")) {
        console.log("❌ Invalid URL for deletion:", imageUrl);
        return;
      }

      console.log("🗑️ Attempting to delete from Firebase:", imageUrl);

      // Extract the path from Firebase Storage URL
      const urlParts = imageUrl.split("/o/");
      if (urlParts.length < 2) {
        console.log("❌ Could not parse Firebase URL for deletion");
        return;
      }

      const pathWithQuery = urlParts[1];
      const path = decodeURIComponent(pathWithQuery.split("?")[0]);

      console.log("📁 Extracted path for deletion:", path);

      const storage = getStorage();
      const imageRef = ref(storage, path);

      await deleteObject(imageRef);
      console.log("✅ Image successfully deleted from Firebase Storage");
    } catch (error) {
      console.error("❌ Error deleting image from Firebase:", error);
      // Don't throw error - deletion failure shouldn't block the user
    }
  };

  // Handle image picking with Firebase upload
  const pickImage = async () => {
    try {
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
        quality: 0.8, // Good quality but reasonable file size
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log("📷 Image selected from gallery:", imageUri);

        setSelectedImage(imageUri);
        await uploadImageToFirebase(imageUri);
      }
    } catch (error) {
      console.error("❌ Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  // Handle camera access with Firebase upload
  const takePicture = async () => {
    try {
      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();

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
        quality: 0.8, // Good quality but reasonable file size
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        console.log("📷 Image captured from camera:", imageUri);

        setSelectedImage(imageUri);
        await uploadImageToFirebase(imageUri);
      }
    } catch (error) {
      console.error("❌ Error taking picture:", error);
      Alert.alert("Error", "Failed to take picture. Please try again.");
    }
  };

  // Remove selected image and delete from Firebase if uploaded
  const removeImage = async () => {
    console.log("🗑️ Removing image...");

    // If image was uploaded to Firebase, delete it
    if (uploadedImageUrl) {
      console.log("🗑️ Deleting from Firebase:", uploadedImageUrl);
      await deleteImageFromFirebase(uploadedImageUrl);
    }

    setSelectedImage(undefined);
    setUploadedImageUrl(undefined);
    setUploadProgress(0);

    console.log("✅ Image removed successfully");
  };

  // Enhanced post submission with better validation and error handling
  const handleSubmitPost = async () => {
    console.log("📝 Starting post submission...");

    // Validation
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
      console.log("📤 Submitting post:", {
        communityId: selectedCommunity.id,
        userId: userId,
        hasImage: !!uploadedImageUrl,
        imageUrl: uploadedImageUrl,
      });

      const response = await createPost(
        String(selectedCommunity.id),
        postContent.trim(),
        uploadedImageUrl
      );

      if (response) {
        console.log("✅ Post created successfully:", response.id);

        // Clear form
        setPostContent("");
        setSelectedImage(undefined);
        setUploadedImageUrl(undefined);
        setUploadProgress(0);

        // Navigate back
        navigation.goBack();

        // Show success message
        Alert.alert(
          "Success",
          uploadedImageUrl
            ? "Your post with image has been published!"
            : "Your post has been published!"
        );
      } else {
        throw new Error("No response received from server");
      }
    } catch (error) {
      console.error("❌ Error submitting post:", error);
      Alert.alert(
        "Error",
        "Failed to publish your post. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Clean up uploaded image if user navigates away without posting
  useEffect(() => {
    return () => {
      // Cleanup function when component unmounts
      if (uploadedImageUrl && !isSubmitting) {
        console.log("🧹 Cleaning up uploaded image on unmount");
        deleteImageFromFirebase(uploadedImageUrl).catch(console.error);
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

  // Enhanced image preview with upload status
  const renderImagePreview = () => {
    if (!selectedImage) return null;

    return (
      <View style={styles.imagePreviewContainer}>
        <Image source={{ uri: selectedImage }} style={styles.imagePreview} />

        {/* Upload overlay */}
        {isUploading && (
          <View style={styles.uploadOverlay}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.uploadText}>Uploading to Firebase...</Text>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${uploadProgress}%` }]}
              />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
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
            <Text style={styles.uploadSuccessText}>Uploaded to Firebase</Text>
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

        {/* Debug info */}
        {uploadedImageUrl && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText} numberOfLines={2}>
              Firebase URL: {uploadedImageUrl}
            </Text>
          </View>
        )}
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
          <Text
            style={[
              styles.actionText,
              (!selectedCommunity || isUploading) && {
                color: COLORS.textSecondary,
              },
            ]}
          >
            Gallery
          </Text>
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
          <Text
            style={[
              styles.actionText,
              (!selectedCommunity || isUploading) && {
                color: COLORS.textSecondary,
              },
            ]}
          >
            Camera
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
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "500",
  },
  uploadSuccessIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 16,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  uploadSuccessText: {
    color: COLORS.white,
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "500",
  },
  removeImageButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
  },
  debugInfo: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 4,
    padding: 4,
  },
  debugText: {
    color: COLORS.white,
    fontSize: 10,
    fontFamily: "monospace",
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
    flexDirection: "column",
    alignItems: "center",
    padding: 8,
  },
  actionText: {
    marginTop: 4,
    fontSize: 12,
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
