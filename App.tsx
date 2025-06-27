// Add DOMException polyfill at the top of the file, before other imports
if (typeof global.DOMException === "undefined") {
  // More complete DOMException polyfill with required constants
  class DOMExceptionPolyfill extends Error {
    static readonly INDEX_SIZE_ERR = 1;
    static readonly DOMSTRING_SIZE_ERR = 2;
    static readonly HIERARCHY_REQUEST_ERR = 3;
    static readonly WRONG_DOCUMENT_ERR = 4;
    static readonly INVALID_CHARACTER_ERR = 5;
    static readonly NO_DATA_ALLOWED_ERR = 6;
    static readonly NO_MODIFICATION_ALLOWED_ERR = 7;
    static readonly NOT_FOUND_ERR = 8;
    static readonly NOT_SUPPORTED_ERR = 9;
    static readonly INUSE_ATTRIBUTE_ERR = 10;
    static readonly INVALID_STATE_ERR = 11;
    static readonly SYNTAX_ERR = 12;
    static readonly INVALID_MODIFICATION_ERR = 13;
    static readonly NAMESPACE_ERR = 14;
    static readonly INVALID_ACCESS_ERR = 15;
    static readonly VALIDATION_ERR = 16;
    static readonly TYPE_MISMATCH_ERR = 17;
    static readonly SECURITY_ERR = 18;
    static readonly NETWORK_ERR = 19;
    static readonly ABORT_ERR = 20;
    static readonly URL_MISMATCH_ERR = 21;
    static readonly QUOTA_EXCEEDED_ERR = 22;
    static readonly TIMEOUT_ERR = 23;
    static readonly INVALID_NODE_TYPE_ERR = 24;
    static readonly DATA_CLONE_ERR = 25;

    code: number;

    constructor(message?: string, name?: string) {
      super(message || "");
      this.name = name || "DOMException";
      this.message = message || "";
      this.code = 0;
    }
  }

  // Add all the static properties to the prototype and constructor
  Object.getOwnPropertyNames(DOMExceptionPolyfill).forEach((prop) => {
    if (typeof DOMExceptionPolyfill[prop] === "number") {
      DOMExceptionPolyfill.prototype[prop] = DOMExceptionPolyfill[prop];
    }
  });

  // Use type assertion to bypass TypeScript's type checking for this assignment
  global.DOMException = DOMExceptionPolyfill as unknown as typeof DOMException;
}

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
import AchievementsScreen from "./src/screens/AchievementsScreen";
import NewsScreen from "./src/screens/NewsScreen"; // ← ADDED: NewsScreen import
import { RootStackParamList } from "./src/types/navigaton";

// Import bottom tab navigator
import BottomTabNavigator from "./src/navigation/BottomTabNavigator";

const Stack = createStackNavigator<RootStackParamList>();

// Create a wrapper component to handle the case where screens might not be loaded yet
const AppContent = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Main" component={BottomTabNavigator} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} />
        <Stack.Screen
          name="NewsScreen"
          component={NewsScreen}
          options={{
            headerShown: false,
            presentation: "modal", // Makes it slide up like a modal
            animationTypeForReplace: "push",
            gestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />
        
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
