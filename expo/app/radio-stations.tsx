import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
} from "react-native";
import { Stack, router } from "expo-router";
import { useState, useEffect } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { X, Radio, Check } from "lucide-react-native";
import { RADIO_STATIONS, RADIO_CATEGORIES, type RadioStation } from "@/constants/radio-stations";
import { Audio } from "expo-av";
import { useRadioStation } from "@/contexts/RadioStationContext";

export default function RadioStationsScreen() {
  const { setSelectedStation } = useRadioStation();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [playingStationId, setPlayingStationId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [loadingStationId, setLoadingStationId] = useState<string | null>(null);
  const [errorStationId, setErrorStationId] = useState<string | null>(null);

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        cleanupSound(sound);
      }
    };
  }, [sound]);

  const cleanupSound = async (soundToClean: Audio.Sound) => {
    try {
      soundToClean.setOnPlaybackStatusUpdate(null);
      const status = await soundToClean.getStatusAsync();
      if (status.isLoaded) {
        await soundToClean.stopAsync();
        await soundToClean.unloadAsync();
      }
    } catch (error) {
      console.log("Error during sound cleanup:", error);
    }
  };

  const filteredStations = RADIO_STATIONS.filter(
    (station) => selectedCategory === "All" || station.category === selectedCategory
  );

  const handleStationSelect = async (station: RadioStation) => {
    console.log("Selected station:", station);
    
    if (sound) {
      await cleanupSound(sound);
      setSound(null);
      setPlayingStationId(null);
    }

    setSelectedStation({
      name: station.name,
      url: station.streamUrl,
    });

    router.back();
  };

  const handleStationTap = async (station: RadioStation) => {
    if (playingStationId === station.id) {
      handleStationSelect(station);
    } else {
      await handlePreviewStation(station);
    }
  };

  const handlePreviewStation = async (station: RadioStation) => {
    try {
      if (playingStationId === station.id) {
        if (sound) {
          await cleanupSound(sound);
          setSound(null);
        }
        setPlayingStationId(null);
        return;
      }

      setLoadingStationId(station.id);
      setErrorStationId(null);

      if (sound) {
        console.log("Stopping previous radio stream");
        await cleanupSound(sound);
        setSound(null);
        setPlayingStationId(null);
      }

      console.log("Loading radio stream:", station.streamUrl);
      
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: station.streamUrl },
        {
          shouldPlay: true,
          volume: 1.0,
          progressUpdateIntervalMillis: 1000,
          isLooping: false,
        },
        (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              console.error("Playback status error:", status.error);
              setErrorStationId(station.id);
              setPlayingStationId(null);
              setLoadingStationId(null);
            }
          } else {
            if (status.isPlaying) {
              setLoadingStationId(null);
            }
            if (status.didJustFinish) {
              setPlayingStationId(null);
            }
          }
        }
      );
      
      setSound(newSound);
      setPlayingStationId(station.id);
      setLoadingStationId(null);
      
    } catch (error) {
      console.error("Error playing radio stream:", error);
      setErrorStationId(station.id);
      setPlayingStationId(null);
      setLoadingStationId(null);
      setSound(null);
    }
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
          headerTitle: "Select Radio Station",
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontSize: 18, fontWeight: "600" },
          headerLeft: () => (
            <TouchableOpacity
              onPress={async () => {
                if (sound) {
                  await cleanupSound(sound);
                  setSound(null);
                  setPlayingStationId(null);
                }
                router.back();
              }}
              style={styles.headerButton}
            >
              <X color="#ffffff" size={24} />
            </TouchableOpacity>
          ),
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.content}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContent}
          >
            {RADIO_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonSelected,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category && styles.categoryButtonTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredStations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.stationsContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.stationCard,
                  playingStationId === item.id && styles.stationCardPlaying,
                  errorStationId === item.id && styles.stationCardError,
                ]}
                onPress={() => handleStationTap(item)}
                activeOpacity={0.7}
                disabled={loadingStationId === item.id}
              >
                <View style={styles.stationInfo}>
                  <View
                    style={[
                      styles.radioIcon,
                      playingStationId === item.id && styles.radioIconPlaying,
                    ]}
                  >
                    <Radio
                      color={playingStationId === item.id ? "#4affe2" : "#4a90e2"}
                      size={24}
                    />
                  </View>
                  <View style={styles.stationTextContainer}>
                    <Text style={styles.stationName}>{item.name}</Text>
                    <Text style={styles.stationCategory}>{item.category}</Text>
                    {playingStationId === item.id && (
                      <Text style={styles.playingLabel}>Now Playing</Text>
                    )}
                    {loadingStationId === item.id && (
                      <Text style={styles.loadingLabel}>Loading...</Text>
                    )}
                    {errorStationId === item.id && (
                      <Text style={styles.errorLabel}>Unable to play</Text>
                    )}
                  </View>
                </View>
                <View style={styles.rightSection}>
                  {playingStationId === item.id && (
                    <>
                      <View style={styles.playingIndicator}>
                        <View style={[styles.soundBar, styles.soundBar1]} />
                        <View style={[styles.soundBar, styles.soundBar2]} />
                        <View style={[styles.soundBar, styles.soundBar3]} />
                      </View>
                      <View style={styles.selectButton}>
                        <Check color="#ffffff" size={20} />
                      </View>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            )}
          />
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
  content: {
    flex: 1,
    paddingTop: 80,
  },
  headerButton: {
    marginHorizontal: 16,
  },
  categoriesScroll: {
    maxHeight: 60,
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 24,
    gap: 8,
  },
  categoryButton: {
    backgroundColor: "#ffffff15",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#ffffff20",
    marginRight: 8,
  },
  categoryButtonSelected: {
    backgroundColor: "#4a90e2",
    borderColor: "#4a90e2",
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#ffffff80",
  },
  categoryButtonTextSelected: {
    color: "#ffffff",
  },
  stationsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stationCard: {
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#ffffff20",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    padding: 20,
  },
  stationCardPlaying: {
    backgroundColor: "#4affe220",
    borderColor: "#4affe2",
    shadowColor: "#4affe2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  stationCardError: {
    backgroundColor: "#ff4a4a20",
    borderColor: "#ff4a4a",
  },
  stationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  radioIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4a90e220",
    alignItems: "center",
    justifyContent: "center",
  },
  radioIconPlaying: {
    backgroundColor: "#4affe230",
  },
  stationTextContainer: {
    flex: 1,
  },
  stationName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#ffffff",
    marginBottom: 4,
  },
  stationCategory: {
    fontSize: 14,
    color: "#ffffff80",
  },
  playingLabel: {
    fontSize: 12,
    color: "#4affe2",
    fontWeight: "700" as const,
    marginTop: 4,
  },
  loadingLabel: {
    fontSize: 12,
    color: "#ffffff80",
    fontWeight: "600" as const,
    marginTop: 4,
  },
  errorLabel: {
    fontSize: 12,
    color: "#ff4a4a",
    fontWeight: "600" as const,
    marginTop: 4,
  },
  playingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 12,
  },
  soundBar: {
    width: 3,
    backgroundColor: "#4affe2",
    borderRadius: 2,
  },
  soundBar1: {
    height: 12,
  },
  soundBar2: {
    height: 16,
  },
  soundBar3: {
    height: 10,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4affe2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4affe2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
});
