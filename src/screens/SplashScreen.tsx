// src/screens/SplashScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
} from "react-native";

const SplashScreen = () => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          {/* Logo */}
          <Image
            source={require("../assets/futuremove-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />

          {/* App Name & Slogan */}
          <Text style={styles.title}>FutureMove</Text>
          <Text style={styles.slogan}>"Move Forward, Achieve More."</Text>

          {/* Form Container */}
          <View style={styles.formContainer}>
            {isSignUp ? (
              // Sign Up Form
              <>
                <Text style={styles.formTitle}>Create Account</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                />

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

                <TouchableOpacity style={styles.mainButton}>
                  <Text style={styles.buttonText}>Sign Up</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Login Form
              <>
                <Text style={styles.formTitle}>Welcome Back</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

                <TouchableOpacity style={styles.mainButton}>
                  <Text style={styles.buttonText}>Log In</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Toggle between Login and Sign Up */}
            <TouchableOpacity
              style={styles.toggleContainer}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.toggleText}>
                {isSignUp
                  ? "Already have an account? Log In"
                  : "Need an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {/* Google Sign Up Button */}
          <TouchableOpacity style={styles.googleButton}>
            <Text style={styles.googleButtonText}>
              {isSignUp ? "Sign up with Google" : "Log in with Google"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginTop: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4A90E2", // Blue color from your design
    marginBottom: 10,
  },
  slogan: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    fontStyle: "italic",
  },
  formContainer: {
    width: "100%",
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  mainButton: {
    backgroundColor: "#4A90E2",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  toggleContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  toggleText: {
    color: "#4A90E2",
    fontSize: 16,
    fontWeight: "500",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 15,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    paddingHorizontal: 10,
    color: "#666",
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: "100%",
    marginBottom: 20,
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "500",
  },
});

export default SplashScreen;
