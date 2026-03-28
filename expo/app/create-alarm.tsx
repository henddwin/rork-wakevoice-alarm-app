import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Sparkles, Mic, X, Check, Radio, ArrowRight, Users } from "lucide-react-native";
import VoiceRecorder from "@/components/VoiceRecorder";
import { useAlarms, type VoiceType } from "@/contexts/AlarmContext";
import { useRadioStation } from "@/contexts/RadioStationContext";
import { useMutation } from "@tanstack/react-query";
import { generateText } from "@rork-ai/toolkit-sdk";
import { File, Paths } from "expo-file-system";

type Step = "permission" | "time" | "label" | "repeat" | "voiceType" | "voiceSetup";

export default function CreateAlarmScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { alarms, addAlarm, updateAlarm } = useAlarms();
  const { selectedStation, setSelectedStation } = useRadioStation();
  const [currentStep, setCurrentStep] = useState<Step>("permission");
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [label, setLabel] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [voiceType, setVoiceType] = useState<VoiceType | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === "ios");
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);
  const [allowFriendMessages, setAllowFriendMessages] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  const isEditing = !!editId;
  const existingAlarm = isEditing ? alarms.find(a => a.id === editId) : null;

  useEffect(() => {
    if (existingAlarm) {
      const date = new Date();
      date.setHours(existingAlarm.hours);
      date.setMinutes(existingAlarm.minutes);
      setSelectedTime(date);
      setLabel(existingAlarm.label);
      setSelectedDays(existingAlarm.repeatDays);
      setVoiceType(existingAlarm.voiceType);
      setRecordedAudioUri(existingAlarm.audioUri || null);
      setAiPrompt(existingAlarm.aiScript || "");
      setAllowFriendMessages(existingAlarm.allowFriendMessages || false);
      if (existingAlarm.radioStationName && existingAlarm.radioStationUrl) {
        setSelectedStation({
          name: existingAlarm.radioStationName,
          url: existingAlarm.radioStationUrl,
        });
      }
    }
  }, [editId, existingAlarm, setSelectedStation]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentStep, fadeAnim, slideAnim]);

  const goToNextStep = () => {
    const steps: Step[] = ["permission", "time", "label", "repeat", "voiceType", "voiceSetup"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  };

  const goToPrevStep = () => {
    const steps: Step[] = ["permission", "time", "label", "repeat", "voiceType", "voiceSetup"];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  };

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const generateScriptMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const script = await generateText({
        messages: [
          {
            role: "user",
            content: `Generate a short, energetic wake-up message (2-3 sentences) based on this: ${prompt}. Make it motivational and personal.`,
          },
        ],
      });
      return script;
    },
  });

  const generateVoiceMutation = useMutation({
    mutationFn: async (text: string) => {
      const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      const VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
      
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
        {
          method: "POST",
          headers: {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      if (Platform.OS === "web") {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      } else {
        const file = new File(Paths.cache, `alarm_voice_${Date.now()}.mp3`);
        const bytes = await response.arrayBuffer().then((buffer) => new Uint8Array(buffer));
        file.create();
        file.write(bytes);
        return file.uri;
      }
    },
  });

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    let audioUri: string | undefined = existingAlarm?.audioUri;
    let aiScript: string | undefined = existingAlarm?.aiScript;

    if (!voiceType) {
      alert("Please select a voice type for your alarm");
      return;
    }

    if (voiceType === "ai") {
      if (!aiPrompt) {
        alert("Please enter a prompt for AI voice generation");
        return;
      }
      
      if (!isEditing || aiPrompt !== existingAlarm?.aiScript) {
        try {
          const script = await generateScriptMutation.mutateAsync(aiPrompt);
          aiScript = script;
          
          const voiceUri = await generateVoiceMutation.mutateAsync(script);
          audioUri = voiceUri;
        } catch (error) {
          console.error("Error generating AI voice:", error);
          alert("Failed to generate AI voice. Please try again.");
          return;
        }
      }
    } else if (voiceType === "recording") {
      if (!recordedAudioUri) {
        alert("Please record an audio message first!");
        return;
      }
      audioUri = recordedAudioUri;
    } else if (voiceType === "radio") {
      if (!selectedStation) {
        alert("Please select a radio station first!");
        return;
      }
    }

    const alarmData = {
      hours: selectedTime.getHours(),
      minutes: selectedTime.getMinutes(),
      label: label || "Alarm",
      enabled: true,
      repeatDays: selectedDays,
      voiceType,
      audioUri,
      aiScript,
      allowFriendMessages,
      radioStationName: voiceType === "radio" ? selectedStation?.name : undefined,
      radioStationUrl: voiceType === "radio" ? selectedStation?.url : undefined,
    };

    if (isEditing && editId) {
      await updateAlarm(editId, alarmData);
    } else {
      await addAlarm(alarmData);
    }

    router.back();
  };

  const renderStepContent = () => {
    const animatedStyle = {
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }],
    };

    switch (currentStep) {
      case "permission":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <Users color="#4a90e2" size={64} />
            <Text style={styles.stepTitle}>Who sets this alarm?</Text>
            <Text style={styles.stepSubtitle}>Choose who can configure this alarm</Text>
            
            <View style={styles.choiceContainer}>
              <TouchableOpacity
                style={[styles.choiceCard, !allowFriendMessages && styles.choiceCardSelected]}
                onPress={() => {
                  setAllowFriendMessages(false);
                  setTimeout(goToNextStep, 300);
                }}
              >
                <Text style={styles.choiceEmoji}>🙋‍♂️</Text>
                <Text style={[styles.choiceTitle, !allowFriendMessages && styles.choiceTitleSelected]}>Just Me</Text>
                <Text style={styles.choiceDescription}>I&apos;ll set my own alarm</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.choiceCard, allowFriendMessages && styles.choiceCardSelected]}
                onPress={() => {
                  setAllowFriendMessages(true);
                  setTimeout(goToNextStep, 300);
                }}
              >
                <Text style={styles.choiceEmoji}>👥</Text>
                <Text style={[styles.choiceTitle, allowFriendMessages && styles.choiceTitleSelected]}>Friends Too</Text>
                <Text style={styles.choiceDescription}>Let friends leave messages</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      case "time":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <Text style={styles.stepTitle}>What time?</Text>
            <Text style={styles.stepSubtitle}>Choose your alarm time</Text>
            
            {Platform.OS === "android" && !showTimePicker && (
              <TouchableOpacity
                style={styles.timeDisplay}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.timeDisplayText}>
                  {selectedTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
            )}
            {showTimePicker && (
              <DateTimePicker
                value={selectedTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={(event, date) => {
                  if (Platform.OS === "android") {
                    setShowTimePicker(false);
                  }
                  if (date) {
                    setSelectedTime(date);
                  }
                }}
                textColor="#ffffff"
                style={styles.timePicker}
              />
            )}
            
            <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
              <Text style={styles.nextButtonText}>Continue</Text>
              <ArrowRight color="#ffffff" size={20} />
            </TouchableOpacity>
          </Animated.View>
        );

      case "label":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <Text style={styles.stepTitle}>Label your alarm</Text>
            <Text style={styles.stepSubtitle}>Give it a name (optional)</Text>
            
            <TextInput
              style={styles.labelInput}
              placeholder="Morning alarm"
              placeholderTextColor="#ffffff60"
              value={label}
              onChangeText={setLabel}
              autoFocus
            />
            
            <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
              <Text style={styles.nextButtonText}>Continue</Text>
              <ArrowRight color="#ffffff" size={20} />
            </TouchableOpacity>
          </Animated.View>
        );

      case "repeat":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <Text style={styles.stepTitle}>Repeat</Text>
            <Text style={styles.stepSubtitle}>Select days to repeat this alarm</Text>
            
            <View style={styles.daysGrid}>
              {days.map((day, index) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayCard,
                    selectedDays.includes(day) && styles.dayCardSelected,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text
                    style={[
                      styles.dayCardText,
                      selectedDays.includes(day) && styles.dayCardTextSelected,
                    ]}
                  >
                    {shortDays[index]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <TouchableOpacity style={styles.nextButton} onPress={goToNextStep}>
              <Text style={styles.nextButtonText}>Continue</Text>
              <ArrowRight color="#ffffff" size={20} />
            </TouchableOpacity>
          </Animated.View>
        );

      case "voiceType":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            <Text style={styles.stepTitle}>How should it wake you?</Text>
            <Text style={styles.stepSubtitle}>Choose your alarm sound</Text>
            
            <View style={styles.voiceTypeGrid}>
              <TouchableOpacity
                style={[styles.voiceTypeCard, voiceType === "ai" && styles.voiceTypeCardSelected]}
                onPress={() => {
                  setVoiceType("ai");
                  setTimeout(() => {
                    router.push("/ai-voice-generator");
                    goToNextStep();
                  }, 300);
                }}
              >
                <Sparkles color={voiceType === "ai" ? "#ffffff" : "#ffffff80"} size={40} />
                <Text style={[styles.voiceTypeTitle, voiceType === "ai" && styles.voiceTypeTitleSelected]}>AI Voice</Text>
                <Text style={styles.voiceTypeSubtext}>Custom wake-up message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voiceTypeCard, voiceType === "recording" && styles.voiceTypeCardSelected]}
                onPress={() => {
                  setVoiceType("recording");
                  setTimeout(goToNextStep, 300);
                }}
              >
                <Mic color={voiceType === "recording" ? "#ffffff" : "#ffffff80"} size={40} />
                <Text style={[styles.voiceTypeTitle, voiceType === "recording" && styles.voiceTypeTitleSelected]}>Record</Text>
                <Text style={styles.voiceTypeSubtext}>Your own message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voiceTypeCard, voiceType === "radio" && styles.voiceTypeCardSelected]}
                onPress={() => {
                  setVoiceType("radio");
                  setTimeout(() => {
                    router.push("/radio-stations" as any);
                    goToNextStep();
                  }, 300);
                }}
              >
                <Radio color={voiceType === "radio" ? "#ffffff" : "#ffffff80"} size={40} />
                <Text style={[styles.voiceTypeTitle, voiceType === "radio" && styles.voiceTypeTitleSelected]}>Radio</Text>
                <Text style={styles.voiceTypeSubtext}>Live radio station</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        );

      case "voiceSetup":
        return (
          <Animated.View style={[styles.stepContainer, animatedStyle]}>
            {voiceType === "ai" && recordedAudioUri && (
              <View>
                <Text style={styles.stepTitle}>AI Voice Ready</Text>
                <View style={styles.setupPreview}>
                  <Text style={styles.setupLabel}>Script:</Text>
                  <Text style={styles.setupValue}>{aiPrompt}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push("/ai-voice-generator")}
                >
                  <Text style={styles.editButtonText}>Edit Voice</Text>
                </TouchableOpacity>
              </View>
            )}

            {voiceType === "recording" && (
              <View>
                <Text style={styles.stepTitle}>Record Your Message</Text>
                <VoiceRecorder
                  onSave={(uri) => {
                    setRecordedAudioUri(uri);
                    console.log("Audio saved:", uri);
                  }}
                />
              </View>
            )}

            {voiceType === "radio" && selectedStation && (
              <View>
                <Text style={styles.stepTitle}>Selected Station</Text>
                <View style={styles.setupPreview}>
                  <Text style={styles.setupLabel}>Station:</Text>
                  <Text style={styles.setupValue}>{selectedStation.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => router.push("/radio-stations" as any)}
                >
                  <Text style={styles.editButtonText}>Change Station</Text>
                </TouchableOpacity>
              </View>
            )}
            
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Check color="#ffffff" size={20} />
              <Text style={styles.saveButtonText}>Create Alarm</Text>
            </TouchableOpacity>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  const steps: Step[] = ["permission", "time", "label", "repeat", "voiceType", "voiceSetup"];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f0c29", "#302b63", "#24243e"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: "",
          headerTintColor: "#ffffff",
          headerLeft: () => (
            <TouchableOpacity 
              onPress={currentStepIndex > 0 ? goToPrevStep : () => router.back()} 
              style={styles.headerButton}
            >
              <X color="#ffffff" size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View 
              style={[
                styles.progressBarFill,
                { width: `${progress}%` }
              ]} 
            />
          </View>
        </View>

        <View style={styles.content}>
          {renderStepContent()}
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
  headerButton: {
    marginHorizontal: 16,
    padding: 8,
  },
  progressBarContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: "#ffffff20",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4a90e2",
    borderRadius: 2,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stepContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#ffffff",
    marginTop: 24,
    marginBottom: 8,
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 16,
    color: "#ffffff80",
    marginBottom: 32,
    textAlign: "center",
  },
  choiceContainer: {
    width: "100%",
    gap: 16,
  },
  choiceCard: {
    backgroundColor: "#ffffff10",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff20",
  },
  choiceCardSelected: {
    backgroundColor: "#4a90e240",
    borderColor: "#4a90e2",
    transform: [{ scale: 1.02 }],
  },
  choiceEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  choiceTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#ffffff80",
    marginBottom: 4,
  },
  choiceTitleSelected: {
    color: "#ffffff",
  },
  choiceDescription: {
    fontSize: 14,
    color: "#ffffff60",
    textAlign: "center",
  },
  timeDisplay: {
    backgroundColor: "#ffffff10",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4a90e2",
    marginVertical: 24,
  },
  timeDisplayText: {
    fontSize: 56,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  timePicker: {
    alignSelf: "center",
    marginVertical: 24,
  },
  labelInput: {
    backgroundColor: "#ffffff10",
    borderRadius: 16,
    padding: 20,
    color: "#ffffff",
    fontSize: 18,
    borderWidth: 2,
    borderColor: "#4a90e2",
    width: "100%",
    textAlign: "center",
    marginBottom: 24,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginBottom: 32,
  },
  dayCard: {
    backgroundColor: "#ffffff10",
    borderRadius: 16,
    width: 70,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff20",
  },
  dayCardSelected: {
    backgroundColor: "#4a90e2",
    borderColor: "#4a90e2",
    transform: [{ scale: 1.05 }],
  },
  dayCardText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#ffffff60",
  },
  dayCardTextSelected: {
    color: "#ffffff",
  },
  voiceTypeGrid: {
    width: "100%",
    gap: 16,
    marginBottom: 24,
  },
  voiceTypeCard: {
    backgroundColor: "#ffffff10",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff20",
  },
  voiceTypeCardSelected: {
    backgroundColor: "#4a90e240",
    borderColor: "#4a90e2",
    transform: [{ scale: 1.02 }],
  },
  voiceTypeTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: "#ffffff80",
    marginTop: 12,
  },
  voiceTypeTitleSelected: {
    color: "#ffffff",
  },
  voiceTypeSubtext: {
    fontSize: 14,
    color: "#ffffff60",
    marginTop: 4,
    textAlign: "center",
  },
  setupPreview: {
    backgroundColor: "#ffffff10",
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: "#4a90e2",
  },
  setupLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#4a90e2",
    marginBottom: 8,
  },
  setupValue: {
    fontSize: 16,
    color: "#ffffff",
    lineHeight: 24,
  },
  editButton: {
    backgroundColor: "#ffffff20",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#ffffff30",
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  nextButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginTop: 16,
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  saveButton: {
    backgroundColor: "#4caf50",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginTop: 32,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
});
