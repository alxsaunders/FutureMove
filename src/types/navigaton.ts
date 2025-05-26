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
  Communities: undefined; // Added Communities screen
  Achievements: undefined; // ← ADDED: Achievements screen
  ItemShop: NavigatorScreenParams<ItemShopStackParamList> | { userId?: string; forceRefresh?: number };
  Profile: { userId?: string; forceRefresh?: number }; // Updated to include userId

  CommunityDetail: { communityId: number | string };
  CreatePost: { communityId?: number | string };
  PostDetail: { postId: number | string };
  UserProfile: { userId: string }; // Added to view other user profiles
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
  Communities: undefined; // Added Communities screen
  ItemShop: NavigatorScreenParams<ItemShopStackParamList> | { userId?: string; forceRefresh?: number };
  Profile: { userId?: string; forceRefresh?: number }; // Updated to include userId
};

// ItemShop Stack Parameters
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

// Community Stack Parameters - New addition
export type CommunityStackParamList = {
  CommunityMain: undefined;
  Communities: undefined;
  CommunityDetail: { communityId: number | string };
  CreatePost: { communityId?: number | string };
  PostDetail: { postId: number | string };
};

// Profile Stack Parameters - New addition
export type ProfileStackParamList = {
  ProfileMain: { userId?: string; forceRefresh?: number };
  UserProfile: { userId: string };
  UserGoals: { userId: string; includeCompleted?: boolean };
  UserCommenders: { userId: string };
  UserBadges: { userId: string };
  EditProfile: { userId: string };
};

// Root Stack Navigation Props
export type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, "Splash">;
export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, "Home">;
export type GoalDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, "GoalDetail">;
export type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, "Login">;
export type ItemShopScreenNavigationProp = StackNavigationProp<RootStackParamList, "ItemShop">;
export type ProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, "Profile">;
export type CommunitiesScreenNavigationProp = StackNavigationProp<RootStackParamList, "Communities">;
export type UserProfileScreenNavigationProp = StackNavigationProp<RootStackParamList, "UserProfile">;
export type AchievementsScreenNavigationProp = StackNavigationProp<RootStackParamList, "Achievements">; // ← ADDED: Achievements navigation prop

// Root Stack Route Props
export type HomeScreenRouteProp = RouteProp<RootStackParamList, "Home">;
export type GoalDetailScreenRouteProp = RouteProp<RootStackParamList, "GoalDetail">;
export type LoginScreenRouteProp = RouteProp<RootStackParamList, "Login">;
export type ItemShopScreenRouteProp = RouteProp<RootStackParamList, "ItemShop">;
export type ProfileScreenRouteProp = RouteProp<RootStackParamList, "Profile">;
export type CommunitiesScreenRouteProp = RouteProp<RootStackParamList, "Communities">;
export type UserProfileScreenRouteProp = RouteProp<RootStackParamList, "UserProfile">;
export type AchievementsScreenRouteProp = RouteProp<RootStackParamList, "Achievements">; // ← ADDED: Achievements route prop

// Community related screen props
export type CommunityScreenNavigationProp = StackNavigationProp<RootStackParamList, "Community">;
export type CommunityScreenRouteProp = RouteProp<RootStackParamList, "Community">;

export type CommunityScreenProps = {
  navigation: CommunityScreenNavigationProp;
  route: CommunityScreenRouteProp;
};

export type CommunitiesScreenProps = {
  navigation: CommunitiesScreenNavigationProp;
  route: CommunitiesScreenRouteProp;
};

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

export type PostDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, "PostDetail">;
export type PostDetailScreenRouteProp = RouteProp<RootStackParamList, "PostDetail">;

export type PostDetailScreenProps = {
  navigation: PostDetailScreenNavigationProp;
  route: PostDetailScreenRouteProp;
};

// ItemShop Stack Navigation Props
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

// Profile related screen props
export type ProfileScreenProps = {
  navigation: ProfileScreenNavigationProp;
  route: ProfileScreenRouteProp;
};

export type UserProfileScreenProps = {
  navigation: UserProfileScreenNavigationProp;
  route: UserProfileScreenRouteProp;
};

// ← ADDED: Achievements screen props
export type AchievementsScreenProps = {
  navigation: AchievementsScreenNavigationProp;
  route: AchievementsScreenRouteProp;
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
    interface RootParamList extends RootStackParamList { }
  }
}