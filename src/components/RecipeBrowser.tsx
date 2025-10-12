import React, { useState, useEffect } from 'react'
import { Search, Clock, Users, ChefHat, Heart, Loader2 } from 'lucide-react'
import { Recipe } from '../lib/supabase'
import { recipeService } from '../services/recipeService'
import { useAuth } from '../hooks/useAuth'

interface RecipeBrowserProps {
  onRecipeSelect: (recipe: Recipe) => void
}

export function RecipeBrowser({ onRecipeSelect }: RecipeBrowserProps) {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'browse' | 'saved'>('browse')
  const [maxCookingTime, setMaxCookingTime] = useState<number | undefined>()
  const [minServings, setMinServings] = useState<number | undefined>()

  useEffect(() => {
    if (user) {
      loadRecipes()
      loadSavedRecipes()
    }
  }, [user, activeView])

  const loadRecipes = async () => {
    if (!user) return

    try {
      setLoading(true)
      if (activeView === 'saved') {
        const data = await recipeService.getSavedRecipes(user.id)
        setRecipes(data)
      } else {
        const data = await recipeService.getRecipes(user.id, {
          search: searchQuery || undefined,
          maxCookingTime,
          minServings,
        })
        setRecipes(data)
      }
    } catch (error) {
      console.error('Error loading recipes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSavedRecipes = async () => {
    if (!user) return

    try {
      const saved = await recipeService.getSavedRecipes(user.id)
      const ids = new Set(saved.map(r => r.id))
      setSavedRecipeIds(ids)
    } catch (error) {
      console.error('Error loading saved recipes:', error)
    }
  }

  const handleSearch = () => {
    loadRecipes()
  }

  const handleSaveToggle = async (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return

    try {
      if (savedRecipeIds.has(recipeId)) {
        await recipeService.unsaveRecipe(user.id, recipeId)
        setSavedRecipeIds(prev => {
          const next = new Set(prev)
          next.delete(recipeId)
          return next
        })
      } else {
        await recipeService.saveRecipe(user.id, recipeId)
        setSavedRecipeIds(prev => new Set(prev).add(recipeId))
      }
    } catch (error) {
      console.error('Error toggling recipe save:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveView('browse')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'browse'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Browse Recipes
          </button>
          <button
            onClick={() => setActiveView('saved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'saved'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            My Recipes
          </button>
        </div>
      </div>

      {activeView === 'browse' && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={maxCookingTime || ''}
              onChange={(e) => {
                setMaxCookingTime(e.target.value ? parseInt(e.target.value) : undefined)
                setTimeout(loadRecipes, 0)
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
            >
              <option value="">Any time</option>
              <option value="15">Under 15 min</option>
              <option value="30">Under 30 min</option>
              <option value="60">Under 1 hour</option>
            </select>

            <select
              value={minServings || ''}
              onChange={(e) => {
                setMinServings(e.target.value ? parseInt(e.target.value) : undefined)
                setTimeout(loadRecipes, 0)
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
            >
              <option value="">Any servings</option>
              <option value="1">1+ servings</option>
              <option value="2">2+ servings</option>
              <option value="4">4+ servings</option>
              <option value="6">6+ servings</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          <span className="ml-3 text-gray-600">Loading recipes...</span>
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12">
          <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeView === 'saved' ? 'No saved recipes yet' : 'No recipes found'}
          </h3>
          <p className="text-gray-600">
            {activeView === 'saved'
              ? 'Start browsing to save your favorite recipes'
              : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              onClick={() => onRecipeSelect(recipe)}
              className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden hover:border-green-300 transition-all cursor-pointer"
            >
              {recipe.image_url && (
                <div className="relative h-48 bg-gray-200">
                  <img
                    src={recipe.image_url}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={(e) => handleSaveToggle(recipe.id, e)}
                    className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-colors"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        savedRecipeIds.has(recipe.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                </div>
              )}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 mb-2">{recipe.title}</h3>
                {recipe.author && (
                  <p className="text-sm text-gray-600 mb-2">By {recipe.author}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {recipe.cooking_time_minutes && (
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{recipe.cooking_time_minutes} min</span>
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{recipe.servings} servings</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
