import React, { useEffect } from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { ItemShopStackParamList } from "../types/navigaton";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../config/firebase"; // Import Firebase auth

// Import the ItemShopScreen component
import ItemShopScreen from "../screens/ItemShopScreen";
// Import the ItemDetailScreen component
import ItemDetailScreen from "../screens/ItemDetailScreen";

// Fixed user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

const Stack = createStackNavigator<ItemShopStackParamList>();

const ItemShopStackNavigator = ({ route }) => {
  const { currentUser } = useAuth();

  // Extract userId from route params, currentUser, or directly from Firebase
  let userId = route.params?.userId;

  // First check if userId exists in route params
  if (!userId) {
    // Then try to get from context
    if (currentUser && currentUser.id) {
      userId = currentUser.id;
       console.log(
         `user found loool`
       );
    }
    // Then try to get directly from Firebase
    else if (auth.currentUser) {
      userId = auth.currentUser.uid;
       console.log(`user found hahhaa`);
    }
    // As a last resort, use the fallback ID
    else {
      userId = FALLBACK_USER_ID;
      console.log(
        `[NAV] No user ID found, using fallback: ${FALLBACK_USER_ID}`
      );
    }
  }

  console.log(
    `[NAV] ItemShopStackNavigator rendering with userId: ${
      userId || "undefined"
    }`
  );

  return (
    <Stack.Navigator
      initialRouteName="ItemShopMain"
      screenOptions={{
        // Completely hide the header
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="ItemShopMain"
        component={ItemShopScreen}
        initialParams={{
          userId: userId,
          forceRefresh: Date.now(),
        }}
      />

      {/* Add the ItemDetail screen */}
      <Stack.Screen
        name="ItemDetail"
        component={ItemDetailScreen}
        options={{
          // For the detail screen, we might want to show a back button
          headerShown: true,
          headerStyle: {
            backgroundColor: "#6A5ACD",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
    </Stack.Navigator>
  );
};

export default ItemShopStackNavigator;
