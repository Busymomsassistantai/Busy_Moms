import React, { useState } from 'react'
import { X, CheckSquare, User, Calendar, Clock, Star, Hash } from 'lucide-react'
import { supabase, Task, FamilyMember } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface TaskFormProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: (task: Task) => void
  editTask?: Task | null
}

export function TaskForm({ isOpen, onClose, onTaskCreated, editTask }: TaskFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [formData, setFormData] = useState({
    title: editTask?.title || '',
    description: editTask?.description || '',
    category: editTask?.category || 'other',
    priority: editTask?.priority || 'medium',
    assigned_to: editTask?.assigned_to || '',
    due_date: editTask?.due_date || '',
    due_time: editTask?.due_time || '',
    points: editTask?.points || 0,
    notes: editTask?.notes || '',
    recurring: editTask?.recurring || false,
    recurring_pattern: editTask?.recurring_pattern || ''
  })

  // Load family members when form opens
  React.useEffect(() => {
    if (isOpen && user) {
      loadFamilyMembers()
    }
  }, [isOpen, user])

  const loadFamilyMembers = async () => {
    if (!user?.id) return
    
    try {
      const { data: members, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (!error) {
        setFamilyMembers(members || [])
      }
    } catch (error) {
      console.error('Error loading family members:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const taskData = {
        ...formData,
        user_id: user.id,
        assigned_to: formData.assigned_to || null,
        points: formData.points || 0,
        status: 'pending' as const,
        recurring_pattern: formData.recurring ? formData.recurring_pattern : null
      }

      let result
      if (editTask) {
        result = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editTask.id)
          .select(`
            *,
            assigned_family_member:family_members(id, name, age)
          `)
          .single()
      } else {
        result = await supabase
          .from('tasks')
          .insert([taskData])
          .select(`
            *,
            assigned_family_member:family_members(id, name, age)
          `)
          .single()
      }

      if (result.error) throw result.error

      onTaskCreated(result.data)
      onClose()
      setFormData({
        title: '',
        description: '',
        category: 'other',
        priority: 'medium',
        assigned_to: '',
        due_date: '',
        due_time: '',
        points: 0,
        notes: '',
        recurring: false,
        recurring_pattern: ''
      })
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Error saving task. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editTask ? 'Edit Task' : 'Create Task'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CheckSquare className="w-4 h-4 inline mr-1" />
                Task Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="e.g., Clean room, Do homework"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
                placeholder="Additional details about the task"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="chores">Chores</option>
                  <option value="homework">Homework</option>
                  <option value="sports">Sports</option>
                  <option value="music">Music</option>
                  <option value="health">Health</option>
                  <option value="social">Social</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Assign to Family Member
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">No assignment</option>
                {familyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} {member.age && `(${member.age})`}
                  </option>
                ))}
              </select>
              {familyMembers.length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Add family members in Settings to assign tasks
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Due Time
                </label>
                <input
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Star className="w-4 h-4 inline mr-1" />
                Points (for gamification)
              </label>
              <input
                type="number"
                min="0"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Reward points for completing this task"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows={2}
                placeholder="Additional notes or instructions"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-sm text-gray-700">Recurring task</span>
              </label>

              {formData.recurring && (
                <select
                  value={formData.recurring_pattern}
                  onChange={(e) => setFormData({ ...formData, recurring_pattern: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Select frequency</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              )}
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editTask ? 'Update Task' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}