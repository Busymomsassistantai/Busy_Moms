import React, { useState, useEffect } from 'react'
import { MapPin, Plus, Edit, Trash2, Star, Home, Briefcase, MapPinned, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase, Address } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { AddressForm } from './AddressForm'

export function AddressManager() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [error, setError] = useState('')

  const loadAddresses = async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      setAddresses(data || [])
    } catch (err: any) {
      console.error('Error loading addresses:', err)
      setError(err.message || 'Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAddresses()
  }, [user])

  const handleSetDefault = async (addressId: string) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', addressId)

      if (error) throw error
      await loadAddresses()
    } catch (err: any) {
      console.error('Error setting default address:', err)
      alert('Failed to set default address. Please try again.')
    }
  }

  const handleDelete = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', addressId)

      if (error) throw error
      await loadAddresses()
    } catch (err: any) {
      console.error('Error deleting address:', err)
      alert('Failed to delete address. Please try again.')
    }
  }

  const handleEdit = (address: Address) => {
    setEditingAddress(address)
    setShowForm(true)
  }

  const handleAddressSaved = () => {
    loadAddresses()
    setShowForm(false)
    setEditingAddress(null)
  }

  const getAddressIcon = (addressType: string) => {
    switch (addressType) {
      case 'home':
        return Home
      case 'work':
        return Briefcase
      default:
        return MapPinned
    }
  }

  const formatAddress = (address: Address) => {
    const parts = [address.street_address]
    if (address.apartment_unit) {
      parts.push(address.apartment_unit)
    }
    parts.push(`${address.city}, ${address.state_province} ${address.postal_code}`)
    parts.push(address.country)
    return parts.join(', ')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
        <span className="ml-2 text-gray-600">Loading addresses...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Your Addresses</h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage your saved locations for faster checkout and location services
          </p>
        </div>
        <button
          onClick={() => {
            setEditingAddress(null)
            setShowForm(true)
          }}
          className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="bg-gradient-to-br from-orange-50 to-rose-50 border-2 border-dashed border-rose-300 rounded-xl p-8 text-center">
          <MapPin className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No addresses saved yet</h3>
          <p className="text-gray-600 mb-2">
            Add your home address to use location-based services like:
          </p>
          <ul className="text-sm text-gray-600 mb-6 space-y-1">
            <li>• Quick retailer search for grocery shopping</li>
            <li>• Auto-fill location fields in event planning</li>
            <li>• Personalized local recommendations</li>
          </ul>
          <button
            onClick={() => {
              setEditingAddress(null)
              setShowForm(true)
            }}
            className="px-6 py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition-colors"
          >
            Add Your First Address
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => {
            const Icon = getAddressIcon(address.address_type)
            return (
              <div
                key={address.id}
                className={`bg-white border rounded-xl p-4 hover:shadow-md transition-all ${
                  address.is_default ? 'border-rose-500 bg-rose-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      address.is_default ? 'bg-rose-500' : 'bg-gray-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${address.is_default ? 'text-white' : 'text-gray-600'}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{address.display_name}</h4>
                        {address.is_default && (
                          <span className="px-2 py-0.5 bg-rose-500 text-white text-xs rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            Default
                          </span>
                        )}
                        {address.validated && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 break-words">
                        {formatAddress(address)}
                      </p>

                      {address.validation_metadata?.formatted_address && (
                        <p className="text-xs text-gray-500 mt-1">
                          Formatted: {address.validation_metadata.formatted_address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {!address.is_default && (
                      <button
                        onClick={() => handleSetDefault(address.id)}
                        className="p-2 text-gray-400 hover:text-rose-500 transition-colors"
                        title="Set as default"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(address)}
                      className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Edit address"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(address.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete address"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddressForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingAddress(null)
        }}
        onAddressSaved={handleAddressSaved}
        editAddress={editingAddress}
      />
    </div>
  )
}
