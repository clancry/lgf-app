// ─── NOTIFICATIONS PUSH ──────────────────────────────────────────────────────
// Utilise expo-notifications (à installer : npx expo install expo-notifications)
// Pour le prototype : simulation des notifications

import { Platform } from 'react-native';
import { CoachMode, getCoachMessage } from './coach-modes';

export interface NotificationConfig {
  title: string;
  body: string;
  trigger?: { hour: number; minute: number; repeats: boolean };
}

// Notifications planifiées par défaut selon le mode coach
export function getDailyNotifications(
  coachMode: CoachMode,
  trainingTime?: string, // ex: "18:00"
): NotificationConfig[] {
  const trainingHour = trainingTime ? parseInt(trainingTime.split(':')[0]) : 18;

  return [
    // 7h00 — Bonjour + Quiz du jour
    {
      title: `Quiz du jour ⚡`,
      body: getCoachMessage(coachMode, 'morning'),
      trigger: { hour: 7, minute: 0, repeats: true },
    },
    // 30 min avant l'entraînement — Pre-workout
    {
      title: `⏰ Repas pre-workout`,
      body: `Dans 30 min c'est l'entraînement. Prends ton repas pre-workout maintenant !`,
      trigger: { hour: trainingHour - 1, minute: 30, repeats: true },
    },
    // 30 min après l'entraînement — Fenêtre anabolique
    {
      title: `🔥 Fenêtre anabolique ouverte`,
      body: `Tu viens de terminer ta séance. Mange dans les 30 minutes — c'est maintenant que ça se construit.`,
      trigger: { hour: trainingHour, minute: 30, repeats: true },
    },
    // 20h30 — Rappel dîner
    {
      title: `🍽️ Dîner`,
      body: coachMode === 'warrior'
        ? `⚔️ Ton dernier repas de la journée. Protéines + légumes. Pas de glucides après 20h.`
        : `N'oublie pas ton dîner pour atteindre tes objectifs du jour.`,
      trigger: { hour: 20, minute: 30, repeats: true },
    },
    // 22h00 — Bilan du jour
    {
      title: `📊 Bilan du jour`,
      body: `Tu as atteint tes objectifs aujourd'hui ? Vérifie ton plan.`,
      trigger: { hour: 22, minute: 0, repeats: true },
    },
  ];
}

// Simulation pour le prototype (affiche une notification locale immédiate)
export async function scheduleTestNotification(title: string, body: string) {
  if (Platform.OS === 'web') {
    // Sur web : notification browser native si permis
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body, icon: '/logo-lgf.jpeg' });
      }
    }
    return;
  }

  // Sur mobile : expo-notifications
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // Immédiat
    });
  } catch (e) {
    console.log('Notifications not available:', e);
  }
}

// Demander les permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  try {
    const Notifications = await import('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// Configurer toutes les notifications récurrentes
export async function setupDailyNotifications(
  coachMode: CoachMode,
  trainingTime?: string,
) {
  if (Platform.OS === 'web') return;

  try {
    const Notifications = await import('expo-notifications');

    // Configurer le gestionnaire de notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Annuler toutes les notifications existantes
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Programmer les nouvelles
    const configs = getDailyNotifications(coachMode, trainingTime);
    for (const config of configs) {
      if (config.trigger) {
        await Notifications.scheduleNotificationAsync({
          content: { title: config.title, body: config.body, sound: true },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: config.trigger.hour,
            minute: config.trigger.minute,
          },
        });
      }
    }

    console.log(`✓ ${configs.length} notifications planifiées`);
  } catch (e) {
    console.log('Notifications setup failed:', e);
  }
}
