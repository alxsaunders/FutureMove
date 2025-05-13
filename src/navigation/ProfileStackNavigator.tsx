import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Import screens
import ProfileScreen from "../screens/ProfileScreen";
import EditProfileScreen from "../screens/EditProfileScreen";

// Import types
import { ProfileStackParamList } from "../types/navigaton";

// Create stack navigator with the correct typing
const Stack = createStackNavigator<ProfileStackParamList>();

const ProfileStackNavigator = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen
                name="ProfileMain"
                component={ProfileScreen as React.ComponentType<any>}
            />
            <Stack.Screen
                name="EditProfile"
                component={EditProfileScreen as React.ComponentType<any>}
            />
        </Stack.Navigator>
    );
};

export default ProfileStackNavigator;