import React, { useState, useEffect } from 'react'
import { X, User, Mail, Heart } from 'lucide-react'
import { supabase, Profile } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface ProfileFormProps {
  isOpen: boolean
  onClose: () => void
  onProfileUpdated: (profile: Profile) => void
}

export function ProfileForm({ isOpen, onClose, onProfileUpdated }: ProfileFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    full_name: '',
    user_type: 'Mom' as 'Mom' | 'Dad' | 'Guardian' | 'Other',
    ai_personality: 'Friendly' as 'Friendly' | 'Professional' | 'Humorous'
  })

  // Load current profile data when form opens
  useEffect(() => {
    if (isOpen && user) {
      loadProfile()
    }
  }, [isOpen, user])

  const loadProfile = async () => {
    if (!user) return

    setLoadingProfile(true)
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (error) {
        throw error
      }

      if (profile) {
        setFormData({
          full_name: profile.full_name || '',
          user_type: profile.user_type || 'Mom',
          ai_personality: profile.ai_personality || 'Friendly'
        })
      }
    } catch (error: any) {
      console.error('Error loading profile:', error)
      setError(`Error loading profile: ${error.message}`)
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) {
      setError('No authenticated user found')
      return
    }

    setError('')
    setLoading(true)

    try {
      const updateData = {
        full_name: formData.full_name,
        user_type: formData.user_type,
        ai_personality: formData.ai_personality,
        updated_at: new Date().toISOString()
      }

      console.log('Updating profile for user:', user.id, 'with data:', updateData)

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .maybeSingle()

      if (error) {
        console.error('Profile update error:', error)
        throw error
      }

      if (!updatedProfile) {
        throw new Error('Profile not found or update failed')
      }

      console.log('Profile updated successfully:', updatedProfile)
      onProfileUpdated(updatedProfile)
      onClose()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setError(error.message || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">Edit Profile</h2>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            </button>
          </div>

          {loadingProfile ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-purple-500"></div>
              <span className="ml-2 text-sm sm:text-base text-gray-600">Loading profile...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              {error && (
                <div className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <Mail className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 text-sm sm:text-base"
                  placeholder="Email cannot be changed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed after registration</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  User Type
                </label>
                <select
                  value={formData.user_type}
                  onChange={(e) => setFormData({ ...formData, user_type: e.target.value as any })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="Mom">Mom</option>
                  <option value="Dad">Dad</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <Heart className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  AI Assistant Personality
                </label>
                <select
                  value={formData.ai_personality}
                  onChange={(e) => setFormData({ ...formData, ai_personality: e.target.value as any })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="Friendly">Friendly</option>
                  <option value="Professional">Professional</option>
                  <option value="Humorous">Humorous</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">This affects how your AI assistant communicates with you</p>
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
                  className="flex-1 px-3 py-2 sm:px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}