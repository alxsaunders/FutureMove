import React from "react";
import { createStackNavigator } from "@react-navigation/stack";

// Import screens
import GoalsScreen from "../screens/GoalsScreen";
import GoalDetailScreen from "../screens/GoalDetailScreen";

// Import types
import { RootStackParamList } from "../types/navigaton";

// Create stack navigator with the correct typing
const Stack = createStackNavigator<RootStackParamList>();

const GoalsStackNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Goals"
        component={GoalsScreen as React.ComponentType<any>}
      />
      <Stack.Screen
        name="GoalDetail"
        component={GoalDetailScreen as React.ComponentType<any>}
      />
    </Stack.Navigator>
  );
};

export default GoalsStackNavigator;
