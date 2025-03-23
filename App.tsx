import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import TestApiScreen from "./src/screens/TestApiScreen";
import SplashScreen from "./src/screens/SplashScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import { RootStackParamList } from "./src/types/navigaton";

const Stack = createStackNavigator<RootStackParamList>();

const App = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>FutureMove</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    fontSize: 40, 
    fontWeight: "bold",
    color: "#4A90E2"
  },
});
