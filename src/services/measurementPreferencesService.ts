import { supabase } from '../lib/supabase'
import type { UserMeasurementPreferences, MeasurementOverride } from '../lib/supabase'
import { MeasurementConverter, MeasurementSystem } from '../utils/measurementConverter'

export class MeasurementPreferencesService {
  private preferencesCache: Map<string, UserMeasurementPreferences> = new Map()

  async getPreferences(userId: string): Promise<UserMeasurementPreferences> {
    if (this.preferencesCache.has(userId)) {
      return this.preferencesCache.get(userId)!
    }

    const { data, error } = await supabase
      .from('user_measurement_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      const defaultPrefs = await this.createDefaultPreferences(userId)
      this.preferencesCache.set(userId, defaultPrefs)
      return defaultPrefs
    }

    this.preferencesCache.set(userId, data)
    return data
  }

  async createDefaultPreferences(userId: string): Promise<UserMeasurementPreferences> {
    const { data, error } = await supabase
      .from('user_measurement_preferences')
      .insert({
        user_id: userId,
        preferred_system: 'imperial',
        default_volume_unit: 'cup',
        default_weight_unit: 'pound',
        auto_convert: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updatePreferences(
    userId: string,
    updates: Partial<UserMeasurementPreferences>
  ): Promise<UserMeasurementPreferences> {
    const { data, error } = await supabase
      .from('user_measurement_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw error

    this.preferencesCache.set(userId, data)
    return data
  }

  async setPreferredSystem(userId: string, system: MeasurementSystem): Promise<void> {
    const updates: Partial<UserMeasurementPreferences> = {
      preferred_system: system,
    }

    if (system === 'metric') {
      updates.default_volume_unit = 'milliliter'
      updates.default_weight_unit = 'gram'
    } else {
      updates.default_volume_unit = 'cup'
      updates.default_weight_unit = 'pound'
    }

    await this.updatePreferences(userId, updates)
  }

  async toggleAutoConvert(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId)
    const newValue = !prefs.auto_convert

    await this.updatePreferences(userId, { auto_convert: newValue })
    return newValue
  }

  async addOverride(
    userId: string,
    override: Omit<MeasurementOverride, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ): Promise<MeasurementOverride> {
    const { data, error } = await supabase
      .from('measurement_overrides')
      .insert({
        user_id: userId,
        ...override,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getOverride(
    userId: string,
    recipeIngredientId?: string,
    shoppingListId?: string
  ): Promise<MeasurementOverride | null> {
    let query = supabase
      .from('measurement_overrides')
      .select('*')
      .eq('user_id', userId)

    if (recipeIngredientId) {
      query = query.eq('recipe_ingredient_id', recipeIngredientId)
    }

    if (shoppingListId) {
      query = query.eq('shopping_list_id', shoppingListId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error
    return data
  }

  async removeOverride(overrideId: string): Promise<void> {
    const { error } = await supabase
      .from('measurement_overrides')
      .delete()
      .eq('id', overrideId)

    if (error) throw error
  }

  async convertBasedOnPreferences(
    userId: string,
    quantity: number,
    unit: string
  ): Promise<{ quantity: number; unit: string }> {
    const prefs = await this.getPreferences(userId)

    if (!prefs.auto_convert) {
      return { quantity, unit }
    }

    const result = MeasurementConverter.convertToSystem(
      quantity,
      unit,
      prefs.preferred_system
    )

    if (result.conversionApplied) {
      return { quantity: result.quantity, unit: result.unit }
    }

    return { quantity, unit }
  }

  clearCache(userId?: string): void {
    if (userId) {
      this.preferencesCache.delete(userId)
    } else {
      this.preferencesCache.clear()
    }
  }

  async getDisplayUnit(
    userId: string,
    measurementType: 'volume' | 'weight' | 'count'
  ): Promise<string> {
    const prefs = await this.getPreferences(userId)

    if (measurementType === 'volume') {
      return prefs.default_volume_unit || 'cup'
    }

    if (measurementType === 'weight') {
      return prefs.default_weight_unit || 'pound'
    }

    return 'each'
  }

  async shouldAutoConvert(userId: string): Promise<boolean> {
    const prefs = await this.getPreferences(userId)
    return prefs.auto_convert ?? true
  }

  async getCommonUnits(userId: string): Promise<{
    volume: string[]
    weight: string[]
    count: string[]
  }> {
    const prefs = await this.getPreferences(userId)
    return MeasurementConverter.getCommonUnits(prefs.preferred_system)
  }
}

export const measurementPreferencesService = new MeasurementPreferencesService()
