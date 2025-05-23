// src/screens/ProfileViewScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS } from "../common/constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { 
  fetchUserProfile,
  fetchUserBadges,
  fetchUserStats,
  commendUser,
  removeCommend,
  ExtendedUserProfile
} from "../services/ProfileService";

const ProfileViewScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params as { userId: string };
  const { currentUser } = useAuth();
  const [profileData, setProfileData] = useState<ExtendedUserProfile | null>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCommending, setIsCommending] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, [userId]);

  const loadProfileData = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Load profile, badges and stats in parallel
      const [profileResponse, badgesResponse, statsResponse] = await Promise.all([
        fetchUserProfile(userId),
        fetchUserBadges(userId),
        fetchUserStats(userId)
      ]);
      
      setProfileData(profileResponse);
      setBadges(badgesResponse);
      setStats(statsResponse);
    } catch (error) {
      console.error("Error loading profile data:", error);
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommend = async () => {
    if (!currentUser) {
      // Prompt user to log in or sign up
      Alert.alert(
        "Authentication Required",
        "You need to be logged in to commend users.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign In",
            onPress: () => navigation.navigate("Login"),
          },
        ]
      );
      return;
    }
    
    if (!profileData) return;
    
    setIsCommending(true);
    try {
      if (profileData.hasCommended) {
        // Remove commend
        const result = await removeCommend(userId);
        if (result.success) {
          setProfileData({
            ...profileData,
            commends: result.commends,
            hasCommended: false
          });
        }
      } else {
        // Add commend
        const result = await commendUser(userId);
        if (result.success) {
          setProfileData({
            ...profileData,
            commends: result.commends,
            hasCommended: true
          });
        }
      }
    } catch (error) {
      console.error("Error updating commend status:", error);
      Alert.alert("Error", "Failed to update commend status. Please try again.");
    } finally {
      setIsCommending(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!profileData) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.errorText}>User not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <Image
            source={
              profileData.profileImage
                ? { uri: profileData.profileImage }
                : require("../assets/default-avatar.png")
            }
            style={styles.profileImage}
          />
          
          <Text style={styles.userName}>
            {profileData.name || "User"}
          </Text>
          
          <Text style={styles.userUsername}>
            @{profileData.username || userId.substring(0, 8) || "user"}
          </Text>
          
          {/* Commend Button - only shown when viewing another user's profile */}
          {currentUser && currentUser.id !== userId && (
            <TouchableOpacity 
              style={[
                styles.commendButton, 
                profileData.hasCommended ? styles.commendedButton : null
              ]}
              onPress={handleCommend}
              disabled={isCommending}
            >
              {isCommending ? (
                <ActivityIndicator size="small" color={profileData.hasCommended ? COLORS.primary : COLORS.white} />
              ) : (
                <>
                  <Ionicons 
                    name={profileData.hasCommended ? "thumbs-up" : "thumbs-up-outline"} 
                    size={16} 
                    color={profileData.hasCommended ? COLORS.primary : COLORS.white} 
                  />
                  <Text 
                    style={[
                      styles.commendButtonText,
                      profileData.hasCommended ? styles.commendedButtonText : null
                    ]}
                  >
                    {profileData.hasCommended ? "Commended" : "Commend"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="flame" size={28} color={COLORS.primary} />
            <Text style={styles.statValue}>{profileData.streakCount || 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="trophy" size={28} color="#FFD700" />
            <Text style={styles.statValue}>{profileData.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="thumbs-up" size={28} color="#FF9500" />
            <Text style={styles.statValue}>{profileData.commends || 0}</Text>
            <Text style={styles.statLabel}>Commends</Text>
          </View>
          
          <View style={styles.statItem}>
            <Ionicons name="ribbon" size={28} color="#5E6CE7" />
            <Text style={styles.statValue}>{profileData.badgeCount || 0}</Text>
            <Text style={styles.statLabel}>Badges</Text>
          </View>
        </View>
        
        {/* Badges Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Badges & Achievements</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {badges.length > 0 ? (
              badges.map((badge, index) => (
                <View key={index} style={styles.badgeItem}>
                  <Image 
                    source={{ uri: badge.icon }} 
                    style={styles.badgeIcon}
                    defaultSource={require("../assets/images/placeholder-badge.png")} 
                  />
                  <Text style={styles.badgeName}>{badge.name}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyBadges}>
                <Ionicons name="ribbon-outline" size={32} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No badges yet</Text>
              </View>
            )}
          </ScrollView>
        </View>
        
        {/* Progress Stats Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Progress Stats</Text>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                <Text style={styles.statsCardTitle}>Goals Completed</Text>
              </View>
              <Text style={styles.statsCardValue}>{profileData.completedGoalsCount || 0}</Text>
            </View>
            
            <View style={styles.statsCard}>
              <View style={styles.statsCardHeader}>
                <Ionicons name="people" size={24} color="#4CAF50" />
                <Text style={styles.statsCardTitle}>Communities</Text>
              </View>
              <Text style={styles.statsCardValue}>{profileData.communityCount || 0}</Text>
            </View>
            
            {stats && (
              <>
                <View style={styles.statsCard}>
                  <View style={styles.statsCardHeader}>
                    <Ionicons name="trending-up" size={24} color="#FF9800" />
                    <Text style={styles.statsCardTitle}>Longest Streak</Text>
                  </View>
                  <Text style={styles.statsCardValue}>{stats.longest_streak || 0}</Text>
                </View>
                
                <View style={styles.statsCard}>
                  <View style={styles.statsCardHeader}>
                    <Ionicons name="calendar" size={24} color="#9C27B0" />
                    <Text style={styles.statsCardTitle}>Days Active</Text>
                  </View>
                  <Text style={styles.statsCardValue}>{stats.days_registered || 0}</Text>
                </View>
              </>
            )}
          </View>
        </View>
        
        {/* XP Progress Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Experience Progress</Text>
          </View>
          
          <View style={styles.xpContainer}>
            <View style={styles.xpHeader}>
              <Text style={styles.xpTitle}>Level {profileData.level}</Text>
              <Text style={styles.xpCount}>{profileData.xp_points}/100 XP</Text>
            </View>
            
            <View style={styles.xpBarContainer}>
              <View 
                style={[
                  styles.xpBar, 
                  { width: `${profileData.xp_points}%` }
                ]} 
              />
            </View>
            
            <Text style={styles.xpNextLevel}>
              {100 - profileData.xp_points} XP to Level {profileData.level + 1}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 12,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.cardBackground,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: COLORS.cardBackground,
  },
  profileImage: {
    height: 100,
    width: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  commendButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  commendedButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  commendButtonText: {
    color: COLORS.white,
    marginLeft: 4,
    fontWeight: "600",
  },
  commendedButtonText: {
    color: COLORS.primary,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: COLORS.cardBackground,
    marginTop: 8,
    marginBottom: 8,
  },
  statItem: {
    alignItems: "center",
    width: "22%",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionContainer: {
    backgroundColor: COLORS.cardBackground,
    padding: 16,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  badgesContainer: {
    paddingBottom: 8,
  },
  badgeItem: {
    alignItems: "center",
    marginRight: 16,
    width: 80,
  },
  badgeIcon: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    textAlign: "center",
    color: COLORS.text,
  },
  emptyBadges: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    width: "100%",
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statsCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    width: "48%",
  },
  statsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  statsCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginLeft: 8,
  },
  statsCardValue: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.primary,
  },
  xpContainer: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  xpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  xpTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
  },
  xpCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  xpBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  xpBar: {
    height: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
  xpNextLevel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});

export default ProfileViewScreen;