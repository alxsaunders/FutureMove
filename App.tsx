import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar, View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Context
import { AuthProvider } from "./src/contexts/AuthContext";

// Import screens
import SplashScreen from "./src/screens/SplashScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App = () => {
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
