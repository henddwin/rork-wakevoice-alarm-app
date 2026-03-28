import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Linking,
} from "react-native";
import { Stack, router } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, AlarmClock, Shield, ChevronRight, Settings, Sparkles, Moon, Sun } from "lucide-react-native";
import { useOnboarding } from "@/contexts/OnboardingContext";
import NotificationService, { NotificationPermissionStatus } from "@/services/NotificationService";
import * as Haptics from "expo-haptics";

type OnboardingStep = "welcome" | "notification" | "features" | "complete";

export default function OnboardingScreen() {
  const { completeOnboarding } = useOnboarding();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkPermissionStatus();
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(iconBounce, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(iconBounce, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [currentStep, fadeAnim, slideAnim, iconBounce]);

  const checkPermissionStatus = async () => {
    const status = await NotificationService.getPermissionStatus();
    setPermissionStatus(status);
    console.log("Onboarding: Permission status:", status);
  };

  const handleRequestPermission = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setIsRequestingPermission(true);
    
    try {
      const status = await NotificationService.requestPermissions();
      setPermissionStatus(status);
      console.log("Onboarding: Permission result:", status);
      
      if (status.granted) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setTimeout(() => setCurrentStep("features"), 500);
      }
    } catch (error) {
      console.error("Onboarding: Error requesting permission:", error);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleOpenSettings = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await Linking.openSettings();
  };

  const handleNext = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const steps: OnboardingStep[] = ["welcome", "notification", "features", "complete"];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const handleComplete = async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await completeOnboarding();
    router.replace("/");
  };

  const handleSkip = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    handleNext();
  };

  const renderStep = () => {
    const animatedStyle = {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    };

    switch (currentStep) {
      case "welcome":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <View style={styles.iconContainer}>
              <Animated.View style={{ transform: [{ scale: iconBounce }] }}>
                <View style={styles.iconCircle}>
                  <AlarmClock color="#ffffff" size={72} strokeWidth={1.5} />
                </View>
              </Animated.View>
            </View>
            
            <Text style={styles.title}>Welcome to{"\n"}Smart Alarm</Text>
            <Text style={styles.subtitle}>
              The intelligent alarm app that wakes you up{"\n"}the way you want
            </Text>

            <View style={styles.featuresPreview}>
              <View style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Sparkles color="#ffd700" size={20} />
                </View>
                <Text style={styles.featureText}>AI-powered wake-up messages</Text>
              </View>
              <View style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Moon color="#9b59b6" size={20} />
                </View>
                <Text style={styles.featureText}>Smart scheduling options</Text>
              </View>
              <View style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Sun color="#f39c12" size={20} />
                </View>
                <Text style={styles.featureText}>Radio & custom sounds</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
              <ChevronRight color="#ffffff" size={20} />
            </TouchableOpacity>
          </Animated.View>
        );

      case "notification":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <View style={styles.iconContainer}>
              <Animated.View style={{ transform: [{ scale: iconBounce }] }}>
                <View style={[styles.iconCircle, styles.notificationIconCircle]}>
                  <Bell color="#ffffff" size={72} strokeWidth={1.5} />
                </View>
              </Animated.View>
            </View>

            <Text style={styles.title}>🔔 Enable Notifications</Text>
            <Text style={styles.subtitle}>
              Allow notifications so your alarms can{"\n"}wake you up even when the app is closed
            </Text>

            <View style={styles.permissionBox}>
              <Shield color="#4a90e2" size={24} />
              <Text style={styles.permissionText}>
                We&apos;ll only send notifications for your scheduled alarms. Your data stays private.
              </Text>
            </View>

            {permissionStatus?.granted ? (
              <View style={styles.successContainer}>
                <View style={styles.successBadge}>
                  <Text style={styles.successText}>✓ Notifications Enabled</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
                  <Text style={styles.primaryButtonText}>Continue</Text>
                  <ChevronRight color="#ffffff" size={20} />
                </TouchableOpacity>
              </View>
            ) : permissionStatus && !permissionStatus.canAskAgain ? (
              <View style={styles.deniedContainer}>
                <Text style={styles.deniedText}>
                  Notifications are disabled. Please enable them in Settings for alarms to work properly.
                </Text>
                <TouchableOpacity style={styles.settingsButton} onPress={handleOpenSettings}>
                  <Settings color="#ffffff" size={20} />
                  <Text style={styles.settingsButtonText}>Open Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.requestContainer}>
                <TouchableOpacity 
                  style={[styles.primaryButton, isRequestingPermission && styles.buttonDisabled]} 
                  onPress={handleRequestPermission}
                  disabled={isRequestingPermission}
                >
                  <Bell color="#ffffff" size={20} />
                  <Text style={styles.primaryButtonText}>
                    {isRequestingPermission ? "Requesting..." : "Allow Notifications"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                  <Text style={styles.skipButtonText}>Maybe later</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        );

      case "features":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <Text style={styles.title}>How to Use</Text>
            <Text style={styles.subtitle}>Create alarms that fit your lifestyle</Text>

            <View style={styles.tutorialList}>
              <View style={styles.tutorialItem}>
                <View style={[styles.tutorialNumber, { backgroundColor: "#4a90e2" }]}>
                  <Text style={styles.tutorialNumberText}>1</Text>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialTitle}>Create Your Alarm</Text>
                  <Text style={styles.tutorialDescription}>
                    Tap + to create an alarm. Choose the time and repeat schedule.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialItem}>
                <View style={[styles.tutorialNumber, { backgroundColor: "#9b59b6" }]}>
                  <Text style={styles.tutorialNumberText}>2</Text>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialTitle}>Choose Your Sound</Text>
                  <Text style={styles.tutorialDescription}>
                    Pick AI voice, record your own message, or wake up to live radio.
                  </Text>
                </View>
              </View>

              <View style={styles.tutorialItem}>
                <View style={[styles.tutorialNumber, { backgroundColor: "#e74c3c" }]}>
                  <Text style={styles.tutorialNumberText}>3</Text>
                </View>
                <View style={styles.tutorialContent}>
                  <Text style={styles.tutorialTitle}>Wake Up Right</Text>
                  <Text style={styles.tutorialDescription}>
                    Stop or snooze with notification buttons, or open the app for full screen.
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <ChevronRight color="#ffffff" size={20} />
            </TouchableOpacity>
          </Animated.View>
        );

      case "complete":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <View style={styles.iconContainer}>
              <Animated.View style={{ transform: [{ scale: iconBounce }] }}>
                <View style={[styles.iconCircle, styles.completeIconCircle]}>
                  <Text style={styles.completeEmoji}>🎉</Text>
                </View>
              </Animated.View>
            </View>

            <Text style={styles.title}>You&apos;re All Set!</Text>
            <Text style={styles.subtitle}>
              Create your first alarm and start waking up{"\n"}smarter every day
            </Text>

            <View style={styles.finalTipsBox}>
              <Text style={styles.finalTipsTitle}>Pro Tips:</Text>
              <Text style={styles.finalTip}>• Stop/Snooze buttons appear in notifications</Text>
              <Text style={styles.finalTip}>• Repeating alarms stay scheduled until disabled</Text>
              <Text style={styles.finalTip}>• AI voices are generated fresh for each alarm</Text>
            </View>

            <TouchableOpacity style={[styles.primaryButton, styles.completeButton]} onPress={handleComplete}>
              <AlarmClock color="#ffffff" size={20} />
              <Text style={styles.primaryButtonText}>Create First Alarm</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  const steps: OnboardingStep[] = ["welcome", "notification", "features", "complete"];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.progressContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentIndex && styles.progressDotActive,
                index < currentIndex && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>

        <View style={styles.content}>
          {renderStep()}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff30",
  },
  progressDotActive: {
    width: 24,
    backgroundColor: "#4a90e2",
  },
  progressDotCompleted: {
    backgroundColor: "#4a90e2",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stepContainer: {
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#4a90e230",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#4a90e250",
  },
  notificationIconCircle: {
    backgroundColor: "#f39c1230",
    borderColor: "#f39c1250",
  },
  completeIconCircle: {
    backgroundColor: "#27ae6030",
    borderColor: "#27ae6050",
  },
  completeEmoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    color: "#ffffff80",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  featuresPreview: {
    width: "100%",
    backgroundColor: "#ffffff10",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff10",
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "500" as const,
  },
  permissionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#4a90e220",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  permissionText: {
    flex: 1,
    fontSize: 14,
    color: "#ffffff90",
    lineHeight: 20,
  },
  successContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  successBadge: {
    backgroundColor: "#27ae6030",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#27ae6050",
  },
  successText: {
    fontSize: 16,
    color: "#27ae60",
    fontWeight: "600" as const,
  },
  deniedContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  deniedText: {
    fontSize: 14,
    color: "#e74c3c",
    textAlign: "center",
    marginBottom: 8,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e74c3c",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
    width: "100%",
  },
  settingsButtonText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600" as const,
  },
  requestContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4a90e2",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 8,
    width: "100%",
  },
  primaryButtonText: {
    fontSize: 17,
    color: "#ffffff",
    fontWeight: "700" as const,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 15,
    color: "#ffffff60",
    fontWeight: "500" as const,
  },
  tutorialList: {
    width: "100%",
    gap: 20,
    marginBottom: 32,
  },
  tutorialItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  tutorialNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorialNumberText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "700" as const,
  },
  tutorialContent: {
    flex: 1,
  },
  tutorialTitle: {
    fontSize: 17,
    color: "#ffffff",
    fontWeight: "600" as const,
    marginBottom: 4,
  },
  tutorialDescription: {
    fontSize: 14,
    color: "#ffffff70",
    lineHeight: 20,
  },
  finalTipsBox: {
    width: "100%",
    backgroundColor: "#ffffff10",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  finalTipsTitle: {
    fontSize: 15,
    color: "#ffffff",
    fontWeight: "700" as const,
    marginBottom: 12,
  },
  finalTip: {
    fontSize: 14,
    color: "#ffffff80",
    lineHeight: 24,
  },
  completeButton: {
    backgroundColor: "#27ae60",
  },
});
