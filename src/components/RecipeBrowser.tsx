import React, { useState, useEffect } from 'react'
import { Search, Clock, Users, ChefHat, Heart, Loader2, Plus, Globe, BookOpen } from 'lucide-react'
import { Recipe } from '../lib/supabase'
import { recipeService } from '../services/recipeService'
import { useAuth } from '../hooks/useAuth'
import { createAllSampleRecipes } from '../utils/sampleRecipes'
import { themealdbService, SimplifiedRecipe } from '../services/themealdb'

interface RecipeBrowserProps {
  onRecipeSelect: (recipe: Recipe) => void
}

export function RecipeBrowser({ onRecipeSelect }: RecipeBrowserProps) {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [savedRecipeIds, setSavedRecipeIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeView, setActiveView] = useState<'my-recipes' | 'saved' | 'discover'>('my-recipes')
  const [maxCookingTime, setMaxCookingTime] = useState<number | undefined>()
  const [minServings, setMinServings] = useState<number | undefined>()
  const [addingSamples, setAddingSamples] = useState(false)
  const [discoverRecipes, setDiscoverRecipes] = useState<SimplifiedRecipe[]>([])
  const [importing, setImporting] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  useEffect(() => {
    if (user) {
      loadRecipes()
      loadSavedRecipes()
    }
  }, [user, activeView])

  useEffect(() => {
    if (activeView === 'discover') {
      loadCategories()
      if (!searchQuery && !selectedCategory) {
        loadRandomRecipes()
      }
    }
  }, [activeView])

  const loadRecipes = async () => {
    if (!user) return

    try {
      setLoading(true)
      if (activeView === 'saved') {
        const data = await recipeService.getSavedRecipes(user.id)
        setRecipes(data)
      } else if (activeView === 'my-recipes') {
        const data = await recipeService.getRecipes(user.id, {
          search: searchQuery || undefined,
          maxCookingTime,
          minServings,
        })
        setRecipes(data)
      } else if (activeView === 'discover') {
        await loadDiscoverRecipes()
      }
    } catch (error) {
      console.error('Error loading recipes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      const cats = await themealdbService.getCategories()
      setCategories(cats)
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadRandomRecipes = async () => {
    try {
      const recipes = await Promise.all([
        themealdbService.getRandomRecipe(),
        themealdbService.getRandomRecipe(),
        themealdbService.getRandomRecipe(),
        themealdbService.getRandomRecipe(),
        themealdbService.getRandomRecipe(),
        themealdbService.getRandomRecipe(),
      ])
      setDiscoverRecipes(recipes)
    } catch (error) {
      console.error('Error loading random recipes:', error)
    }
  }

  const loadDiscoverRecipes = async () => {
    try {
      if (searchQuery) {
        const results = await themealdbService.searchByName(searchQuery)
        setDiscoverRecipes(results)
      } else if (selectedCategory) {
        const results = await themealdbService.filterByCategory(selectedCategory)
        setDiscoverRecipes(results)
      } else {
        await loadRandomRecipes()
      }
    } catch (error) {
      console.error('Error loading discover recipes:', error)
      setDiscoverRecipes([])
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

  const handleAddSampleRecipes = async () => {
    if (!user) return

    try {
      setAddingSamples(true)
      await createAllSampleRecipes(user.id)
      await loadRecipes()
      alert('Sample recipes added successfully!')
    } catch (error) {
      console.error('Error adding sample recipes:', error)
      alert('Failed to add sample recipes')
    } finally {
      setAddingSamples(false)
    }
  }

  const handleImportRecipe = async (themealdbRecipe: SimplifiedRecipe) => {
    if (!user) return

    try {
      setImporting(themealdbRecipe.id)
      await recipeService.importFromTheMealDB(user.id, themealdbRecipe)
      alert(`"${themealdbRecipe.title}" imported successfully!`)
      setActiveView('my-recipes')
    } catch (error) {
      console.error('Error importing recipe:', error)
      alert('Failed to import recipe')
    } finally {
      setImporting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveView('my-recipes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'my-recipes'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <BookOpen className="w-4 h-4 inline mr-2" />
            My Recipes
          </button>
          <button
            onClick={() => setActiveView('discover')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'discover'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-2" />
            Discover
          </button>
          <button
            onClick={() => setActiveView('saved')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeView === 'saved'
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Heart className="w-4 h-4 inline mr-2" />
            Saved
          </button>
        </div>
      </div>

      {activeView === 'discover' && (
        <div className="space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search 1000+ recipes from TheMealDB..."
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
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setSearchQuery('')
                setTimeout(loadRecipes, 0)
              }}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {(searchQuery || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('')
                  setTimeout(loadRecipes, 0)
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {activeView === 'my-recipes' && (
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

      {loading && activeView !== 'discover' ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
          <span className="ml-3 text-gray-600">Loading recipes...</span>
        </div>
      ) : activeView === 'discover' ? (
        loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
            <span className="ml-3 text-gray-600">Discovering recipes...</span>
          </div>
        ) : discoverRecipes.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recipes found</h3>
            <p className="text-gray-600">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {discoverRecipes.map((recipe) => (
              <div
                key={recipe.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="relative h-48">
                  <img
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                    {recipe.cuisine}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-1">{recipe.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{recipe.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {recipe.prepTime + recipe.cookTime} min
                      </span>
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {recipe.servings}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleImportRecipe(recipe)}
                    disabled={importing === recipe.id}
                    className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    {importing === recipe.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Import Recipe</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : recipes.length === 0 ? (
        <div className="text-center py-12">
          <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeView === 'saved' ? 'No saved recipes yet' : 'No recipes found'}
          </h3>
          <p className="text-gray-600 mb-6">
            {activeView === 'saved'
              ? 'Start browsing to save your favorite recipes'
              : 'Try adjusting your search or filters, or add sample recipes to get started'}
          </p>
          {activeView === 'my-recipes' && (
            <button
              onClick={handleAddSampleRecipes}
              disabled={addingSamples}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingSamples ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Adding Recipes...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Add Sample Recipes</span>
                </>
              )}
            </button>
          )}
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
