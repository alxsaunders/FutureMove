import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Import screens
import TestApiScreen from "./src/screens/TestApiScreen";
import SplashScreen from "./src/screens/SplashScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import { RootStackParamList } from "./src/types/navigaton";

// Import bottom tab navigator
import BottomTabNavigator from "./src/navigation/BottomTabNavigator";

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle="light-content" // This makes the status bar icons white
        backgroundColor="#3B82F6" // This would make the background white
      />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false }}
        >
          {/* <Stack.Screen name="TestAPI" component={TestApiScreen} /> */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="Main" component={BottomTabNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
