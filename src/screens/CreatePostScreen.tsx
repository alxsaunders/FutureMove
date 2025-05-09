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
  ); // Changed null to undefined
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(
    null
  );
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(true);

  // Fetch joined communities
  const fetchUserCommunities = useCallback(async () => {
    if (!currentUser) return;

    setIsLoadingCommunities(true);
    try {
      console.log("Fetching joined communities for user");
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

      // Convert API communities to UI communities
      const adaptedCommunities = joinedCommunitiesApi.map(adaptCommunity);
      setCommunities(adaptedCommunities);

      // If a community ID was passed as a parameter, select that community
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
          // Set default community if preselected not found
          setSelectedCommunity(adaptedCommunities[0]);
        }
      } else if (adaptedCommunities.length > 0) {
        // No preselected community, use the first one
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
  }, [currentUser, preselectedCommunityId]);

  // Initial load
  useEffect(() => {
    fetchUserCommunities();
  }, [fetchUserCommunities]);

  // Handle image picking
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

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // Handle camera access
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

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  // Remove selected image
  const removeImage = () => {
    setSelectedImage(undefined); // Changed null to undefined
  };

  // Submit post
  const handleSubmitPost = async () => {
    if (!postContent.trim()) {
      Alert.alert("Error", "Please enter some content for your post");
      return;
    }

    if (!selectedCommunity) {
      Alert.alert("Error", "Please select a community to post in");
      return;
    }

    setIsSubmitting(true);

    try {
      console.log(`Creating post in community: ${selectedCommunity.id}`);
      const response = await createPost(
        String(selectedCommunity.id),
        postContent,
        selectedImage
      );

      if (response) {
        console.log("Post created successfully");

        // Clear form
        setPostContent("");
        setSelectedImage(undefined); // Changed null to undefined

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
                  {/* Fixed Image source prop */}
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
                  // Changed string navigation to use proper screen name
                  navigation.navigate("Home"); // Update this to your actual screen name
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
            (!postContent.trim() || !selectedCommunity) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmitPost}
          disabled={!postContent.trim() || !selectedCommunity || isSubmitting}
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
              // If no communities and not loading, redirect to find communities
              Alert.alert(
                "No Communities",
                "You need to join a community before posting",
                [
                  {
                    text: "Find Communities",
                    onPress: () => navigation.navigate("Home"), // Update this to your actual screen name
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
              {/* Fixed Image source prop */}
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

        {/* Selected Image Preview */}
        {selectedImage && (
          <View style={styles.imagePreviewContainer}>
            <Image
              source={{ uri: selectedImage }}
              style={styles.imagePreview}
            />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={removeImage}
            >
              <Ionicons name="close-circle" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={pickImage}
          disabled={!selectedCommunity}
        >
          <Ionicons
            name="image"
            size={24}
            color={selectedCommunity ? COLORS.primary : COLORS.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={takePicture}
          disabled={!selectedCommunity}
        >
          <Ionicons
            name="camera"
            size={24}
            color={selectedCommunity ? COLORS.primary : COLORS.textSecondary}
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
    paddingBottom: 30, // Extra padding for bottom safe area
    maxHeight: "70%", // Limit modal height
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
});

export default CreatePostScreen;
