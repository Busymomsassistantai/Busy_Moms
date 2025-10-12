import React, { useState } from 'react'
import { X, ShoppingBag, Hash, Package } from 'lucide-react'
import { supabase, ShoppingItem, ProviderName } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { MeasurementInput } from '../MeasurementInput'
import { InstacartUnitMapper } from '../../utils/instacartUnitMapper'

interface ShoppingFormProps {
  isOpen: boolean
  onClose: () => void
  onItemCreated: (item: ShoppingItem) => void
  editItem?: ShoppingItem | null
}

export function ShoppingForm({ isOpen, onClose, onItemCreated, editItem }: ShoppingFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    item: editItem?.item || '',
    category: editItem?.category || 'other',
    quantity: editItem?.quantity || 1,
    unit: editItem?.unit || null,
    urgent: editItem?.urgent || false,
    notes: editItem?.notes || '',
    provider_name: editItem?.provider_name || null
  })


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const itemData = {
        ...formData,
        user_id: user.id,
        completed: false,
        assigned_to: null,
        purchase_status: 'not_sent'
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
        unit: null,
        urgent: false,
        notes: '',
        provider_name: null
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
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-sm sm:max-w-md">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {editItem ? 'Edit Item' : 'Add Shopping Item'}
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
                <ShoppingBag className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Item Name *
              </label>
              <input
                type="text"
                required
                value={formData.item}
                onChange={(e) => setFormData({ ...formData, item: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                placeholder="e.g., Milk, Bananas, Diapers"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
              >
                <option value="dairy">Dairy</option>
                <option value="produce">Produce</option>
                <option value="meat">Meat</option>
                <option value="bakery">Bakery</option>
                <option value="baby">Baby</option>
                <option value="beverages">Beverages</option>
                <option value="frozen">Frozen</option>
                <option value="household">Household</option>
                <option value="snacks">Snacks</option>
                <option value="health">Health</option>
                <option value="pantry">Pantry</option>
                <option value="other">Other</option>
              </select>
            </div>

            <MeasurementInput
              quantity={formData.quantity}
              unit={formData.unit}
              ingredientName={formData.item}
              category={formData.category}
              onQuantityChange={(q) => setFormData({ ...formData, quantity: q || 1 })}
              onUnitChange={(u) => setFormData({ ...formData, unit: u })}
              showConverter={true}
              className=""
            />

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 sm:px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm sm:text-base"
                rows={2}
                placeholder="Brand preference, size, etc."
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                <Package className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
                Shopping Provider Preference
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, provider_name: null })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formData.provider_name === null
                      ? 'bg-gray-100 border-gray-400 text-gray-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  No Preference
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, provider_name: 'instacart' })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formData.provider_name === 'instacart'
                      ? 'bg-green-100 border-green-400 text-green-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Instacart
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, provider_name: 'amazon' })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formData.provider_name === 'amazon'
                      ? 'bg-orange-100 border-orange-400 text-orange-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Amazon
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, provider_name: 'manual' })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    formData.provider_name === 'manual'
                      ? 'bg-gray-100 border-gray-400 text-gray-900'
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Manual
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Choose your preferred shopping method for this item
              </p>
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.urgent}
                  onChange={(e) => setFormData({ ...formData, urgent: e.target.checked })}
                  className="w-3 h-3 sm:w-4 sm:h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                />
                <span className="ml-2 text-xs sm:text-sm text-gray-700">Mark as urgent</span>
              </label>
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
                className="flex-1 px-3 py-2 sm:px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-sm sm:text-base"
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