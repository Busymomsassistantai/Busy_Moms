import React, { useState } from 'react'
import { X, ShoppingBag, Hash, User } from 'lucide-react'
import { supabase, ShoppingItem, FamilyMember } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

interface ShoppingFormProps {
  isOpen: boolean
  onClose: () => void
  onItemCreated: (item: ShoppingItem) => void
  editItem?: ShoppingItem | null
}

export function ShoppingForm({ isOpen, onClose, onItemCreated, editItem }: ShoppingFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [formData, setFormData] = useState({
    item: editItem?.item || '',
    category: editItem?.category || 'other',
    quantity: editItem?.quantity || 1,
    urgent: editItem?.urgent || false,
    notes: editItem?.notes || '',
    assigned_to: editItem?.assigned_to || ''
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
      const itemData = {
        ...formData,
        user_id: user.id,
        completed: false,
        assigned_to: formData.assigned_to || null
      }

      let result
      if (editItem) {
        result = await supabase
          .from('shopping_lists')
          .update(itemData)
          .eq('id', editItem.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('shopping_lists')
          .insert([itemData])
          .select()
          .single()
      }

      if (result.error) throw result.error

      onItemCreated(result.data)
      onClose()
      setFormData({
        item: '',
        category: 'other',
        quantity: 1,
        urgent: false,
        notes: '',
        assigned_to: ''
      })
    } catch (error) {
      console.error('Error saving shopping item:', error)
      alert('Error saving item. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editItem ? 'Edit Item' : 'Add Shopping Item'}
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
                <ShoppingBag className="w-4 h-4 inline mr-1" />
                Item Name *
              </label>
              <input
                type="text"
                required
                value={formData.item}
                onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Milk, Bananas, Diapers"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="dairy">Dairy</option>
                  <option value="produce">Produce</option>
                  <option value="meat">Meat</option>
                  <option value="bakery">Bakery</option>
                  <option value="baby">Baby</option>
                  <option value="household">Household</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash className="w-4 h-4 inline mr-1" />
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                rows={2}
                placeholder="Brand preference, size, etc."
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.urgent}
                  onChange={(e) => setFormData({ ...formData, urgent: e.target.checked })}
                  className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">Mark as urgent</span>
              </label>
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
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editItem ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}