// src/components/common/FirebaseImage.tsx
import React, { useState } from "react";
import {
  Image,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ImageStyle,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../common/constants/colors";

interface FirebaseImageProps {
  uri?: string;
  imageStyle?: ImageStyle;
  containerStyle?: ViewStyle;
  defaultSource?: any;
  optimizeSize?: { width: number; height: number };
  resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
  showLoading?: boolean;
  showError?: boolean;
  placeholder?: React.ReactNode;
}

const FirebaseImage: React.FC<FirebaseImageProps> = ({
  uri,
  imageStyle,
  containerStyle,
  defaultSource,
  optimizeSize,
  resizeMode = "cover",
  showLoading = true,
  showError = true,
  placeholder,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Clean and validate the URI
  const cleanUri = uri?.trim();
  const isValidUri =
    cleanUri &&
    (cleanUri.startsWith("https://") ||
      cleanUri.startsWith("http://") ||
      cleanUri.startsWith("file://"));

  // Handle load start
  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  // Handle successful load
  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  // Handle load error
  const handleError = (error: any) => {
    console.warn("FirebaseImage load error:", error);
    setIsLoading(false);
    setHasError(true);
  };

  // Optimize Firebase Storage URL if possible
  const getOptimizedUri = (originalUri: string) => {
    if (
      !originalUri ||
      !originalUri.includes("firebasestorage.googleapis.com")
    ) {
      return originalUri;
    }

    try {
      const url = new URL(originalUri);

      if (optimizeSize) {
        // Add size parameters for Firebase Storage optimization
        // Note: This is a basic implementation - Firebase may not support all parameters
        url.searchParams.set("width", optimizeSize.width.toString());
        url.searchParams.set("height", optimizeSize.height.toString());
      }

      return url.toString();
    } catch (error) {
      console.warn("Failed to optimize Firebase image URL:", error);
      return originalUri;
    }
  };

  // If no valid URI, show default or error
  if (!isValidUri) {
    if (defaultSource) {
      return (
        <Image
          source={defaultSource}
          style={[styles.image, imageStyle]}
          resizeMode={resizeMode}
        />
      );
    }

    if (showError) {
      return (
        <View style={[styles.errorContainer, imageStyle, containerStyle]}>
          <Ionicons
            name="image-outline"
            size={24}
            color={COLORS.textSecondary}
          />
          <Text style={styles.errorText}>No image</Text>
        </View>
      );
    }

    return null;
  }

  const optimizedUri = getOptimizedUri(cleanUri);

  return (
    <View style={[styles.container, containerStyle]}>
      <Image
        source={{ uri: optimizedUri }}
        style={[styles.image, imageStyle]}
        resizeMode={resizeMode}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={handleError}
      />

      {/* Loading indicator */}
      {isLoading && showLoading && (
        <View style={[styles.loadingContainer, imageStyle]}>
          {placeholder || (
            <>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading...</Text>
            </>
          )}
        </View>
      )}

      {/* Error state */}
      {hasError && showError && (
        <View style={[styles.errorContainer, imageStyle]}>
          {defaultSource ? (
            <Image
              source={defaultSource}
              style={[styles.image, imageStyle]}
              resizeMode={resizeMode}
            />
          ) : (
            <>
              <Ionicons
                name="alert-circle-outline"
                size={24}
                color={COLORS.textSecondary}
              />
              <Text style={styles.errorText}>Failed to load</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  errorText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

export default FirebaseImage;
