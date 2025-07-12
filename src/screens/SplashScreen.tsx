import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigaton";
import { useNavigation } from "@react-navigation/native";

type SplashScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Splash"
>;

const SplashScreen = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Navigate to Main (tab navigation) instead of Home
      navigation.navigate("Main");

      // Store the username in global state or context if needed
      // For example using AsyncStorage or a state management library
    } catch (error: any) {
      console.error("SIGNIN ERROR:", error.message);
      Alert.alert("Login Failed", error.message);
    }
  };

  return (
    <ImageBackground
      source={require("../assets/back.png")}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/videos/FIXFUTURE-ezgif.com-optimize.gif")}
            style={styles.logo}
            contentFit="contain"
            transition={1000}
          />
        </View>

        {/* Overlay for better text readability - positioned after logo */}
        <View style={styles.overlay} />

        <View style={styles.contentContainer}>
          <Text style={styles.title}>FutureMove</Text>
          <Text style={styles.slogan}>"Move Forward, Achieve More."</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("SignUp")}>
            <Text style={styles.link}>Don't have an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  logoContainer: {
    position: "absolute",
    top: 220,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.1)", // Semi-transparent overlay for better text readability
    zIndex: 2,
  },
  contentContainer: {
    flex: 1,
    alignItems: "center",
    padding: 20,
    justifyContent: "center",
    position: "relative",
    zIndex: 3,
    paddingTop: 160, // Add space for the logo above
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2563EB", // Darker blue
textShadowColor: "rgba(85, 12, 255, 0.5)",
textShadowOffset: { width: 1, height: 1 },
textShadowRadius: 6, // Changed to blue to match the design
    marginBottom: 10,
  },
  slogan: {
    fontSize: 16,
    color: "#E0E0E0", // Light gray for better visibility
    marginBottom: 30,
    fontStyle: "italic",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.9)", // Semi-transparent white
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    width: "100%",
  },
  signInButton: {
    backgroundColor: "rgba(74, 144, 226, 0.9)", // Semi-transparent blue
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  link: {
    color: "#FFFFFF", // Changed to white
    fontSize: 16,
    fontWeight: "bold", // Added bold font weight
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});

export default SplashScreen;
