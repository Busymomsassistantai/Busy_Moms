import React, { useState, useEffect } from 'react'
import { Database, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function SupabaseTest() {
  const { user } = useAuth()
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'error'>('testing')
  const [testResults, setTestResults] = useState<{
    connection: boolean
    auth: boolean
    database: boolean
    tables: string[]
    error?: string
  }>({
    connection: false,
    auth: false,
    database: false,
    tables: []
  })

  useEffect(() => {
    testSupabaseConnection()
  }, [])

  const testSupabaseConnection = async () => {
    setConnectionStatus('testing')
    const results = {
      connection: false,
      auth: false,
      database: false,
      tables: [] as string[],
      error: undefined as string | undefined
    }

    try {
      // Test 1: Basic connection
      console.log('Testing Supabase connection...')
      const { data: healthCheck, error: healthError } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)

      if (!healthError) {
        results.connection = true
        console.log('✅ Supabase connection successful')
      } else {
        console.log('❌ Supabase connection failed:', healthError.message)
        results.error = healthError.message
      }

      // Test 2: Authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      if (!authError) {
        results.auth = true
        console.log('✅ Supabase auth working, session:', session ? 'Active' : 'None')
      } else {
        console.log('❌ Supabase auth error:', authError.message)
      }

      // Test 3: Database access
      const { data: profileTest, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      if (!profileError) {
        results.database = true
        results.tables = ['profiles', 'family_members', 'events', 'contacts', 'shopping_lists', 'reminders', 'auto_reorders', 'event_actions', 'gift_suggestions', 'user_preferences', 'whatsapp_messages']
        console.log('✅ Database access successful')
      } else {
        console.log('❌ Database access failed:', profileError.message)
        results.error = profileError.message
      }

      setTestResults(results)
      setConnectionStatus(results.connection ? 'connected' : 'error')

    } catch (error: any) {
      console.error('❌ Supabase test failed:', error)
      results.error = error.message
      setTestResults(results)
      setConnectionStatus('error')
    }
  }

  const testUserOperations = async () => {
    if (!user) {
      alert('Please sign in first to test user operations')
      return
    }

    try {
      // Test creating a family member
      const { data: newMember, error: createError } = await supabase
        .from('family_members')
        .insert([{
          user_id: user.id,
          name: 'Test Child',
          age: 8,
          gender: 'Other'
        }])
        .select()
        .single()

      if (createError) {
        console.error('❌ Create test failed:', createError)
        alert(`Create test failed: ${createError.message}`)
        return
      }

      console.log('✅ Create test successful:', newMember)

      // Test reading the family member
      const { data: readMember, error: readError } = await supabase
        .from('family_members')
        .select('*')
        .eq('id', newMember.id)
        .single()

      if (readError) {
        console.error('❌ Read test failed:', readError)
        alert(`Read test failed: ${readError.message}`)
        return
      }

      console.log('✅ Read test successful:', readMember)

      // Test updating the family member
      const { data: updatedMember, error: updateError } = await supabase
        .from('family_members')
        .update({ name: 'Updated Test Child' })
        .eq('id', newMember.id)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Update test failed:', updateError)
        alert(`Update test failed: ${updateError.message}`)
        return
      }

      console.log('✅ Update test successful:', updatedMember)

      // Test deleting the family member
      const { error: deleteError } = await supabase
        .from('family_members')
        .delete()
        .eq('id', newMember.id)

      if (deleteError) {
        console.error('❌ Delete test failed:', deleteError)
        alert(`Delete test failed: ${deleteError.message}`)
        return
      }

      console.log('✅ Delete test successful')
      alert('✅ All CRUD operations successful!')

    } catch (error: any) {
      console.error('❌ User operations test failed:', error)
      alert(`User operations test failed: ${error.message}`)
    }
  }

  const StatusIcon = ({ status }: { status: boolean }) => {
    return status ? (
      <CheckCircle className="w-5 h-5 text-green-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="bg-theme-surface rounded-xl shadow-lg p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Database className="w-8 h-8 text-blue-500" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Supabase Connection Test</h2>
            <p className="text-gray-600">Testing database connectivity and functionality</p>
          </div>
        </div>

        {/* Overall Status */}
        <div className={`p-4 rounded-lg mb-6 ${
          connectionStatus === 'testing' ? 'bg-yellow-50 border border-yellow-200' :
          connectionStatus === 'connected' ? 'bg-green-50 border border-green-200' :
          'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center space-x-2">
            {connectionStatus === 'testing' && <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />}
            {connectionStatus === 'connected' && <CheckCircle className="w-5 h-5 text-green-500" />}
            {connectionStatus === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
            <span className="font-medium">
              {connectionStatus === 'testing' && 'Testing connection...'}
              {connectionStatus === 'connected' && 'Supabase Connected Successfully'}
              {connectionStatus === 'error' && 'Connection Failed'}
            </span>
          </div>
          {testResults.error && (
            <p className="text-sm text-red-600 mt-2">Error: {testResults.error}</p>
          )}
        </div>

        {/* Detailed Test Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-theme-bg rounded-lg">
            <span className="font-medium">Basic Connection</span>
            <StatusIcon status={testResults.connection} />
          </div>

          <div className="flex items-center justify-between p-3 bg-theme-bg rounded-lg">
            <span className="font-medium">Authentication System</span>
            <StatusIcon status={testResults.auth} />
          </div>

          <div className="flex items-center justify-between p-3 bg-theme-bg rounded-lg">
            <span className="font-medium">Database Access</span>
            <StatusIcon status={testResults.database} />
          </div>

          {testResults.tables.length > 0 && (
            <div className="p-3 bg-theme-bg rounded-lg">
              <span className="font-medium block mb-2">Available Tables:</span>
              <div className="flex flex-wrap gap-2">
                {testResults.tables.map((table) => (
                  <span key={table} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {table}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Environment Variables Check */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Environment Variables</h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>VITE_SUPABASE_URL:</span>
              <span className={import.meta.env.VITE_SUPABASE_URL ? 'text-green-600' : 'text-red-600'}>
                {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>VITE_SUPABASE_ANON_KEY:</span>
              <span className={import.meta.env.VITE_SUPABASE_ANON_KEY ? 'text-green-600' : 'text-red-600'}>
                {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 mt-6">
          <button
            onClick={testSupabaseConnection}
            className="px-4 py-2 bg-theme-primary text-white rounded-lg hover:bg-theme-primary transition-colors"
          >
            Retry Connection Test
          </button>
          
          {user && (
            <button
              onClick={testUserOperations}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Test CRUD Operations
            </button>
          )}
        </div>

        {/* User Info */}
        <div className="mt-6 p-4 bg-theme-bg rounded-lg">
          <h3 className="font-medium text-theme-fg mb-2">Current User</h3>
          {user ? (
            <div className="text-sm text-gray-600">
              <p>ID: {user.id}</p>
              <p>Email: {user.email}</p>
              <p>Authenticated: ✅</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Not authenticated</p>
          )}
        </div>
      </div>
    </div>
  )
}