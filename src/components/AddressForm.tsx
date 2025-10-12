import React, { useState, useEffect } from 'react'
import { X, MapPin, Loader2, CheckCircle, AlertCircle, Home, Briefcase, MapPinned } from 'lucide-react'
import { supabase, Address, AddressType } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { addressValidationService } from '../services/addressValidation'

interface AddressFormProps {
  isOpen: boolean
  onClose: () => void
  onAddressSaved: (address: Address) => void
  editAddress?: Address | null
}

export function AddressForm({ isOpen, onClose, onAddressSaved, editAddress }: AddressFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [formData, setFormData] = useState({
    address_type: 'home' as AddressType,
    display_name: '',
    street_address: '',
    apartment_unit: '',
    city: '',
    state_province: '',
    postal_code: '',
    country: 'US',
    is_default: false
  })

  useEffect(() => {
    if (isOpen && editAddress) {
      setFormData({
        address_type: editAddress.address_type,
        display_name: editAddress.display_name,
        street_address: editAddress.street_address,
        apartment_unit: editAddress.apartment_unit || '',
        city: editAddress.city,
        state_province: editAddress.state_province,
        postal_code: editAddress.postal_code,
        country: editAddress.country,
        is_default: editAddress.is_default || false
      })
    } else if (isOpen && !editAddress) {
      setFormData({
        address_type: 'home',
        display_name: 'Home',
        street_address: '',
        apartment_unit: '',
        city: '',
        state_province: '',
        postal_code: '',
        country: 'US',
        is_default: false
      })
    }
  }, [isOpen, editAddress])

  useEffect(() => {
    if (formData.address_type && !editAddress) {
      const displayNames: Record<AddressType, string> = {
        home: 'Home',
        work: 'Work',
        other: 'Other'
      }
      if (!formData.display_name || Object.values(displayNames).includes(formData.display_name)) {
        setFormData(prev => ({ ...prev, display_name: displayNames[formData.address_type] }))
      }
    }
  }, [formData.address_type, editAddress])

  const handleValidate = async () => {
    if (!formData.street_address || !formData.city || !formData.state_province || !formData.postal_code) {
      setValidationMessage('Please fill in all required fields before validating')
      return
    }

    setValidating(true)
    setValidationMessage('')
    setError('')

    try {
      const result = await addressValidationService.validateAddress(
        formData.street_address,
        formData.city,
        formData.state_province,
        formData.postal_code,
        formData.country,
        formData.apartment_unit
      )

      if (result.valid) {
        setValidationMessage(`Address validated successfully! ${result.formatted_address || ''}`)
      } else {
        setError(result.error_message || 'Address could not be validated')
        if (result.suggestions && result.suggestions.length > 0) {
          setError(`${result.error_message || 'Address could not be validated'}. Did you mean: ${result.suggestions[0]}?`)
        }
      }
    } catch (err) {
      console.error('Validation error:', err)
      setError('Failed to validate address. You can still save it.')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) {
      setError('No authenticated user found')
      return
    }

    if (!formData.street_address || !formData.city || !formData.state_province || !formData.postal_code) {
      setError('Please fill in all required fields')
      return
    }

    if (!addressValidationService.validatePostalCode(formData.postal_code, formData.country)) {
      setError('Invalid postal code format for the selected country')
      return
    }

    setError('')
    setLoading(true)

    try {
      let validationMetadata = null

      const result = await addressValidationService.validateAddress(
        formData.street_address,
        formData.city,
        formData.state_province,
        formData.postal_code,
        formData.country,
        formData.apartment_unit
      )

      validationMetadata = {
        validated_at: new Date().toISOString(),
        formatted_address: result.formatted_address,
        latitude: result.latitude,
        longitude: result.longitude,
        valid: result.valid
      }

      const addressData = {
        user_id: user.id,
        address_type: formData.address_type,
        display_name: formData.display_name.trim(),
        street_address: formData.street_address.trim(),
        apartment_unit: formData.apartment_unit.trim() || null,
        city: formData.city.trim(),
        state_province: formData.state_province.trim(),
        postal_code: formData.postal_code.trim(),
        country: formData.country,
        is_default: formData.is_default,
        validated: result.valid,
        validation_metadata: validationMetadata,
        updated_at: new Date().toISOString()
      }

      let savedAddress: Address | null = null

      if (editAddress) {
        const { data, error } = await supabase
          .from('addresses')
          .update(addressData)
          .eq('id', editAddress.id)
          .select()
          .maybeSingle()

        if (error) throw error
        savedAddress = data
      } else {
        const { data, error } = await supabase
          .from('addresses')
          .insert([addressData])
          .select()
          .maybeSingle()

        if (error) throw error
        savedAddress = data
      }

      if (!savedAddress) {
        throw new Error('Failed to save address')
      }

      onAddressSaved(savedAddress)
      onClose()
    } catch (error: any) {
      console.error('Error saving address:', error)
      setError(error.message || 'Failed to save address')
    } finally {
      setLoading(false)
    }
  }

  const getStateProvinceOptions = () => {
    if (formData.country === 'US') {
      return addressValidationService.getUSStates()
    } else if (formData.country === 'CA') {
      return addressValidationService.getCanadianProvinces()
    }
    return []
  }

  const countries = addressValidationService.getCountries()
  const stateProvinceOptions = getStateProvinceOptions()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              {editAddress ? 'Edit Address' : 'Add New Address'}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {validationMessage && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-600">{validationMessage}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['home', 'work', 'other'] as AddressType[]).map((type) => {
                    const icons = { home: Home, work: Briefcase, other: MapPinned }
                    const Icon = icons[type]
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, address_type: type })}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                          formData.address_type === type
                            ? 'bg-rose-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="e.g., Home, Mom's House"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Street Address *
              </label>
              <input
                type="text"
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                placeholder="123 Main Street"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Apartment / Unit / Suite
              </label>
              <input
                type="text"
                value={formData.apartment_unit}
                onChange={(e) => setFormData({ ...formData, apartment_unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                placeholder="Apt 4B"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder="San Francisco"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value, state_province: '' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  required
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.country === 'US' ? 'State' : formData.country === 'CA' ? 'Province' : 'State/Province'} *
                </label>
                {stateProvinceOptions.length > 0 ? (
                  <select
                    value={formData.state_province}
                    onChange={(e) => setFormData({ ...formData, state_province: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select...</option>
                    {stateProvinceOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.state_province}
                    onChange={(e) => setFormData({ ...formData, state_province: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    placeholder="State/Province"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {formData.country === 'US' ? 'ZIP Code' : 'Postal Code'} *
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  placeholder={formData.country === 'US' ? '94102' : 'Postal Code'}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="w-4 h-4 text-rose-500 border-gray-300 rounded focus:ring-rose-500"
              />
              <label htmlFor="is_default" className="text-sm text-gray-700 cursor-pointer">
                Set as default address for location services
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Validate Address
                  </>
                )}
              </button>
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
                className="flex-1 px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editAddress ? 'Update Address' : 'Save Address'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
