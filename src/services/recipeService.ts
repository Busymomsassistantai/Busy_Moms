import { supabase } from '../lib/supabase'
import type { Recipe, RecipeIngredient, UserSavedRecipe, RecipeFilter } from '../lib/supabase'

export class RecipeService {
  async createRecipe(recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>): Promise<Recipe> {
    const { data, error } = await supabase
      .from('recipes')
      .insert(recipe)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async getRecipe(recipeId: string): Promise<Recipe | null> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  async getRecipes(userId: string, filter?: RecipeFilter): Promise<Recipe[]> {
    let query = supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (filter?.search) {
      query = query.or(`title.ilike.%${filter.search}%,author.ilike.%${filter.search}%`)
    }

    if (filter?.author) {
      query = query.ilike('author', `%${filter.author}%`)
    }

    if (filter?.maxCookingTime) {
      query = query.lte('cooking_time_minutes', filter.maxCookingTime)
    }

    if (filter?.minServings) {
      query = query.gte('servings', filter.minServings)
    }

    if (filter?.maxServings) {
      query = query.lte('servings', filter.maxServings)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  async updateRecipe(recipeId: string, updates: Partial<Recipe>): Promise<Recipe> {
    const { data, error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', recipeId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteRecipe(recipeId: string): Promise<void> {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)

    if (error) throw error
  }

  async addIngredients(ingredients: Omit<RecipeIngredient, 'id' | 'created_at'>[]): Promise<RecipeIngredient[]> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .insert(ingredients)
      .select()

    if (error) throw error
    return data
  }

  async getIngredients(recipeId: string): Promise<RecipeIngredient[]> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('display_order', { ascending: true })

    if (error) throw error
    return data || []
  }

  async updateIngredient(ingredientId: string, updates: Partial<RecipeIngredient>): Promise<RecipeIngredient> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .update(updates)
      .eq('id', ingredientId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteIngredient(ingredientId: string): Promise<void> {
    const { error } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('id', ingredientId)

    if (error) throw error
  }

  async saveRecipe(userId: string, recipeId: string): Promise<UserSavedRecipe> {
    const { data, error } = await supabase
      .from('user_saved_recipes')
      .insert({ user_id: userId, recipe_id: recipeId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async unsaveRecipe(userId: string, recipeId: string): Promise<void> {
    const { error } = await supabase
      .from('user_saved_recipes')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)

    if (error) throw error
  }

  async isRecipeSaved(userId: string, recipeId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_saved_recipes')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .maybeSingle()

    if (error) throw error
    return !!data
  }

  async getSavedRecipes(userId: string): Promise<Recipe[]> {
    const { data, error } = await supabase
      .from('user_saved_recipes')
      .select(`
        recipe_id,
        recipes (*)
      `)
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })

    if (error) throw error

    return data?.map((item: any) => item.recipes).filter(Boolean) || []
  }

  async needsInstacartUrlRefresh(recipe: Recipe): Promise<boolean> {
    if (!recipe.instacart_recipe_url || !recipe.url_expires_at) {
      return true
    }

    const expiresAt = new Date(recipe.url_expires_at)
    const now = new Date()
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    return expiresAt <= oneDayFromNow
  }
}

export const recipeService = new RecipeService()
