import React, { useState } from 'react';
import { Calendar, CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink, X, RefreshCw } from 'lucide-react';
import { googleCalendarService, GoogleCalendarEvent } from '../services/googleCalendar';

interface GoogleCalendarTestProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleCalendarTest({ isOpen, onClose }: GoogleCalendarTestProps) {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    overall: 'idle' | 'testing' | 'success' | 'error';
    diagnostics?: any;
    tests: {
      name: string;
      status: 'idle' | 'testing' | 'success' | 'error';
      message?: string;
      details?: string;
    }[];
  }>({
    overall: 'idle',
    tests: [
      { name: 'Check Backend Configuration', status: 'idle' },
      { name: 'Service Initialization', status: 'idle' },
      { name: 'Authentication Check', status: 'idle' },
      { name: 'List Upcoming Events', status: 'idle' },
      { name: 'Create Test Event', status: 'idle' }
    ]
  });
  const [upcomingEvents, setUpcomingEvents] = useState<GoogleCalendarEvent[]>([]);

  const runGoogleCalendarTest = async () => {
    setTesting(true);
    setResults(prev => ({
      overall: 'testing',
      tests: prev.tests.map(test => ({ ...test, status: 'testing', message: undefined, details: undefined }))
    }));

    const testResults = [...results.tests];
    let overallSuccess = true;
    let diagnosticsData = null;

    try {
      // Test 0: Check Backend Configuration (Diagnostics)
      console.log('🔍 Running backend diagnostics...');
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const diagResponse = await fetch(`${supabaseUrl}/functions/v1/google-diagnostics`);

        if (diagResponse.ok) {
          diagnosticsData = await diagResponse.json();
          const diagStatus = diagnosticsData.overall_status;

          testResults[0] = {
            name: 'Check Backend Configuration',
            status: diagStatus === 'pass' ? 'success' : diagStatus === 'warning' ? 'success' : 'error',
            message: diagStatus === 'pass'
              ? 'Backend configuration is correct'
              : diagStatus === 'warning'
              ? 'Backend has warnings but may work'
              : 'Backend configuration has errors',
            details: JSON.stringify(diagnosticsData.checks, null, 2)
          };

          if (diagStatus === 'fail') {
            console.log('❌ Backend configuration issues detected:', diagnosticsData);
            overallSuccess = false;
          } else {
            console.log('✅ Backend diagnostics OK');
          }
        } else {
          throw new Error(`Diagnostics endpoint returned ${diagResponse.status}`);
        }
      } catch (error: any) {
        testResults[0] = {
          name: 'Check Backend Configuration',
          status: 'error',
          message: 'Failed to run backend diagnostics',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Backend diagnostics failed:', error.message);
      }

      // Test 1: Service Initialization
      console.log('🔍 Testing Google Calendar service initialization...');
      try {
        await googleCalendarService.initialize();

        if (googleCalendarService.isAvailable()) {
          testResults[1] = {
            name: 'Service Initialization',
            status: 'success',
            message: 'Google Calendar service initialized successfully',
            details: `Ready: ${googleCalendarService.isReady()}, Available: ${googleCalendarService.isAvailable()}`
          };
          console.log('✅ Service initialization OK');
        } else {
          throw new Error('Google Calendar service not available. Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured.');
        }
      } catch (error: any) {
        testResults[1] = {
          name: 'Service Initialization',
          status: 'error',
          message: 'Failed to initialize Google Calendar service',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Service initialization failed:', error.message);
      }

      // Test 2: Authentication Check
      console.log('🔍 Testing Google Calendar authentication...');
      try {
        const isSignedIn = googleCalendarService.isSignedIn();

        if (isSignedIn) {
          testResults[2] = {
            name: 'Authentication Check',
            status: 'success',
            message: 'User is authenticated with Google Calendar',
            details: 'Ready to make API calls'
          };
          console.log('✅ Authentication OK');
        } else {
          testResults[2] = {
            name: 'Authentication Check',
            status: 'error',
            message: 'User not authenticated with Google Calendar',
            details: 'Please connect Google Calendar first using the "Connect Google Calendar" button in Settings'
          };
          overallSuccess = false;
          console.log('❌ Authentication failed');
        }
      } catch (error: any) {
        testResults[2] = {
          name: 'Authentication Check',
          status: 'error',
          message: 'Authentication check failed',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Authentication check failed:', error.message);
      }

      // Test 3: List Upcoming Events
      console.log('🔍 Testing list upcoming events...');
      try {
        const events = await googleCalendarService.listUpcoming(5);

        testResults[3] = {
          name: 'List Upcoming Events',
          status: 'success',
          message: `Successfully retrieved ${events.length} upcoming events`,
          details: events.length > 0 ? `First event: ${events[0].summary}` : 'No upcoming events found'
        };
        setUpcomingEvents(events);
        console.log('✅ List events OK');
      } catch (error: any) {
        testResults[3] = {
          name: 'List Upcoming Events',
          status: 'error',
          message: 'Failed to retrieve upcoming events',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ List events failed:', error.message);
      }

      // Test 4: Create Test Event
      console.log('🔍 Testing create test event...');
      try {
        const testEvent = {
          summary: 'Busy Moms App Test Event',
          description: 'This is a test event created by the Busy Moms app to verify Google Calendar integration.',
          start: {
            dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          },
          end: {
            dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(), // Tomorrow + 30 min
          },
        };

        const createdEvent = await googleCalendarService.insertEvent(testEvent);

        testResults[4] = {
          name: 'Create Test Event',
          status: 'success',
          message: 'Successfully created test event',
          details: `Event ID: ${(createdEvent as any)?.id || 'Unknown'}`
        };
        console.log('✅ Create event OK');
      } catch (error: any) {
        testResults[4] = {
          name: 'Create Test Event',
          status: 'error',
          message: 'Failed to create test event',
          details: error.message
        };
        overallSuccess = false;
        console.log('❌ Create event failed:', error.message);
      }

    } catch (error: any) {
      console.error('❌ Google Calendar test failed:', error);
      overallSuccess = false;
    }

    // Update final results
    setResults({
      overall: overallSuccess ? 'success' : 'error',
      diagnostics: diagnosticsData,
      tests: testResults
    });
    setTesting(false);

    console.log(overallSuccess ? '✅ All Google Calendar tests passed!' : '❌ Some Google Calendar tests failed');
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
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-8 h-8 text-blue-500" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Google Calendar API Test</h2>
                <p className="text-gray-600">Test Google Calendar integration and API connectivity</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Overall Status */}
          <div className={`p-4 rounded-lg mb-6 border-2 ${getStatusColor(results.overall)}`}>
            <div className="flex items-center space-x-3">
              {getStatusIcon(results.overall)}
              <div>
                <h3 className="font-semibold">
                  {results.overall === 'idle' && 'Ready to test Google Calendar API'}
                  {results.overall === 'testing' && 'Testing Google Calendar API...'}
                  {results.overall === 'success' && 'All Google Calendar tests passed!'}
                  {results.overall === 'error' && 'Some Google Calendar tests failed'}
                </h3>
                <p className="text-sm opacity-75">
                  {results.overall === 'idle' && 'Click "Run Test" to verify your Google Calendar integration'}
                  {results.overall === 'testing' && 'Please wait while we test your Google Calendar connection'}
                  {results.overall === 'success' && 'Your Google Calendar integration is working perfectly'}
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

          {/* Diagnostics Display */}
          {results.diagnostics && results.diagnostics.overall_status === 'fail' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-medium text-red-900 mb-3">Backend Configuration Issues Detected</h3>
              <div className="space-y-2 text-sm">
                {results.diagnostics.checks.map((check: any, idx: number) => (
                  check.status === 'fail' && (
                    <div key={idx} className="bg-white p-2 rounded border border-red-200">
                      <div className="font-medium text-gray-900">{check.name}</div>
                      <div className="text-red-700">{check.message}</div>
                      {check.instructions && (
                        <ul className="mt-2 ml-4 list-disc text-xs text-gray-600">
                          {check.instructions.map((instruction: string, i: number) => (
                            <li key={i}>{instruction}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                ))}
              </div>
              <a
                href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-diagnostics`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                View full diagnostics report
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          )}

          {/* Upcoming Events Display */}
          {upcomingEvents.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-3">Upcoming Events from Google Calendar</h3>
              <div className="space-y-2">
                {upcomingEvents.slice(0, 3).map((event, index) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">{event.summary || 'Untitled Event'}</h4>
                        <p className="text-sm text-gray-600">
                          {event.start?.dateTime 
                            ? new Date(event.start.dateTime).toLocaleString()
                            : event.start?.date 
                            ? new Date(event.start.date).toLocaleDateString()
                            : 'No date'
                          }
                        </p>
                        {event.location && (
                          <p className="text-xs text-gray-500">{event.location}</p>
                        )}
                      </div>
                      {event.htmlLink && (
                        <a
                          href={event.htmlLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                          title="Open in Google Calendar"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {upcomingEvents.length > 3 && (
                  <p className="text-sm text-gray-500 text-center">
                    ... and {upcomingEvents.length - 3} more events
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Environment Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">Environment Configuration</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Supabase URL:</span>
                <span className={import.meta.env.VITE_SUPABASE_URL ? 'text-green-600' : 'text-red-600'}>
                  {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Supabase Anon Key:</span>
                <span className={import.meta.env.VITE_SUPABASE_ANON_KEY ? 'text-green-600' : 'text-red-600'}>
                  {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Edge Functions URL:</span>
                <span className={import.meta.env.VITE_SUPABASE_URL ? 'text-green-600' : 'text-red-600'}>
                  {import.meta.env.VITE_SUPABASE_URL ? `✅ ${import.meta.env.VITE_SUPABASE_URL}/functions/v1` : '❌ Missing'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Service Available:</span>
                <span className={googleCalendarService.isAvailable() ? 'text-green-600' : 'text-red-600'}>
                  {googleCalendarService.isAvailable() ? '✅ Yes' : '❌ No'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={runGoogleCalendarTest}
              disabled={testing}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <Calendar className={`w-4 h-4 ${testing ? 'animate-pulse' : ''}`} />
              <span>{testing ? 'Testing...' : 'Run Google Calendar Test'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 text-gray-900 opacity-90 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">Troubleshooting Guide</h3>
            <div className="text-sm text-yellow-700 space-y-2">
              <p className="font-medium">If tests fail, check the following:</p>
              <ol className="list-decimal ml-5 space-y-1">
                <li>
                  <strong>Backend Configuration:</strong> Google OAuth credentials must be set in Supabase Dashboard → Project Settings → Edge Functions → Secrets
                  <ul className="ml-4 mt-1 list-disc">
                    <li>GOOGLE_CLIENT_ID</li>
                    <li>GOOGLE_CLIENT_SECRET</li>
                  </ul>
                </li>
                <li>
                  <strong>User Authentication:</strong> You must connect your Google Calendar first using the "Connect Google Calendar" button in Settings
                </li>
                <li>
                  <strong>Edge Functions:</strong> All Google Calendar Edge Functions must be deployed (they are already deployed for this project)
                </li>
                <li>
                  <strong>Run Diagnostics:</strong> Click the diagnostics link above to get a detailed configuration report
                </li>
              </ol>
              <p className="mt-2">
                <strong>Note:</strong> The first test checks your backend configuration. If it fails, fix the configuration issues before proceeding.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}