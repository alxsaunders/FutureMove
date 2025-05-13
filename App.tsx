import React, { useState, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar, View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Font from "expo-font";

// Context
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";

// Import screens
import SplashScreen from "./src/screens/SplashScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import { RootStackParamList } from "./src/types/navigaton";

// Import bottom tab navigator
import BottomTabNavigator from "./src/navigation/BottomTabNavigator";

const Stack = createStackNavigator<RootStackParamList>();

// Create a wrapper component to handle the case where screens might not be loaded yet
const AppContent = () => {
  // Note: We're not initializing routine reset service here
  // It will be initialized in HomeScreenWrapper instead
  // This avoids potential issues with imports and timing

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Main" component={BottomTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
  const [fontLoaded, setFontLoaded] = useState(false);

  useEffect(() => {
    async function loadFont() {
      try {
        await Font.loadAsync({
          FutureMoveLogo: require("./src/assets/fonts/futuremovelogo.ttf"),
        });
        setFontLoaded(true);
      } catch (error) {
        console.warn("Error loading font:", error);
        // Continue without the custom font
        setFontLoaded(true);
      }
    }

    loadFont();
  }, []);

  if (!fontLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
