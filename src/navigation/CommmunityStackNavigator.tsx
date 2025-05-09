import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../common/constants/colors";

// Import screens directly instead of using dynamic imports
import CommunityScreen from "../screens/CommunityScreen";
import CommunityDetailScreen from "../screens/CommunityDetailScreen";
import CreatePostScreen from "../screens/CreatePostScreen";
import PostDetailScreen from "../screens/PostDetailScreen";

// Define the stack parameter list for type safety
export type CommunityStackParamList = {
  CommunityMain: undefined;
  CommunityDetail: { communityId: string };
  CreatePost: { communityId?: string };
  PostDetail: { postId: string };
};

const Stack = createStackNavigator<CommunityStackParamList>();

// Back button component for the header
const BackButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={{ padding: 8, marginLeft: 4 }} onPress={onPress}>
    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
  </TouchableOpacity>
);

const CommunityStackNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="CommunityMain"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: COLORS.background },
      }}
    >
      {/* Main Community Screen with tabs */}
      <Stack.Screen name="CommunityMain" component={CommunityScreen} />

      {/* Community Detail Screen */}
      <Stack.Screen
        name="CommunityDetail"
        component={CommunityDetailScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: "Community",
          headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
          headerStyle: {
            backgroundColor: COLORS.background,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            color: COLORS.text,
            fontSize: 18,
            fontWeight: "600",
          },
        })}
      />

      {/* Create Post Screen */}
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: "Create Post",
          headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
          headerStyle: {
            backgroundColor: COLORS.background,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            color: COLORS.text,
            fontSize: 18,
            fontWeight: "600",
          },
        })}
      />

      {/* Post Detail Screen */}
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: "Post",
          headerLeft: () => <BackButton onPress={() => navigation.goBack()} />,
          headerStyle: {
            backgroundColor: COLORS.background,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTitleStyle: {
            color: COLORS.text,
            fontSize: 18,
            fontWeight: "600",
          },
        })}
      />
    </Stack.Navigator>
  );
};

export default CommunityStackNavigator;
