// src/navigation/AppNavigator.tsx
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

// Import screens
import SplashScreen from "../screens/SplashScreen";
import SignUpScreen from "../screens/SignUpScreen";
import BottomTabNavigator from "./BottomTabNavigator";

// We no longer need these imports as they'll be handled in CommunityStackNavigator
// import CommunityDetailScreen from "../screens/CommunityDetailScreen";
// import CreatePostScreen from "../screens/CreatePostScreen";
// import PostDetailScreen from "../screens/PostDetailScreen";

const Stack = createStackNavigator();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Main" component={BottomTabNavigator} />

        {/* Remove these screens as they are now in CommunityStackNavigator */}
        {/* 
        <Stack.Screen name="CommunityDetail" component={CommunityDetailScreen} />
        <Stack.Screen name="CreatePost" component={CreatePostScreen} />
        <Stack.Screen name="PostDetail" component={PostDetailScreen} />
        */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
