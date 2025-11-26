import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Audio } from "expo-av";
import { Mic, Square, Play, Trash2, Save } from "lucide-react-native";

interface VoiceRecorderProps {
  onSave: (audioUri: string) => void;
  onCancel?: () => void;
}

export default function VoiceRecorder({ onSave, onCancel }: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          Alert.alert("Error", "Audio recording is not supported on this browser");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecordingUri(audioUrl);
          
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
      } else {
        const permission = await Audio.requestPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission Required", "Please grant microphone permission to record audio");
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording: newRecording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        newRecording.setOnRecordingStatusUpdate((status) => {
          if (status.isRecording && status.durationMillis) {
            setRecordingDuration(Math.floor(status.durationMillis / 1000));
          }
        });

        setRecording(newRecording);
        setIsRecording(true);
      }
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      } else {
        if (!recording) return;

        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
        });

        const uri = recording.getURI();
        if (uri) {
          setRecordingUri(uri);
        }
        setRecording(null);
        setIsRecording(false);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to stop recording.");
    }
  };

  const playRecording = async () => {
    if (!recordingUri) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error) {
      console.error("Failed to play recording:", error);
      Alert.alert("Error", "Failed to play recording.");
    }
  };

  const deleteRecording = () => {
    if (sound) {
      sound.unloadAsync();
    }
    setRecordingUri(null);
    setRecordingDuration(0);
    setIsPlaying(false);
  };

  const saveRecording = () => {
    if (recordingUri) {
      onSave(recordingUri);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {!recordingUri ? (
        <View style={styles.recordingSection}>
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordingActive]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? (
              <Square color="#ffffff" size={32} fill="#ffffff" />
            ) : (
              <Mic color="#ffffff" size={32} />
            )}
          </TouchableOpacity>
          <Text style={styles.recordText}>
            {isRecording
              ? `Recording... ${formatDuration(recordingDuration)}`
              : "Tap to start recording"}
          </Text>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.playbackSection}>
          <Text style={styles.successText}>Recording saved!</Text>
          <Text style={styles.durationText}>
            Duration: {formatDuration(recordingDuration)}
          </Text>
          
          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={playRecording}
              disabled={isPlaying}
            >
              {isPlaying ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Play color="#ffffff" size={24} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.deleteButton]}
              onPress={deleteRecording}
            >
              <Trash2 color="#ffffff" size={24} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.controlButton, styles.saveButton]}
              onPress={saveRecording}
            >
              <Save color="#ffffff" size={24} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {onCancel && !isRecording && (
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  recordingSection: {
    alignItems: "center",
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4a90e2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingActive: {
    backgroundColor: "#e24a4a",
  },
  recordText: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e24a4a",
  },
  recordingText: {
    color: "#e24a4a",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  playbackSection: {
    alignItems: "center",
  },
  successText: {
    color: "#4ade80",
    fontSize: 18,
    fontWeight: "700" as const,
    marginBottom: 8,
  },
  durationText: {
    color: "#ffffff80",
    fontSize: 14,
    marginBottom: 24,
  },
  playbackControls: {
    flexDirection: "row",
    gap: 12,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#4a90e2",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    backgroundColor: "#e24a4a",
  },
  saveButton: {
    backgroundColor: "#4ade80",
  },
  cancelButton: {
    marginTop: 16,
    padding: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#ffffff80",
    fontSize: 14,
  },
});
