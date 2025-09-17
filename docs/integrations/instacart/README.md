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

## Environment

### Client Configuration

Set in your `.env` file:

```bash
VITE_FUNCTIONS_URL=https://rtvwcyrksplhsgycyfzo.functions.supabase.co/instacart-proxy
# Optional; only if your functions require it to invoke:
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Security Note**: No Instacart API keys are stored in the client. The server-side Edge Function injects the Bearer token from Supabase project secrets.

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

## Deploy

Deploy the Edge Function to your Supabase project:

```bash
supabase functions deploy instacart-proxy --project-ref [PROJECT_REF]
```

Update your client environment to point to the deployed function:

```bash
VITE_FUNCTIONS_URL=https://[PROJECT_REF].supabase.co/functions/v1/instacart-proxy
```

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
- **Server-side authentication** - Bearer token injected from `INSTACART_API_KEY`
- **CORS enabled** - Supports browser requests
- **Secret filtering** - Removes sensitive fields from responses
- **Environment-based** - All credentials read from env variables

## Client SDK

### Configuration

Set in your `.env` file:

```bash
VITE_FUNCTIONS_URL=https://[PROJECT_REF].supabase.co/functions/v1/instacart-proxy
```

### Available Methods

#### `createRecipeLink(input)`
Generate shopping list from recipe text and ingredients.

```typescript
import { createRecipeLink } from '@/lib/instacartClient';
import { toLineItem } from '@/lib/instacartMap';

const result = await createRecipeLink({
  title: "Chicken Tacos",
  servings: 4,
  ingredients: [
    toLineItem({ name: "chicken breast", quantity: 1.5, unit: "lb" }),
    toLineItem({ name: "flour tortillas", quantity: 8, unit: "ea" })
  ]
});
// Returns: { products_link_url: "https://www.instacart.com/..." }
```

#### `createShoppingListLink(input)`
Convert shopping list items to Instacart products.

```typescript
import { createShoppingListLink } from '@/lib/instacartClient';
import { toLineItem } from '@/lib/instacartMap';

const result = await createShoppingListLink({
  title: "Weekly Groceries",
  line_items: [
    toLineItem({ name: "milk", quantity: 1, unit: "gallon" }),
    toLineItem({ name: "bread", quantity: 1, unit: "ea" })
  ]
});
// Returns: { products_link_url: "https://www.instacart.com/..." }
```

#### `getNearbyRetailers(postal_code, country_code?)`
Get available retailers by location.

```typescript
import { getNearbyRetailers } from '@/lib/instacartClient';

const retailers = await getNearbyRetailers("10001", "US");
// Returns: { retailers: [...] }
```

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

## Guardrails

### Security
- **Never expose secrets in client** - All API keys stored in Supabase project secrets
- **Server-side proxy only** - Client never directly calls Instacart API
- **Environment-based configuration** - No hardcoded credentials

### Data Integrity
- **Don't mix product_ids and upcs** - Use one identification method per item
- **Keep names generic** - Move specific details to `display_text` and `measurements`
- **Validate all inputs** - Client SDK enforces proper LineItem structure

### Performance
- **Reuse products_link_url** - URLs are valid until content changes
- **Cache retailer data** - Store location-based retailer lists locally
- **Batch operations** - Group multiple items in single API calls

## Acceptance Criteria

- [ ] **Edge Function compiles & serves** - Proper CORS and environment-driven authentication
- [ ] **API routes functional** - POST /recipe, POST /list, GET /retailers return Instacart responses
- [ ] **Client SDK validates inputs** - Proper validation and returns `{ products_link_url }`
- [ ] **Documentation complete** - README covers setup, deployment, and examples
- [ ] **Security verified** - No secrets in client code or repository
- [ ] **End-to-end tested** - Generated URLs work in Instacart checkout flow

## Quick QA

### Development Setup

1. **Set environment variable** in your `.env` file:
   ```bash
   VITE_FUNCTIONS_URL=https://[PROJECT_REF].supabase.co/functions/v1/instacart-proxy
   ```

2. **Test in browser console** or create a scratch script:
   ```typescript
   import { demoRecipe, demoList, demoRetailers } from '@/lib/examples/instacartExamples';

   // Test recipe conversion
   const recipeResult = await demoRecipe();
   console.log('Recipe link:', recipeResult.products_link_url);

   // Test shopping list conversion
   const listResult = await demoList();
   console.log('Shopping list link:', listResult.products_link_url);

   // Test retailer lookup
   const retailers = await demoRetailers();
   console.log('Available retailers:', retailers.retailers);
   ```

3. **Verify the flow**:
   - Copy the `products_link_url` from the response
   - Open the URL in a new browser tab
   - Select a local store (Costco, Kroger, etc.)
   - Verify items are added to cart correctly
   - Complete checkout to test end-to-end flow

### Expected Response Format

```json
{
  "products_link_url": "https://www.instacart.com/store/checkout/..."
}
```

**Note**: The `products_link_url` expires after the configured time (default: 24 hours).

## Diagnostics

### AI Usage (Server-side Only)
- All OpenAI requests now go through a Supabase Edge Function: **ai-proxy**.
- The browser never instantiates the OpenAI SDK and never needs an OpenAI key.
- Public env (safe): `VITE_AI_FUNCTIONS_URL=https://rtvwcyrksplhsgycyfzo.functions.supabase.co/ai-proxy`
- Server secret required in Supabase (no repo files): `OPENAI_API_KEY`

#### Deploy / Configure
1. Set project secrets (replace YOUR_KEY):
   ```
   supabase secrets set --project-ref rtvwcyrksplhsgycyfzo OPENAI_API_KEY='[YOUR_OPENAI_API_KEY]'
   ```
2. Deploy the function:
   ```
   supabase functions deploy ai-proxy --project-ref rtvwcyrksplhsgycyfzo
   ```
3. Client calls `POST /ai-proxy/chat` via `src/lib/aiProxy.ts`.
4. Health check: `GET /ai-proxy/ping` should return `{ ok: true, hasKey: true }` once secret is set.

### AI Usage (Server-side Only)
- All OpenAI requests now go through a Supabase Edge Function: **ai-proxy**.
- The browser never instantiates the OpenAI SDK and never needs an OpenAI key.
- Public env (safe): `VITE_AI_FUNCTIONS_URL=https://rtvwcyrksplhsgycyfzo.functions.supabase.co/ai-proxy`
- Server secret required in Supabase (no repo files): `OPENAI_API_KEY`

#### Deploy / Configure
1. Set project secrets (replace YOUR_KEY):
   ```
   supabase secrets set --project-ref rtvwcyrksplhsgycyfzo OPENAI_API_KEY='[YOUR_OPENAI_API_KEY]'
   ```
2. Deploy the function:
   ```
   supabase functions deploy ai-proxy --project-ref rtvwcyrksplhsgycyfzo
   ```
3. Client calls `POST /ai-proxy/chat` via `src/lib/aiProxy.ts`.
4. Health check: `GET /ai-proxy/ping` should return `{ ok: true, hasKey: true }` once secret is set.

- Open **Settings → Network Diagnostics** and click **Run Checks**.
- Ensure:
  - `VITE_FUNCTIONS_URL` shows your Supabase Function base.
  - **Instacart Proxy /ping** returns `{ ok: true, hasAuthHeader: <bool>, origin: "<your-origin>" }`.
  - **Instacart Proxy /retailers** returns OK or a clear JSON error from Instacart proxy.
  - **Supabase /auth/v1/health** returns OK (JSON).
- If any fail:
  - Check env vars are set and dev server restarted.
  - For 401/403 on proxy, set `VITE_SUPABASE_ANON_KEY` so the client sends `Authorization: Bearer <anon>`.
  - Verify the function URL matches your project ref and ends with `/instacart-proxy`.

### Correct Project Ref (NXDOMAIN fix)
- Your project ref is **rtvwcyrksplhsgycyfzo**.
- Client envs must point to:
  - `VITE_SUPABASE_URL=https://rtvwcyrksplhsgycyfzo.supabase.co`
  - `VITE_FUNCTIONS_URL=https://rtvwcyrksplhsgycyfzo.functions.supabase.co/instacart-proxy`
- If you see `DNS_PROBE_FINISHED_NXDOMAIN`, you likely used the wrong host. Fix the envs and restart the dev server.

## UI QA Checklist

### Testing the Shopping Tab Interface

1. **Navigate to Shopping Tab**
   - Open the app and click the "Instacart" tab in the bottom navigation
   - Verify the page loads with three panels: Retailers, Recipe, and Shopping List

2. **Test Retailers Lookup**
   - Enter postal code (e.g., `32801`)
   - Select country (`US` or `CA`)
   - Click "Find Retailers"
   - **Expected**: List of nearby stores OR friendly error message
   - **Verify**: Loading state shows during API call

3. **Test Recipe Link Creator**
   - Click "Quick Fill Sample" button
   - **Expected**: Form populates with chicken tacos recipe
   - Click "Create Recipe Link"
   - **Expected**: Generates Instacart URL
   - Click "Open Link" to test in new tab
   - **Verify**: Instacart page loads with ingredients in cart

4. **Test Shopping List Creator**
   - Click "Quick Fill Sample" button
   - **Expected**: Form populates with weekly essentials
   - Click "Create Shopping List Link"
   - **Expected**: Generates Instacart URL
   - Click "Open Link" to test in new tab
   - **Verify**: Instacart page loads with items in cart

5. **Test Caching Behavior**
   - Re-run recipe or list creation with identical content
   - **Expected**: "Reused cached link for identical content" message appears
   - **Verify**: Response is instant (no loading state)

6. **Test Copy Functionality**
   - Generate any link (recipe or shopping list)
   - Click "Copy URL" button
   - **Expected**: URL copied to clipboard
   - **Verify**: Can paste URL in browser address bar

7. **Test Error Handling**
   - Clear all ingredients/items from text areas
   - Try to create links
   - **Expected**: Friendly validation error messages
   - **Verify**: No API calls made for empty content

8. **End-to-End Instacart Flow**
   - Generate a shopping list link
   - Open in new browser tab
   - Select a local store (Costco, Kroger, etc.)
   - **Verify**: Items appear correctly in Instacart cart
   - **Optional**: Complete checkout to test full integration

## Quick QA

### Development Setup

1. **Set environment variable** in your `.env` file:
   ```bash
   VITE_FUNCTIONS_URL=https://[PROJECT_REF].supabase.co/functions/v1/instacart-proxy
   ```

2. **Test in browser console** or create a scratch script:
   ```typescript
   import { demoRecipe, demoList, demoRetailers } from '@/lib/examples/instacartExamples';

   // Test recipe conversion
   const recipeResult = await demoRecipe();
   console.log('Recipe link:', recipeResult.products_link_url);

   // Test shopping list conversion
   const listResult = await demoList();
   console.log('Shopping list link:', listResult.products_link_url);

   // Test retailer lookup
   const retailers = await demoRetailers();
   console.log('Available retailers:', retailers.retailers);
   ```

3. **Verify the flow**:
   - Copy the `products_link_url` from the response
   - Open the URL in a new browser tab
   - Select a local store (Costco, Kroger, etc.)
   - Verify items are added to cart correctly
   - Complete checkout to test end-to-end flow

### Expected Response Format

```json
{
  "products_link_url": "https://www.instacart.com/store/checkout/..."
}
```

**Note**: The `products_link_url` expires after the configured time (default: 24 hours).

## Shopping Tab

The Shopping tab (`src/features/shopping/ShoppingTab.tsx`) provides a user-friendly interface for testing the Instacart integration with three main panels:

### Panels

1. **Retailers Lookup** - Find available Instacart stores by postal code
   - Enter postal code and country
   - Returns list of nearby retailers that support delivery

2. **Recipe Link Creator** - Convert recipes to Instacart shopping lists
   - Enter recipe title, ingredients (one per line), and instructions
   - Generates Instacart URL with all ingredients ready for purchase

3. **Shopping List Creator** - Transform item lists to Instacart carts
   - Enter list title and items (one per line)
   - Creates Instacart URL with items added to cart

### Usage Notes

- **One item per line** - Each text area expects items separated by newlines
- **Smart parsing** - Uses `toLineItem()` heuristics to extract sizes and measurements
- **Validation** - Requires at least one non-empty line before creating links
- **Error handling** - Shows helpful messages for validation and API errors
- **Quick actions** - Generated URLs can be opened directly or copied to clipboard
- **Content caching** - Links are cached based on content hash and reused until content changes
- **Quick fill buttons** - Pre-populate forms with sample data for easy testing

### Testing Workflow

1. Navigate to the Shopping tab in the app
2. Use the pre-filled examples or enter your own data
3. Click "Create Recipe Link" or "Create Shopping List Link"
4. Copy the generated URL and open in a new tab
5. Select a local store and verify items are added correctly