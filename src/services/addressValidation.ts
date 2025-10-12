import type { AddressValidationResult } from '../lib/supabase'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

interface GoogleGeocodingResult {
  formatted_address: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  address_components: Array<{
    long_name: string
    short_name: string
    types: string[]
  }>
}

interface GoogleGeocodingResponse {
  results: GoogleGeocodingResult[]
  status: string
  error_message?: string
}

export const addressValidationService = {
  async validateAddress(
    streetAddress: string,
    city: string,
    stateProvince: string,
    postalCode: string,
    country: string,
    apartmentUnit?: string
  ): Promise<AddressValidationResult> {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured, skipping validation')
      return {
        valid: true,
        formatted_address: this.formatAddressString(
          streetAddress,
          apartmentUnit,
          city,
          stateProvince,
          postalCode,
          country
        ),
        error_message: 'Validation skipped: API key not configured'
      }
    }

    const addressString = this.formatAddressString(
      streetAddress,
      apartmentUnit,
      city,
      stateProvince,
      postalCode,
      country
    )

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          addressString
        )}&key=${GOOGLE_MAPS_API_KEY}`
      )

      if (!response.ok) {
        throw new Error(`Geocoding API error: ${response.statusText}`)
      }

      const data: GoogleGeocodingResponse = await response.json()

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0]

        return {
          valid: true,
          formatted_address: result.formatted_address,
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          suggestions: data.results.length > 1
            ? data.results.slice(1, 3).map(r => r.formatted_address)
            : undefined
        }
      } else if (data.status === 'ZERO_RESULTS') {
        return {
          valid: false,
          error_message: 'Address not found. Please check the details and try again.',
          suggestions: []
        }
      } else {
        return {
          valid: false,
          error_message: data.error_message || `Validation failed: ${data.status}`,
          suggestions: []
        }
      }
    } catch (error) {
      console.error('Address validation error:', error)
      return {
        valid: true,
        formatted_address: addressString,
        error_message: error instanceof Error ? error.message : 'Validation service unavailable'
      }
    }
  },

  formatAddressString(
    streetAddress: string,
    apartmentUnit: string | undefined,
    city: string,
    stateProvince: string,
    postalCode: string,
    country: string
  ): string {
    const parts = [streetAddress]

    if (apartmentUnit) {
      parts[0] = `${streetAddress} ${apartmentUnit}`
    }

    parts.push(city)
    parts.push(stateProvince)
    parts.push(postalCode)
    parts.push(country)

    return parts.filter(Boolean).join(', ')
  },

  validatePostalCode(postalCode: string, country: string): boolean {
    const patterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/,
      UK: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
      AU: /^\d{4}$/,
      DE: /^\d{5}$/,
      FR: /^\d{5}$/,
      JP: /^\d{3}-?\d{4}$/,
    }

    const pattern = patterns[country]
    if (!pattern) {
      return postalCode.length >= 3
    }

    return pattern.test(postalCode)
  },

  getCountries(): Array<{ code: string; name: string }> {
    return [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
      { code: 'UK', name: 'United Kingdom' },
      { code: 'AU', name: 'Australia' },
      { code: 'DE', name: 'Germany' },
      { code: 'FR', name: 'France' },
      { code: 'JP', name: 'Japan' },
      { code: 'MX', name: 'Mexico' },
      { code: 'BR', name: 'Brazil' },
      { code: 'IN', name: 'India' },
    ]
  },

  getUSStates(): Array<{ code: string; name: string }> {
    return [
      { code: 'AL', name: 'Alabama' },
      { code: 'AK', name: 'Alaska' },
      { code: 'AZ', name: 'Arizona' },
      { code: 'AR', name: 'Arkansas' },
      { code: 'CA', name: 'California' },
      { code: 'CO', name: 'Colorado' },
      { code: 'CT', name: 'Connecticut' },
      { code: 'DE', name: 'Delaware' },
      { code: 'FL', name: 'Florida' },
      { code: 'GA', name: 'Georgia' },
      { code: 'HI', name: 'Hawaii' },
      { code: 'ID', name: 'Idaho' },
      { code: 'IL', name: 'Illinois' },
      { code: 'IN', name: 'Indiana' },
      { code: 'IA', name: 'Iowa' },
      { code: 'KS', name: 'Kansas' },
      { code: 'KY', name: 'Kentucky' },
      { code: 'LA', name: 'Louisiana' },
      { code: 'ME', name: 'Maine' },
      { code: 'MD', name: 'Maryland' },
      { code: 'MA', name: 'Massachusetts' },
      { code: 'MI', name: 'Michigan' },
      { code: 'MN', name: 'Minnesota' },
      { code: 'MS', name: 'Mississippi' },
      { code: 'MO', name: 'Missouri' },
      { code: 'MT', name: 'Montana' },
      { code: 'NE', name: 'Nebraska' },
      { code: 'NV', name: 'Nevada' },
      { code: 'NH', name: 'New Hampshire' },
      { code: 'NJ', name: 'New Jersey' },
      { code: 'NM', name: 'New Mexico' },
      { code: 'NY', name: 'New York' },
      { code: 'NC', name: 'North Carolina' },
      { code: 'ND', name: 'North Dakota' },
      { code: 'OH', name: 'Ohio' },
      { code: 'OK', name: 'Oklahoma' },
      { code: 'OR', name: 'Oregon' },
      { code: 'PA', name: 'Pennsylvania' },
      { code: 'RI', name: 'Rhode Island' },
      { code: 'SC', name: 'South Carolina' },
      { code: 'SD', name: 'South Dakota' },
      { code: 'TN', name: 'Tennessee' },
      { code: 'TX', name: 'Texas' },
      { code: 'UT', name: 'Utah' },
      { code: 'VT', name: 'Vermont' },
      { code: 'VA', name: 'Virginia' },
      { code: 'WA', name: 'Washington' },
      { code: 'WV', name: 'West Virginia' },
      { code: 'WI', name: 'Wisconsin' },
      { code: 'WY', name: 'Wyoming' },
    ]
  },

  getCanadianProvinces(): Array<{ code: string; name: string }> {
    return [
      { code: 'AB', name: 'Alberta' },
      { code: 'BC', name: 'British Columbia' },
      { code: 'MB', name: 'Manitoba' },
      { code: 'NB', name: 'New Brunswick' },
      { code: 'NL', name: 'Newfoundland and Labrador' },
      { code: 'NS', name: 'Nova Scotia' },
      { code: 'ON', name: 'Ontario' },
      { code: 'PE', name: 'Prince Edward Island' },
      { code: 'QC', name: 'Quebec' },
      { code: 'SK', name: 'Saskatchewan' },
      { code: 'NT', name: 'Northwest Territories' },
      { code: 'NU', name: 'Nunavut' },
      { code: 'YT', name: 'Yukon' },
    ]
  }
}
