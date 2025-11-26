import createContextHook from "@nkzw/create-context-hook";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface UserProfile {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}

const USER_PROFILE_KEY = "user_profile";

const generateUniqueCode = (): string => {
  const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  return code;
};

export const [UserProfileContext, useUserProfile] = createContextHook(() => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const saveProfile = async (profileData: UserProfile) => {
    try {
      await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profileData));
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  const loadProfile = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_PROFILE_KEY);
      
      if (stored) {
        setProfile(JSON.parse(stored));
      } else {
        const newProfile: UserProfile = {
          id: Date.now().toString(),
          code: generateUniqueCode(),
          name: "",
          createdAt: new Date().toISOString(),
        };
        setProfile(newProfile);
        await saveProfile(newProfile);
      }
      
      setIsLoaded(true);
    } catch (error) {
      console.error("Error loading profile:", error);
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (isLoaded && profile) {
      saveProfile(profile);
    }
  }, [profile, isLoaded]);

  const updateProfile = (updates: Partial<Omit<UserProfile, "id" | "code" | "createdAt">>) => {
    if (profile) {
      setProfile({ ...profile, ...updates });
    }
  };

  const regenerateCode = () => {
    if (profile) {
      setProfile({ ...profile, code: generateUniqueCode() });
    }
  };

  return {
    profile,
    isLoaded,
    updateProfile,
    regenerateCode,
  };
});
