export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is not set');
  } else if (typeof supabaseUrl !== 'string' || supabaseUrl.trim() === '') {
    errors.push('VITE_SUPABASE_URL is empty or invalid');
  } else if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
    errors.push('VITE_SUPABASE_URL must start with http:// or https://');
  } else if (supabaseUrl.includes('your-project-ref')) {
    errors.push('VITE_SUPABASE_URL is still set to placeholder value');
  }

  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is not set');
  } else if (typeof supabaseAnonKey !== 'string' || supabaseAnonKey.trim() === '') {
    errors.push('VITE_SUPABASE_ANON_KEY is empty or invalid');
  } else if (supabaseAnonKey.includes('your-anon-key')) {
    errors.push('VITE_SUPABASE_ANON_KEY is still set to placeholder value');
  } else if (supabaseAnonKey.length < 20) {
    warnings.push('VITE_SUPABASE_ANON_KEY seems unusually short');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function getConfig(): AppConfig {
  const validation = validateConfig();

  if (!validation.isValid) {
    const errorMessage = [
      'Environment configuration is invalid:',
      '',
      ...validation.errors.map(e => `  - ${e}`),
      '',
      'Please check your environment variables:',
      '',
      'For local development:',
      '  1. Copy .env.example to .env',
      '  2. Fill in your Supabase credentials from https://app.supabase.com/project/_/settings/api',
      '',
      'For Bolt Cloud deployment:',
      '  1. Go to your Bolt project settings',
      '  2. Navigate to Project → Secrets',
      '  3. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY',
      '  4. Ensure there are no extra spaces or newlines',
      '',
    ].join('\n');

    throw new Error(errorMessage);
  }

  if (validation.warnings.length > 0) {
    console.warn('Configuration warnings:');
    validation.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL!,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
  };
}

export function logConfigStatus(): void {
  const validation = validateConfig();

  console.group('🔧 Environment Configuration Status');

  if (validation.isValid) {
    console.log('✅ Configuration is valid');
    console.log('📍 Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('🔑 Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
  } else {
    console.error('❌ Configuration is invalid');
    validation.errors.forEach(error => console.error(`  ❌ ${error}`));
  }

  if (validation.warnings.length > 0) {
    validation.warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
  }

  console.groupEnd();
}
