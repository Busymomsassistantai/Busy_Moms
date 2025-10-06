import React, { useState, useEffect } from 'react';
import { Settings, Save, X } from 'lucide-react';
import { useCalendarSync } from '../hooks/useCalendarSync';
import { calendarSyncService } from '../services/calendarSync';
import { useAuth } from '../hooks/useAuth';

interface SyncSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncSettings({ isOpen, onClose }: SyncSettingsProps) {
  const { user } = useAuth();
  const { syncEnabled, syncFrequencyMinutes, updateSyncPreferences } = useCalendarSync();
  const [localSyncEnabled, setLocalSyncEnabled] = useState(syncEnabled);
  const [localSyncFrequency, setLocalSyncFrequency] = useState(syncFrequencyMinutes);
  const [syncDirection, setSyncDirection] = useState<'bidirectional' | 'google_to_local' | 'local_to_google'>('bidirectional');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user?.id) {
      // Load current preferences
      calendarSyncService.getUserSyncPreferences(user.id).then(prefs => {
        if (prefs) {
          setLocalSyncEnabled(prefs.sync_enabled);
          setLocalSyncFrequency(prefs.sync_frequency_minutes);
          setSyncDirection(prefs.sync_direction);
        }
      });
    }
  }, [isOpen, user?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updateSyncPreferences({
        sync_enabled: localSyncEnabled,
        sync_frequency_minutes: localSyncFrequency,
        sync_direction: syncDirection,
      });

      if (success) {
        onClose();
      } else {
        alert('Failed to save sync settings. Please try again.');
      }
    } catch (error) {
      console.error('Error saving sync settings:', error);
      alert('Failed to save sync settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Sync Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Enable Sync */}
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSyncEnabled}
                  onChange={(e) => setLocalSyncEnabled(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Enable automatic sync</span>
                  <p className="text-sm text-gray-500">
                    Automatically sync your calendar at regular intervals
                  </p>
                </div>
              </label>
            </div>

            {/* Sync Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sync frequency
              </label>
              <select
                value={localSyncFrequency}
                onChange={(e) => setLocalSyncFrequency(Number(e.target.value))}
                disabled={!localSyncEnabled}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
                <option value={120}>Every 2 hours</option>
                <option value={240}>Every 4 hours</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How often to check for changes and sync
              </p>
            </div>

            {/* Sync Direction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sync direction
              </label>
              <div className="space-y-2">
                <label className="flex items-start space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="sync_direction"
                    value="bidirectional"
                    checked={syncDirection === 'bidirectional'}
                    onChange={(e) => setSyncDirection(e.target.value as any)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Two-way sync</span>
                    <p className="text-xs text-gray-500">
                      Sync changes in both directions. Conflicts will be detected for manual resolution.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="sync_direction"
                    value="google_to_local"
                    checked={syncDirection === 'google_to_local'}
                    onChange={(e) => setSyncDirection(e.target.value as any)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Google Calendar to Local</span>
                    <p className="text-xs text-gray-500">
                      Only sync from Google Calendar to this app. Local changes won't affect Google Calendar.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="sync_direction"
                    value="local_to_google"
                    checked={syncDirection === 'local_to_google'}
                    onChange={(e) => setSyncDirection(e.target.value as any)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Local to Google Calendar</span>
                    <p className="text-xs text-gray-500">
                      Only sync from this app to Google Calendar. Google Calendar changes won't affect local events.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
