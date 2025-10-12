import { useState, useEffect } from 'react'
import { supabase, Address } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDefaultAddress() {
  const { user } = useAuth()
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDefaultAddress = async () => {
    if (!user?.id) {
      setDefaultAddress(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle()

      if (error) throw error
      setDefaultAddress(data)
    } catch (err: any) {
      console.error('Error loading default address:', err)
      setError(err.message || 'Failed to load default address')
      setDefaultAddress(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDefaultAddress()
  }, [user?.id])

  return {
    defaultAddress,
    loading,
    error,
    reload: loadDefaultAddress
  }
}
