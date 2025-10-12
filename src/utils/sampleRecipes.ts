import { Recipe, RecipeIngredient } from '../lib/supabase'
import { recipeService } from '../services/recipeService'

export interface SampleRecipe {
  recipe: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>
  ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id' | 'created_at'>[]
}

export const sampleRecipes: SampleRecipe[] = [
  {
    recipe: {
      user_id: '',
      title: 'Classic Spaghetti Carbonara',
      author: 'Italian Kitchen',
      description: 'A traditional Italian pasta dish made with eggs, cheese, pancetta, and black pepper. Simple yet incredibly delicious.',
      image_url: 'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg',
      servings: 4,
      cooking_time_minutes: 25,
      instructions: [
        'Bring a large pot of salted water to boil and cook spaghetti according to package directions.',
        'While pasta cooks, cut pancetta into small pieces and cook in a large skillet over medium heat until crispy.',
        'In a bowl, whisk together eggs, grated Parmesan cheese, and black pepper.',
        'Drain pasta, reserving 1 cup of pasta water. Add hot pasta to the skillet with pancetta.',
        'Remove from heat and quickly stir in the egg mixture, adding pasta water a little at a time until creamy.',
        'Serve immediately with extra Parmesan and black pepper.'
      ],
      source_url: null,
      instacart_recipe_url: null,
      url_expires_at: null,
      instacart_metadata: null,
    },
    ingredients: [
      {
        name: 'spaghetti pasta',
        display_text: 'Spaghetti',
        quantity: 1,
        unit: 'pound',
        category: 'pantry',
        display_order: 0,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'pancetta',
        display_text: 'Pancetta',
        quantity: 8,
        unit: 'ounces',
        category: 'meat',
        display_order: 1,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'large eggs',
        display_text: 'Large Eggs',
        quantity: 4,
        unit: 'whole',
        category: 'dairy',
        display_order: 2,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'parmesan cheese grated',
        display_text: 'Grated Parmesan Cheese',
        quantity: 1,
        unit: 'cup',
        category: 'dairy',
        display_order: 3,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'black pepper',
        display_text: 'Black Pepper',
        quantity: 1,
        unit: 'teaspoon',
        category: 'pantry',
        display_order: 4,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: true,
      },
      {
        name: 'salt',
        display_text: 'Salt',
        quantity: 1,
        unit: 'teaspoon',
        category: 'pantry',
        display_order: 5,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: true,
      },
    ],
  },
  {
    recipe: {
      user_id: '',
      title: 'Easy Chicken Stir-Fry',
      author: 'Quick Meals',
      description: 'A healthy and colorful stir-fry packed with vegetables and tender chicken. Perfect for busy weeknights.',
      image_url: 'https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg',
      servings: 4,
      cooking_time_minutes: 20,
      instructions: [
        'Cut chicken breast into bite-sized pieces and season with salt and pepper.',
        'Heat vegetable oil in a large wok or skillet over high heat.',
        'Add chicken and cook until golden brown, about 5 minutes. Remove and set aside.',
        'Add more oil if needed and stir-fry vegetables until tender-crisp, about 3-4 minutes.',
        'Return chicken to the pan and add soy sauce, garlic, and ginger. Toss to combine.',
        'Serve hot over rice or noodles.'
      ],
      source_url: null,
      instacart_recipe_url: null,
      url_expires_at: null,
      instacart_metadata: null,
    },
    ingredients: [
      {
        name: 'chicken breast',
        display_text: 'Boneless Chicken Breast',
        quantity: 1.5,
        unit: 'pounds',
        category: 'meat',
        display_order: 0,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'bell peppers mixed colors',
        display_text: 'Mixed Bell Peppers',
        quantity: 2,
        unit: 'whole',
        category: 'produce',
        display_order: 1,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'broccoli florets',
        display_text: 'Broccoli Florets',
        quantity: 2,
        unit: 'cups',
        category: 'produce',
        display_order: 2,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'carrots sliced',
        display_text: 'Sliced Carrots',
        quantity: 1,
        unit: 'cup',
        category: 'produce',
        display_order: 3,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: false,
      },
      {
        name: 'soy sauce',
        display_text: 'Soy Sauce',
        quantity: 3,
        unit: 'tablespoons',
        category: 'pantry',
        display_order: 4,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: true,
      },
      {
        name: 'garlic minced',
        display_text: 'Minced Garlic',
        quantity: 2,
        unit: 'teaspoons',
        category: 'produce',
        display_order: 5,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: true,
      },
      {
        name: 'fresh ginger',
        display_text: 'Fresh Ginger',
        quantity: 1,
        unit: 'teaspoon',
        category: 'produce',
        display_order: 6,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: true,
      },
      {
        name: 'vegetable oil',
        display_text: 'Vegetable Oil',
        quantity: 2,
        unit: 'tablespoons',
        category: 'pantry',
        display_order: 7,
        brand_filters: null,
        health_filters: null,
        is_pantry_item: true,
      },
    ],
  },
]

export async function createSampleRecipe(userId: string, recipeIndex: number = 0): Promise<void> {
  if (recipeIndex < 0 || recipeIndex >= sampleRecipes.length) {
    throw new Error(`Recipe index ${recipeIndex} is out of range`)
  }

  const sample = sampleRecipes[recipeIndex]

  const recipe = await recipeService.createRecipe({
    ...sample.recipe,
    user_id: userId,
  })

  const ingredients = sample.ingredients.map((ing, index) => ({
    ...ing,
    recipe_id: recipe.id,
    display_order: index,
  }))

  await recipeService.addIngredients(ingredients)

  console.log(`Created sample recipe: ${recipe.title}`)
}

export async function createAllSampleRecipes(userId: string): Promise<void> {
  for (let i = 0; i < sampleRecipes.length; i++) {
    await createSampleRecipe(userId, i)
  }
  console.log(`Created ${sampleRecipes.length} sample recipes`)
}
