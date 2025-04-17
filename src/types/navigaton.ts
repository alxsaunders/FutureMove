import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { NavigatorScreenParams } from "@react-navigation/native";

// Root Stack Parameters
export type RootStackParamList = {
  Splash: undefined;
  Home: { username: string };
  SignUp: undefined;
  Main: undefined;
  GoalDetail: { goalId: number }; // Added for goal details
  Login: undefined; // Added for authentication
};

// Bottom Tab Parameters
export type BottomTabParamList = {
  Home: undefined;
  Goals: undefined;
  Community: undefined;
  ItemShop: undefined;
  Profile: undefined;
};

// Root Stack Navigation Props
export type SplashScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Splash"
>;
export type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Home"
>;
// Added GoalDetail navigation prop
export type GoalDetailScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "GoalDetail"
>;
// Added Login navigation prop
export type LoginScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Login"
>;

// Root Stack Route Props
export type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;
// Added GoalDetail route prop
export type GoalDetailScreenRouteProp = RouteProp<
  RootStackParamList,
  "GoalDetail"
>;
// Added Login route prop
export type LoginScreenRouteProp = RouteProp<RootStackParamList, "Login">;

// Combined Screen Props
export type HomeScreenProps = {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp;
};

export type SplashScreenProps = {
  navigation: SplashScreenNavigationProp;
};

// Added GoalDetail screen props
export type GoalDetailScreenProps = {
  navigation: GoalDetailScreenNavigationProp;
  route: GoalDetailScreenRouteProp;
};

// Added Login screen props
export type LoginScreenProps = {
  navigation: LoginScreenNavigationProp;
  route: LoginScreenRouteProp;
};

// Bottom Tab Navigation Props
export type GoalsScreenNavigationProp = StackNavigationProp<
  BottomTabParamList,
  "Goals"
>;

export type GoalsScreenRouteProp = RouteProp<BottomTabParamList, "Goals">;

export type GoalsScreenProps = {
  navigation: GoalsScreenNavigationProp;
  route: GoalsScreenRouteProp;
};

// Declare global namespace for type augmentation (helpful for useNavigation hook)
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
