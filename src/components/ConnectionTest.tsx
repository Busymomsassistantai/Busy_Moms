import React, { useState } from 'react';
import { Database, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ConnectionTestProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectionTest({ isOpen, onClose }: ConnectionTestProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    overall: 'idle' | 'testing' | 'success' | 'error';
    tests: {
      name: string;
      status: 'idle' | 'testing' | 'success' | 'error';
      message?: string;
      details?: string;
    }[];
  }>({
    overall: 'idle',
    tests: [
      { name: 'Environment Variables', status: 'idle' },
      { name: 'Basic Connection', status: 'idle' },
      { name: 'Authentication System', status: 'idle' },
      { name: 'Database Access', status: 'idle' },
      { name: 'Table Permissions', status: 'idle' }
    ]
  });

  const runConnectionTest = async () => {
    setTesting(true);
    setResults(prev => ({
      overall: 'testing',
      tests: prev.tests.map(test => ({ ...test, status: 'testing', message: undefined, details: undefined }))
    }));

    const testResults = [...results.tests];
    let overallSuccess = true;

    try {
      // Test 1: Environment Variables
      console.log('🔍 Testing environment variables...');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseKey) {
        testResults[0] = {
          name: 'Environment Variables',
          status: 'success',
          message: 'All required environment variables are set',
          details: `URL: ${supabaseUrl.substring(0, 30)}...`
        };
        console.log('✅ Environment variables OK');
      } else {
        testResults[0] = {
          name: 'Environment Variables',
          status: 'error',
          message: 'Missing required environment variables',
          details: `URL: ${supabaseUrl ? 'Set' : 'Missing'}, Key: ${supabaseKey ? 'Set' : 'Missing'}`
        };
        overallSuccess = false;
        console.log('❌ Environment variables missing');
      }

      // Test 2: Basic Connection
      console.log('🔍 Testing basic connection...');
      try {
        const { data: healthCheck, error: healthError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        if (!healthError) {
          testResults[1] = {
            name: 'Basic Connection',
            status: 'success',
            message: 'Successfully connected to Supabase',
            details: 'Database is reachable and responding'
          };
          console.log('✅ Basic connection OK');
        } else {
          throw healthError;
        }
      } catch (error: any) {
        testResults[1] = {
          name: 'Basic Connection',
          status: 'error',
          message: 'Failed to connect to Supabase',
          details: error.message || 'Unknown connection error'
        };
        overallSuccess = false;
        console.log('❌ Basic connection failed:', error.message);
      }

      // Test 3: Authentication System
      console.log('🔍 Testing authentication system...');
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        
        testResults[2] = {
          name: 'Authentication System',
          status: 'success',
          message: 'Authentication system is working',
          details: session ? `User authenticated: ${session.user.email}` : 'No active session (normal for demo mode)'
        };
        console.log('✅ Authentication system OK');
      } catch (error: any) {
        testResults[2] = {
          name: 'Authentication System',
          status: 'error',
          message: 'Authentication system error',
          details: error.message || 'Unknown auth error'
        };
        overallSuccess = false;
        console.log('❌ Authentication system failed:', error.message);
      }

      // Test 4: Database Access
      console.log('🔍 Testing database access...');
      try {
        const { data: profileTest, error: profileError } = await supabase
          .from('profiles')
          .select('id, email')
          .limit(1);

        if (!profileError) {
          testResults[3] = {
            name: 'Database Access',
            status: 'success',
            message: 'Database queries are working',
            details: `Found ${profileTest?.length || 0} profile records`
          };
          console.log('✅ Database access OK');
        } else {
          throw profileError;
        }
      } catch (error: any) {
        testResults[3] = {
          name: 'Database Access',
          status: 'error',
          message: 'Database query failed',
          details: error.message || 'Unknown database error'
        };
        overallSuccess = false;
        console.log('❌ Database access failed:', error.message);
      }

      // Test 5: Table Permissions
      console.log('🔍 Testing table permissions...');
      try {
        const tables = ['family_members', 'events', 'contacts', 'shopping_lists', 'reminders'];
        const tableTests = await Promise.all(
          tables.map(async (table) => {
            try {
              const { error } = await supabase.from(table).select('count').limit(1);
              return { table, success: !error, error: error?.message };
            } catch (err: any) {
              return { table, success: false, error: err.message };
            }
          })
        );

        const successfulTables = tableTests.filter(t => t.success);
        const failedTables = tableTests.filter(t => !t.success);

        if (failedTables.length === 0) {
          testResults[4] = {
            name: 'Table Permissions',
            status: 'success',
            message: 'All table permissions are working',
            details: `Accessible tables: ${successfulTables.map(t => t.table).join(', ')}`
          };
          console.log('✅ Table permissions OK');
        } else {
          testResults[4] = {
            name: 'Table Permissions',
            status: 'error',
            message: `${failedTables.length} tables have permission issues`,
            details: `Failed: ${failedTables.map(t => t.table).join(', ')}`
          };
          overallSuccess = false;
          console.log('❌ Table permissions failed for:', failedTables.map(t => t.table));
        }
      } catch (error: any) {
        testResults[4] = {
          name: 'Table Permissions',
          status: 'error',
          message: 'Failed to test table permissions',
          details: error.message || 'Unknown permissions error'
        };
        overallSuccess = false;
        console.log('❌ Table permissions test failed:', error.message);
      }

    } catch (error: any) {
      console.error('❌ Connection test failed:', error);
      overallSuccess = false;
    }

    // Update final results
    setResults({
      overall: overallSuccess ? 'success' : 'error',
      tests: testResults
    });
    setTesting(false);

    console.log(overallSuccess ? '✅ All tests passed!' : '❌ Some tests failed');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'testing':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'testing':
        return 'bg-yellow-50 border-yellow-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Database className="w-8 h-8 text-blue-500" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Supabase Connection Test</h2>
                <p className="text-gray-600">Verify database connectivity and permissions</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Overall Status */}
          <div className={`p-4 rounded-lg mb-6 border-2 ${getStatusColor(results.overall)}`}>
            <div className="flex items-center space-x-3">
              {getStatusIcon(results.overall)}
              <div>
                <h3 className="font-semibold">
                  {results.overall === 'idle' && 'Ready to test connection'}
                  {results.overall === 'testing' && 'Testing connection...'}
                  {results.overall === 'success' && 'All tests passed!'}
                  {results.overall === 'error' && 'Some tests failed'}
                </h3>
                <p className="text-sm opacity-75">
                  {results.overall === 'idle' && 'Click "Run Test" to check your Supabase connection'}
                  {results.overall === 'testing' && 'Please wait while we test your connection'}
                  {results.overall === 'success' && 'Your Supabase connection is working perfectly'}
                  {results.overall === 'error' && 'Check the details below to resolve issues'}
                </p>
              </div>
            </div>
          </div>

          {/* Individual Test Results */}
          <div className="space-y-3 mb-6">
            {results.tests.map((test, index) => (
              <div key={index} className={`p-4 rounded-lg border ${getStatusColor(test.status)}`}>
                <div className="flex items-start space-x-3">
                  {getStatusIcon(test.status)}
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{test.name}</h4>
                    {test.message && (
                      <p className="text-sm text-gray-600 mt-1">{test.message}</p>
                    )}
                    {test.details && (
                      <p className="text-xs text-gray-500 mt-1 font-mono bg-gray-100 p-2 rounded">
                        {test.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Environment Variables Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
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
          <div className="flex space-x-3">
            <button
              onClick={runConnectionTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Testing...' : 'Run Test'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}