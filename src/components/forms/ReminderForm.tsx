import React, { useState } from 'react';
import { X, Bell, Calendar, Clock, User, AlertTriangle } from 'lucide-react';
import { supabase, Reminder, FamilyMember } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface ReminderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onReminderCreated: (reminder: Reminder) => void;
  editReminder?: Reminder | null;
  preselectedMember?: FamilyMember | null;
}

export function ReminderForm({ 
  isOpen, 
  onClose, 
  onReminderCreated, 
  editReminder,
  preselectedMember 
}: ReminderFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [formData, setFormData] = useState({
    title: editReminder?.title || '',
    description: editReminder?.description || '',
    reminder_date: editReminder?.reminder_date || '',
    reminder_time: editReminder?.reminder_time || '',
    priority: editReminder?.priority || 'medium',
    family_member_id: editReminder?.family_member_id || preselectedMember?.id || '',
    recurring: editReminder?.recurring || false,
    recurring_pattern: editReminder?.recurring_pattern || ''
  });

  // Load family members when form opens
  React.useEffect(() => {
    if (isOpen && user) {
      loadFamilyMembers();
    }
  }, [isOpen, user]);

  // Update form when editReminder or preselectedMember changes
  React.useEffect(() => {
    if (editReminder) {
      setFormData({
        title: editReminder.title || '',
        description: editReminder.description || '',
        reminder_date: editReminder.reminder_date || '',
        reminder_time: editReminder.reminder_time || '',
        priority: editReminder.priority || 'medium',
        family_member_id: editReminder.family_member_id || '',
        recurring: editReminder.recurring || false,
        recurring_pattern: editReminder.recurring_pattern || ''
      });
    } else if (preselectedMember) {
      setFormData(prev => ({
        ...prev,
        family_member_id: preselectedMember.id
      }));
    }
  }, [editReminder, preselectedMember]);

  const loadFamilyMembers = async () => {
    if (!user?.id) return;
    
    try {
      const { data: members, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (!error) {
        setFamilyMembers(members || []);
      }
    } catch (error) {
      console.error('Error loading family members:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const reminderData = {
        title: formData.title,
        description: formData.description || '',
        reminder_date: formData.reminder_date,
        reminder_time: formData.reminder_time || null,
        priority: formData.priority,
        family_member_id: formData.family_member_id || null,
        recurring: formData.recurring,
        recurring_pattern: formData.recurring ? formData.recurring_pattern || null : null,
        user_id: user.id,
        completed: false
      };

      let result;
      if (editReminder) {
        result = await supabase
          .from('reminders')
          .update(reminderData)
          .eq('id', editReminder.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('reminders')
          .insert([reminderData])
          .select()
          .single();
      }

      if (result.error) throw result.error;

      onReminderCreated(result.data);
      onClose();
      setFormData({
        title: '',
        description: '',
        reminder_date: '',
        reminder_time: '',
        priority: 'medium',
        family_member_id: preselectedMember?.id || '',
        recurring: false,
        recurring_pattern: ''
      });
    } catch (error) {
      console.error('Error saving reminder:', error);
      alert(`Error saving reminder: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {editReminder ? 'Edit Reminder' : `Add Reminder${preselectedMember ? ` for ${preselectedMember.name}` : ''}`}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                <Bell className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Reminder Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                placeholder="e.g., Take medicine, Call doctor"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                rows={2}
                placeholder="Additional details about the reminder"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.reminder_date}
                  onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Time
                </label>
                <input
                  type="time"
                  value={formData.reminder_time}
                  onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Family Member
                </label>
                <select
                  value={formData.family_member_id}
                  onChange={(e) => setFormData({ ...formData, family_member_id: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="">General reminder</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} {member.age && `(${member.age})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="w-3 h-3 sm:w-4 sm:h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-700">Recurring reminder</span>
              </label>

              {formData.recurring && (
                <select
                  value={formData.recurring_pattern}
                  onChange={(e) => setFormData({ ...formData, recurring_pattern: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>

            <div className="flex space-x-2 sm:space-x-3 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 sm:px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-2 sm:px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Saving...' : editReminder ? 'Update Reminder' : 'Create Reminder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}