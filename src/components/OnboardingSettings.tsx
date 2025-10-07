import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Users, Bell, Calendar, MessageCircle, Watch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface OnboardingSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingSettings({ isOpen, onClose }: OnboardingSettingsProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userType, setUserType] = useState('');
  const [preferences, setPreferences] = useState({
    notification_events: true,
    notification_shopping: true,
    notification_reminders: true,
    notification_whatsapp: false,
    whatsapp_integration_enabled: false,
    smartwatch_connected: false,
    background_check_alerts: true
  });

  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
    }
  }, [isOpen, user]);

  const loadSettings = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .maybeSingle();

      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.user_type) {
        setUserType(profile.user_type);
      }

      if (prefs) {
        setPreferences({
          notification_events: prefs.notification_events ?? true,
          notification_shopping: prefs.notification_shopping ?? true,
          notification_reminders: prefs.notification_reminders ?? true,
          notification_whatsapp: prefs.notification_whatsapp ?? false,
          whatsapp_integration_enabled: prefs.whatsapp_integration_enabled ?? false,
          smartwatch_connected: prefs.smartwatch_connected ?? false,
          background_check_alerts: prefs.background_check_alerts ?? true
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ user_type: userType as any })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: prefsError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          ...preferences
        }, {
          onConflict: 'user_id'
        });

      if (prefsError) throw prefsError;

      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300 text-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Onboarding Settings</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-rose-100 mt-2">Review and update your initial setup preferences</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">About You</h3>
                <div className="space-y-3">
                  {['Mom', 'Dad', 'Guardian', 'Other'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setUserType(type)}
                      className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                        userType === type
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Users className="w-5 h-5 text-rose-500" />
                        <span className="font-medium">{type}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Smart Features</h3>
                <div className="space-y-3">
                  {[
                    {
                      icon: Bell,
                      title: 'Event Notifications',
                      desc: 'Get notified about upcoming events',
                      key: 'notification_events'
                    },
                    {
                      icon: Calendar,
                      title: 'Shopping Alerts',
                      desc: 'Reminders for your shopping lists',
                      key: 'notification_shopping'
                    },
                    {
                      icon: Bell,
                      title: 'General Reminders',
                      desc: 'Never miss important tasks',
                      key: 'notification_reminders'
                    },
                    {
                      icon: MessageCircle,
                      title: 'WhatsApp Integration',
                      desc: 'Parse invitations and reminders',
                      key: 'whatsapp_integration_enabled'
                    },
                    {
                      icon: Watch,
                      title: 'Smartwatch Connection',
                      desc: 'Voice commands and quick actions',
                      key: 'smartwatch_connected'
                    }
                  ].map(({ icon: Icon, title, desc, key }) => (
                    <div key={title} className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center">
                          <Icon className="w-5 h-5 text-rose-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{title}</h4>
                          <p className="text-sm text-gray-600">{desc}</p>
                        </div>
                        <button
                          onClick={() => setPreferences(prev => ({
                            ...prev,
                            [key]: !prev[key as keyof typeof prev]
                          }))}
                          className={`w-12 h-6 rounded-full relative transition-colors ${
                            preferences[key as keyof typeof preferences]
                              ? 'bg-rose-500'
                              : 'bg-gray-300'
                          }`}
                        >
                          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform ${
                            preferences[key as keyof typeof preferences]
                              ? 'translate-x-6'
                              : 'translate-x-0.5'
                          }`}></div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving || !userType}
              className="px-6 py-3 bg-gradient-to-r from-rose-400 to-pink-400 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
