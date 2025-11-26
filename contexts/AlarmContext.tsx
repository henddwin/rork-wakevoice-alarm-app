import createContextHook from "@nkzw/create-context-hook";
import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import AlarmService from "@/services/AlarmService";
import NotificationService from "@/services/NotificationService";

export type VoiceType = "ai" | "recording" | "radio";

export interface Alarm {
  id: string;
  hours: number;
  minutes: number;
  label: string;
  enabled: boolean;
  repeatDays: string[];
  voiceType: VoiceType;
  audioUri?: string;
  aiScript?: string;
  friendId?: string;
  friendName?: string;
  notificationId?: string;
  allowFriendMessages?: boolean;
  radioStationName?: string;
  radioStationUrl?: string;
}

export interface Friend {
  id: string;
  name: string;
  code: string;
  canSetAlarms: boolean;
}

const ALARMS_KEY = "alarms_storage";
const FRIENDS_KEY = "friends_storage";

export const [AlarmContext, useAlarms] = createContextHook(() => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadData();
    initializeServices();
    
    return () => {
      AlarmService.cleanup();
      NotificationService.cleanup();
    };
  }, []);

  useEffect(() => {
    if (isLoaded) {
      saveData();
      AlarmService.updateAlarms(alarms);
    }
  }, [alarms, friends, isLoaded]);

  const initializeServices = async () => {
    try {
      await NotificationService.initialize();
      console.log("AlarmContext: NotificationService initialized");
      
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      console.log("AlarmContext: Audio permission:", audioStatus);
    } catch (error) {
      console.error("AlarmContext: Error initializing services:", error);
    }
  };

  const loadData = async () => {
    try {
      const alarmsData = await AsyncStorage.getItem(ALARMS_KEY);
      const friendsData = await AsyncStorage.getItem(FRIENDS_KEY);

      if (alarmsData) {
        setAlarms(JSON.parse(alarmsData));
      }
      if (friendsData) {
        setFriends(JSON.parse(friendsData));
      }
      
      const loadedAlarms = alarmsData ? JSON.parse(alarmsData) : [];
      await AlarmService.initialize(loadedAlarms);
      
      setIsLoaded(true);
    } catch (error) {
      console.error("Error loading data:", error);
      setIsLoaded(true);
    }
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
      await AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const scheduleNotification = async (alarm: Alarm): Promise<string | undefined> => {
    try {
      const notificationId = await NotificationService.scheduleAlarmNotification(alarm);
      console.log("AlarmContext: Scheduled notification for alarm", alarm.id, ":", notificationId);
      return notificationId;
    } catch (error) {
      console.error("AlarmContext: Error scheduling notification:", error);
      return undefined;
    }
  };

  const cancelNotification = async (notificationId?: string) => {
    if (notificationId) {
      try {
        await NotificationService.cancelNotification(notificationId);
        console.log("AlarmContext: Cancelled notification:", notificationId);
      } catch (error) {
        console.error("AlarmContext: Error canceling notification:", error);
      }
    }
  };

  const addAlarm = async (alarm: Omit<Alarm, "id" | "notificationId">) => {
    const newAlarm: Alarm = {
      ...alarm,
      id: Date.now().toString(),
    };

    if (newAlarm.enabled) {
      const notificationId = await scheduleNotification(newAlarm);
      newAlarm.notificationId = notificationId;
    }

    setAlarms((prev) => [...prev, newAlarm]);
    console.log("Alarm added:", newAlarm);
  };

  const toggleAlarm = async (id: string) => {
    setAlarms((prev) =>
      prev.map((alarm) => {
        if (alarm.id === id) {
          const updatedAlarm = { ...alarm, enabled: !alarm.enabled };

          if (updatedAlarm.enabled) {
            scheduleNotification(updatedAlarm).then((notificationId) => {
              updatedAlarm.notificationId = notificationId;
              setAlarms((current) =>
                current.map((a) => (a.id === id ? updatedAlarm : a))
              );
            });
          } else {
            cancelNotification(alarm.notificationId);
            updatedAlarm.notificationId = undefined;
          }

          return updatedAlarm;
        }
        return alarm;
      })
    );
  };

  const deleteAlarm = async (id: string) => {
    const alarm = alarms.find((a) => a.id === id);
    if (alarm?.notificationId) {
      await cancelNotification(alarm.notificationId);
    }
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  const updateAlarm = async (id: string, updates: Partial<Omit<Alarm, "id">>) => {
    const alarm = alarms.find((a) => a.id === id);
    if (!alarm) return;

    if (alarm.notificationId) {
      await cancelNotification(alarm.notificationId);
    }

    const updatedAlarm = { ...alarm, ...updates };

    if (updatedAlarm.enabled) {
      const notificationId = await scheduleNotification(updatedAlarm);
      updatedAlarm.notificationId = notificationId;
    } else {
      updatedAlarm.notificationId = undefined;
    }

    setAlarms((prev) => prev.map((a) => (a.id === id ? updatedAlarm : a)));
    console.log("Alarm updated:", updatedAlarm);
  };

  const addFriend = (name: string, code?: string) => {
    const newFriend: Friend = {
      id: code || Date.now().toString(),
      name,
      code: code || "",
      canSetAlarms: true,
    };
    setFriends((prev) => [...prev, newFriend]);
  };

  const toggleFriendPermission = (id: string) => {
    setFriends((prev) =>
      prev.map((friend) =>
        friend.id === id
          ? { ...friend, canSetAlarms: !friend.canSetAlarms }
          : friend
      )
    );
  };

  const deleteFriend = (id: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
    setAlarms((prev) => prev.filter((a) => a.friendId !== id));
  };

  return {
    alarms,
    friends,
    addAlarm,
    updateAlarm,
    toggleAlarm,
    deleteAlarm,
    addFriend,
    toggleFriendPermission,
    deleteFriend,
  };
});
