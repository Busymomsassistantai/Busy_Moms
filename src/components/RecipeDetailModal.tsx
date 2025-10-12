import React, { useState, useEffect } from 'react'
import { X, Clock, Users, ShoppingCart, Loader2, Heart, Plus, Minus } from 'lucide-react'
import { Recipe, RecipeIngredient, ShoppingItem } from '../lib/supabase'
import { recipeService } from '../services/recipeService'
import { instacartService } from '../services/instacartService'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { InstacartButton } from './InstacartButton'

interface RecipeDetailModalProps {
  recipe: Recipe
  onClose: () => void
  onIngredientsAdded?: () => void
}

export function RecipeDetailModal({ recipe, onClose, onIngredientsAdded }: RecipeDetailModalProps) {
  const { user } = useAuth()
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [addingToList, setAddingToList] = useState(false)
  const [generatingUrl, setGeneratingUrl] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [servings, setServings] = useState(recipe.servings || 4)
  const originalServings = recipe.servings || 4

  useEffect(() => {
    loadIngredients()
    checkIfSaved()
  }, [recipe.id])

  const loadIngredients = async () => {
    try {
      setLoading(true)
      const data = await recipeService.getIngredients(recipe.id)
      setIngredients(data)
      setSelectedIngredients(new Set(data.map(i => i.id)))
    } catch (error) {
      console.error('Error loading ingredients:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkIfSaved = async () => {
    if (!user) return
    try {
      const saved = await recipeService.isRecipeSaved(user.id, recipe.id)
      setIsSaved(saved)
    } catch (error) {
      console.error('Error checking if recipe is saved:', error)
    }
  }

  const toggleIngredient = (ingredientId: string) => {
    setSelectedIngredients(prev => {
      const next = new Set(prev)
      if (next.has(ingredientId)) {
        next.delete(ingredientId)
      } else {
        next.add(ingredientId)
      }
      return next
    })
  }

  const toggleSaveRecipe = async () => {
    if (!user) return
    try {
      if (isSaved) {
        await recipeService.unsaveRecipe(user.id, recipe.id)
        setIsSaved(false)
      } else {
        await recipeService.saveRecipe(user.id, recipe.id)
        setIsSaved(true)
      }
    } catch (error) {
      console.error('Error toggling recipe save:', error)
    }
  }

  const adjustServings = (delta: number) => {
    const newServings = Math.max(1, servings + delta)
    setServings(newServings)
  }

  const getAdjustedQuantity = (originalQuantity: number | null) => {
    if (!originalQuantity) return null
    const multiplier = servings / originalServings
    return (originalQuantity * multiplier).toFixed(2).replace(/\.?0+$/, '')
  }

  const addSelectedToShoppingList = async () => {
    if (!user) return

    try {
      setAddingToList(true)
      const selectedItems = ingredients.filter(ing => selectedIngredients.has(ing.id))

      const shoppingItems: Omit<ShoppingItem, 'id' | 'created_at' | 'updated_at'>[] = selectedItems.map(ing => ({
        user_id: user.id,
        item: ing.display_text,
        quantity: ing.quantity ? parseFloat(getAdjustedQuantity(ing.quantity) || '1') : 1,
        category: mapIngredientCategory(ing.category),
        notes: ing.unit ? `${getAdjustedQuantity(ing.quantity)} ${ing.unit}` : undefined,
        completed: false,
        recipe_id: recipe.id,
      }))

      const { error } = await supabase
        .from('shopping_lists')
        .insert(shoppingItems)

      if (error) throw error

      alert(`Added ${selectedItems.length} ingredient(s) to shopping list`)
      onIngredientsAdded?.()
    } catch (error) {
      console.error('Error adding to shopping list:', error)
      alert('Failed to add ingredients to shopping list')
    } finally {
      setAddingToList(false)
    }
  }

  const mapIngredientCategory = (category: string | null): string => {
    if (!category) return 'other'
    const mapping: Record<string, string> = {
      'dairy': 'dairy',
      'produce': 'produce',
      'meat': 'meat',
      'bakery': 'bakery',
      'beverages': 'beverages',
      'frozen': 'frozen',
      'household': 'household',
      'snacks': 'snacks',
      'health': 'health',
      'pantry': 'pantry',
    }
    return mapping[category.toLowerCase()] || 'other'
  }

  const openInstacartRecipe = async () => {
    try {
      setGeneratingUrl(true)

      let instacartUrl = instacartService.getCachedUrl(
        recipe.instacart_recipe_url,
        recipe.url_expires_at
      )

      if (!instacartUrl) {
        const response = await instacartService.createRecipePage({
          title: recipe.title,
          author: recipe.author,
          image_url: recipe.image_url,
          servings: servings,
          cooking_time: recipe.cooking_time_minutes,
          instructions: recipe.instructions || undefined,
          ingredients: ingredients.map(ing => ({
            name: ing.name,
            display_text: ing.display_text,
            quantity: ing.quantity ? parseFloat(getAdjustedQuantity(ing.quantity) || '0') : undefined,
            unit: ing.unit || undefined,
            brand_filters: ing.brand_filters || undefined,
            health_filters: ing.health_filters || undefined,
          })),
          partner_linkback_url: instacartService.buildPartnerLinkbackUrl(),
          enable_pantry_items: true,
          expires_in: 30,
        })

        instacartUrl = response.products_link_url

        await recipeService.updateRecipe(recipe.id, {
          instacart_recipe_url: instacartUrl,
          url_expires_at: instacartService.calculateExpiresAt(30),
        })
      }

      window.open(instacartUrl, '_blank')
    } catch (error) {
      console.error('Error opening Instacart recipe:', error)
      alert('Failed to open Instacart recipe page')
    } finally {
      setGeneratingUrl(false)
    }
  }

  const pantryItems = ingredients.filter(ing => ing.is_pantry_item)
  const mainIngredients = ingredients.filter(ing => !ing.is_pantry_item)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{recipe.title}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {recipe.image_url && (
            <div className="relative h-64 rounded-xl overflow-hidden">
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6 text-gray-600">
              {recipe.cooking_time_minutes && (
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>{recipe.cooking_time_minutes} min</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <button
                  onClick={() => adjustServings(-1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span>{servings} servings</span>
                <button
                  onClick={() => adjustServings(1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              onClick={toggleSaveRecipe}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Heart
                className={`w-5 h-5 ${
                  isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'
                }`}
              />
              <span>{isSaved ? 'Saved' : 'Save Recipe'}</span>
            </button>
          </div>

          {recipe.author && (
            <p className="text-gray-600">By {recipe.author}</p>
          )}

          {recipe.description && (
            <p className="text-gray-700">{recipe.description}</p>
          )}

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Ingredients</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {mainIngredients.length > 0 && (
                  <div className="space-y-2">
                    {mainIngredients.map(ingredient => (
                      <div
                        key={ingredient.id}
                        className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIngredients.has(ingredient.id)}
                          onChange={() => toggleIngredient(ingredient.id)}
                          className="mt-1 w-5 h-5 text-green-500 rounded focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <p className="text-gray-900">
                            {ingredient.quantity && ingredient.unit
                              ? `${getAdjustedQuantity(ingredient.quantity)} ${ingredient.unit} `
                              : ''}
                            {ingredient.display_text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {pantryItems.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">You may already have:</h4>
                    <div className="space-y-2">
                      {pantryItems.map(ingredient => (
                        <div
                          key={ingredient.id}
                          className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIngredients.has(ingredient.id)}
                            onChange={() => toggleIngredient(ingredient.id)}
                            className="mt-1 w-5 h-5 text-green-500 rounded focus:ring-green-500"
                          />
                          <div className="flex-1">
                            <p className="text-gray-600">
                              {ingredient.quantity && ingredient.unit
                                ? `${getAdjustedQuantity(ingredient.quantity)} ${ingredient.unit} `
                                : ''}
                              {ingredient.display_text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {recipe.instructions && recipe.instructions.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h3>
              <ol className="space-y-3">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex space-x-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 flex-1">{instruction}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={addSelectedToShoppingList}
              disabled={addingToList || selectedIngredients.size === 0}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingToList ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShoppingCart className="w-5 h-5" />
              )}
              <span>
                Add {selectedIngredients.size} to Shopping List
              </span>
            </button>

            <InstacartButton
              variant="dark"
              text="Get Recipe Ingredients"
              onClick={openInstacartRecipe}
              disabled={generatingUrl}
              loading={generatingUrl}
              className="flex-1"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
