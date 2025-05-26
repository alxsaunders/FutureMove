// BottomTabNavigator.tsx - Manual Refresh Approach
import React, { useState, useEffect, useCallback } from "react";
import { Image, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomTabParamList } from "../types/navigaton";
import { useAuth } from "../contexts/AuthContext";
import { auth, storage } from "../config/firebase";
import axios from "axios";
import { Platform } from "react-native";

// Import screen components
import HomeScreenWrapper from "../components/HomeScreenWrapper";
import ProfileScreen from "../screens/ProfileScreen";

import ItemShopStackNavigator from "./ItemShopStackNavigator";
import ProfileStackNavigator from "./ProfileStackNavigator";

// Import Stack Navigators
import GoalsStackNavigator from "./GoalsStackNavigator";
import CommunityStackNavigator from "./CommmunityStackNavigator";

// Create bottom tab navigator with proper typing
const Tab = createBottomTabNavigator<BottomTabParamList>();

// Import icons
const homeIcon = require("../assets/icons/home.png");
const goalsIcon = require("../assets/icons/target.png");
const communityIcon = require("../assets/icons/community.png");
const shopIcon = require("../assets/icons/itemshop.png");
const profileIcon = require("../assets/icons/user.png");
const defaultAvatar = require("../assets/default-avatar.png");

// Get API base URL (same as in ProfileService)
const getApiBaseUrl = () => {
  const baseUrl =
    Platform.OS === "android"
      ? "http://10.0.2.2:3001/api"
      : "http://192.168.1.207:3001/api";
  return baseUrl;
};

// Global variable to store profile image URL
let globalProfileImageUrl: string | null = null;
let profileImageListeners: Array<(url: string | null) => void> = [];

// Function to update profile image globally
export const updateGlobalProfileImage = (url: string | null) => {
  console.log(
    "[BOTTOM_TAB] Updating global profile image:",
    url ? "New URL" : "Cleared"
  );
  globalProfileImageUrl = url;
  // Notify all listeners
  profileImageListeners.forEach((listener) => listener(url));
};

// Function to subscribe to profile image changes
const subscribeToProfileImage = (listener: (url: string | null) => void) => {
  profileImageListeners.push(listener);
  // Return unsubscribe function
  return () => {
    profileImageListeners = profileImageListeners.filter((l) => l !== listener);
  };
};

// Custom Tab Bar Component
function MyTabBar({ state, descriptors, navigation }) {
  const { currentUser } = useAuth();
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(
    globalProfileImageUrl
  );

  // Subscribe to global profile image changes
  useEffect(() => {
    const unsubscribe = subscribeToProfileImage((url) => {
      console.log("[BOTTOM_TAB] Received profile image update");
      setProfileImageUrl(url);
    });

    return unsubscribe;
  }, []);

  // Fetch profile image on mount and auth changes
  useEffect(() => {
    const fetchProfileImage = async (userId: string) => {
      try {
        console.log(`[BOTTOM_TAB] Fetching profile for user: ${userId}`);
        const apiUrl = getApiBaseUrl();

        const response = await axios.get(
          `${apiUrl}/profile/${userId}?userId=${userId}`,
          { timeout: 10000 }
        );

        if (response.data?.profile_image) {
          console.log("[BOTTOM_TAB] ✅ Found profile image");
          updateGlobalProfileImage(response.data.profile_image);
        } else {
          console.log("[BOTTOM_TAB] ❌ No profile image in response");
          updateGlobalProfileImage(null);
        }
      } catch (error) {
        console.error("[BOTTOM_TAB] Error fetching profile:", error);
      }
    };

    // Listen to auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log(`[BOTTOM_TAB] Auth state: User ${user.uid}`);
        // Delay to ensure everything is ready
        setTimeout(() => fetchProfileImage(user.uid), 1000);
      } else {
        console.log("[BOTTOM_TAB] Auth state: No user");
        updateGlobalProfileImage(null);
      }
    });

    // Check current user immediately
    if (auth.currentUser) {
      fetchProfileImage(auth.currentUser.uid);
    }

    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || route.name;
        const isFocused = state.index === index;

        let iconSource;
        let isProfileTab = false;

        switch (route.name) {
          case "Home":
            iconSource = homeIcon;
            break;
          case "Goals":
            iconSource = goalsIcon;
            break;
          case "Community":
            iconSource = communityIcon;
            break;
          case "ItemShop":
            iconSource = shopIcon;
            break;
          case "Profile":
            isProfileTab = true;
            iconSource = profileIcon;
            break;
          default:
            iconSource = homeIcon;
        }

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);

            // Refresh profile image when navigating to profile
            if (route.name === "Profile" && auth.currentUser) {
              console.log(
                "[BOTTOM_TAB] Navigating to profile - refreshing image"
              );
              // Force a refresh
              const apiUrl = getApiBaseUrl();
              axios
                .get(
                  `${apiUrl}/profile/${auth.currentUser.uid}?userId=${auth.currentUser.uid}`,
                  { timeout: 5000 }
                )
                .then((response) => {
                  if (response.data?.profile_image) {
                    updateGlobalProfileImage(response.data.profile_image);
                  }
                })
                .catch((error) => {
                  console.error(
                    "[BOTTOM_TAB] Error refreshing on navigation:",
                    error
                  );
                });
            }
          }
        };

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={styles.tabButton}
          >
            <View
              style={[
                styles.tabContainer,
                isFocused ? styles.focusedTab : null,
              ]}
            >
              {/* Show profile image for profile tab when available */}
              {isProfileTab && profileImageUrl ? (
                <View style={styles.profileImageWrapper}>
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={[
                      styles.profileImage,
                      isFocused && styles.profileImageFocused,
                    ]}
                    defaultSource={profileIcon}
                    onError={(e) => {
                      console.log(
                        "[BOTTOM_TAB] Image load error:",
                        e.nativeEvent?.error
                      );
                    }}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <Image
                  source={iconSource}
                  style={[
                    styles.tabIcon,
                    isProfileTab && isFocused && styles.tabIconFocused,
                  ]}
                />
              )}

              {/* Show text for all tabs when active */}
              {isFocused && (
                <Text numberOfLines={1} style={styles.tabLabelText}>
                  {label}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const BottomTabNavigator = () => {
  const { currentUser } = useAuth();

  console.log("[BOTTOM_TAB] 📱 BottomTabNavigator mounted");
  console.log("[BOTTOM_TAB] 👤 Current user:", currentUser?.id || "No user");
  console.log(
    "[BOTTOM_TAB] 🔥 Firebase user:",
    auth.currentUser?.uid || "No Firebase user"
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <MyTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreenWrapper} />
      <Tab.Screen name="Goals" component={GoalsStackNavigator} />
      <Tab.Screen name="Community" component={CommunityStackNavigator} />
      <Tab.Screen
        name="ItemShop"
        component={ItemShopStackNavigator}
        initialParams={{
          userId: currentUser?.id || auth.currentUser?.uid,
          forceRefresh: Date.now(),
        }}
      />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    height: 70,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
  },
  tabContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    width: 70,
  },
  tabIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  tabIconFocused: {
    tintColor: "#6A5ACD",
  },
  profileImageWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  },
  profileImage: {
    width: 30,
    height: 30,
  },
  profileImageFocused: {
    borderWidth: 2,
    borderColor: "#6A5ACD",
  },
  focusedTab: {
    borderTopWidth: 2,
    borderTopColor: "#6A5ACD",
  },
  tabLabelText: {
    color: "#6A5ACD",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default BottomTabNavigator;

// In your ProfileScreen, after successfully uploading a new image:
// import { updateGlobalProfileImage } from '../navigation/BottomTabNavigator';
// updateGlobalProfileImage(newImageUrl);
