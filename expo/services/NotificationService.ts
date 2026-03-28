import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import { Alarm } from "@/contexts/AlarmContext";

export interface NotificationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
}

class NotificationService {
  private static instance: NotificationService;
  private notificationReceivedSubscription: Notifications.Subscription | null = null;
  private notificationResponseSubscription: Notifications.Subscription | null = null;
  private isInitialized = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log("NotificationService: Already initialized");
      return;
    }

    console.log("NotificationService: Initializing...");

    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data;
        console.log("NotificationService: Handling notification", data);
        
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });

    await this.registerNotificationCategories();
    this.setupListeners();
    this.isInitialized = true;
    console.log("NotificationService: Initialized successfully");
  }

  private async registerNotificationCategories(): Promise<void> {
    if (Platform.OS === "web") {
      console.log("NotificationService: Categories not supported on web");
      return;
    }

    try {
      await Notifications.setNotificationCategoryAsync("alarm", [
        {
          identifier: "STOP_ALARM",
          buttonTitle: "Stop",
          options: {
            opensAppToForeground: true,
            isDestructive: true,
          },
        },
        {
          identifier: "SNOOZE_ALARM",
          buttonTitle: "Snooze 5min",
          options: {
            opensAppToForeground: false,
          },
        },
      ]);
      console.log("NotificationService: Categories registered successfully");
    } catch (error) {
      console.error("NotificationService: Error registering categories:", error);
    }
  }

  private setupListeners(): void {
    if (this.notificationReceivedSubscription) {
      this.notificationReceivedSubscription.remove();
    }
    if (this.notificationResponseSubscription) {
      this.notificationResponseSubscription.remove();
    }

    this.notificationReceivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("NotificationService: Notification received in foreground", notification);
        const data = notification.request.content.data;
        
        if (data?.type === "alarm" && data?.alarmId) {
          console.log("NotificationService: Triggering alarm screen for:", data.alarmId);
          router.push({
            pathname: "/alarm-ringing" as any,
            params: { alarmId: data.alarmId as string },
          });
        }
      }
    );

    this.notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log("NotificationService: User responded to notification", response);
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content.data;
        const alarmId = data?.alarmId as string | undefined;

        console.log("NotificationService: Action:", actionId, "AlarmId:", alarmId);

        if (actionId === "STOP_ALARM") {
          console.log("NotificationService: Stop action triggered");
          await Notifications.dismissAllNotificationsAsync();
        } else if (actionId === "SNOOZE_ALARM" && alarmId) {
          console.log("NotificationService: Snooze action triggered for alarm:", alarmId);
          await this.scheduleSnooze(alarmId, data?.label as string);
        } else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER && alarmId) {
          console.log("NotificationService: Default action - opening alarm screen");
          router.push({
            pathname: "/alarm-ringing" as any,
            params: { alarmId },
          });
        }
      }
    );

    console.log("NotificationService: Listeners setup complete");
  }

  async requestPermissions(): Promise<NotificationPermissionStatus> {
    console.log("NotificationService: Requesting permissions...");
    
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log("NotificationService: Existing status:", existingStatus);

      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowCriticalAlerts: true,
            provideAppNotificationSettings: true,
            allowProvisional: false,
          },
          android: {},
        });
        finalStatus = status;
        console.log("NotificationService: New permission status:", finalStatus);
      }

      const settings = await Notifications.getPermissionsAsync();
      
      return {
        granted: finalStatus === "granted",
        canAskAgain: settings.canAskAgain ?? false,
        status: finalStatus,
      };
    } catch (error) {
      console.error("NotificationService: Error requesting permissions:", error);
      return {
        granted: false,
        canAskAgain: false,
        status: "error",
      };
    }
  }

  async getPermissionStatus(): Promise<NotificationPermissionStatus> {
    try {
      const settings = await Notifications.getPermissionsAsync();
      return {
        granted: settings.status === "granted",
        canAskAgain: settings.canAskAgain ?? false,
        status: settings.status,
      };
    } catch (error) {
      console.error("NotificationService: Error getting permission status:", error);
      return {
        granted: false,
        canAskAgain: false,
        status: "error",
      };
    }
  }

  async scheduleAlarmNotification(alarm: Alarm): Promise<string | undefined> {
    console.log("NotificationService: Scheduling notification for alarm:", alarm.id);

    try {
      if (alarm.repeatDays.length === 0) {
        return await this.scheduleOneTimeAlarm(alarm);
      } else {
        return await this.scheduleRepeatingAlarm(alarm);
      }
    } catch (error) {
      console.error("NotificationService: Error scheduling notification:", error);
      return undefined;
    }
  }

  private async scheduleOneTimeAlarm(alarm: Alarm): Promise<string | undefined> {
    const now = new Date();
    const triggerDate = new Date();
    triggerDate.setHours(alarm.hours);
    triggerDate.setMinutes(alarm.minutes);
    triggerDate.setSeconds(0);
    triggerDate.setMilliseconds(0);

    if (triggerDate <= now) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }

    const seconds = Math.floor((triggerDate.getTime() - now.getTime()) / 1000);
    console.log("NotificationService: One-time alarm in", seconds, "seconds");

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: this.createNotificationContent(alarm),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });

    console.log("NotificationService: Scheduled one-time notification:", notificationId);
    return notificationId;
  }

  private async scheduleRepeatingAlarm(alarm: Alarm): Promise<string | undefined> {
    const weekdayMap: { [key: string]: number } = {
      Sunday: 1,
      Monday: 2,
      Tuesday: 3,
      Wednesday: 4,
      Thursday: 5,
      Friday: 6,
      Saturday: 7,
    };

    const notificationIds: string[] = [];

    for (const day of alarm.repeatDays) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: this.createNotificationContent(alarm),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday: weekdayMap[day],
          hour: alarm.hours,
          minute: alarm.minutes,
          repeats: true,
        },
      });
      notificationIds.push(notificationId);
      console.log("NotificationService: Scheduled repeating notification for", day, ":", notificationId);
    }

    return notificationIds[0];
  }

  private createNotificationContent(alarm: Alarm): Notifications.NotificationContentInput {
    return {
      title: "⏰ Alarm",
      subtitle: alarm.label || "Wake up!",
      body: this.getAlarmBody(alarm),
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      categoryIdentifier: Platform.OS !== "web" ? "alarm" : undefined,
      data: {
        type: "alarm",
        alarmId: alarm.id,
        label: alarm.label,
        voiceType: alarm.voiceType,
      },
      ...(Platform.OS === "android" && {
        color: "#4a90e2",
        vibrate: [0, 250, 250, 250],
        sticky: true,
      }),
      ...(Platform.OS === "ios" && {
        interruptionLevel: "timeSensitive",
      }),
    };
  }

  private getAlarmBody(alarm: Alarm): string {
    const time = this.formatTime(alarm.hours, alarm.minutes);
    let body = `It's ${time}!`;

    if (alarm.voiceType === "radio" && alarm.radioStationName) {
      body += ` 📻 ${alarm.radioStationName}`;
    } else if (alarm.voiceType === "ai") {
      body += " ✨ AI Wake-up message";
    }

    return body;
  }

  private formatTime(hours: number, minutes: number): string {
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");
    return `${displayHours}:${displayMinutes} ${period}`;
  }

  async scheduleSnooze(alarmId: string, label?: string): Promise<string | undefined> {
    console.log("NotificationService: Scheduling snooze for alarm:", alarmId);

    const snoozeSeconds = 5 * 60;

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ Snoozed Alarm",
          subtitle: label || "Wake up!",
          body: "Your snoozed alarm is ringing!",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          categoryIdentifier: Platform.OS !== "web" ? "alarm" : undefined,
          data: {
            type: "alarm",
            alarmId,
            label,
            isSnooze: true,
          },
          ...(Platform.OS === "ios" && {
            interruptionLevel: "timeSensitive",
          }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: snoozeSeconds,
        },
      });

      console.log("NotificationService: Snooze scheduled:", notificationId);
      return notificationId;
    } catch (error) {
      console.error("NotificationService: Error scheduling snooze:", error);
      return undefined;
    }
  }

  async cancelNotification(notificationId: string): Promise<void> {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      console.log("NotificationService: Cancelled notification:", notificationId);
    } catch (error) {
      console.error("NotificationService: Error cancelling notification:", error);
    }
  }

  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("NotificationService: Cancelled all notifications");
    } catch (error) {
      console.error("NotificationService: Error cancelling all notifications:", error);
    }
  }

  async dismissAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      console.log("NotificationService: Dismissed all notifications");
    } catch (error) {
      console.error("NotificationService: Error dismissing notifications:", error);
    }
  }

  async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log("NotificationService: Scheduled notifications:", notifications.length);
      return notifications;
    } catch (error) {
      console.error("NotificationService: Error getting scheduled notifications:", error);
      return [];
    }
  }

  cleanup(): void {
    console.log("NotificationService: Cleaning up...");
    if (this.notificationReceivedSubscription) {
      this.notificationReceivedSubscription.remove();
      this.notificationReceivedSubscription = null;
    }
    if (this.notificationResponseSubscription) {
      this.notificationResponseSubscription.remove();
      this.notificationResponseSubscription = null;
    }
  }
}

export default NotificationService.getInstance();
