import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  deleteUser,
} from "firebase/auth";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import {
  registerUserToMySQL,
  checkUsernameAvailable,
  checkEmailAvailable,
} from "../services/authService";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types/navigaton";

type NavigationProp = StackNavigationProp<RootStackParamList, "SignUp">;

const SignUpScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Validation states
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const [emailValid, setEmailValid] = useState(false);

  // Debounced validation functions
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const checkUsernameValidation = useCallback(
    debounce(async (usernameToCheck) => {
      if (!usernameToCheck || usernameToCheck.length < 3) {
        setUsernameError("Username must be at least 3 characters");
        setUsernameValid(false);
        setIsCheckingUsername(false);
        return;
      }

      // Check for valid characters (alphanumeric and underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(usernameToCheck)) {
        setUsernameError(
          "Username can only contain letters, numbers, and underscores"
        );
        setUsernameValid(false);
        setIsCheckingUsername(false);
        return;
      }

      try {
        setIsCheckingUsername(true);
        const isAvailable = await checkUsernameAvailable(usernameToCheck);

        if (isAvailable) {
          setUsernameError("");
          setUsernameValid(true);
        } else {
          setUsernameError("Username is already taken");
          setUsernameValid(false);
        }
      } catch (error) {
        console.error("Error checking username:", error);
        setUsernameError("Error checking username availability");
        setUsernameValid(false);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500),
    []
  );

  const checkEmailValidation = useCallback(
    debounce(async (emailToCheck) => {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailToCheck || !emailRegex.test(emailToCheck)) {
        setEmailError("Please enter a valid email address");
        setEmailValid(false);
        setIsCheckingEmail(false);
        return;
      }

      try {
        setIsCheckingEmail(true);
        const isAvailable = await checkEmailAvailable(emailToCheck);

        if (isAvailable) {
          setEmailError("");
          setEmailValid(true);
        } else {
          setEmailError("Email is already registered");
          setEmailValid(false);
        }
      } catch (error) {
        console.error("Error checking email:", error);
        setEmailError("Error checking email availability");
        setEmailValid(false);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500),
    []
  );

  const handleUsernameChange = (text) => {
    setUsername(text);
    setUsernameValid(false);
    if (text.length > 0) {
      checkUsernameValidation(text);
    } else {
      setUsernameError("");
    }
  };

  const handleEmailChange = (text) => {
    setEmail(text);
    setEmailValid(false);
    if (text.length > 0) {
      checkEmailValidation(text);
    } else {
      setEmailError("");
    }
  };

  const isFormValid = () => {
    return (
      username.length >= 3 &&
      name.length > 0 &&
      email.length > 0 &&
      password.length >= 6 &&
      usernameValid &&
      emailValid &&
      !isCheckingUsername &&
      !isCheckingEmail
    );
  };

  const handleSignUp = async () => {
    try {
      // Final validation before signup
      if (!isFormValid()) {
        Alert.alert("Error", "Please fix all errors before continuing");
        return;
      }

      setIsLoading(true);

      // Step 1: Create Firebase user FIRST
      console.log("Creating Firebase user...");
      let userCredential;
      let firebaseUser;

      try {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        firebaseUser = userCredential.user;

        // Update Firebase profile
        await updateProfile(firebaseUser, { displayName: name });

        // Create Firestore document
        await setDoc(doc(db, "users", firebaseUser.uid), {
          username,
          name,
          email,
          level: 1,
          xpPoints: 0,
          futureCoins: 0,
          createdAt: new Date(),
        });

        console.log(
          "Firebase user created successfully with UID:",
          firebaseUser.uid
        );
      } catch (firebaseError) {
        console.error("Firebase registration failed:", firebaseError);

        // Show appropriate error message
        let errorMessage = "Unable to create account. Please try again.";
        if (firebaseError.code === "auth/email-already-in-use") {
          errorMessage = "An account with this email already exists.";
        } else if (firebaseError.code === "auth/weak-password") {
          errorMessage =
            "Password is too weak. Please choose a stronger password.";
        } else if (firebaseError.code === "auth/invalid-email") {
          errorMessage = "Please enter a valid email address.";
        }

        Alert.alert("Account Creation Failed", errorMessage);
        return;
      }

      // Step 2: Create MySQL user with the real Firebase UID
      console.log("Creating MySQL user with Firebase UID:", firebaseUser.uid);
      try {
        await registerUserToMySQL({
          user_id: firebaseUser.uid, // Use the real Firebase UID
          username,
          name,
          email,
        });

        console.log(
          "MySQL user created successfully with UID:",
          firebaseUser.uid
        );
      } catch (mysqlError) {
        console.error("MySQL registration failed:", mysqlError);

        // Cleanup: Delete Firebase user and Firestore document since MySQL failed
        try {
          await deleteDoc(doc(db, "users", firebaseUser.uid));
          await deleteUser(firebaseUser);
          console.log("Firebase cleanup completed after MySQL failure");
        } catch (cleanupError) {
          console.error("Firebase cleanup failed:", cleanupError);
        }

        Alert.alert(
          "Account Creation Failed",
          "Unable to complete account setup. Please try again."
        );
        return;
      }

      // Success!
      console.log("Account created successfully for UID:", firebaseUser.uid);
      Alert.alert(
        "Account Successfully Created",
        "Your account has been created successfully. Please sign in to continue.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Splash"),
          },
        ]
      );
    } catch (error) {
      console.error("Unexpected error during signup:", error);
      Alert.alert(
        "Account Creation Failed",
        "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const getInputStyle = (hasError, isValid, isChecking) => {
    if (isChecking) {
      return [styles.input, styles.inputChecking];
    }
    if (hasError) {
      return [styles.input, styles.inputError];
    }
    if (isValid) {
      return [styles.input, styles.inputValid];
    }
    return styles.input;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Image
            source={require("../assets/videos/FIXFUTURE-ezgif.com-optimize.gif")}
            style={styles.logo}
            contentFit="contain"
            transition={1000}
          />
          <Text style={styles.title}>FutureMove</Text>
          <Text style={styles.slogan}>"Move Forward, Achieve More."</Text>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Create Your Account</Text>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  getInputStyle(
                    usernameError,
                    usernameValid,
                    isCheckingUsername
                  ),
                  isLoading && styles.inputDisabled,
                ]}
                placeholder="Username"
                value={username}
                onChangeText={handleUsernameChange}
                editable={!isLoading}
                autoCapitalize="none"
              />
              {isCheckingUsername && (
                <ActivityIndicator
                  size="small"
                  color="#4A90E2"
                  style={styles.inputIcon}
                />
              )}
              {!isCheckingUsername && usernameValid && (
                <Text style={styles.checkIcon}>✓</Text>
              )}
              {usernameError ? (
                <Text style={styles.errorText}>{usernameError}</Text>
              ) : null}
            </View>

            <TextInput
              style={[styles.input, isLoading && styles.inputDisabled]}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  getInputStyle(emailError, emailValid, isCheckingEmail),
                  isLoading && styles.inputDisabled,
                ]}
                placeholder="Email"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
              {isCheckingEmail && (
                <ActivityIndicator
                  size="small"
                  color="#4A90E2"
                  style={styles.inputIcon}
                />
              )}
              {!isCheckingEmail && emailValid && (
                <Text style={styles.checkIcon}>✓</Text>
              )}
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}
            </View>

            <TextInput
              style={[styles.input, isLoading && styles.inputDisabled]}
              placeholder="Password (minimum 6 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.signUpButton,
              (isLoading || !isFormValid()) && styles.buttonDisabled,
            ]}
            onPress={handleSignUp}
            disabled={isLoading || !isFormValid()}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#999999" size="small" />
                <Text
                  style={[
                    styles.buttonText,
                    styles.buttonTextDisabled,
                    { marginLeft: 10 },
                  ]}
                >
                  Creating Account...
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.buttonText,
                  !isFormValid() && styles.buttonTextDisabled,
                ]}
              >
                Sign Up
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Splash")}
            disabled={isLoading}
            style={isLoading && styles.linkDisabled}
          >
            <Text style={[styles.link, isLoading && styles.textDisabled]}>
              Already have an account? Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollContainer: { flexGrow: 1 },
  container: { flex: 1, alignItems: "center", padding: 20 },
  logo: {
    width: 120,
    height: 120,
    marginTop: 40,
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4A90E2",
    marginBottom: 10,
  },
  slogan: {
    fontSize: 16,
    color: "#666",
    marginBottom: 30,
    fontStyle: "italic",
  },
  formContainer: { width: "100%", marginBottom: 20 },
  formTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  inputContainer: {
    position: "relative",
    marginBottom: 12,
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
  inputDisabled: {
    backgroundColor: "#f8f8f8",
    color: "#999",
  },
  inputError: {
    borderColor: "#ff4444",
    marginBottom: 4,
  },
  inputValid: {
    borderColor: "#4CAF50",
    marginBottom: 4,
  },
  inputChecking: {
    borderColor: "#4A90E2",
    marginBottom: 4,
  },
  inputIcon: {
    position: "absolute",
    right: 15,
    top: 15,
  },
  checkIcon: {
    position: "absolute",
    right: 15,
    top: 15,
    color: "#4CAF50",
    fontSize: 18,
    fontWeight: "bold",
  },
  errorText: {
    color: "#ff4444",
    fontSize: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  signUpButton: {
    backgroundColor: "#4A90E2",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: "#cccccc",
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonTextDisabled: {
    color: "#999999",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  link: {
    color: "#4A90E2",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
  linkDisabled: {
    opacity: 0.5,
  },
  textDisabled: {
    color: "#999",
  },
});

export default SignUpScreen;
