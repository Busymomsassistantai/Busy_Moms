# Recipe Feature Implementation Guide

## Overview

Your app now includes a complete recipe browsing and shopping list integration powered by Instacart's Developer Platform API. Users can browse recipes, save favorites, view ingredients with adjustable servings, selectively add ingredients to their shopping list, and purchase items directly through Instacart.

## Features Implemented

### 1. Recipe Database
- **Tables Created:**
  - `recipes` - Stores recipe information (title, author, description, image, servings, cooking time, instructions)
  - `recipe_ingredients` - Stores ingredients with Instacart-compliant fields (generic names, quantities, units, filters)
  - `user_saved_recipes` - Junction table tracking which recipes users have saved
  - `shopping_lists.recipe_id` - New column linking shopping items back to source recipes

### 2. Instacart API Integration
- **Edge Function:** `instacart-recipes` deployed to Supabase
- **API Configuration:**
  - Development server: `https://connect.dev.instacart.tools`
  - Production server: `https://connect.instacart.com` (when ready)
  - API Key stored securely in environment variables
  - Follows all Instacart Developer Platform guidelines

### 3. User Interface
- **New "Recipes" tab** in Shopping section with ChefHat icon
- **RecipeBrowser Component:**
  - Browse/Saved recipes view toggle
  - Search functionality by recipe title and author
  - Filters: cooking time and servings
  - Recipe cards with images, save/unsave functionality
  - Empty states for no results

- **RecipeDetailModal Component:**
  - Full recipe view with hero image
  - Adjustable servings (automatically recalculates ingredient quantities)
  - Ingredient selection with checkboxes
  - Separate "pantry items" section for ingredients users might already have
  - Step-by-step instructions
  - Actions:
    - Save/unsave recipe (heart icon)
    - Add selected ingredients to shopping list
    - "View on Instacart" button (opens Instacart shopping page)

## How to Use the Recipe Feature

### For Testing with Sample Data

1. Open your browser console on the app
2. Import the sample recipe utility:
```javascript
import { createAllSampleRecipes } from './src/utils/sampleRecipes'
```

3. Get your user ID and create sample recipes:
```javascript
// In your app, after logging in:
const userId = 'your-user-id-here'
await createAllSampleRecipes(userId)
```

This will create two sample recipes:
- Classic Spaghetti Carbonara (25 min, 4 servings)
- Easy Chicken Stir-Fry (20 min, 4 servings)

### Adding Your Own Recipes

You can add recipes programmatically or build an admin interface. Here's how to add a recipe:

```javascript
import { recipeService } from './src/services/recipeService'

// Create the recipe
const recipe = await recipeService.createRecipe({
  user_id: userId,
  title: 'My Amazing Recipe',
  author: 'Your Name',
  description: 'A delicious meal',
  image_url: 'https://images.pexels.com/...',
  servings: 4,
  cooking_time_minutes: 30,
  instructions: [
    'Step 1: Do this',
    'Step 2: Do that',
    'Step 3: Enjoy!'
  ],
})

// Add ingredients
await recipeService.addIngredients([
  {
    recipe_id: recipe.id,
    name: 'chicken breast',  // Generic name for Instacart
    display_text: 'Boneless Chicken Breast',  // User-friendly text
    quantity: 1.5,
    unit: 'pounds',
    category: 'meat',
    display_order: 0,
    is_pantry_item: false,
  },
  // Add more ingredients...
])
```

### Using the Instacart Integration

When a user clicks "View on Instacart" on a recipe:

1. **First time:** The app calls the Instacart API to generate a shoppable recipe page
2. **Cached:** The URL is saved in the database with a 30-day expiration
3. **Reuse:** Subsequent clicks reuse the cached URL until it expires
4. **Refresh:** URLs nearing expiration are automatically regenerated

The generated Instacart page includes:
- All recipe ingredients formatted for product matching
- Adjustable servings from the modal
- "You may already have" section for pantry items
- Link back to your app (partner linkback)
- Instacart's 100,000+ store network for shopping

## Instacart API Best Practices (Implemented)

✅ **Authentication:** Using Bearer token in Authorization header
✅ **Required Headers:** Accept, Content-Type, Authorization
✅ **Generic Ingredient Names:** No brands, weights, or sizes in `name` field
✅ **Display Text:** User-friendly text in `display_text` field
✅ **Measurements:** Quantity must be > 0, valid units required
✅ **URL Caching:** Generated URLs cached for 30 days
✅ **Partner Linkback:** Returns users to your app after Instacart shopping
✅ **Pantry Items:** Marked separately for better UX
✅ **Rate Limiting:** Error handling for 429 responses
✅ **CORS:** Proper CORS headers in Edge Function

## API Key Configuration

Your Instacart API credentials are stored securely:

**Local Development (.env file):**
```
INSTACART_API_KEY=keys.clx1bq0D2Okgk8P7zo2TLm22BRgWQmbKFv4obaB2fjM
```

**Edge Function (automatic):**
The API key is automatically available in the Supabase Edge Function environment. No manual configuration needed.

## Going to Production

Before launching to production users:

1. **Test thoroughly** in development environment
2. **Review Instacart's pre-launch checklist**
3. **Request production API key** from Instacart
4. **Update Edge Function** to use production server:
   ```typescript
   const instacartBaseUrl = "https://connect.instacart.com"
   ```
5. **Submit for Instacart approval** per their guidelines
6. **Update API key** in environment variables

## Architecture

```
User Interface (React Components)
    ↓
RecipeBrowser ← → RecipeDetailModal
    ↓                    ↓
recipeService    instacartService
    ↓                    ↓
Supabase DB      Edge Function → Instacart API
```

## Database Schema

**recipes:**
- Stores recipe metadata, instructions, Instacart URL cache

**recipe_ingredients:**
- Stores ingredients with Instacart-compliant naming
- Includes brand_filters and health_filters (organic, gluten-free, etc.)

**user_saved_recipes:**
- Tracks which recipes each user has saved

**shopping_lists.recipe_id:**
- Links shopping items back to their source recipe

## File Structure

```
src/
├── components/
│   ├── RecipeBrowser.tsx          # Recipe browsing UI
│   └── RecipeDetailModal.tsx      # Recipe detail view
├── services/
│   ├── recipeService.ts           # Database operations
│   └── instacartService.ts        # API communication
├── utils/
│   └── sampleRecipes.ts           # Sample data for testing
└── lib/
    └── supabase.ts                # Type definitions

supabase/
├── migrations/
│   ├── create_recipes_tables.sql  # Recipe schema
│   └── add_recipe_id_to_shopping_lists.sql
└── functions/
    └── instacart-recipes/
        └── index.ts               # API integration
```

## Next Steps

1. **Add sample recipes** using the provided utility
2. **Test the Instacart integration** by clicking "View on Instacart"
3. **Add your own recipes** for your users
4. **Customize recipe images** from Pexels or other stock photo sources
5. **Build recipe creation UI** if you want users to add their own recipes
6. **Apply for Instacart production approval** when ready to launch

## Support

For Instacart API questions:
- Documentation: https://docs.instacart.com/developer_platform_api/
- Support: Enterprise Service Desk (per Instacart documentation)

For implementation questions:
- Review the inline code comments in all service and component files
- Check the Supabase dashboard for database schema and data
- Review Edge Function logs in Supabase dashboard

---

**Congratulations!** Your recipe feature is fully implemented and ready for testing.
