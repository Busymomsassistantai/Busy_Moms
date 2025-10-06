import React, { useState } from 'react'
import { X, User, Heart, School } from 'lucide-react'
import { supabase, FamilyMember } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface FamilyMemberFormProps {
  isOpen: boolean
  onClose: () => void
  onMemberCreated: (member: FamilyMember) => void
  editMember?: FamilyMember | null
}

export function FamilyMemberForm({ isOpen, onClose, onMemberCreated, editMember }: FamilyMemberFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Other',
    allergies: '',
    medical_notes: '',
    school: '',
    grade: ''
  })

  // Update form data when editMember changes
  React.useEffect(() => {
    if (editMember) {
      setFormData({
        name: editMember.name || '',
        age: editMember.age?.toString() || '',
        gender: editMember.gender || 'Other',
        allergies: editMember.allergies?.join(', ') || '',
        medical_notes: editMember.medical_notes || '',
        school: editMember.school || '',
        grade: editMember.grade || ''
      })
    } else {
      // Reset form for new member
      setFormData({
        name: '',
        age: '',
        gender: 'Other',
        allergies: '',
        medical_notes: '',
        school: '',
        grade: ''
      })
    }
  }, [editMember])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    setLoading(true)
    try {
      // Ensure we have a valid authenticated user
      if (!user?.id) {
        throw new Error('You must be logged in to add family members.')
      }

      const memberData = {
        ...formData,
        user_id: user.id,
        age: formData.age ? parseInt(formData.age.toString()) : null,
        allergies: formData.allergies.split(',').map(a => a.trim()).filter(a => a)
      }

      let result
      if (editMember) {
        // Update existing family member
        result = await supabase
          .from('family_members')
          .update(memberData)
          .eq('id', editMember.id)
          .select()
          .single()
      } else {
        // Insert new family member
        result = await supabase
          .from('family_members')
          .insert([memberData])
          .select()
          .single()
      }

      if (result.error) {
        throw result.error
      }

      // Call the callback with the saved member
      onMemberCreated(result.data)
      onClose()
      
      // Reset form
      setFormData({
        name: '',
        age: '',
        gender: 'Other',
        allergies: '',
        medical_notes: '',
        school: '',
        grade: ''
      })
    } catch (error) {
      console.error('Error saving family member:', error)
      setError(`Error saving family member: ${error.message || 'Please try again.'}`)
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
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {editMember ? 'Edit Family Member' : 'Add Family Member'}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {error && (
              <div className="p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs sm:text-sm text-red-600">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                <User className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Child's name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Age
                </label>
                <input
                  type="number"
                  min="0"
                  max="25"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Age"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Gender
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                >
                  <option value="Boy">Boy</option>
                  <option value="Girl">Girl</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  <School className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                  School
                </label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="School name"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Grade
                </label>
                <input
                  type="text"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="e.g., 2nd Grade, K"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                <Heart className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Allergies
              </label>
              <input
                type="text"
                value={formData.allergies}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                placeholder="Peanuts, Dairy, etc. (comma separated)"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Medical Notes
              </label>
              <textarea
                value={formData.medical_notes}
                onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent text-sm sm:text-base"
                rows={2}
                placeholder="Important medical information, medications, etc."
              />
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
                className="flex-1 px-3 py-2 sm:px-4 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Saving...' : editMember ? 'Update Member' : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}