import { RouteProp } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Splash: undefined;
  Home: { username: string };
  SignUp: undefined;
};

export type SplashScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Splash"
>;
export type HomeScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Home"
>;

export type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;

export type HomeScreenProps = {
  navigation: HomeScreenNavigationProp;
  route: HomeScreenRouteProp;
};

export type SplashScreenProps = {
  navigation: SplashScreenNavigationProp;
};
