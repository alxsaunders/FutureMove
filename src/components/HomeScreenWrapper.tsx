// src/components/HomeScreenWrapper.tsx
import React from "react";
import HomeScreen from "../screens/HomeScreen";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigaton";

// Create a simple wrapper component
const HomeScreenWrapper = () => {
  // We'll create a custom route object with the username
  const mockRoute = {
    params: {
      username: "User", // Default username or get from storage/context
    },
  };

  // Get the navigation object
  const navigation = useNavigation();

  // Pass the navigation and mocked route to HomeScreen
  return <HomeScreen navigation={navigation as any} route={mockRoute as any} />;
};

export default HomeScreenWrapper;
