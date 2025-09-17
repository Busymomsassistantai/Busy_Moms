# Instacart Integration

## Overview

The Instacart integration allows users to automatically order items from their shopping lists through Instacart's API. This integration is implemented as a secure server-side proxy to keep API credentials safe.

## Architecture

```
Client App → Supabase Edge Function → Instacart API
```

- **Client SDK** (`src/lib/instacartClient.ts`) - Type-safe client interface
- **Edge Function** (`supabase/functions/instacart-proxy/`) - Server-side proxy with auth
- **Mapping Layer** (`src/lib/instacartMap.ts`) - Data transformation utilities

## Edge Function

### Endpoint Base
`/functions/v1/instacart-proxy`

### Available Routes
- **POST /recipe** - Generate shopping list from recipe
  - Forwards to `/idp/v1/products/recipe`
  - Body: Recipe text or ingredients list

- **POST /list** - Convert shopping list to Instacart products
  - Forwards to `/idp/v1/products/products_link`
  - Body: Shopping list items

- **GET /retailers** - Get available retailers by location
  - Forwards to `/idp/v1/retailers`
  - Query params: `postal_code`, `country_code` (defaults to "US")

### Security Features
- **Server-side authentication** - Bearer token injected from `INSTACART_API_KEY_DEV`
- **CORS enabled** - Supports browser requests
- **Secret filtering** - Removes sensitive fields from responses
- **Environment-based** - All credentials read from env variables

## Environment Variables

### Client Configuration

Set in your `.env` file:

```bash
VITE_FUNCTIONS_URL=https://[PROJECT_REF].supabase.co/functions/v1/instacart-proxy
```

### Server Configuration (Supabase Secrets)

Set these in your Supabase project dashboard under Settings → Edge Functions:

- **INSTACART_API_KEY** - Your Instacart API key (required)
- **INSTACART_BASE_URL** - Override base URL if needed (optional, defaults to `https://connect.dev.instacart.tools`)

**Security Note**: API keys are stored ONLY in Supabase project secrets, never in code or local files.


## Local Development

For development, we recommend using the deployed Edge Function to avoid managing local secrets.

**Advanced users** can serve locally by temporarily exporting environment variables:

```bash
export INSTACART_API_KEY="your_key_here"
supabase functions serve instacart-proxy
```

**Note**: Never commit environment files or hardcode secrets in your project.

## Client SDK

### Configuration

Set in your `.env` file:

```bash
VITE_FUNCTIONS_URL=https://[PROJECT_REF].supabase.co/functions/v1/instacart-proxy
```

### Available Methods

#### `createRecipeLink(input)`
Generate shopping list from recipe text and ingredients.

#### `createShoppingListLink(input)`
Convert shopping list items to Instacart products.

#### `getNearbyRetailers(postal_code, country_code?)`
Get available retailers by location.

### Validation Rules

**LineItem Requirements:**
- `name` is required
- Cannot combine `product_ids` and `upcs` in the same item
- Must provide either:
  - `quantity` + `unit` (e.g., `quantity: 2, unit: "lb"`)
  - `measurements[]` array
  - `line_item_measurements[]` array

**Example LineItem:**
```typescript
{
  name: "organic milk",
  quantity: 1,
  unit: "gallon",
  filters: {
    brand_filters: ["Organic Valley"],
    health_filters: ["organic"]
  }
}
```

## Mapping Layer

### Data Transformation

The mapping utilities help convert between our app's shopping list format and Instacart's API requirements:

#### `normalizeNameAndMeasurements(rawName, maybeDisplay?)`
Intelligently extracts size information from product names:
- **Keeps `name` generic** - Removes size tokens like "8 oz", "1 lb"
- **Moves size to measurements** - Converts "milk 8 oz" → `name: "milk"`, `measurements: [{unit: "oz", quantity: 8}]`
- **Preserves display text** - Optional human-readable extras

#### `toLineItem(input)`
Converts shopping list items to Instacart-compatible format:
- **Smart defaults** - Falls back to `quantity: 1, unit: "ea"` if no measurements provided
- **Filter support** - Optional `brand_filters` and `health_filters` for precise matching
- **UPC support** - Use product UPCs when available (cannot mix with `product_ids`)

### Best Practices

- **Keep names generic** - "milk" instead of "Organic Valley 2% Milk 64oz"
- **Use measurements** - Specify size requirements separately from product name
- **Apply filters** - Use brand/health filters for specific product requirements
- **Validate inputs** - All LineItems are validated before API calls

### Example Usage

```typescript
import { toLineItem, normalizeNameAndMeasurements } from '@/lib/instacartMap';

// Normalize a product name
const normalized = normalizeNameAndMeasurements("organic milk 64 oz");
// Result: { name: "organic milk", display_text: "64 oz", measurements: [{unit: "oz", quantity: 64}] }

// Convert to LineItem
const lineItem = toLineItem({
  name: "milk",
  quantity: 1,
  unit: "gallon",
  brand_filters: ["Organic Valley"],
  health_filters: ["organic"]
});
```

## Deployment

### 1. Set environment variables in Supabase Dashboard

Go to your project settings and add the required environment variables.

### 2. Deploy the function

```bash
supabase functions deploy instacart-proxy
```

### 3. Update client environment

Update `VITE_FUNCTIONS_URL` to point to your deployed function URL.

## API Examples

### Search Products

```typescript
import { instacartClient } from '@/lib/instacartClient';

// Generate shopping list from recipe
const products = await instacartClient.generateFromRecipe(
  "Spaghetti Bolognese recipe with ground beef, tomatoes, pasta"
);

// Convert shopping list to products
const productLinks = await instacartClient.convertShoppingList([
  "organic milk",
  "whole wheat bread", 
  "fresh spinach"
]);

// Get local retailers
const retailers = await instacartClient.getRetailers({
  postal_code: "10001",
  country_code: "US"
});
```

### Example Payloads

```typescript
// POST /recipe
{
  "recipe": "Chicken stir fry with broccoli, carrots, and soy sauce"
}

// POST /list  
{
  "items": ["milk", "bread", "eggs", "butter"]
}

// GET /retailers?postal_code=10001&country_code=US
// No body required
```

### Map Shopping List

```typescript
import { InstacartMapper } from '@/lib/instacartMap';

// Convert shopping list items to search queries
const queries = shoppingItems.map(item => 
  InstacartMapper.toSearchQuery(item)
);

// Map categories
const instacartCategory = InstacartMapper.mapCategory('dairy');
```

## Error Handling

The client SDK includes comprehensive error handling:

```typescript
try {
  const products = await instacartClient.searchProducts({ query: 'milk' });
} catch (error) {
  if (error.code === 'INSTACART_API_ERROR') {
    // Handle Instacart API errors
  } else if (error.code === 'NETWORK_ERROR') {
    // Handle network issues
  }
}
```

## Security Notes

- API keys are never exposed to the client
- All requests go through our secure Edge Function proxy
- CORS is properly configured for browser requests
- Input validation prevents malicious requests

## Testing

Run the integration tests:

```bash
npm run test:instacart
```

## Troubleshooting

### Common Issues

1. **CORS errors** - Ensure the Edge Function is deployed and CORS headers are set
2. **API key errors** - Verify environment variables are set in Supabase Dashboard
3. **Network timeouts** - Check Instacart API status and increase timeout values

### Debug Mode

Enable debug logging:

```typescript
const client = new InstacartClient(process.env.VITE_FUNCTIONS_URL, { debug: true });
```