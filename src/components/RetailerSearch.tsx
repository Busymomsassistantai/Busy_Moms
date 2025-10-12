import React, { useState, useEffect } from 'react'
import { Search, MapPin, Star, Trash2, Check, Loader2, Home } from 'lucide-react'
import { instacartShoppingService } from '../services/instacartShoppingService'
import { supabase } from '../lib/supabase'
import type { Retailer, UserPreferredRetailer, Address } from '../lib/supabase'

interface RetailerSearchProps {
  userId: string
  onRetailerSaved?: () => void
}

export function RetailerSearch({ userId, onRetailerSaved }: RetailerSearchProps) {
  const [postalCode, setPostalCode] = useState('')
  const [countryCode, setCountryCode] = useState<'US' | 'CA'>('US')
  const [searchResults, setSearchResults] = useState<Retailer[]>([])
  const [preferredRetailers, setPreferredRetailers] = useState<UserPreferredRetailer[]>([])
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingPreferred, setLoadingPreferred] = useState(true)
  const [loadingAddresses, setLoadingAddresses] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadPreferredRetailers = async () => {
    if (!userId) {
      setLoadingPreferred(false)
      return
    }

    try {
      setLoadingPreferred(true)
      const retailers = await instacartShoppingService.getPreferredRetailers(userId)
      setPreferredRetailers(retailers)
    } catch (err) {
      console.error('Failed to load preferred retailers:', err)
      setError(err instanceof Error ? err.message : 'Failed to load your preferred retailers')
    } finally {
      setLoadingPreferred(false)
    }
  }

  const handleSearch = async () => {
    if (!postalCode.trim()) {
      setError('Please enter a postal code')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await instacartShoppingService.getNearbyRetailers(postalCode, countryCode)
      setSearchResults(response.retailers)

      await loadPreferredRetailers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search retailers')
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRetailer = async (retailer: Retailer, isPrimary: boolean = false) => {
    setError(null)
    setSuccessMessage(null)

    try {
      await instacartShoppingService.savePreferredRetailer(userId, retailer, isPrimary)
      const message = isPrimary
        ? `${retailer.name} is now your primary retailer!`
        : `${retailer.name} added to your preferred retailers!`
      setSuccessMessage(message)
      await loadPreferredRetailers()
      onRetailerSaved?.()

      setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save retailer'
      setError(errorMessage)

      setTimeout(() => {
        setError(null)
      }, 5000)
    }
  }

  const handleSetPrimary = async (retailerId: string) => {
    setError(null)
    setSuccessMessage(null)

    try {
      await instacartShoppingService.setPrimaryRetailer(userId, retailerId)
      setSuccessMessage('Primary retailer updated!')
      await loadPreferredRetailers()
      onRetailerSaved?.()

      setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update primary retailer'
      setError(errorMessage)

      setTimeout(() => {
        setError(null)
      }, 5000)
    }
  }

  const handleRemoveRetailer = async (retailerId: string) => {
    if (!window.confirm('Are you sure you want to remove this retailer from your preferences?')) {
      return
    }

    setError(null)
    setSuccessMessage(null)

    try {
      await instacartShoppingService.removePreferredRetailer(userId, retailerId)
      setSuccessMessage('Retailer removed from your preferences')
      await loadPreferredRetailers()
      onRetailerSaved?.()

      setTimeout(() => {
        setSuccessMessage(null)
      }, 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove retailer'
      setError(errorMessage)

      setTimeout(() => {
        setError(null)
      }, 5000)
    }
  }

  const loadSavedAddresses = async () => {
    if (!userId) {
      setLoadingAddresses(false)
      return
    }

    try {
      setLoadingAddresses(true)
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false })

      if (error) throw error
      setSavedAddresses(data || [])

      const defaultAddress = data?.find(addr => addr.is_default)
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id)
        setPostalCode(defaultAddress.postal_code)
        setCountryCode(defaultAddress.country as 'US' | 'CA')
      }
    } catch (err) {
      console.error('Failed to load saved addresses:', err)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const handleAddressSelect = (addressId: string) => {
    const address = savedAddresses.find(a => a.id === addressId)
    if (address) {
      setSelectedAddressId(addressId)
      setPostalCode(address.postal_code)
      setCountryCode(address.country as 'US' | 'CA')
    }
  }

  const isRetailerSaved = (retailerKey: string) => {
    return preferredRetailers.some(r => r.retailer_key === retailerKey)
  }

  React.useEffect(() => {
    loadPreferredRetailers()
    loadSavedAddresses()
  }, [userId])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Search Nearby Retailers
        </h3>

        <div className="space-y-4">
          {savedAddresses.length > 0 && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Home className="w-4 h-4 text-blue-600" />
                Use Saved Address
              </label>
              <select
                value={selectedAddressId}
                onChange={(e) => handleAddressSelect(e.target.value)}
                className="w-full px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Choose an address or enter manually below</option>
                {savedAddresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.display_name} - {address.city}, {address.state_province} {address.postal_code}
                    {address.is_default ? ' (Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {savedAddresses.length === 0 && !loadingAddresses && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                <strong>Note:</strong> Add a saved address in Settings to quickly search retailers near you.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter postal code (e.g., 94102)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value as 'US' | 'CA')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="US">United States</option>
              <option value="CA">Canada</option>
            </select>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {successMessage}
            </div>
          )}
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            Available Retailers Near {postalCode}
          </h4>
          <div className="space-y-3">
            {searchResults.map((retailer) => (
              <div
                key={retailer.retailer_key}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                {retailer.retailer_logo_url && (
                  <img
                    src={retailer.retailer_logo_url}
                    alt={retailer.name}
                    className="w-12 h-12 object-contain"
                  />
                )}
                <div className="flex-1">
                  <h5 className="font-medium text-gray-900">{retailer.name}</h5>
                  <p className="text-sm text-gray-500">{retailer.retailer_key}</p>
                </div>
                {isRetailerSaved(retailer.retailer_key) ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" />
                    <span className="text-sm font-medium">Saved</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveRetailer(retailer, false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => handleSaveRetailer(retailer, true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Set as Primary
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingPreferred ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading your preferred retailers...</span>
          </div>
        </div>
      ) : preferredRetailers.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4">
            Your Preferred Retailers
          </h4>
          <div className="space-y-3">
            {preferredRetailers.map((retailer) => (
              <div
                key={retailer.id}
                className={`flex items-center gap-4 p-4 border rounded-lg transition-colors ${
                  retailer.is_primary
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {retailer.retailer_logo_url && (
                  <img
                    src={retailer.retailer_logo_url}
                    alt={retailer.retailer_name}
                    className="w-12 h-12 object-contain"
                  />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-gray-900">{retailer.retailer_name}</h5>
                    {retailer.is_primary && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" />
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">{retailer.retailer_key}</p>
                </div>
                <div className="flex gap-2">
                  {!retailer.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(retailer.id)}
                      className="px-3 py-2 text-gray-600 hover:text-blue-600 transition-colors"
                      title="Set as primary"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveRetailer(retailer.id)}
                    className="px-3 py-2 text-gray-600 hover:text-red-600 transition-colors"
                    title="Remove retailer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
