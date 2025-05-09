import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { ItemShopStackParamList } from "../types/navigaton";
import { useAuth } from "../contexts/AuthContext";

// Import the ItemShopScreen component
import ItemShopScreen from "../screens/ItemShopScreen";
// Import the ItemDetailScreen component (create this file if it doesn't exist)
import ItemDetailScreen from "../screens/ItemDetailScreen";

// Fixed user ID for development/testing
const FALLBACK_USER_ID = "KbtY3t4Tatd0r5tCjnjlmJyNT5R2";

const Stack = createStackNavigator<ItemShopStackParamList>();

const ItemShopStackNavigator = ({ route }) => {
  const { currentUser } = useAuth();

  // Extract userId from route params or currentUser
  let userId = route.params?.userId;

  // Fall back to currentUser.id if route params don't have userId
  if (!userId && currentUser) {
    userId = currentUser.id;
  }

  // As a last resort, use the fallback ID
  if (!userId) {
    userId = FALLBACK_USER_ID;
    console.log(`[NAV] No user ID found, using fallback: ${FALLBACK_USER_ID}`);
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
