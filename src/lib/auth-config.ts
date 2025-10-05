export const getOAuthRedirectUrl = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.location.origin
}

export const getGoogleOAuthScopes = (): string => {
  return [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/calendar'
  ].join(' ')
}

export const getSupabaseAuthCallbackUrl = (): string => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

  if (!supabaseUrl) {
    console.error('VITE_SUPABASE_URL not found')
    return ''
  }

  return `${supabaseUrl}/auth/v1/callback`
}

export const getOAuthConfig = () => {
  return {
    redirectTo: getOAuthRedirectUrl(),
    queryParams: {
      access_type: 'offline' as const,
      prompt: 'consent' as const,
      scope: getGoogleOAuthScopes()
    }
  }
}
