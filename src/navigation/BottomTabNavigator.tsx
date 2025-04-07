// src/navigation/BottomTabNavigator.tsx
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomTabParamList } from "../types/navigaton";

// Import screen components
import HomeScreenWrapper from "../components/HomeScreenWrapper";
import GoalsScreen from "../screens/GoalsScreen";
import CommunityScreen from "../screens/CommunityScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ItemShopScreen from "../screens/ItemShopScreen";

// Create bottom tab navigator with proper typing
const Tab = createBottomTabNavigator<BottomTabParamList>();

// Import icons
// Make sure these files exist in your assets folder
const homeIcon = require("../assets/icons/home.png");
const goalsIcon = require("../assets/icons/target.png");
const communityIcon = require("../assets/icons/community.png");
const shopIcon = require("../assets/icons/itemshop.png");
const profileIcon = require("../assets/icons/user.png");

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        tabBarActiveTintColor: "#6A5ACD", // Purple as mentioned in your design
        tabBarInactiveTintColor: "#000000", // Not used as we're not tinting the icons
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
        },
        headerShown: false,
        // Hide all labels by default
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreenWrapper}
        options={{
          // Custom tab bar icon with conditional label
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemContainer}>
              <Image
                source={homeIcon}
                style={[styles.tabIcon, focused ? styles.activeIcon : null]}
                // Don't tint the icons at all
              />
              {focused && (
                <Text numberOfLines={1} style={styles.tabLabelText}>
                  Home
                </Text>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemContainer}>
              <Image
                source={goalsIcon}
                style={[styles.tabIcon, focused ? styles.activeIcon : null]}
              />
              {focused && (
                <Text numberOfLines={1} style={styles.tabLabelText}>
                  Goals
                </Text>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemContainer}>
              <Image
                source={communityIcon}
                style={[styles.tabIcon, focused ? styles.activeIcon : null]}
              />
              {focused && (
                <Text numberOfLines={1} style={styles.tabLabelText}>
                  Community
                </Text>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ItemShop"
        component={ItemShopScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemContainer}>
              <Image
                source={shopIcon}
                style={[styles.tabIcon, focused ? styles.activeIcon : null]}
              />
              {focused && (
                <Text numberOfLines={1} style={styles.tabLabelText}>
                  Shop
                </Text>
              )}
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.tabItemContainer}>
              <Image
                source={profileIcon}
                style={[styles.tabIcon, focused ? styles.activeIcon : null]}
              />
              {focused && (
                <Text numberOfLines={1} style={styles.tabLabelText}>
                  Profile
                </Text>
              )}
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  activeIcon: {
    // A slight scale effect for active icons
    transform: [{ scale: 1.1 }],
  },
  tabItemContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 70, // Fixed width to prevent shifting
  },
  tabLabelText: {
    color: "#6A5ACD",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
    textAlign: "center",
  },
});

export default BottomTabNavigator;
