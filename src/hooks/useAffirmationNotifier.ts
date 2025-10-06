import { useEffect, useState } from 'react';
import { affirmationService } from '../services/affirmationService';
import { Affirmation, AffirmationSettings } from '../lib/supabase';

export function useAffirmationNotifier() {
  const [pendingAffirmation, setPendingAffirmation] = useState<Affirmation | null>(null);
  const [settings, setSettings] = useState<AffirmationSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: number;

    const loadSettings = async () => {
      try {
        const data = await affirmationService.getSettings();
        if (mounted) {
          setSettings(data);
        }
      } catch (error) {
        console.error('Error loading affirmation settings:', error);
      }
    };

    const checkForAffirmation = async () => {
      try {
        const affirmation = await affirmationService.checkAndShowAffirmation();
        if (mounted && affirmation) {
          setPendingAffirmation(affirmation);
          requestNotificationPermission();
        }
      } catch (error) {
        console.error('Error checking for affirmation:', error);
      }
    };

    const requestNotificationPermission = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    };

    loadSettings();

    intervalId = window.setInterval(() => {
      checkForAffirmation();
    }, 60000);

    checkForAffirmation();

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  const dismissNotification = () => {
    setPendingAffirmation(null);
  };

  const showBrowserNotification = (affirmation: Affirmation) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('Daily Affirmation', {
        body: affirmation.affirmation_text.substring(0, 100) + (affirmation.affirmation_text.length > 100 ? '...' : ''),
        icon: '/icon.png',
        badge: '/badge.png',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  };

  return {
    pendingAffirmation,
    settings,
    dismissNotification,
    showBrowserNotification,
  };
}
