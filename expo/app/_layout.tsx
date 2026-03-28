// template
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AlarmContext } from "@/contexts/AlarmContext";
import { UserProfileContext } from "@/contexts/UserProfileContext";
import { RadioStationContext } from "@/contexts/RadioStationContext";
import { OnboardingContext, useOnboarding } from "@/contexts/OnboardingContext";
import { trpc, trpcClient } from "@/lib/trpc";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NavigationController() {
  const { hasCompletedOnboarding, isLoading } = useOnboarding();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inOnboarding = segments[0] === "onboarding";
    const inAlarmRinging = segments[0] === "alarm-ringing";

    if (inAlarmRinging) {
      return;
    }

    if (!hasCompletedOnboarding && !inOnboarding) {
      console.log("Redirecting to onboarding");
      router.replace("/onboarding");
    } else if (hasCompletedOnboarding && inOnboarding) {
      console.log("Redirecting to home");
      router.replace("/");
    }
  }, [hasCompletedOnboarding, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={layoutStyles.loadingContainer}>
        <LinearGradient
          colors={["#1a1a2e", "#16213e", "#0f3460"]}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NavigationController />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="create-alarm" options={{ headerShown: false }} />
        <Stack.Screen name="friends" options={{ headerShown: false }} />
        <Stack.Screen name="create-friend-alarm" options={{ headerShown: false }} />
        <Stack.Screen name="ai-voice-generator" options={{ headerShown: false }} />
        <Stack.Screen name="radio-stations" options={{ headerShown: false }} />
        <Stack.Screen 
          name="alarm-ringing" 
          options={{ 
            headerShown: false, 
            gestureEnabled: false,
            presentation: "fullScreenModal",
          }} 
        />
      </Stack>
    </>
  );
}

const layoutStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <OnboardingContext>
          <UserProfileContext>
            <AlarmContext>
              <RadioStationContext>
                <GestureHandlerRootView>
                  <RootLayoutNav />
                </GestureHandlerRootView>
              </RadioStationContext>
            </AlarmContext>
          </UserProfileContext>
        </OnboardingContext>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
