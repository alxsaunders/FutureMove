import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { NavigatorScreenParams } from "@react-navigation/native";

// Root Stack Parameters
export type RootStackParamList = {
  Splash: undefined;
  Home: { 
    username?: string;
    userLevel?: number;
    userExp?: number;
    userCoins?: number;
    streakCount?: number;
  };
  SignUp: undefined;
  Main: undefined;
  GoalDetail: { goalId: number }; 
  Login: undefined;
  Goals: {
    viewGoalId?: number;
    openCreateGoal?: boolean;
    createAsRoutine?: boolean;
    filterType?: string;
  };
  Community: undefined;
  ItemShop: undefined;
  Profile: undefined;
};

// Bottom Tab Parameters
export type BottomTabParamList = {
  Home: { 
    username?: string;
    userLevel?: number;
    userExp?: number;
    userCoins?: number;
    streakCount?: number;
  };
  Goals: {
    viewGoalId?: number;
    openCreateGoal?: boolean;
    createAsRoutine?: boolean;
    filterType?: string;
  };
  Community: undefined;
  ItemShop: undefined;
  Profile: undefined;
};

// Root Stack Navigation Props
export type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, "Splash">;
export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;
export type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, "GoalDetail">;
export type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;

// Root Stack Route Props
export type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;
export type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, "GoalDetail">;
export type LoginScreenRouteProp = RouteProp<RootStackParamList, "Login">;

// Combined Screen Props
export type HomeScreenProps = {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp;
};

export type SplashScreenProps = {
  navigation: SplashScreenNavigationProp;
};

export type GoalDetailScreenProps = {
  navigation: GoalDetailScreenNavigationProp;
  route: GoalDetailScreenRouteProp;
};

export type LoginScreenProps = {
  navigation: LoginScreenNavigationProp;
  route: LoginScreenRouteProp;
};

// Bottom Tab Navigation Props
export type GoalsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Goals">;
export type GoalsScreenRouteProp = RouteProp<BottomTabParamList, "Goals">;

export type GoalsScreenProps = {
  navigation: GoalsScreenNavigationProp;
  route: GoalsScreenRouteProp;
};

// Declare global namespace for type augmentation
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}