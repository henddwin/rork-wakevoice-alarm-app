import { Audio } from "expo-av";
import { router } from "expo-router";
import { AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { Alarm } from "@/contexts/AlarmContext";

class AlarmService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private alarms: Alarm[] = [];
  private sound: Audio.Sound | null = null;
  private appStateSubscription: any = null;

  async initialize(alarms: Alarm[]) {
    console.log("AlarmService: Initializing with", alarms.length, "alarms");
    this.alarms = alarms;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    });

    this.startMonitoring();
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        console.log("AlarmService: App state changed to", nextAppState);
        if (nextAppState === "active") {
          this.checkAlarms();
        }
      }
    );
  }

  updateAlarms(alarms: Alarm[]) {
    console.log("AlarmService: Updating alarms to", alarms.length, "alarms");
    this.alarms = alarms;
  }

  private startMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    console.log("AlarmService: Starting monitoring");
    this.checkInterval = setInterval(() => {
      this.checkAlarms();
    }, 5000);

    this.checkAlarms();
  }

  private checkAlarms() {
    const now = new Date();
    const currentDay = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    console.log(
      `AlarmService: Checking alarms at ${currentHour}:${currentMinute}:${currentSecond}`
    );

    this.alarms.forEach((alarm) => {
      if (!alarm.enabled) {
        return;
      }

      const isTimeMatch =
        alarm.hours === currentHour && alarm.minutes === currentMinute;
      const isWithinTriggerWindow = currentSecond < 10;

      if (!isTimeMatch || !isWithinTriggerWindow) {
        return;
      }

      const shouldRepeat = alarm.repeatDays.length > 0;
      const isDayMatch =
        !shouldRepeat || alarm.repeatDays.includes(currentDay);

      if (isDayMatch) {
        console.log("AlarmService: Triggering alarm", alarm.id, alarm.label);
        this.triggerAlarm(alarm);
      }
    });
  }

  private async triggerAlarm(alarm: Alarm) {
    console.log("AlarmService: Starting alarm trigger for", alarm.id);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Alarm Ringing!",
        body: alarm.label || "Time to wake up!",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });

    try {
      router.push({
        pathname: "/alarm-ringing" as any,
        params: { alarmId: alarm.id },
      });
    } catch (error) {
      console.error("AlarmService: Error navigating to alarm screen", error);
    }
  }

  async stopAlarm() {
    console.log("AlarmService: Stopping alarm");
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
        this.sound = null;
      } catch (error) {
        console.error("AlarmService: Error stopping alarm sound", error);
      }
    }
  }

  cleanup() {
    console.log("AlarmService: Cleaning up");
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    this.stopAlarm();
  }
}

export default new AlarmService();
