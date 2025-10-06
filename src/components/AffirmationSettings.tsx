import React, { useState, useEffect } from 'react';
import { X, Clock, Bell, Calendar as CalendarIcon, ShoppingBag, Users, CheckSquare, Loader2, Save } from 'lucide-react';
import { affirmationService } from '../services/affirmationService';
import { AffirmationSettings as AffirmationSettingsType } from '../lib/supabase';

interface AffirmationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AffirmationSettings({ isOpen, onClose }: AffirmationSettingsProps) {
  const [settings, setSettings] = useState<AffirmationSettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await affirmationService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await affirmationService.updateSettings(settings);
      alert('Settings saved successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AffirmationSettingsType>(
    key: K,
    value: AffirmationSettingsType[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center hover:bg-opacity-30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Affirmation Settings</h2>
              <p className="text-purple-100 text-sm">Customize your daily encouragement</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : settings ? (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Bell className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-gray-900">Enable Affirmations</h3>
                  </div>
                  <button
                    onClick={() => updateSetting('enabled', !settings.enabled)}
                    className={`w-12 h-6 rounded-full relative transition-all ${
                      settings.enabled ? 'bg-purple-500' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${
                        settings.enabled ? 'right-0.5' : 'left-0.5'
                      }`}
                    ></div>
                  </button>
                </div>
                <p className="text-sm text-gray-600">
                  {settings.enabled
                    ? 'You will receive daily affirmations'
                    : 'Affirmations are currently disabled'}
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Frequency</h3>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.frequency === 'once_daily'}
                      onChange={() => updateSetting('frequency', 'once_daily')}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700">Once daily</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={settings.frequency === 'twice_daily'}
                      onChange={() => updateSetting('frequency', 'twice_daily')}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700">Twice daily</span>
                  </label>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Timing</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Time
                    </label>
                    <input
                      type="time"
                      value={settings.preferred_time?.slice(0, 5) || '08:00'}
                      onChange={(e) => updateSetting('preferred_time', `${e.target.value}:00`)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {settings.frequency === 'twice_daily' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Secondary Time
                      </label>
                      <input
                        type="time"
                        value={settings.secondary_time?.slice(0, 5) || '20:00'}
                        onChange={(e) => updateSetting('secondary_time', `${e.target.value}:00`)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <CheckSquare className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Data Sources</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Select which information to include when generating your affirmations
                </p>

                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <CalendarIcon className="w-5 h-5 text-purple-600" />
                      <span className="text-gray-700">Calendar Events</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.include_calendar ?? true}
                      onChange={(e) => updateSetting('include_calendar', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                      <span className="text-gray-700">Tasks</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.include_tasks ?? true}
                      onChange={(e) => updateSetting('include_tasks', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-pink-600" />
                      <span className="text-gray-700">Family Members</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.include_family ?? true}
                      onChange={(e) => updateSetting('include_family', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <ShoppingBag className="w-5 h-5 text-green-600" />
                      <span className="text-gray-700">Shopping List</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.include_shopping ?? true}
                      onChange={(e) => updateSetting('include_shopping', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-gray-500">Failed to load settings</p>
          </div>
        )}

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !settings}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
