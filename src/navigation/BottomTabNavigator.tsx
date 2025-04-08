// src/navigation/BottomTabNavigator.tsx
import React from "react";
import { Image, StyleSheet, Text, View, TouchableOpacity } from "react-native";
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

// Custom Tab Bar Component
function MyTabBar({ state, descriptors, navigation }) {
  return (
    <View style={styles.tabBarContainer}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel || route.name;
        const isFocused = state.index === index;

        // Determine which icon to use based on route name
        let iconSource;
        switch (route.name) {
          case "Home":
            iconSource = homeIcon;
            break;
          case "Goals":
            iconSource = goalsIcon;
            break;
          case "Community":
            iconSource = communityIcon;
            break;
          case "ItemShop":
            iconSource = shopIcon;
            break;
          case "Profile":
            iconSource = profileIcon;
            break;
          default:
            iconSource = homeIcon;
        }

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Style differently based on which tab (middle tab gets special treatment)
        const isMiddleTab = index === 2; // Community is in the middle (index 2)

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            style={[
              styles.tabButton,
              isMiddleTab ? styles.middleTabButton : null,
            ]}
          >
            <View
              style={[
                isMiddleTab ? styles.middleTabContainer : styles.tabContainer,
                isFocused ? styles.focusedTab : null,
              ]}
            >
              <Image
                source={iconSource}
                style={[
                  isMiddleTab ? styles.middleTabIcon : styles.tabIcon,
                  isFocused && styles.focusedIcon,
                ]}
                // No tintColor change when active
                tintColor={isMiddleTab ? "#FFFFFF" : undefined}
              />

              {/* Show text for all tabs when active, positioned below the icon */}
              {isFocused && (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabLabelText,
                    isMiddleTab ? styles.middleTabLabelText : null,
                  ]}
                >
                  {isMiddleTab ? "Community" : label}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => <MyTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreenWrapper} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="ItemShop" component={ItemShopScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: "row",
    height: 80,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingBottom: 20,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
  },
  middleTabButton: {
    flex: 1,
    alignItems: "center",
  },
  tabContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    width: 70,
    paddingBottom: 10,
  },
  middleTabContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    borderRadius: 35,
    width: 56,
    height: 56,
    bottom: 15, // This creates the "raised" effect
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 3,
  },
  tabIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  middleTabIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
    tintColor: "#FFFFFF", // Makes the icon white for visibility
  },
  focusedIcon: {
    transform: [{ scale: 1 }], // Slightly enlarge the icon when active
  },
  focusedTab: {
    
    borderTopColor: "#6A5ACD",
    
  },
  tabLabelText: {
    color: "#6A5ACD",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "500",
    textAlign: "center",
  },
  middleTabLabelText: {
    color: "#6A5ACD", // Same color as other tab labels
    position: "absolute",
    bottom: -16, // Position the text below the raised button
    width: 70, // Give enough width for the text
  },
});

export default BottomTabNavigator;
