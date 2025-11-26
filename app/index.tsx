import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert, Platform } from "react-native";
import { Stack, router } from "expo-router";
import { AlarmClock, Plus, Users, UserPlus, Edit2, Trash2, TestTube2 } from "lucide-react-native";
import { useAlarms, type Alarm } from "@/contexts/AlarmContext";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

export default function HomeScreen() {
  const { alarms, toggleAlarm, deleteAlarm, addAlarm } = useAlarms();

  const formatTime = (hours: number, minutes: number) => {
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${period}`;
  };

  const getDaysText = (days: string[]) => {
    if (days.length === 7) return "Every day";
    if (days.length === 0) return "Once";
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOrder = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days
      .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
      .map(d => shortDays[dayOrder.indexOf(d)])
      .join(", ");
  };

  const scheduleTestAlarm = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const now = new Date();
    const testTime = new Date(now.getTime() + 30000);
    
    await addAlarm({
      hours: testTime.getHours(),
      minutes: testTime.getMinutes(),
      label: "🧪 Test Alarm",
      enabled: true,
      repeatDays: [],
      voiceType: "ai",
    });

    Alert.alert(
      "Test Alarm Scheduled ✅",
      `A test alarm will ring in 30 seconds at ${formatTime(testTime.getHours(), testTime.getMinutes())}.\n\n📱 Lock your device now to test the lock screen notification!\n\nYou should see:\n• Notification on lock screen\n• Stop and Snooze buttons\n• Alarm sound`,
      [{ text: "OK" }]
    );
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
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity
                onPress={scheduleTestAlarm}
                style={styles.headerButton}
              >
                <TestTube2 color="#ffd700" size={24} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/create-friend-alarm")}
                style={styles.headerButton}
              >
                <UserPlus color="#ffffff" size={24} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/friends")}
                style={styles.headerButton}
              >
                <Users color="#ffffff" size={24} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <AlarmClock color="#ffffff" size={40} />
          <Text style={styles.headerTitle}>Alarms</Text>
          <Text style={styles.headerSubtitle}>
            {alarms.filter((a: Alarm) => a.enabled).length} active
          </Text>
        </View>

        <FlatList
          data={alarms}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <AlarmClock color="#ffffff40" size={80} />
              <Text style={styles.emptyText}>No alarms yet</Text>
              <Text style={styles.emptySubtext}>
                Tap + to create your first AI-powered alarm
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.alarmCard}>
              <View style={styles.alarmContent}>
                <TouchableOpacity
                  style={styles.alarmLeft}
                  onPress={() => router.push({
                    pathname: "/create-alarm",
                    params: { editId: item.id },
                  })}
                >
                  <Text style={styles.alarmTime}>
                    {formatTime(item.hours, item.minutes)}
                  </Text>
                  <Text style={styles.alarmLabel}>{item.label}</Text>
                  <Text style={styles.alarmDays}>{getDaysText(item.repeatDays)}</Text>
                  <View style={styles.voiceTypeContainer}>
                    {item.voiceType === "ai" && (
                      <Text style={styles.voiceTypeBadge}>AI Voice</Text>
                    )}
                    {item.voiceType === "recording" && (
                      <Text style={styles.voiceTypeBadge}>Custom Recording</Text>
                    )}
                    {item.voiceType === "radio" && (
                      <Text style={[styles.voiceTypeBadge, styles.radioBadge]}>
                        Radio: {item.radioStationName}
                      </Text>
                    )}
                    {item.friendId && (
                      <Text style={[styles.voiceTypeBadge, styles.friendBadge]}>
                        From Friend
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.alarmRight}>
                  <Switch
                    value={item.enabled}
                    onValueChange={() => toggleAlarm(item.id)}
                    trackColor={{ false: "#767577", true: "#4a90e2" }}
                    thumbColor={item.enabled ? "#ffffff" : "#f4f3f4"}
                  />
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => router.push({
                        pathname: "/create-alarm",
                        params: { editId: item.id },
                      })}
                    >
                      <Edit2 color="#4a90e2" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => deleteAlarm(item.id)}
                    >
                      <Trash2 color="#e24a4a" size={20} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push("/create-alarm")}
        >
          <LinearGradient
            colors={["#4a90e2", "#357abd"]}
            style={styles.fabGradient}
          >
            <Plus color="#ffffff" size={32} />
          </LinearGradient>
        </TouchableOpacity>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: "center",
  },
  headerButtons: {
    flexDirection: "row",
    gap: 8,
  },
  headerButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: "#ffffff",
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#ffffff80",
    marginTop: 4,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "600" as const,
    color: "#ffffff",
    marginTop: 24,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#ffffff60",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
  alarmCard: {
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  alarmContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  alarmLeft: {
    flex: 1,
  },
  alarmRight: {
    alignItems: "center",
    gap: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  deleteButton: {
    backgroundColor: "#e24a4a20",
    borderColor: "#e24a4a40",
  },
  alarmTime: {
    fontSize: 36,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  alarmLabel: {
    fontSize: 16,
    color: "#ffffff",
    marginTop: 4,
  },
  alarmDays: {
    fontSize: 14,
    color: "#ffffff80",
    marginTop: 4,
  },
  voiceTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
    gap: 6,
  },
  voiceTypeBadge: {
    fontSize: 12,
    color: "#4a90e2",
    backgroundColor: "#4a90e220",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  friendBadge: {
    color: "#e24a90",
    backgroundColor: "#e24a9020",
  },
  radioBadge: {
    color: "#4ae290",
    backgroundColor: "#4ae29020",
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
});
