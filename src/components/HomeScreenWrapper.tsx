// src/components/HomeScreenWrapper.tsx
import React, { useState, useEffect } from "react";
import HomeScreen from "../screens/HomeScreen";
import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, View, Platform } from "react-native";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { COLORS } from "../common/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Define API URL directly
const getApiBaseUrl = () => {
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001/api";
  } else {
    // For iOS or development on Mac
    return "http://localhost:3001/api";
  }
};

// Format name helper
const formatName = (name: string | null | undefined): string => {
  if (!name) return "User";

  // Split the full name and take the first part (first name)
  const nameParts = name.trim().split(" ");
  const firstName = nameParts[0];

  // Capitalize the first letter
  return firstName.charAt(0).toUpperCase() + firstName.slice(1);
};

// Create a wrapper component that integrates user data
const HomeScreenWrapper = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Get the navigation object
  const navigation = useNavigation();

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // First check Firebase Auth state
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            // Get user ID
            const userId = firebaseUser.uid;

            // Try to get Firebase user profile from Firestore
            const userDocRef = doc(db, "users", userId);
            const userDoc = await getDoc(userDocRef);

            // Create a base user object
            let user = {
              id: userId,
              name: formatName(firebaseUser.displayName),
              email: firebaseUser.email || "",
              level: 1,
              xp_points: 0,
              future_coins: 0,
              streak: 0,
            };

            // If we have Firestore data, use it
            if (userDoc.exists()) {
              const firestoreData = userDoc.data();
              user = {
                ...user,
                name: formatName(
                  firestoreData.name ||
                    firestoreData.displayName ||
                    firebaseUser.displayName
                ),
                level: firestoreData.level || 1,
                xp_points: firestoreData.xp_points || 0,
                future_coins: firestoreData.future_coins || 0,
              };
            }

            // Now fetch additional data from your backend API
            try {
              const apiUrl = `${getApiBaseUrl()}/users/${userId}`;
              const response = await fetch(apiUrl);

              if (response.ok) {
                const apiData = await response.json();
                // Update user with API data
                user = {
                  ...user,
                  level: apiData.level || user.level,
                  xp_points: apiData.xp_points || user.xp_points,
                  future_coins: apiData.future_coins || user.future_coins,
                };
              }

              // Fetch user streak from API
              const streakUrl = `${getApiBaseUrl()}/users/${userId}/streak`;
              const streakResponse = await fetch(streakUrl);

              if (streakResponse.ok) {
                const streakData = await streakResponse.json();
                user.streak =
                  streakData.streak || streakData.current_streak || 0;
              }
            } catch (apiError) {
              console.error("Error fetching API data:", apiError);
              // Continue with Firebase data if API fails
            }

            // Set the user data
            setUserData(user);
          } else {
            // No Firebase user, try to get data from AsyncStorage as fallback
            try {
              const userJson = await AsyncStorage.getItem("user");
              if (userJson) {
                const localUser = JSON.parse(userJson);
                setUserData({
                  id: localUser.user_id,
                  name: formatName(localUser.name || localUser.username),
                  level: localUser.level || 1,
                  xp_points: localUser.xp_points || 0,
                  future_coins: localUser.future_coins || 0,
                  streak: 0, // Default streak since we don't have it in local storage
                });
              } else {
                // No local user either, use defaults
                setUserData({
                  id: "default_user",
                  name: "User",
                  level: 1,
                  xp_points: 0,
                  future_coins: 0,
                  streak: 0,
                });
              }
            } catch (storageError) {
              console.error("Error reading from AsyncStorage:", storageError);
              // Use defaults if all else fails
              setUserData({
                id: "default_user",
                name: "User",
                level: 1,
                xp_points: 0,
                future_coins: 0,
                streak: 0,
              });
            }
          }

          // Data loading complete
          setLoading(false);
        });
      } catch (error) {
        console.error("Error in auth state change handler:", error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Show loading indicator while fetching user data
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: COLORS.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Create route object with the user data
  const route = {
    params: {
      username: userData?.name || "User",
      userLevel: userData?.level || 1,
      userExp: userData?.xp_points || 0,
      userCoins: userData?.future_coins || 0,
      streakCount: userData?.streak || 0,
    },
  };

  // Pass all the data to HomeScreen
  return <HomeScreen navigation={navigation as any} route={route as any} />;
};

export default HomeScreenWrapper;
