// src/contexts/ProfileImageContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getStorage, ref, getDownloadURL, listAll } from "firebase/storage";
import { useAuth } from "./AuthContext";

interface ProfileImageContextType {
  profileImageUrl: string | null;
  refreshProfileImage: () => Promise<void>;
  setProfileImageUrl: (url: string | null) => void;
}

const ProfileImageContext = createContext<ProfileImageContextType | undefined>(
  undefined
);

export const ProfileImageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const fetchProfileImage = async () => {
    if (!currentUser?.id) {
      console.log("[PROFILE_IMAGE_CONTEXT] No user ID available");
      setProfileImageUrl(null);
      return;
    }

    try {
      console.log(
        `[PROFILE_IMAGE_CONTEXT] Fetching profile image for user: ${currentUser.id}`
      );

      const storage = getStorage();
      const profileImagesRef = ref(storage, "profile_images");

      // List all files in the profile_images directory
      const listResult = await listAll(profileImagesRef);
      console.log(
        `[PROFILE_IMAGE_CONTEXT] Found ${listResult.items.length} total files`
      );

      // Find files that match the current user's ID
      const userProfileImages = listResult.items.filter((item) => {
        const matches = item.name.includes(currentUser.id);
        console.log(
          `[PROFILE_IMAGE_CONTEXT] File ${item.name} matches user? ${matches}`
        );
        return matches;
      });

      if (userProfileImages.length > 0) {
        // Sort to get the most recent (based on timestamp in filename)
        const sortedImages = userProfileImages.sort((a, b) => {
          // Extract timestamp from filename
          const getTimestamp = (name: string) => {
            const match = name.match(/_(\d+)\./);
            return match ? parseInt(match[1]) : 0;
          };

          return getTimestamp(b.name) - getTimestamp(a.name);
        });

        const mostRecentImage = sortedImages[0];
        console.log(
          `[PROFILE_IMAGE_CONTEXT] Selected image: ${mostRecentImage.name}`
        );

        // Get the download URL
        const downloadUrl = await getDownloadURL(mostRecentImage);
        console.log(
          `[PROFILE_IMAGE_CONTEXT] Got download URL: ${downloadUrl.substring(
            0,
            50
          )}...`
        );

        setProfileImageUrl(downloadUrl);
      } else {
        console.log("[PROFILE_IMAGE_CONTEXT] No profile images found for user");
        setProfileImageUrl(null);
      }
    } catch (error) {
      console.error(
        "[PROFILE_IMAGE_CONTEXT] Error fetching profile image:",
        error
      );
      setProfileImageUrl(null);
    }
  };

  // Fetch profile image when user changes
  useEffect(() => {
    fetchProfileImage();
  }, [currentUser?.id]);

  const refreshProfileImage = async () => {
    console.log("[PROFILE_IMAGE_CONTEXT] Refreshing profile image...");
    await fetchProfileImage();
  };

  return (
    <ProfileImageContext.Provider
      value={{
        profileImageUrl,
        refreshProfileImage,
        setProfileImageUrl,
      }}
    >
      {children}
    </ProfileImageContext.Provider>
  );
};

export const useProfileImage = () => {
  const context = useContext(ProfileImageContext);
  if (context === undefined) {
    throw new Error(
      "useProfileImage must be used within a ProfileImageProvider"
    );
  }
  return context;
};
