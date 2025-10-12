interface MealDBIngredient {
  ingredient: string
  measure: string
}

interface MealDBMeal {
  idMeal: string
  strMeal: string
  strCategory: string
  strArea: string
  strInstructions: string
  strMealThumb: string
  strTags: string | null
  strYoutube: string | null
  [key: string]: string | null
}

interface MealDBSearchResponse {
  meals: MealDBMeal[] | null
}

interface SimplifiedRecipe {
  id: string
  title: string
  description: string
  category: string
  cuisine: string
  prepTime: number
  cookTime: number
  servings: number
  imageUrl: string
  ingredients: Array<{
    name: string
    quantity: number
    unit: string
    category: string
  }>
  instructions: string[]
  tags: string[]
  youtubeUrl?: string
}

const API_BASE = 'https://www.themealdb.com/api/json/v1/1'

class TheMealDBService {
  private parseIngredients(meal: MealDBMeal): Array<{ ingredient: string; measure: string }> {
    const ingredients: Array<{ ingredient: string; measure: string }> = []

    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`]
      const measure = meal[`strMeasure${i}`]

      if (ingredient && ingredient.trim() !== '') {
        ingredients.push({
          ingredient: ingredient.trim(),
          measure: measure?.trim() || ''
        })
      }
    }

    return ingredients
  }

  private convertToSimplifiedRecipe(meal: MealDBMeal): SimplifiedRecipe {
    const rawIngredients = this.parseIngredients(meal)

    const ingredients = rawIngredients.map(({ ingredient, measure }) => {
      const parsedMeasure = this.parseMeasurement(measure)

      return {
        name: ingredient,
        quantity: parsedMeasure.quantity,
        unit: parsedMeasure.unit,
        category: this.categorizeIngredient(ingredient)
      }
    })

    const instructions = meal.strInstructions
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && line !== '.')

    const tags = meal.strTags ? meal.strTags.split(',').map(t => t.trim()) : []

    return {
      id: meal.idMeal,
      title: meal.strMeal,
      description: `Delicious ${meal.strArea} ${meal.strCategory.toLowerCase()} recipe`,
      category: meal.strCategory,
      cuisine: meal.strArea,
      prepTime: 15,
      cookTime: 30,
      servings: 4,
      imageUrl: meal.strMealThumb,
      ingredients,
      instructions,
      tags,
      youtubeUrl: meal.strYoutube || undefined
    }
  }

  private parseMeasurement(measure: string): { quantity: number; unit: string } {
    if (!measure || measure.trim() === '') {
      return { quantity: 1, unit: 'unit' }
    }

    const cleanMeasure = measure.trim().toLowerCase()

    const fractionMap: { [key: string]: number } = {
      '¼': 0.25, '½': 0.5, '¾': 0.75,
      '⅓': 0.33, '⅔': 0.67,
      '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
      '1/4': 0.25, '1/2': 0.5, '3/4': 0.75,
      '1/3': 0.33, '2/3': 0.67,
      '1/8': 0.125, '3/8': 0.375, '5/8': 0.625, '7/8': 0.875
    }

    const numberMatch = cleanMeasure.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
    if (numberMatch) {
      return {
        quantity: parseFloat(numberMatch[1]),
        unit: numberMatch[2] || 'unit'
      }
    }

    for (const [fraction, value] of Object.entries(fractionMap)) {
      if (cleanMeasure.startsWith(fraction)) {
        const rest = cleanMeasure.substring(fraction.length).trim()
        return { quantity: value, unit: rest || 'unit' }
      }
    }

    const wholeAndFraction = cleanMeasure.match(/^(\d+)\s*(¼|½|¾|⅓|⅔|⅛|⅜|⅝|⅞)\s*(.*)$/)
    if (wholeAndFraction) {
      const whole = parseInt(wholeAndFraction[1])
      const fraction = fractionMap[wholeAndFraction[2]] || 0
      return {
        quantity: whole + fraction,
        unit: wholeAndFraction[3] || 'unit'
      }
    }

    if (cleanMeasure.includes('to taste')) {
      return { quantity: 1, unit: 'to taste' }
    }

    return { quantity: 1, unit: cleanMeasure }
  }

  private categorizeIngredient(ingredient: string): string {
    const lower = ingredient.toLowerCase()

    const categories: { [key: string]: string[] } = {
      produce: ['onion', 'garlic', 'tomato', 'pepper', 'lettuce', 'carrot', 'celery', 'potato', 'lemon', 'lime', 'ginger', 'cilantro', 'parsley', 'basil', 'spinach', 'mushroom'],
      meat: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham'],
      seafood: ['fish', 'salmon', 'tuna', 'shrimp', 'prawn', 'cod', 'crab', 'lobster'],
      dairy: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg'],
      pantry: ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'rice', 'pasta', 'sauce', 'stock', 'broth', 'spice', 'herb', 'paprika', 'cumin', 'coriander', 'oregano', 'thyme', 'bay']
    }

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lower.includes(keyword))) {
        return category
      }
    }

    return 'other'
  }

  async searchByName(query: string): Promise<SimplifiedRecipe[]> {
    try {
      const response = await fetch(`${API_BASE}/search.php?s=${encodeURIComponent(query)}`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals) {
        return []
      }

      return data.meals.map(meal => this.convertToSimplifiedRecipe(meal))
    } catch (error) {
      console.error('TheMealDB search error:', error)
      throw new Error('Failed to search recipes')
    }
  }

  async searchByFirstLetter(letter: string): Promise<SimplifiedRecipe[]> {
    try {
      const response = await fetch(`${API_BASE}/search.php?f=${letter}`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals) {
        return []
      }

      return data.meals.map(meal => this.convertToSimplifiedRecipe(meal))
    } catch (error) {
      console.error('TheMealDB search error:', error)
      throw new Error('Failed to search recipes')
    }
  }

  async getRandomRecipe(): Promise<SimplifiedRecipe> {
    try {
      const response = await fetch(`${API_BASE}/random.php`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals || data.meals.length === 0) {
        throw new Error('No random recipe found')
      }

      return this.convertToSimplifiedRecipe(data.meals[0])
    } catch (error) {
      console.error('TheMealDB random recipe error:', error)
      throw new Error('Failed to get random recipe')
    }
  }

  async getRecipeById(id: string): Promise<SimplifiedRecipe> {
    try {
      const response = await fetch(`${API_BASE}/lookup.php?i=${id}`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals || data.meals.length === 0) {
        throw new Error('Recipe not found')
      }

      return this.convertToSimplifiedRecipe(data.meals[0])
    } catch (error) {
      console.error('TheMealDB lookup error:', error)
      throw new Error('Failed to get recipe details')
    }
  }

  async filterByCategory(category: string): Promise<SimplifiedRecipe[]> {
    try {
      const response = await fetch(`${API_BASE}/filter.php?c=${encodeURIComponent(category)}`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals) {
        return []
      }

      const detailedRecipes = await Promise.all(
        data.meals.slice(0, 12).map(meal => this.getRecipeById(meal.idMeal))
      )

      return detailedRecipes
    } catch (error) {
      console.error('TheMealDB filter error:', error)
      throw new Error('Failed to filter recipes')
    }
  }

  async filterByArea(area: string): Promise<SimplifiedRecipe[]> {
    try {
      const response = await fetch(`${API_BASE}/filter.php?a=${encodeURIComponent(area)}`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals) {
        return []
      }

      const detailedRecipes = await Promise.all(
        data.meals.slice(0, 12).map(meal => this.getRecipeById(meal.idMeal))
      )

      return detailedRecipes
    } catch (error) {
      console.error('TheMealDB filter error:', error)
      throw new Error('Failed to filter recipes')
    }
  }

  async filterByIngredient(ingredient: string): Promise<SimplifiedRecipe[]> {
    try {
      const response = await fetch(`${API_BASE}/filter.php?i=${encodeURIComponent(ingredient)}`)
      const data: MealDBSearchResponse = await response.json()

      if (!data.meals) {
        return []
      }

      const detailedRecipes = await Promise.all(
        data.meals.slice(0, 12).map(meal => this.getRecipeById(meal.idMeal))
      )

      return detailedRecipes
    } catch (error) {
      console.error('TheMealDB filter error:', error)
      throw new Error('Failed to filter recipes')
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE}/list.php?c=list`)
      const data = await response.json()

      if (!data.meals) {
        return []
      }

      return data.meals.map((item: any) => item.strCategory)
    } catch (error) {
      console.error('TheMealDB categories error:', error)
      return []
    }
  }

  async getAreas(): Promise<string[]> {
    try {
      const response = await fetch(`${API_BASE}/list.php?a=list`)
      const data = await response.json()

      if (!data.meals) {
        return []
      }

      return data.meals.map((item: any) => item.strArea)
    } catch (error) {
      console.error('TheMealDB areas error:', error)
      return []
    }
  }
}

export const themealdbService = new TheMealDBService()
export type { SimplifiedRecipe }
