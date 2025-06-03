// src/components/common/FirebaseImage.tsx
import React, { useState, useEffect } from "react";
import {
  Image,
  View,
  ActivityIndicator,
  StyleSheet,
  ImageProps,
  ImageStyle,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";
import ImageService from "../../services/ImageService";

interface FirebaseImageProps extends Omit<ImageProps, "source"> {
  // Firebase Storage URL or regular URL
  uri?: string;
  // Fallback image for when no URI is provided
  defaultSource?: any;
  // Placeholder to show while loading
  placeholder?: React.ReactNode;
  // Style for the container
  containerStyle?: ViewStyle;
  // Style for the image
  imageStyle?: ImageStyle;
  // Optimize image size (requires Firebase Extensions)
  optimizeSize?: { width: number; height: number };
  // Show loading indicator
  showLoading?: boolean;
  // Show error state
  showError?: boolean;
  // Callback for load events
  onLoadStart?: () => void;
  onLoadEnd?: () => void;
  onError?: (error: any) => void;
}

const FirebaseImage: React.FC<FirebaseImageProps> = ({
  uri,
  defaultSource,
  placeholder,
  containerStyle,
  imageStyle,
  optimizeSize,
  showLoading = true,
  showError = true,
  onLoadStart,
  onLoadEnd,
  onError,
  style,
  ...imageProps
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [imageUri, setImageUri] = useState<string | undefined>(uri);

  // Process URI when it changes
  useEffect(() => {
    if (uri) {
      processImageUri(uri);
    } else {
      setImageUri(undefined);
      setLoading(false);
      setError(false);
    }
  }, [uri, optimizeSize]);

  const processImageUri = (originalUri: string) => {
    try {
      // Reset states
      setError(false);
      setLoading(true);

      let processedUri = originalUri;

      // Optimize Firebase Storage images if requested
      if (optimizeSize && ImageService.isFirebaseStorageUrl(originalUri)) {
        processedUri = ImageService.getOptimizedImageUrl(
          originalUri,
          optimizeSize.width,
          optimizeSize.height
        );
      }

      setImageUri(processedUri);
    } catch (err) {
      console.error("Error processing image URI:", err);
      setError(true);
      setLoading(false);
    }
  };

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
    onLoadStart?.();
  };

  const handleLoadEnd = () => {
    setLoading(false);
    onLoadEnd?.();
  };

  const handleError = (errorEvent: any) => {
    console.error("Image load error:", errorEvent.nativeEvent?.error);
    setLoading(false);
    setError(true);
    onError?.(errorEvent);
  };

  const renderPlaceholder = () => {
    if (placeholder) {
      return placeholder;
    }

    return (
      <View style={[styles.defaultPlaceholder, imageStyle]}>
        <Ionicons name="image-outline" size={24} color={COLORS.textSecondary} />
      </View>
    );
  };

  const renderLoadingIndicator = () => (
    <View style={[styles.loadingContainer, imageStyle]}>
      <ActivityIndicator size="small" color={COLORS.primary} />
    </View>
  );

  const renderErrorState = () => (
    <View style={[styles.errorContainer, imageStyle]}>
      <Ionicons
        name="alert-circle-outline"
        size={24}
        color={COLORS.textSecondary}
      />
    </View>
  );

  // If no URI provided, show placeholder or default source
  if (!imageUri) {
    if (defaultSource) {
      return (
        <View style={containerStyle}>
          <Image
            source={defaultSource}
            style={[style, imageStyle]}
            {...imageProps}
          />
        </View>
      );
    }

    return <View style={containerStyle}>{renderPlaceholder()}</View>;
  }

  return (
    <View style={containerStyle}>
      <Image
        source={{ uri: imageUri }}
        style={[style, imageStyle]}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        {...imageProps}
      />

      {/* Loading overlay */}
      {loading && showLoading && (
        <View style={styles.overlay}>{renderLoadingIndicator()}</View>
      )}

      {/* Error overlay */}
      {error && showError && (
        <View style={styles.overlay}>{renderErrorState()}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  defaultPlaceholder: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  loadingContainer: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  errorContainer: {
    backgroundColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 8,
  },
});

export default FirebaseImage;
