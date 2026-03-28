import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Keyboard,
} from "react-native";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Sparkles, Mic, X, Check, UserPlus } from "lucide-react-native";
import VoiceRecorder from "@/components/VoiceRecorder";
import { useAlarms, type VoiceType, type Friend } from "@/contexts/AlarmContext";
import { useMutation } from "@tanstack/react-query";
import { generateText } from "@rork-ai/toolkit-sdk";
import { File, Paths } from "expo-file-system";

export default function CreateFriendAlarmScreen() {
  const { addAlarm, friends } = useAlarms();
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [label, setLabel] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [voiceType, setVoiceType] = useState<VoiceType | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === "ios");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [recordedAudioUri, setRecordedAudioUri] = useState<string | null>(null);

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const availableFriends = friends.filter((f) => f.canSetAlarms);

  const generateScriptMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const script = await generateText({
        messages: [
          {
            role: "user",
            content: `Generate a short, energetic wake-up message (2-3 sentences) from a friend based on this: ${prompt}. Make it personal and friendly.`,
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
    let audioUri: string | undefined;
    let aiScript: string | undefined;

    if (!selectedFriend) {
      alert("Please select a friend for this alarm");
      return;
    }

    if (!voiceType) {
      alert("Please select a voice type for your alarm");
      return;
    }

    if (voiceType === "ai") {
      if (!aiPrompt) {
        alert("Please enter a prompt for AI voice generation");
        return;
      }
      
      Keyboard.dismiss();
      
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
    } else if (voiceType === "recording") {
      if (!recordedAudioUri) {
        alert("Please record an audio message first!");
        return;
      }
      audioUri = recordedAudioUri;
    }

    await addAlarm({
      hours: selectedTime.getHours(),
      minutes: selectedTime.getMinutes(),
      label: label || `Alarm from ${selectedFriend.name}`,
      enabled: true,
      repeatDays: selectedDays,
      voiceType,
      audioUri,
      aiScript,
      friendId: selectedFriend.id,
      friendName: selectedFriend.name,
    });

    router.back();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1a1a2e", "#16213e", "#0f3460"]}
        style={StyleSheet.absoluteFillObject}
      />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerTitle: "",
          headerTintColor: "#ffffff",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <X color="#ffffff" size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
              <Check color="#ffffff" size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleSection}>
            <UserPlus color="#ffffff" size={32} />
            <Text style={styles.title}>Friend Alarm</Text>
            <Text style={styles.subtitle}>Create an alarm from a friend</Text>
          </View>

          <Text style={styles.sectionTitle}>Select Friend</Text>
          {availableFriends.length === 0 ? (
            <View style={styles.noFriendsContainer}>
              <Text style={styles.noFriendsText}>
                No friends available. Add friends first!
              </Text>
              <TouchableOpacity
                style={styles.addFriendsButton}
                onPress={() => router.push("/friends")}
              >
                <Text style={styles.addFriendsButtonText}>Go to Friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.friendSelector}
              onPress={() => setShowFriendPicker(!showFriendPicker)}
            >
              <Text style={styles.friendSelectorText}>
                {selectedFriend ? selectedFriend.name : "Select a friend"}
              </Text>
            </TouchableOpacity>
          )}

          {showFriendPicker && availableFriends.length > 0 && (
            <View style={styles.friendPicker}>
              {availableFriends.map((friend) => (
                <TouchableOpacity
                  key={friend.id}
                  style={[
                    styles.friendOption,
                    selectedFriend?.id === friend.id && styles.friendOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedFriend(friend);
                    setShowFriendPicker(false);
                  }}
                >
                  <Text style={styles.friendOptionText}>{friend.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Time</Text>
          {Platform.OS === "android" && !showTimePicker && (
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={styles.timeButtonText}>
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

          <Text style={styles.sectionTitle}>Label</Text>
          <TextInput
            style={styles.input}
            placeholder={
              selectedFriend ? `Alarm from ${selectedFriend.name}` : "Morning alarm"
            }
            placeholderTextColor="#ffffff60"
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.sectionTitle}>Repeat</Text>
          <View style={styles.daysContainer}>
            {days.map((day, index) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  selectedDays.includes(day) && styles.dayButtonSelected,
                ]}
                onPress={() => toggleDay(day)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    selectedDays.includes(day) && styles.dayButtonTextSelected,
                  ]}
                >
                  {shortDays[index]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Voice Type</Text>
          <View style={styles.voiceOptions}>
            <TouchableOpacity
              style={[
                styles.voiceOption,
                voiceType === "ai" && styles.voiceOptionSelected,
              ]}
              onPress={() => setVoiceType("ai")}
            >
              <Sparkles color={voiceType === "ai" ? "#ffffff" : "#ffffff80"} size={32} />
              <Text
                style={[
                  styles.voiceOptionText,
                  voiceType === "ai" && styles.voiceOptionTextSelected,
                ]}
              >
                AI Voice
              </Text>
              <Text style={styles.voiceOptionSubtext}>
                Generate a custom wake-up message
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.voiceOption,
                voiceType === "recording" && styles.voiceOptionSelected,
              ]}
              onPress={() => setVoiceType("recording")}
            >
              <Mic
                color={voiceType === "recording" ? "#ffffff" : "#ffffff80"}
                size={32}
              />
              <Text
                style={[
                  styles.voiceOptionText,
                  voiceType === "recording" && styles.voiceOptionTextSelected,
                ]}
              >
                Record
              </Text>
              <Text style={styles.voiceOptionSubtext}>
                Your friend records a message
              </Text>
            </TouchableOpacity>
          </View>

          {voiceType === "ai" && (
            <View style={styles.aiSection}>
              <Text style={styles.sectionTitle}>AI Prompt</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="E.g., A funny wake-up message from my friend"
                placeholderTextColor="#ffffff60"
                value={aiPrompt}
                onChangeText={setAiPrompt}
                multiline
                numberOfLines={4}
              />
              {generateScriptMutation.isPending && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#4a90e2" />
                  <Text style={styles.loadingText}>Generating script...</Text>
                </View>
              )}
              {generateScriptMutation.data && (
                <View style={styles.scriptPreview}>
                  <Text style={styles.scriptTitle}>Generated Script:</Text>
                  <Text style={styles.scriptText}>{generateScriptMutation.data}</Text>
                </View>
              )}
              {generateVoiceMutation.isPending && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#4a90e2" />
                  <Text style={styles.loadingText}>Generating voice...</Text>
                </View>
              )}
            </View>
          )}

          {voiceType === "recording" && (
            <View style={styles.recordingSection}>
              <Text style={styles.sectionTitle}>Record Message for Friend</Text>
              <VoiceRecorder
                onSave={(uri) => {
                  setRecordedAudioUri(uri);
                  console.log("Audio saved:", uri);
                }}
              />
            </View>
          )}
        </ScrollView>
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
  },
  scrollContent: {
    padding: 24,
    paddingTop: 80,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: "#ffffff",
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#ffffff80",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#ffffff",
    marginTop: 24,
    marginBottom: 12,
  },
  friendSelector: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  friendSelectorText: {
    color: "#ffffff",
    fontSize: 16,
  },
  friendPicker: {
    marginTop: 8,
    gap: 8,
  },
  friendOption: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  friendOptionSelected: {
    backgroundColor: "#4a90e230",
    borderColor: "#4a90e2",
  },
  friendOptionText: {
    color: "#ffffff",
    fontSize: 16,
  },
  noFriendsContainer: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  noFriendsText: {
    color: "#ffffff80",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  addFriendsButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  addFriendsButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  timeButton: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  timeButtonText: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  timePicker: {
    alignSelf: "center",
  },
  input: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 16,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  daysContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  dayButton: {
    backgroundColor: "#ffffff10",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff15",
    minWidth: 64,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dayButtonSelected: {
    backgroundColor: "#4a90e2",
    borderColor: "#4a90e2",
    shadowColor: "#4a90e2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  dayButtonText: {
    color: "#ffffff60",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  dayButtonTextSelected: {
    color: "#ffffff",
  },
  voiceOptions: {
    gap: 12,
  },
  voiceOption: {
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff20",
  },
  voiceOptionSelected: {
    backgroundColor: "#4a90e230",
    borderColor: "#4a90e2",
  },
  voiceOptionText: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#ffffff80",
    marginTop: 12,
  },
  voiceOptionTextSelected: {
    color: "#ffffff",
  },
  voiceOptionSubtext: {
    fontSize: 14,
    color: "#ffffff60",
    marginTop: 4,
    textAlign: "center",
  },
  aiSection: {
    marginTop: 12,
  },
  recordingSection: {
    marginTop: 12,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },
  loadingText: {
    color: "#ffffff80",
    fontSize: 14,
  },
  scriptPreview: {
    backgroundColor: "#ffffff10",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#4a90e2",
  },
  scriptTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: "#4a90e2",
    marginBottom: 8,
  },
  scriptText: {
    fontSize: 16,
    color: "#ffffff",
    lineHeight: 24,
  },
});
