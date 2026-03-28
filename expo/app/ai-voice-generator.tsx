import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Keyboard,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Wand2, Play, Save, RefreshCw, Volume2 } from "lucide-react-native";
import { useMutation } from "@tanstack/react-query";
import { generateText } from "@rork-ai/toolkit-sdk";
import { File, Paths } from "expo-file-system";
import { Audio } from "expo-av";

const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Calm and soothing" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Strong and confident" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Soft and friendly" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Deep and warm" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", description: "Bright and energetic" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Young and enthusiastic" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", description: "Crisp and professional" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Natural and clear" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", description: "Raspy and dynamic" },
];

export default function AIVoiceGeneratorScreen() {
  const { returnUri } = useLocalSearchParams<{ returnUri?: string }>();
  const [prompt, setPrompt] = useState("");
  const [generatedScript, setGeneratedScript] = useState("");
  const [editableScript, setEditableScript] = useState("");
  const [selectedVoice, setSelectedVoice] = useState(ELEVENLABS_VOICES[0]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [scriptHistory, setScriptHistory] = useState<string[]>([]);
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [pressedButton, setPressedButton] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const generateScriptMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      const messages: { role: "user" | "assistant"; content: string }[] = [
        ...conversationHistory,
        {
          role: "user",
          content: userPrompt,
        },
      ];

      if (conversationHistory.length === 0) {
        messages.unshift({
          role: "user",
          content: `Generate a short, energetic wake-up message (2-3 sentences) based on this: ${userPrompt}. Make it motivational and personal. Output ONLY the wake-up message text, nothing else. No introduction, no explanation, just the message itself.`,
        });
      } else {
        messages[messages.length - 1] = {
          role: "user",
          content: `Based on the previous script: "${editableScript || generatedScript}", ${userPrompt}. Output ONLY the modified script, nothing else. No introduction, no explanation, just the script itself.`,
        };
      }

      const script = await generateText({ messages });
      return script.trim();
    },
    onSuccess: (script) => {
      setScriptHistory((prev) => [...prev, editableScript || generatedScript]);
      setGeneratedScript(script);
      setEditableScript(script);
      setConversationHistory((prev) => [
        ...prev,
        { role: "user", content: prompt },
        { role: "assistant", content: script },
      ]);
      setPrompt("");
      Keyboard.dismiss();
    },
  });

  const generateVoiceMutation = useMutation({
    mutationFn: async (text: string) => {
      const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        throw new Error("ElevenLabs API key not configured");
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice.id}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
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
        const file = new File(Paths.cache, `ai_voice_${Date.now()}.mp3`);
        const bytes = await response
          .arrayBuffer()
          .then((buffer) => new Uint8Array(buffer));
        file.create();
        file.write(bytes);
        return file.uri;
      }
    },
    onSuccess: (uri) => {
      setAudioUri(uri);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      Alert.alert("Error", "Please enter a prompt");
      return;
    }
    Keyboard.dismiss();
    generateScriptMutation.mutate(prompt);
  };

  const handleFollowUp = (followUp: string, buttonId?: string) => {
    if (!editableScript.trim()) {
      Alert.alert("Error", "Please generate a script first");
      return;
    }
    
    if (buttonId) {
      setPressedButton(buttonId);
      setTimeout(() => setPressedButton(null), 300);
    }
    
    Keyboard.dismiss();
    setScriptHistory((prev) => [...prev, editableScript]);
    const tempPrompt = followUp;
    setFollowUpPrompt("");
    generateScriptMutation.mutate(tempPrompt);
  };

  const handleUndo = () => {
    if (scriptHistory.length === 0) {
      Alert.alert("Cannot Undo", "No previous version available");
      return;
    }
    const previous = scriptHistory[scriptHistory.length - 1];
    setEditableScript(previous);
    setGeneratedScript(previous);
    setScriptHistory((prev) => prev.slice(0, -1));
    setAudioUri(null);
  };

  const handleGenerateVoice = () => {
    if (!editableScript.trim()) {
      Alert.alert("Error", "Please generate a script first");
      return;
    }
    Keyboard.dismiss();
    generateVoiceMutation.mutate(editableScript);
  };

  const handlePlayPreview = async () => {
    if (!audioUri) return;

    try {
      if (isPlaying) {
        if (sound) {
          await sound.stopAsync();
          setIsPlaying(false);
        }
        return;
      }

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );
      
      await newSound.setVolumeAsync(1.0);

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error("Failed to play audio:", error);
      Alert.alert("Error", "Failed to play audio preview");
    }
  };

  const handleVoicePreview = async (voiceId: string) => {
    console.log("[VoicePreview] Starting preview for voice:", voiceId);
    setPreviewingVoiceId(voiceId);
    try {
      const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        console.error("[VoicePreview] API key not configured");
        throw new Error("ElevenLabs API key not configured");
      }

      const sampleText = "Good morning! Time to wake up and make today amazing!";
      console.log("[VoicePreview] Sample text:", sampleText);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: sampleText,
            model_id: "eleven_monolingual_v1",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        }
      );

      console.log("[VoicePreview] Response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[VoicePreview] API error response:", errorText);
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      let previewUri: string;
      if (Platform.OS === "web") {
        const blob = await response.blob();
        previewUri = URL.createObjectURL(blob);
        console.log("[VoicePreview] Created blob URL:", previewUri);
      } else {
        const file = new File(Paths.cache, `preview_${Date.now()}.mp3`);
        const bytes = await response
          .arrayBuffer()
          .then((buffer) => new Uint8Array(buffer));
        file.create();
        file.write(bytes);
        previewUri = file.uri;
        console.log("[VoicePreview] Created file URI:", previewUri);
      }

      if (sound) {
        console.log("[VoicePreview] Unloading previous sound");
        await sound.unloadAsync();
      }

      console.log("[VoicePreview] Creating and playing audio");
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: previewUri },
        { shouldPlay: true, volume: 1.0 }
      );
      
      await newSound.setVolumeAsync(1.0);

      setSound(newSound);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log("[VoicePreview] Playback finished");
          setPreviewingVoiceId(null);
        }
      });
      console.log("[VoicePreview] Successfully started playback");
    } catch (error) {
      console.error("[VoicePreview] Failed to preview voice:", error);
      Alert.alert("Error", `Failed to preview voice: ${error}`);
      setPreviewingVoiceId(null);
    }
  };

  const handleSave = () => {
    if (!audioUri) {
      Alert.alert("Error", "Please generate voice first");
      return;
    }

    if (returnUri) {
      router.back();
      router.setParams({
        aiVoiceUri: audioUri,
        aiScript: editableScript,
      });
    } else {
      router.back();
    }
  };

  const handleReset = () => {
    Alert.alert("Reset", "Are you sure you want to start over?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setPrompt("");
          setGeneratedScript("");
          setEditableScript("");
          setAudioUri(null);
          setConversationHistory([]);
          if (sound) {
            sound.unloadAsync();
          }
          setIsPlaying(false);
        },
      },
    ]);
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
          headerTitle: "AI Voice Generator",
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontSize: 18, fontWeight: "600" },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <X color="#ffffff" size={24} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleReset} style={styles.headerButton}>
              <RefreshCw color="#ffffff" size={20} />
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
            <Text style={styles.sectionTitle}>Select Voice</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.voicesScroll}
              contentContainerStyle={styles.voicesScrollContent}
            >
              {ELEVENLABS_VOICES.map((voice) => (
                <View key={voice.id} style={styles.voiceCardWrapper}>
                  <TouchableOpacity
                    style={[
                      styles.voiceCard,
                      selectedVoice.id === voice.id && styles.voiceCardSelected,
                    ]}
                    onPress={() => setSelectedVoice(voice)}
                  >
                    <Volume2
                      color={
                        selectedVoice.id === voice.id ? "#ffffff" : "#ffffff80"
                      }
                      size={24}
                    />
                    <Text
                      style={[
                        styles.voiceName,
                        selectedVoice.id === voice.id && styles.voiceNameSelected,
                      ]}
                    >
                      {voice.name}
                    </Text>
                    <Text style={styles.voiceDescription}>{voice.description}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.previewVoiceButton}
                    onPress={() => handleVoicePreview(voice.id)}
                    disabled={previewingVoiceId !== null}
                  >
                    {previewingVoiceId === voice.id ? (
                      <ActivityIndicator color="#4a90e2" size="small" />
                    ) : (
                      <Play color="#4a90e2" size={16} />
                    )}
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {!editableScript && (
              <>
                <Text style={styles.sectionTitle}>
                  What kind of wake-up message?
                </Text>
                <View style={styles.promptSection}>
                  <TextInput
                    style={styles.promptInput}
                    placeholder="E.g., Motivate me for my morning workout"
                    placeholderTextColor="#ffffff60"
                    value={prompt}
                    onChangeText={setPrompt}
                    multiline
                    numberOfLines={3}
                  />
                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      generateScriptMutation.isPending && styles.buttonDisabled,
                    ]}
                    onPress={handleGenerate}
                    disabled={generateScriptMutation.isPending}
                  >
                    {generateScriptMutation.isPending ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Wand2 color="#ffffff" size={20} />
                        <Text style={styles.buttonText}>Generate Script</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {editableScript && (
              <>
                <View style={styles.scriptHeader}>
                  <Text style={styles.sectionTitle}>Your Script</Text>
                  {scriptHistory.length > 0 && (
                    <TouchableOpacity
                      onPress={handleUndo}
                      style={styles.undoButton}
                    >
                      <RefreshCw color="#4a90e2" size={18} />
                      <Text style={styles.undoText}>Undo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.scriptSection}>
                  <TextInput
                    style={styles.scriptInput}
                    value={editableScript}
                    onChangeText={setEditableScript}
                    multiline
                    numberOfLines={6}
                    placeholder="Your generated script will appear here..."
                    placeholderTextColor="#ffffff60"
                  />
                </View>

                <Text style={styles.sectionTitle}>Refine Script</Text>
                <View style={styles.presetButtons}>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      pressedButton === "edgy" && styles.presetButtonPressed,
                    ]}
                    onPress={() => handleFollowUp("Make it more edgy", "edgy")}
                    disabled={generateScriptMutation.isPending}
                  >
                    <Text style={styles.presetButtonText}>🔥 More Edgy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      pressedButton === "dark" && styles.presetButtonPressed,
                    ]}
                    onPress={() => handleFollowUp("Add dark humor", "dark")}
                    disabled={generateScriptMutation.isPending}
                  >
                    <Text style={styles.presetButtonText}>😈 Dark Humor</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      pressedButton === "motivational" && styles.presetButtonPressed,
                    ]}
                    onPress={() => handleFollowUp("Make it more motivational", "motivational")}
                    disabled={generateScriptMutation.isPending}
                  >
                    <Text style={styles.presetButtonText}>💪 Motivational</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      pressedButton === "funnier" && styles.presetButtonPressed,
                    ]}
                    onPress={() => handleFollowUp("Make it funnier", "funnier")}
                    disabled={generateScriptMutation.isPending}
                  >
                    <Text style={styles.presetButtonText}>😂 Funnier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      pressedButton === "shorter" && styles.presetButtonPressed,
                    ]}
                    onPress={() => handleFollowUp("Make it shorter", "shorter")}
                    disabled={generateScriptMutation.isPending}
                  >
                    <Text style={styles.presetButtonText}>✂️ Shorter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.presetButton,
                      pressedButton === "energetic" && styles.presetButtonPressed,
                    ]}
                    onPress={() => handleFollowUp("Make it more energetic", "energetic")}
                    disabled={generateScriptMutation.isPending}
                  >
                    <Text style={styles.presetButtonText}>⚡ Energetic</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.customPromptSection}>
                  <TextInput
                    style={styles.followUpInput}
                    placeholder="Or type your own refinement..."
                    placeholderTextColor="#ffffff60"
                    value={followUpPrompt}
                    onChangeText={setFollowUpPrompt}
                    multiline
                    numberOfLines={2}
                  />
                  <TouchableOpacity
                    style={[
                      styles.followUpButton,
                      generateScriptMutation.isPending && styles.buttonDisabled,
                    ]}
                    onPress={() => handleFollowUp(followUpPrompt)}
                    disabled={generateScriptMutation.isPending || !followUpPrompt.trim()}
                  >
                    {generateScriptMutation.isPending ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <>
                        <Wand2 color="#ffffff" size={18} />
                        <Text style={styles.buttonText}>Refine</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.generateVoiceButton,
                    generateVoiceMutation.isPending && styles.buttonDisabled,
                  ]}
                  onPress={handleGenerateVoice}
                  disabled={generateVoiceMutation.isPending}
                >
                  {generateVoiceMutation.isPending ? (
                    <>
                      <ActivityIndicator color="#ffffff" />
                      <Text style={styles.buttonText}>Generating Voice...</Text>
                    </>
                  ) : (
                    <>
                      <Volume2 color="#ffffff" size={20} />
                      <Text style={styles.buttonText}>Generate Voice</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {audioUri && (
              <View style={styles.previewSection}>
                <Text style={styles.sectionTitle}>Preview & Save</Text>
                <View style={styles.previewControls}>
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={handlePlayPreview}
                  >
                    {isPlaying ? (
                      <>
                        <ActivityIndicator color="#ffffff" />
                        <Text style={styles.playButtonText}>Playing...</Text>
                      </>
                    ) : (
                      <>
                        <Play color="#ffffff" size={24} />
                        <Text style={styles.playButtonText}>Play Preview</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                  >
                    <Save color="#ffffff" size={20} />
                    <Text style={styles.saveButtonText}>Save & Use</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.helpText}>
                  Tap &quot;Save &amp; Use&quot; to apply this voice to your alarm
                </Text>
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
    paddingHorizontal: 0,
    paddingTop: 80,
    paddingBottom: 400,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#ffffff",
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  voicesScroll: {
    marginBottom: 8,
    paddingLeft: 24,
  },
  voicesScrollContent: {
    gap: 12,
    paddingRight: 24,
  },
  voiceCardWrapper: {
    position: "relative",
  },
  voiceCard: {
    width: 140,
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffffff20",
  },
  voiceCardSelected: {
    backgroundColor: "#4a90e230",
    borderColor: "#4a90e2",
  },
  voiceName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#ffffff80",
    marginTop: 8,
  },
  voiceNameSelected: {
    color: "#ffffff",
  },
  voiceDescription: {
    fontSize: 12,
    color: "#ffffff60",
    marginTop: 4,
    textAlign: "center",
  },
  promptSection: {
    gap: 12,
    paddingHorizontal: 24,
  },
  promptInput: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 16,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
    minHeight: 80,
    textAlignVertical: "top",
  },
  generateButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  scriptSection: {
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  scriptInput: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 16,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#4a90e2",
    minHeight: 120,
    textAlignVertical: "top",
  },
  generateVoiceButton: {
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    marginHorizontal: 24,
  },
  previewSection: {
    marginTop: 24,
    backgroundColor: "#ffffff10",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#4ade80",
    marginHorizontal: 24,
  },
  previewControls: {
    gap: 12,
  },
  playButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  saveButton: {
    backgroundColor: "#4ade80",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700" as const,
  },
  helpText: {
    color: "#ffffff80",
    fontSize: 14,
    textAlign: "center",
    marginTop: 12,
  },
  scriptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4a90e2",
  },
  undoText: {
    color: "#4a90e2",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  presetButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  presetButton: {
    backgroundColor: "#ffffff20",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ffffff30",
  },
  presetButtonPressed: {
    backgroundColor: "#4a90e250",
    borderColor: "#4a90e2",
    transform: [{ scale: 0.95 }],
  },
  presetButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  customPromptSection: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    alignItems: "flex-start",
    paddingHorizontal: 24,
  },
  followUpInput: {
    flex: 1,
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 12,
    color: "#ffffff",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#ffffff20",
    minHeight: 44,
    textAlignVertical: "top",
  },
  followUpButton: {
    backgroundColor: "#4a90e2",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minWidth: 90,
    height: 44,
  },
  previewVoiceButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
