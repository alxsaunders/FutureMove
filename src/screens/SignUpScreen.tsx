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
  Alert,
} from "react-native";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
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

  const handleSignUp = async () => {
    try {
      if (!username || !name || !email || !password) {
        Alert.alert("Error", "Please fill out all fields");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      await setDoc(doc(db, "users", user.uid), {
        username,
        name,
        email,
        level: 1,
        xpPoints: 0,
        futureCoins: 0,
        createdAt: new Date(),
      });

      const response = await registerUserToMySQL({
        user_id: user.uid,
        username,
        name,
        email,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error || "MySQL insert failed");
      }

      Alert.alert("Success", "Account created successfully");
      navigation.navigate("Home", { username });
    } catch (err: any) {
      console.error("SIGNUP ERROR:", err.message);
      Alert.alert("Signup Failed", err.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Image
            source={require("../assets/futuremove-logo.png")}
            style={styles.logo}
          />
          <Text style={styles.title}>FutureMove</Text>
          <Text style={styles.slogan}>"Move Forward, Achieve More."</Text>

          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Create Your Account</Text>

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
          </View>

          <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Splash")}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
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
  logo: { width: 120, height: 120, marginTop: 40, marginBottom: 10 },
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
  signUpButton: {
    backgroundColor: "#4A90E2",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 25,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  link: {
    color: "#4A90E2",
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default SignUpScreen;
