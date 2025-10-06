import React, { useState } from 'react'
import { X, User, Phone, Mail, Star } from 'lucide-react'
import { supabase, Contact } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface ContactFormProps {
  isOpen: boolean
  onClose: () => void
  onContactCreated: (contact: Contact) => void
  editContact?: Contact | null
}

export function ContactForm({ isOpen, onClose, onContactCreated, editContact }: ContactFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    category: 'other' as const,
    rating: 0,
    notes: '',
    verified: false,
    available: true
  })

  // Update form data when editContact changes
  React.useEffect(() => {
    if (editContact) {
      setFormData({
        name: editContact.name || '',
        role: editContact.role || '',
        phone: editContact.phone || '',
        email: editContact.email || '',
        category: editContact.category || 'other',
        rating: editContact.rating || 0,
        notes: editContact.notes || '',
        verified: editContact.verified || false,
        available: editContact.available !== false
      })
    } else {
      // Reset form for new contact
      setFormData({
        name: '',
        role: '',
        phone: '',
        email: '',
        category: 'other',
        rating: 0,
        notes: '',
        verified: false,
        available: true
      })
    }
  }, [editContact])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const contactData = {
        ...formData,
        user_id: user.id
      }

      let result
      if (editContact) {
        result = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', editContact.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('contacts')
          .insert([contactData])
          .select()
          .single()
      }

      if (result.error) throw result.error

      onContactCreated(result.data)
      onClose()
    } catch (error) {
      console.error('Error saving contact:', error)
      alert('Error saving contact. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-theme-surface rounded-xl sm:rounded-2xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {editContact ? 'Edit Contact' : 'Add Contact'}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-theme-secondary rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Contact name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                  Role *
                </label>
                <input
                  type="text"
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="e.g., Babysitter"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="babysitter">Babysitter</option>
                  <option value="coach">Coach</option>
                  <option value="doctor">Doctor</option>
                  <option value="tutor">Tutor</option>
                  <option value="teacher">Teacher</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                  <Phone className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                <Star className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Rating (0-5)
              </label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-theme-fg opacity-90 mb-1 sm:mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-theme-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                rows={2}
                placeholder="Additional notes about this contact"
              />
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.verified}
                  onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                  className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 border-theme-border rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-700">Verified</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                  className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600 border-theme-border rounded focus:ring-purple-500"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-700">Available</span>
              </label>
            </div>

            <div className="flex space-x-2 sm:space-x-3 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 sm:px-4 border border-theme-border text-theme-fg opacity-90 rounded-lg hover:bg-theme-secondary transition-colors text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-3 py-2 sm:px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Saving...' : editContact ? 'Update Contact' : 'Add Contact'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}