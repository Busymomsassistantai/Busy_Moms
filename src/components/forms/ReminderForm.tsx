import React, { useState } from 'react'
import { X, Bell, Calendar, Clock, AlertTriangle } from 'lucide-react'
import { supabase, Reminder } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface ReminderFormProps {
  defaultDate?: string
  reminder?: Reminder
  onCancel: () => void
  onSaved: () => void
}

export function ReminderForm({ defaultDate, reminder, onCancel, onSaved }: ReminderFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminder_date: '',
    reminder_time: '',
    priority: 'medium' as const,
    recurring: false,
    recurring_pattern: ''
  })

  // Update form data when defaultDate or reminder changes
  React.useEffect(() => {
    if (reminder) {
      setFormData({
        title: reminder.title || '',
        description: reminder.description || '',
        reminder_date: reminder.reminder_date || '',
        reminder_time: reminder.reminder_time || '',
        priority: reminder.priority || 'medium',
        recurring: reminder.recurring || false,
        recurring_pattern: reminder.recurring_pattern || ''
      })
    } else if (defaultDate) {
      setFormData(prev => ({
        ...prev,
        reminder_date: defaultDate
      }))
    } else {
      // Reset form for new reminder
      setFormData({
        title: '',
        description: '',
        reminder_date: '',
        reminder_time: '',
        priority: 'medium',
        recurring: false,
        recurring_pattern: ''
      })
    }
  }, [reminder, defaultDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const reminderData = {
        ...formData,
        user_id: user.id,
        completed: false
      }

      let result
      if (reminder) {
        result = await supabase
          .from('reminders')
          .update(reminderData)
          .eq('id', reminder.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('reminders')
          .insert([reminderData])
          .select()
          .single()
      }

      if (result.error) throw result.error

      onSaved()
    } catch (error) {
      console.error('Error saving reminder:', error)
      alert('Error saving reminder. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
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
          placeholder="Enter reminder title"
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
          placeholder="Additional details"
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
          onClick={onCancel}
          className="flex-1 px-3 py-2 sm:px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-3 py-2 sm:px-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
        >
          {loading ? 'Saving...' : reminder ? 'Update Reminder' : 'Create Reminder'}
        </button>
      </div>
    </form>
  )
}