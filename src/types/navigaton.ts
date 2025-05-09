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
  
  ItemShop: NavigatorScreenParams<ItemShopStackParamList> | { userId?: string; forceRefresh?: number };
  Profile: undefined;

  CommunityDetail: { communityId: number | string };
  CreatePost: { communityId?: number | string };
  PostDetail: { postId: number | string };
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
  ItemShop: NavigatorScreenParams<ItemShopStackParamList> | { userId?: string; forceRefresh?: number };
  Profile: undefined;
};

// ItemShop Stack Parameters - Updated with userId and ItemDetail
export type ItemShopStackParamList = {
  ItemShopMain: { userId?: string; forceRefresh?: number };
  ItemDetail: { 
    itemId: number; 
    userId?: string;
    itemName?: string;
    itemDescription?: string;
    itemPrice?: number;
    itemCategory?: string;
    itemImageUrl?: string;
  };
};

// Root Stack Navigation Props
export type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, "Splash">;
export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;
export type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, "GoalDetail">;
export type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;
export type ItemShopScreenNavigationProp = StackNavigationProp<RootStackParamList, "ItemShop">; 

// Root Stack Route Props
export type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;
export type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, "GoalDetail">;
export type LoginScreenRouteProp = RouteProp<RootStackParamList, "Login">;
export type ItemShopScreenRouteProp = RouteProp<RootStackParamList, "ItemShop">;

// Add these to your navigation types file
export type CommunityDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, "CommunityDetail">;
export type CommunityDetailScreenRouteProp = RouteProp<RootStackParamList, "CommunityDetail">;

export type CommunityDetailScreenProps = {
  navigation: CommunityDetailScreenNavigationProp;
  route: CommunityDetailScreenRouteProp;
};

export type CreatePostScreenNavigationProp = StackNavigationProp<RootStackParamList, "CreatePost">;
export type CreatePostScreenRouteProp = RouteProp<RootStackParamList, "CreatePost">;

export type CreatePostScreenProps = {
  navigation: CreatePostScreenNavigationProp;
  route: CreatePostScreenRouteProp;
};

// ItemShop Stack Navigation Props - Updated with ItemDetail
export type ItemShopMainScreenNavigationProp = StackNavigationProp<ItemShopStackParamList, "ItemShopMain">;
export type ItemShopMainScreenRouteProp = RouteProp<ItemShopStackParamList, "ItemShopMain">;

export type ItemDetailScreenNavigationProp = StackNavigationProp<ItemShopStackParamList, "ItemDetail">;
export type ItemDetailScreenRouteProp = RouteProp<ItemShopStackParamList, "ItemDetail">;

export type ItemShopMainScreenProps = {
  navigation: ItemShopMainScreenNavigationProp;
  route: ItemShopMainScreenRouteProp;
};

export type ItemDetailScreenProps = {
  navigation: ItemDetailScreenNavigationProp;
  route: ItemDetailScreenRouteProp;
};

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

// ItemShopScreenProps - for the main tab navigator
export type ItemShopScreenProps = {
  navigation: ItemShopScreenNavigationProp;
  route: ItemShopScreenRouteProp;
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