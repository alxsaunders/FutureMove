// src/screens/CommunityScreen.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import CommunityHubTab from "../components/community/CommunityHubTab";
import CommunityMyFeedTab from "../components/community/CommunityMyFeedTab";
import { useNavigation } from "@react-navigation/native";

// Get screen dimensions
const { width } = Dimensions.get('window');

const CommunityScreen = () => {
  const { currentUser } = useAuth();
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('Hub'); // Default to Hub tab

  // Function to render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'Hub':
        return <CommunityHubTab />;
      case 'My Feed':
        return <CommunityMyFeedTab />;
      default:
        return <CommunityHubTab />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Ionicons
            name="notifications-outline"
            size={24}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'Hub' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('Hub')}
        >
          <Text 
            style={[
              styles.tabButtonText, 
              activeTab === 'Hub' && styles.activeTabButtonText
            ]}
          >
            Hub
          </Text>
          {activeTab === 'Hub' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            activeTab === 'My Feed' && styles.activeTabButton
          ]}
          onPress={() => setActiveTab('My Feed')}
        >
          <Text 
            style={[
              styles.tabButtonText, 
              activeTab === 'My Feed' && styles.activeTabButtonText
            ]}
          >
            My Feed
          </Text>
          {activeTab === 'My Feed' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => {
          // Navigation to post creation screen
          navigation.navigate("CreatePost" as never);
        }}
      >
        <Ionicons name="add" size={24} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.text,
  },
  notificationButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: COLORS.cardBackground,
  },
  createButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 100,
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  activeTabButton: {
    // No additional styling needed - indicator is separate
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabButtonText: {
    color: COLORS.primary,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '70%',
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 1.5,
  },
  contentContainer: {
    flex: 1,
  },
});

export default CommunityScreen;