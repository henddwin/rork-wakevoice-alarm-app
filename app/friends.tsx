import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Clipboard,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { Stack } from "expo-router";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Users, Plus, X, Trash2, Bell, Copy, Hash, UserPlus } from "lucide-react-native";
import { useAlarms, type Friend, type Alarm } from "@/contexts/AlarmContext";
import { useUserProfile } from "@/contexts/UserProfileContext";

export default function FriendsScreen() {
  const { friends, addFriend, toggleFriendPermission, deleteFriend, alarms } = useAlarms();
  const { profile } = useUserProfile();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showAddByCode, setShowAddByCode] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendCode, setFriendCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  const handleAddFriend = () => {
    if (friendName.trim()) {
      Keyboard.dismiss();
      addFriend(friendName.trim());
      setFriendName("");
      setShowAddFriend(false);
    }
  };

  const handleAddByCode = async () => {
    if (friendCode.length !== 10) {
      Alert.alert("Invalid Code", "Please enter a 10-digit code");
      return;
    }

    if (friendCode === profile?.code) {
      Alert.alert("Error", "You cannot add yourself as a friend");
      return;
    }

    Keyboard.dismiss();
    setIsValidating(true);
    
    try {
      const friendExists = friends.some((f) => f.id === friendCode);
      if (friendExists) {
        Alert.alert("Already Added", "This friend is already in your list");
        setIsValidating(false);
        return;
      }

      addFriend(`Friend ${friendCode.slice(-4)}`, friendCode);
      setFriendCode("");
      setShowAddByCode(false);
      Alert.alert("Success", "Friend added successfully!");
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("Error", "Failed to add friend. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (profile?.code) {
      Clipboard.setString(profile.code);
      Alert.alert("Copied!", "Your friend code has been copied to clipboard");
    }
  };

  const handleDeleteFriend = (friend: Friend) => {
    Alert.alert(
      "Delete Friend",
      `Remove ${friend.name}? Their alarms will also be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteFriend(friend.id),
        },
      ]
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
          headerTintColor: "#ffffff",
        }}
      />

      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Users color="#ffffff" size={40} />
          <Text style={styles.headerTitle}>Friends</Text>
          <Text style={styles.headerSubtitle}>
            Manage who can set alarms for you
          </Text>
        </View>

        <View style={styles.codeCard}>
          <View style={styles.codeHeader}>
            <Hash color="#4a90e2" size={24} />
            <Text style={styles.codeTitle}>Your Friend Code</Text>
          </View>
          <View style={styles.codeDisplay}>
            <Text style={styles.codeText}>{profile?.code || "Loading..."}</Text>
            <TouchableOpacity onPress={copyCodeToClipboard} style={styles.copyButton}>
              <Copy color="#4a90e2" size={20} />
            </TouchableOpacity>
          </View>
          <Text style={styles.codeSubtext}>
            Share this code with friends so they can find you
          </Text>
        </View>

        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users color="#ffffff40" size={80} />
              <Text style={styles.emptyText}>No friends yet</Text>
              <Text style={styles.emptySubtext}>
                Add friends to share wake-up messages
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const approvedAlarms = alarms.filter(
              (alarm: Alarm) => alarm.allowFriendMessages && !alarm.friendId
            );
            return (
              <View style={styles.friendCard}>
                <View style={styles.friendLeft}>
                  <Text style={styles.friendName}>{item.name}</Text>
                  <View style={styles.permissionRow}>
                    <Bell color="#ffffff80" size={16} />
                    <Text style={styles.permissionText}>
                      Can set alarms: {item.canSetAlarms ? "Yes" : "No"}
                    </Text>
                  </View>
                  {approvedAlarms.length > 0 && (
                    <View style={styles.approvedAlarmsContainer}>
                      <Text style={styles.approvedAlarmsTitle}>
                        Approved Alarms ({approvedAlarms.length})
                      </Text>
                      {approvedAlarms.map((alarm: Alarm) => (
                        <Text key={alarm.id} style={styles.approvedAlarmText}>
                          • {alarm.label} at {String(alarm.hours).padStart(2, "0")}:
                          {String(alarm.minutes).padStart(2, "0")}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
                <View style={styles.friendActions}>
                  <Switch
                    value={item.canSetAlarms}
                    onValueChange={() => toggleFriendPermission(item.id)}
                    trackColor={{ false: "#767577", true: "#4a90e2" }}
                    thumbColor={item.canSetAlarms ? "#ffffff" : "#f4f3f4"}
                  />
                  <TouchableOpacity
                    onPress={() => handleDeleteFriend(item)}
                    style={styles.deleteButton}
                  >
                    <Trash2 color="#ff6b6b" size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />

        {!showAddFriend && !showAddByCode ? (
          <>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowAddFriend(true)}
            >
              <LinearGradient
                colors={["#4a90e2", "#357abd"]}
                style={styles.fabGradient}
              >
                <Plus color="#ffffff" size={32} />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fabSecondary}
              onPress={() => setShowAddByCode(true)}
            >
              <LinearGradient
                colors={["#50c878", "#45b868"]}
                style={styles.fabGradient}
              >
                <UserPlus color="#ffffff" size={28} />
              </LinearGradient>
            </TouchableOpacity>
          </>
        ) : showAddFriend ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.addFriendModal}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Friend</Text>
                <TouchableOpacity onPress={() => setShowAddFriend(false)}>
                  <X color="#ffffff" size={24} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Friend's name"
                placeholderTextColor="#ffffff60"
                value={friendName}
                onChangeText={setFriendName}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleAddFriend}
              >
                <LinearGradient
                  colors={["#4a90e2", "#357abd"]}
                  style={styles.modalButtonGradient}
                >
                  <Text style={styles.modalButtonText}>Add</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.addFriendModal}
            keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add by Code</Text>
                <TouchableOpacity onPress={() => {
                  setShowAddByCode(false);
                  setFriendCode("");
                }}>
                  <X color="#ffffff" size={24} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter 10-digit friend code"
                placeholderTextColor="#ffffff60"
                value={friendCode}
                onChangeText={setFriendCode}
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleAddByCode}
                disabled={isValidating}
              >
                <LinearGradient
                  colors={["#50c878", "#45b868"]}
                  style={styles.modalButtonGradient}
                >
                  {isValidating ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.modalButtonText}>Add Friend</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
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
    paddingTop: 80,
    paddingBottom: 24,
    alignItems: "center",
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
    textAlign: "center",
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
  friendCard: {
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    marginBottom: 12,
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  friendLeft: {
    flex: 1,
  },
  friendName: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  permissionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  permissionText: {
    fontSize: 14,
    color: "#ffffff80",
  },
  friendActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deleteButton: {
    padding: 8,
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
  addFriendModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#16213e",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#ffffff20",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  modalInput: {
    backgroundColor: "#ffffff15",
    borderRadius: 12,
    padding: 16,
    color: "#ffffff",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ffffff20",
    marginBottom: 16,
  },
  modalButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  modalButtonGradient: {
    padding: 16,
    alignItems: "center",
  },
  modalButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700" as const,
  },
  codeCard: {
    backgroundColor: "#ffffff15",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#4a90e2",
  },
  codeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  codeTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  codeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff10",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 28,
    fontWeight: "800" as const,
    color: "#ffffff",
    letterSpacing: 4,
  },
  copyButton: {
    padding: 8,
  },
  codeSubtext: {
    fontSize: 14,
    color: "#ffffff80",
    textAlign: "center",
  },
  fabSecondary: {
    position: "absolute",
    bottom: 104,
    right: 24,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  approvedAlarmsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#ffffff15",
  },
  approvedAlarmsTitle: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#4a90e2",
    marginBottom: 6,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  approvedAlarmText: {
    fontSize: 13,
    color: "#ffffff70",
    marginTop: 4,
    lineHeight: 18,
  },
});
