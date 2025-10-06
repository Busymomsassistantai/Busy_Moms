import { supabase, Affirmation, AffirmationSettings } from '../lib/supabase';

export class AffirmationService {
  async generateAffirmation(forceRegenerate: boolean = false): Promise<Affirmation> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('User not authenticated');
    }

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-affirmation`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        forceRegenerate,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate affirmation');
    }

    const affirmation = await response.json();
    return affirmation;
  }

  async getTodaysAffirmation(): Promise<Affirmation | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('affirmations')
      .select('*')
      .eq('user_id', user.id)
      .eq('generated_date', today)
      .maybeSingle();

    if (error) {
      console.error('Error fetching today\'s affirmation:', error);
      return null;
    }

    return data;
  }

  async getAffirmationHistory(limit: number = 30): Promise<Affirmation[]> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase
      .from('affirmations')
      .select('*')
      .eq('user_id', user.id)
      .order('generated_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching affirmation history:', error);
      return [];
    }

    return data || [];
  }

  async markAsViewed(affirmationId: string): Promise<void> {
    const { error } = await supabase
      .from('affirmations')
      .update({ viewed: true, updated_at: new Date().toISOString() })
      .eq('id', affirmationId);

    if (error) {
      console.error('Error marking affirmation as viewed:', error);
    }
  }

  async toggleFavorite(affirmationId: string, favorited: boolean): Promise<void> {
    const { error } = await supabase
      .from('affirmations')
      .update({ favorited, updated_at: new Date().toISOString() })
      .eq('id', affirmationId);

    if (error) {
      console.error('Error toggling favorite:', error);
      throw error;
    }
  }

  async getSettings(): Promise<AffirmationSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('affirmation_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching affirmation settings:', error);
      return null;
    }

    if (!data) {
      return await this.createDefaultSettings();
    }

    return data;
  }

  async createDefaultSettings(): Promise<AffirmationSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const { data, error } = await supabase
      .from('affirmation_settings')
      .insert({
        user_id: user.id,
        enabled: true,
        frequency: 'once_daily',
        preferred_time: '08:00:00',
        secondary_time: '20:00:00',
        timezone: userTimezone,
        include_calendar: true,
        include_tasks: true,
        include_family: true,
        include_shopping: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating default settings:', error);
      return null;
    }

    return data;
  }

  async updateSettings(settings: Partial<AffirmationSettings>): Promise<AffirmationSettings | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('affirmation_settings')
      .update({
        ...settings,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating affirmation settings:', error);
      throw error;
    }

    return data;
  }

  shouldShowAffirmation(settings: AffirmationSettings | null): boolean {
    if (!settings || !settings.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.toTimeString().split(' ')[0];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    if (!settings.preferred_time) {
      return false;
    }

    const [prefHour, prefMinute] = settings.preferred_time.split(':').map(Number);

    const isPreferredTime = currentHour === prefHour && currentMinute === prefMinute;

    if (settings.frequency === 'twice_daily' && settings.secondary_time) {
      const [secHour, secMinute] = settings.secondary_time.split(':').map(Number);
      const isSecondaryTime = currentHour === secHour && currentMinute === secMinute;
      return isPreferredTime || isSecondaryTime;
    }

    return isPreferredTime;
  }

  async checkAndShowAffirmation(): Promise<Affirmation | null> {
    const settings = await this.getSettings();

    if (!this.shouldShowAffirmation(settings)) {
      return null;
    }

    let affirmation = await this.getTodaysAffirmation();

    if (!affirmation) {
      try {
        affirmation = await this.generateAffirmation(false);
      } catch (error) {
        console.error('Error generating affirmation:', error);
        return null;
      }
    }

    if (affirmation && !affirmation.viewed) {
      await this.markAsViewed(affirmation.id);
    }

    return affirmation;
  }

  getTimeUntilNextAffirmation(settings: AffirmationSettings | null): number | null {
    if (!settings || !settings.enabled || !settings.preferred_time) {
      return null;
    }

    const now = new Date();
    const [prefHour, prefMinute] = settings.preferred_time.split(':').map(Number);

    const nextAffirmation = new Date();
    nextAffirmation.setHours(prefHour, prefMinute, 0, 0);

    if (nextAffirmation <= now) {
      nextAffirmation.setDate(nextAffirmation.getDate() + 1);
    }

    return nextAffirmation.getTime() - now.getTime();
  }

  formatTimeUntilNext(milliseconds: number): string {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

export const affirmationService = new AffirmationService();
