import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlarmClock, X, Sun, Sunset, Moon, Clock } from "lucide-react-native";
import { useAlarms } from "@/contexts/AlarmContext";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import NotificationService from "@/services/NotificationService";

export default function AlarmRingingScreen() {
  const { alarmId } = useLocalSearchParams<{ alarmId: string }>();
  const { alarms, updateAlarm } = useAlarms();
  const alarm = alarms.find((a) => a.id === alarmId);

  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      pulseAnim.setValue(1);
      fadeAnim.setValue(0);
    };
  }, [pulseAnim, fadeAnim]);

  const playAlarmSound = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });

      if (!alarm) return;

      let soundToPlay: Audio.Sound | null = null;

      if (alarm.voiceType === "radio" && alarm.radioStationUrl) {
        console.log("Playing radio station:", alarm.radioStationUrl);
        const { sound: radioSound } = await Audio.Sound.createAsync(
          { uri: alarm.radioStationUrl },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        soundToPlay = radioSound;
      } else if (alarm.audioUri) {
        console.log("Playing audio from URI:", alarm.audioUri);
        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: alarm.audioUri },
          { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        soundToPlay = audioSound;
      } else {
        console.log("No audio configured, using notification only");
        return;
      }

      setSound(soundToPlay);
      setIsPlaying(true);
    } catch (error) {
      console.error("Error playing alarm sound:", error);
    }
  }, [alarm]);

  const stopAlarmSound = useCallback(async () => {
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.stopAsync();
          await sound.unloadAsync();
        }
        setSound(null);
        setIsPlaying(false);
      } catch (error: any) {
        if (error.message && error.message.includes("Seeking interrupted")) {
          console.log("Sound already stopped or unloaded");
          setSound(null);
          setIsPlaying(false);
        } else {
          console.error("Error stopping alarm sound:", error);
        }
      }
    }
  }, [sound]);

  useEffect(() => {
    if (!alarm) {
      router.back();
      return;
    }

    let hapticInterval: ReturnType<typeof setInterval> | undefined;

    if (Platform.OS !== "web") {
      hapticInterval = setInterval(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }, 2000);
    }

    playAlarmSound();

    return () => {
      if (hapticInterval) {
        clearInterval(hapticInterval);
      }
      stopAlarmSound();
    };
  }, [alarm, playAlarmSound, stopAlarmSound]);

  const handleDismiss = async () => {
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    await stopAlarmSound();

    if (alarm && alarm.repeatDays.length === 0) {
      await updateAlarm(alarm.id, { enabled: false });
    }

    router.back();
  };

  const handleSnooze = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    await stopAlarmSound();

    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();

    if (alarm) {
      const snoozeTime = new Date();
      snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);
      console.log("Snoozed until:", snoozeTime.toLocaleTimeString());
      
      await NotificationService.scheduleSnooze(alarm.id, alarm.label);
    }

    router.back();
  };

  const getTimeOfDay = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  };

  const getTimeIcon = () => {
    const timeOfDay = getTimeOfDay();
    if (timeOfDay === "morning") return <Sun color="#ffd700" size={48} />;
    if (timeOfDay === "afternoon") return <Sunset color="#ff8c00" size={48} />;
    return <Moon color="#b0c4de" size={48} />;
  };

  const getGradientColors = (): [string, string, ...string[]] => {
    const timeOfDay = getTimeOfDay();
    if (timeOfDay === "morning")
      return ["#667eea", "#764ba2", "#f093fb", "#f5576c"];
    if (timeOfDay === "afternoon")
      return ["#f46b45", "#eea849", "#f093fb", "#f5576c"];
    return ["#2c3e50", "#3498db", "#8e44ad", "#c0392b"];
  };

  if (!alarm) {
    return null;
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={getGradientColors()} style={StyleSheet.absoluteFillObject} />
      <Stack.Screen
        options={{
          headerShown: false,
          animation: "none",
          gestureEnabled: false,
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateX: shakeAnim }] },
          ]}
        >
          <View style={styles.header}>
            {getTimeIcon()}
            <Text style={styles.greeting}>
              Good {getTimeOfDay().charAt(0).toUpperCase() + getTimeOfDay().slice(1)}!
            </Text>
          </View>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <AlarmClock color="#ffffff" size={120} strokeWidth={1.5} />
          </Animated.View>

          <View style={styles.timeContainer}>
            <Text style={styles.currentTime}>{formatTime(currentTime)}</Text>
            <Text style={styles.alarmLabel}>{alarm.label || "Alarm"}</Text>
            {alarm.voiceType === "radio" && alarm.radioStationName && (
              <Text style={styles.radioInfo}>
                Playing: {alarm.radioStationName}
              </Text>
            )}
          </View>

          <View style={styles.waveContainer}>
            {isPlaying && (
              <View style={styles.waveForm}>
                {[...Array(5)].map((_, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveLine,
                      {
                        height: 30 + Math.random() * 40,
                        opacity: 0.6 + Math.random() * 0.4,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.snoozeButton]}
              onPress={handleSnooze}
              activeOpacity={0.8}
            >
              <Clock color="#ffffff" size={24} />
              <Text style={styles.actionButtonText}>Snooze 5min</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.dismissButton]}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <X color="#ffffff" size={28} />
              <Text style={styles.actionButtonText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    gap: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "600" as const,
    color: "#ffffff",
    textAlign: "center",
  },
  timeContainer: {
    alignItems: "center",
    gap: 8,
  },
  currentTime: {
    fontSize: 72,
    fontWeight: "800" as const,
    color: "#ffffff",
    letterSpacing: -2,
  },
  alarmLabel: {
    fontSize: 24,
    fontWeight: "600" as const,
    color: "#ffffffd0",
    textAlign: "center",
  },
  radioInfo: {
    fontSize: 16,
    color: "#ffffffa0",
    textAlign: "center",
    marginTop: 8,
  },
  waveContainer: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  waveForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 80,
  },
  waveLine: {
    width: 6,
    backgroundColor: "#ffffff80",
    borderRadius: 3,
  },
  actions: {
    width: "100%",
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    borderRadius: 20,
    gap: 12,
  },
  snoozeButton: {
    backgroundColor: "#ffffff30",
    borderWidth: 2,
    borderColor: "#ffffff50",
  },
  dismissButton: {
    backgroundColor: "#ff4444",
    borderWidth: 2,
    borderColor: "#ff6666",
  },
  actionButtonText: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
});
