import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Alert } from "react-native";
import * as authService from "../services/authService";

// Define the User type for the context
export type User = {
  id: string; // Using user_id from MySQL as id
  username: string;
  name: string;
  email: string;
  level: number;
  xp_points: number;
  future_coins: number;
  created_at: string;
  last_login: string | null;
};

// Define the Auth Context type
type AuthContextType = {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    username: string,
    name: string,
    email: string,
    password: string
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUserCoins: (amount: number) => Promise<void>;
  updateUserXP: (amount: number) => Promise<void>;
};

// Create the Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider props type
type AuthProviderProps = {
  children: ReactNode;
};

// Create the Auth Provider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for stored user data on component mount
  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        setIsLoading(true);

        // Check if user is authenticated
        const authStatus = await authService.isAuthenticated();
        setIsAuthenticated(authStatus);

        if (authStatus) {
          // Get user data from storage
          const userData = await authService.getCurrentUser();

          if (userData) {
            // Transform from AuthUser to User type if needed
            setCurrentUser({
              id: userData.user_id,
              username: userData.username,
              name: userData.name,
              email: userData.email,
              level: userData.level,
              xp_points: userData.xp_points,
              future_coins: userData.future_coins,
              created_at: userData.created_at,
              last_login: userData.last_login,
            });
          }
        }
      } catch (error) {
        console.error("Failed to load user from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserFromStorage();
  }, []);

  // Login function
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Call login service
      const result = await authService.loginUser({ email, password });

      if (result && result.user) {
        // Transform and set user
        setCurrentUser({
          id: result.user.user_id,
          username: result.user.username,
          name: result.user.name,
          email: result.user.email,
          level: result.user.level,
          xp_points: result.user.xp_points,
          future_coins: result.user.future_coins,
          created_at: result.user.created_at,
          last_login: result.user.last_login,
        });

        setIsAuthenticated(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login failed:", error);
      Alert.alert(
        "Login Failed",
        "Invalid email or password. Please try again."
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (
    username: string,
    name: string,
    email: string,
    password: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);

      // Call register service
      const result = await authService.registerUser({
        username,
        name,
        email,
        password,
      });

      if (result && result.user) {
        // Transform and set user
        setCurrentUser({
          id: result.user.user_id,
          username: result.user.username,
          name: result.user.name,
          email: result.user.email,
          level: result.user.level,
          xp_points: result.user.xp_points,
          future_coins: result.user.future_coins,
          created_at: result.user.created_at,
          last_login: result.user.last_login,
        });

        setIsAuthenticated(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Registration failed:", error);
      Alert.alert(
        "Registration Failed",
        "Could not create account. Please try again."
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Call logout service
      await authService.logoutUser();

      // Clear user from state
      setCurrentUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Logout failed:", error);
      Alert.alert("Error", "Failed to log out. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update user coins
  const updateUserCoins = async (amount: number): Promise<void> => {
    try {
      await authService.updateUserCoins(amount);

      // Update local user state
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          future_coins: currentUser.future_coins + amount,
        });
      }
    } catch (error) {
      console.error("Failed to update coins:", error);
    }
  };

  // Update user XP
  const updateUserXP = async (amount: number): Promise<void> => {
    try {
      const updatedUser = await authService.updateUserXP(amount);

      // Update local user state if we got an updated user back
      if (updatedUser && currentUser) {
        setCurrentUser({
          ...currentUser,
          xp_points: updatedUser.xp_points,
          level: updatedUser.level,
        });
      }
    } catch (error) {
      console.error("Failed to update XP:", error);
    }
  };

  // Provide the auth context
  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        updateUserCoins,
        updateUserXP,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
