import React, { useState } from "react";
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
import { registerUserToMySQL } from "../services/authService";
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

  // Helper function to delete MySQL user if needed
  const deleteUserFromMySQL = async (userId: string) => {
    try {
      const apiUrl = `${getApiBaseUrl()}/users/${userId}`;
      await fetch(apiUrl, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error deleting user from MySQL:", error);
    }
  };

  // Helper function to get API base URL (you might need to import this from authService)
  const getApiBaseUrl = () => {
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3001/api";
    } else {
      return "http://192.168.1.207:3001/api";
    }
  };

  const handleSignUp = async () => {
    try {
      // Validate input
      if (!username || !name || !email || !password) {
        Alert.alert("Error", "Please fill out all fields");
        return;
      }

      if (password.length < 6) {
        Alert.alert("Error", "Password must be at least 6 characters long");
        return;
      }

      setIsLoading(true);

      // Step 1: Create MySQL user first
      console.log("Creating MySQL user...");
      let mysqlResponse;
      let tempUserId = `temp_${Date.now()}`; // Temporary ID for MySQL

      try {
        mysqlResponse = await registerUserToMySQL({
          user_id: tempUserId,
          username,
          name,
          email,
        });
      } catch (mysqlError) {
        console.error("MySQL registration failed:", mysqlError);
        Alert.alert(
          "Account Creation Failed",
          "Unable to create account. Please try again."
        );
        return;
      }

      // Step 2: Create Firebase user
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
      } catch (firebaseError) {
        console.error("Firebase registration failed:", firebaseError);

        // Cleanup: Delete the MySQL user we just created
        await deleteUserFromMySQL(tempUserId);

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

      // Step 3: Update MySQL user with the real Firebase UID
      console.log("Updating MySQL user with Firebase UID...");
      try {
        // Delete the temporary MySQL record
        await deleteUserFromMySQL(tempUserId);

        // Create new MySQL record with the real Firebase UID
        await registerUserToMySQL({
          user_id: firebaseUser.uid,
          username,
          name,
          email,
        });
      } catch (updateError) {
        console.error("MySQL update failed:", updateError);

        // Cleanup: Delete Firebase user and Firestore document
        try {
          await deleteDoc(doc(db, "users", firebaseUser.uid));
          await deleteUser(firebaseUser);
        } catch (cleanupError) {
          console.error("Cleanup failed:", cleanupError);
        }

        // Also cleanup the temporary MySQL record
        await deleteUserFromMySQL(tempUserId);

        Alert.alert(
          "Account Creation Failed",
          "Unable to complete account setup. Please try again."
        );
        return;
      }

      // Success!
      console.log("Account created successfully");
      Alert.alert(
        "Account Successfully Created",
        "Your account has been created successfully. Please sign in to continue.",
        [
          {
            text: "OK",
            onPress: () => navigation.navigate("Splash"), // Navigate to login screen
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

            <TextInput
              style={[styles.input, isLoading && styles.inputDisabled]}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              editable={!isLoading}
            />
            <TextInput
              style={[styles.input, isLoading && styles.inputDisabled]}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              editable={!isLoading}
            />
            <TextInput
              style={[styles.input, isLoading && styles.inputDisabled]}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
            <TextInput
              style={[styles.input, isLoading && styles.inputDisabled]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.signUpButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
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
                  isLoading && styles.buttonTextDisabled,
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
