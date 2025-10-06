import React, { useState } from 'react';
import { Database, CheckCircle, XCircle, AlertCircle, Loader2, User, Mail, Lock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AuthTestProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthTest({ isOpen, onClose }: AuthTestProps) {
  const { user, signUp, signIn, signOut } = useAuth();
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
      { name: 'Create Demo User', status: 'idle' },
      { name: 'Test Login', status: 'idle' },
      { name: 'Create Profile', status: 'idle' },
      { name: 'Test Database Access', status: 'idle' }
    ]
  });

  const runAuthTest = async () => {
    setTesting(true);
    setResults(prev => ({
      overall: 'testing',
      tests: prev.tests.map(test => ({ ...test, status: 'testing', message: undefined, details: undefined }))
    }));

    const testResults = [...results.tests];
    let overallSuccess = true;

    try {
      // Test 1: Create Demo User
      console.log('🔍 Creating demo user...');
      try {
        // First, try to sign out any existing user
        await signOut();
        
        // Try to create the demo user
        const { data: signUpData, error: signUpError } = await signUp('demo@busymoms.app', 'demo123456');
        
        if (signUpError && signUpError.message.includes('already registered')) {
          testResults[0] = {
            name: 'Create Demo User',
            status: 'success',
            message: 'Demo user already exists',
            details: 'User demo@busymoms.app is already registered'
          };
          console.log('✅ Demo user already exists');
        } else if (signUpError) {
          throw signUpError;
        } else {
          testResults[0] = {
            name: 'Create Demo User',
            status: 'success',
            message: 'Demo user created successfully',
            details: `User ID: ${signUpData.user?.id}`
          };
          console.log('✅ Demo user created');
        }
      } catch (error: any) {
        testResults[0] = {
          name: 'Create Demo User',
          status: 'error',
          message: 'Failed to create demo user',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Demo user creation failed:', error.message);
      }

      // Test 2: Test Login
      console.log('🔍 Testing login...');
      try {
        const { data: signInData, error: signInError } = await signIn('demo@busymoms.app', 'demo123456');
        
        if (signInError) {
          throw signInError;
        }

        testResults[1] = {
          name: 'Test Login',
          status: 'success',
          message: 'Login successful',
          details: `Logged in as: ${signInData.user?.email}`
        };
        console.log('✅ Login successful');
      } catch (error: any) {
        testResults[1] = {
          name: 'Test Login',
          status: 'error',
          message: 'Login failed',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Login failed:', error.message);
      }

      // Test 3: Create Profile
      console.log('🔍 Creating user profile...');
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          throw new Error('No authenticated user found');
        }

        // Check if profile already exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (existingProfile) {
          testResults[2] = {
            name: 'Create Profile',
            status: 'success',
            message: 'Profile already exists',
            details: `Profile for ${existingProfile.email}`
          };
          console.log('✅ Profile already exists');
        } else {
          // Create profile
          const { data: newProfile, error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: currentUser.id,
              email: currentUser.email || 'demo@busymoms.app',
              full_name: 'Demo User',
              user_type: 'Mom',
              onboarding_completed: true,
              ai_personality: 'Friendly'
            }])
            .select()
            .single();

          if (profileError) {
            throw profileError;
          }

          testResults[2] = {
            name: 'Create Profile',
            status: 'success',
            message: 'Profile created successfully',
            details: `Created profile for ${newProfile.email}`
          };
          console.log('✅ Profile created');
        }
      } catch (error: any) {
        testResults[2] = {
          name: 'Create Profile',
          status: 'error',
          message: 'Profile creation failed',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Profile creation failed:', error.message);
      }

      // Test 4: Test Database Access
      console.log('🔍 Testing database access...');
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          throw new Error('No authenticated user found');
        }

        // Test creating a family member
        const { data: testMember, error: memberError } = await supabase
          .from('family_members')
          .insert([{
            user_id: currentUser.id,
            name: 'Test Child',
            age: 8,
            gender: 'Other'
          }])
          .select()
          .single();

        if (memberError) {
          throw memberError;
        }

        // Clean up test data
        await supabase
          .from('family_members')
          .delete()
          .eq('id', testMember.id);

        testResults[3] = {
          name: 'Test Database Access',
          status: 'success',
          message: 'Database operations working',
          details: 'Successfully created and deleted test family member'
        };
        console.log('✅ Database access working');
      } catch (error: any) {
        testResults[3] = {
          name: 'Test Database Access',
          status: 'error',
          message: 'Database access failed',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Database access failed:', error.message);
      }

    } catch (error: any) {
      console.error('❌ Auth test failed:', error);
      overallSuccess = false;
    }

    // Update final results
    setResults({
      overall: overallSuccess ? 'success' : 'error',
      tests: testResults
    });
    setTesting(false);

    console.log(overallSuccess ? '✅ All auth tests passed!' : '❌ Some auth tests failed');
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
              <User className="w-8 h-8 text-purple-500" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Authentication Test</h2>
                <p className="text-gray-600">Test and setup demo user authentication</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Current User Status */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Current User Status</h3>
            {user ? (
              <div className="text-sm text-blue-700">
                <p>✅ Authenticated as: {user.email}</p>
                <p>User ID: {user.id}</p>
              </div>
            ) : (
              <p className="text-sm text-blue-700">❌ Not authenticated</p>
            )}
          </div>

          {/* Overall Status */}
          <div className={`p-4 rounded-lg mb-6 border-2 ${getStatusColor(results.overall)}`}>
            <div className="flex items-center space-x-3">
              {getStatusIcon(results.overall)}
              <div>
                <h3 className="font-semibold">
                  {results.overall === 'idle' && 'Ready to test authentication'}
                  {results.overall === 'testing' && 'Testing authentication...'}
                  {results.overall === 'success' && 'All authentication tests passed!'}
                  {results.overall === 'error' && 'Some authentication tests failed'}
                </h3>
                <p className="text-sm opacity-75">
                  {results.overall === 'idle' && 'Click "Run Auth Test" to setup and test demo user'}
                  {results.overall === 'testing' && 'Please wait while we test authentication'}
                  {results.overall === 'success' && 'Demo user is ready to use'}
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

          {/* Action Buttons */}
          <div className="flex space-x-3 mb-6">
            <button
              onClick={runAuthTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              <User className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
              <span>{testing ? 'Testing...' : 'Run Auth Test'}</span>
            </button>
            
            {user && (
              <button
                onClick={signOut}
                className="px-4 py-3 border border-gray-200 text-gray-900 opacity-90 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>

          {/* Demo Credentials */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">Demo Credentials</h3>
            <div className="text-sm text-green-700 space-y-1">
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4" />
                <span>Email: demo@busymoms.app</span>
              </div>
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4" />
                <span>Password: demo123456</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}