import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function AuthCallback() {
  const { user } = useAuth();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // The auth state change will be handled by useAuth hook
        // Just wait a moment and then redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      } catch (error) {
        console.error('Auth callback error:', error);
        // Redirect to home with error
        window.location.href = '/?auth=error';
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">
          {user ? 'Signing you in...' : 'Processing authentication...'}
        </p>
      </div>
    </div>
  );
}