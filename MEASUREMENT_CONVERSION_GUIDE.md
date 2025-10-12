# Ingredient Measurement Conversion System

## Overview

This system provides comprehensive ingredient measurement conversion capabilities aligned with Instacart's API requirements. It supports both metric and imperial units with intelligent parsing, conversion, and user preference management.

## Key Features

### 1. **Measurement Converter** (`src/utils/measurementConverter.ts`)
- Hardcoded conversion factors for optimal performance
- Supports volume, weight, and count-based measurements
- Bidirectional conversions between metric and imperial systems
- Smart fraction formatting (1/2, 1/4, 3/4, etc.)

**Supported Volume Units:**
- Imperial: cup, tablespoon, teaspoon, fluid ounce, gallon, pint, quart
- Metric: milliliter, liter

**Supported Weight Units:**
- Imperial: pound, ounce
- Metric: gram, kilogram, milligram

**Supported Count Units:**
- each, bunch, can, package, item, piece, clove, slice

### 2. **Ingredient Parser** (`src/utils/ingredientParser.ts`)
- Extracts quantity, unit, and ingredient name from text
- Handles fractions: "1/2 cup", "2 1/4 pounds"
- Supports ranges: "2-3 cups", "1 to 2 tablespoons"
- Smart unit detection based on ingredient name and category

### 3. **Instacart Unit Mapper** (`src/utils/instacartUnitMapper.ts`)
- Maps measurements to Instacart-compatible formats
- Category-specific unit preferences
- Validates measurements before API submission
- Automatic unit suggestion based on ingredient type

**Category-Specific Defaults:**
- Produce: `each` (for counting items)
- Meat: `pound` (for weight)
- Dairy (liquid): `fluid ounce`
- Dairy (solid): `ounce`
- Beverages: `fluid ounce`
- Pantry (dry): `cup`
- Pantry (spices): `teaspoon`

### 4. **User Preferences** (`src/services/measurementPreferencesService.ts`)
- Database-backed user preference storage
- Configurable measurement system (metric/imperial)
- Auto-conversion toggle
- Per-item measurement overrides

### 5. **UI Components**

#### MeasurementInput Component
- Quantity and unit input with smart defaults
- Real-time conversion preview
- Unit dropdown filtered by measurement type
- Instacart compatibility validation

#### Settings Integration
- Toggle between metric and imperial systems
- Enable/disable automatic unit conversion
- Preferences persist across sessions

## Database Schema

### `user_measurement_preferences`
```sql
- id (uuid)
- user_id (uuid)
- preferred_system (text: 'metric' | 'imperial')
- default_volume_unit (text)
- default_weight_unit (text)
- auto_convert (boolean)
```

### `measurement_overrides`
```sql
- id (uuid)
- user_id (uuid)
- recipe_ingredient_id (uuid, nullable)
- shopping_list_id (uuid, nullable)
- original_quantity (numeric)
- original_unit (text)
- override_quantity (numeric)
- override_unit (text)
- reason (text, nullable)
```

### Shopping List Updates
Added fields to `shopping_lists`:
- `unit` (text): Current unit for the item
- `original_unit` (text): Original unit before conversion

### Recipe Ingredient Updates
Added field to `recipe_ingredients`:
- `conversion_metadata` (jsonb): Stores conversion confidence and alternatives

## Integration Points

### Recipe Import
When importing recipes from TheMealDB:
1. Parse ingredient text to extract quantities and units
2. Apply smart unit detection if missing
3. Store standardized measurements
4. Track conversion metadata

### Shopping List Submission
When sending items to Instacart:
1. Format measurements using InstacartUnitMapper
2. Apply category-specific unit preferences
3. Validate Instacart API compatibility
4. Store original units for reference

### User Preference Application
When displaying measurements:
1. Check user's preferred system
2. Apply auto-conversion if enabled
3. Show both original and converted values
4. Allow manual overrides

## Usage Examples

### Converting Between Units
```typescript
import { MeasurementConverter } from './utils/measurementConverter'

// Convert 2 cups to milliliters
const result = MeasurementConverter.convert(2, 'cup', 'milliliter')
// result.quantity = 473.18
// result.unit = 'milliliter'

// Convert to user's preferred system
const metric = MeasurementConverter.convertToSystem(1, 'pound', 'metric')
// metric.quantity = 453.59
// metric.unit = 'gram'
```

### Parsing Ingredient Text
```typescript
import { IngredientParser } from './utils/ingredientParser'

const parsed = IngredientParser.parse('2 1/2 cups flour')
// parsed.quantity = 2.5
// parsed.unit = 'cup'
// parsed.ingredient = 'flour'

const range = IngredientParser.parse('1-2 tablespoons olive oil')
// range.quantity = 1.5 (average)
// range.minQuantity = 1
// range.maxQuantity = 2
```

### Mapping to Instacart Units
```typescript
import { InstacartUnitMapper } from './utils/instacartUnitMapper'

// Format for Instacart API
const formatted = InstacartUnitMapper.formatForInstacart(500, 'gram', 'meat')
// formatted.quantity = 1.10
// formatted.unit = 'pound'

// Get suggested unit for ingredient
const unit = InstacartUnitMapper.suggestUnitForIngredient('tomato', 'produce')
// unit = 'each'
```

### Managing User Preferences
```typescript
import { measurementPreferencesService } from './services/measurementPreferencesService'

// Set user's preferred system
await measurementPreferencesService.setPreferredSystem(userId, 'metric')

// Toggle auto-conversion
await measurementPreferencesService.toggleAutoConvert(userId)

// Convert based on preferences
const converted = await measurementPreferencesService.convertBasedOnPreferences(
  userId,
  2,
  'cup'
)
```

## Instacart API Compatibility

### Supported Units (from Instacart documentation)
- **Volume**: cup, tablespoon, teaspoon, fluid ounce, gallon, milliliter, liter, pint, quart
- **Weight**: gram, kilogram, pound, ounce
- **Count**: each, bunch, can, package, item

### Best Practices
1. Always use category-appropriate units
2. Prefer "each" for countable produce items
3. Use "pound" for meat products
4. Use "fluid ounce" for liquid beverages
5. Validate units before API submission

## Future Enhancements

Potential improvements:
- Volume-to-weight conversions with ingredient density tables
- International measurement systems (UK imperial, Australian)
- Recipe scaling with automatic unit adjustment
- Bulk conversion tools for existing data
- Smart rounding based on context
- Unit abbreviation support in parser

## Testing

Test the conversion system:
1. Add items with various units in Shopping form
2. Toggle measurement system in Settings
3. Verify auto-conversion works correctly
4. Check Instacart submissions use compatible units
5. Import recipes and verify unit parsing

## Troubleshooting

**Issue**: Units not converting
- Check user preferences in Settings
- Verify auto-convert is enabled
- Ensure units are compatible (same measurement type)

**Issue**: Instacart API rejecting units
- Check InstacartUnitMapper compatibility
- Verify unit is in supported list
- Review category-specific defaults

**Issue**: Parsed quantities incorrect
- Check for fraction format support
- Verify unit detection patterns
- Review ingredient text format
