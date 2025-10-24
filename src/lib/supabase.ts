import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getConfig, logConfigStatus } from './config'

let supabaseInstance: SupabaseClient | null = null

function createSupabaseClient(): SupabaseClient {
  try {
    const config = getConfig()

    logConfigStatus()

    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      db: { schema: 'public' },
    })
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const supabase: SupabaseClient = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient()
  }
  return supabaseInstance
})()

// ---- Shared App Types (used only for TypeScript hints) ----------------------

export type UUID = string

export interface FamilyMember {
id: UUID
user_id: UUID
name: string
relationship?: string | null
avatar_url?: string | null
created_at?: string
updated_at?: string
}

export interface Event {
id: UUID
user_id: UUID
title: string
description?: string | null
event_date: string // YYYY-MM-DD
start_time?: string | null // HH:MM:SS
end_time?: string | null // HH:MM:SS
location?: string | null
participants?: string[] | null
event_type?: string | null
rsvp_required?: boolean | null
rsvp_status?: 'pending' | 'yes' | 'no' | 'maybe' | null
source?: 'whatsapp' | 'manual' | 'ai' | null
created_at?: string
updated_at?: string
}

export interface Reminder {
id: UUID
user_id: UUID
title: string
description?: string | null
reminder_date?: string | null // YYYY-MM-DD
reminder_time?: string | null // HH:MM:SS
priority?: 'low' | 'medium' | 'high' | null
completed?: boolean | null
recurring?: boolean | null
recurring_pattern?: string | null
family_member_id?: UUID | null
created_at?: string
updated_at?: string
}

export interface Task {
id: UUID
user_id: UUID
assigned_to?: UUID | null
title: string
description?: string | null
category?: string | null
priority?: 'low' | 'medium' | 'high' | null
status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | null
due_date?: string | null
due_time?: string | null
recurring?: boolean | null
recurring_pattern?: string | null
points?: number | null
notes?: string | null
completed_at?: string | null
created_at?: string
updated_at?: string
}

export interface Contact {
id: UUID
user_id: UUID
name: string
role: string
phone?: string | null
email?: string | null
category?: string | null
rating?: number | null
notes?: string | null
verified?: boolean | null
background_check_date?: string | null
background_check_status?: string | null
available?: boolean | null
last_contact?: string | null
created_at?: string
updated_at?: string
}

export interface Profile {
id: UUID
email: string
full_name?: string | null
user_type?: 'Mom' | 'Dad' | 'Guardian' | 'Other' | null
onboarding_completed?: boolean | null
ai_personality?: 'Friendly' | 'Professional' | 'Humorous' | null
created_at?: string
updated_at?: string
}

export type ProviderName = 'instacart' | 'amazon' | 'manual' | null

export type PurchaseStatus = 'not_sent' | 'in_cart' | 'purchased' | 'failed'

export interface ProviderMetadata {
cart_url?: string
timestamp?: string
sync_info?: Record<string, any>
[key: string]: any
}

export interface ShoppingItem {
id: UUID
user_id: UUID
item: string
quantity?: number | null
unit?: string | null
original_unit?: string | null
category?:
| 'dairy' | 'produce' | 'meat' | 'bakery' | 'baby' | 'beverages'
| 'frozen' | 'household' | 'snacks' | 'health' | 'pantry' | 'other'
| string | null
notes?: string | null
completed?: boolean | null
assigned_to?: UUID | null
recipe_id?: UUID | null
provider_name?: ProviderName
purchase_status?: PurchaseStatus
external_order_id?: string | null
provider_metadata?: ProviderMetadata | null
provider_synced_at?: string | null
urgent?: boolean | null
created_at?: string
updated_at?: string
}

export interface Recipe {
id: UUID
user_id: UUID
title: string
author?: string | null
description?: string | null
image_url?: string | null
servings?: number | null
prep_time_minutes?: number | null
cooking_time_minutes?: number | null
instructions?: string[] | null
source_url?: string | null
instacart_recipe_url?: string | null
url_expires_at?: string | null
instacart_metadata?: Record<string, any> | null
external_id?: string | null
external_source?: string | null
created_at?: string
updated_at?: string
}

export interface RecipeIngredient {
id: UUID
recipe_id: UUID
name: string
display_text: string
quantity?: number | null
unit?: string | null
category?: string | null
display_order?: number | null
brand_filters?: string[] | null
health_filters?: string[] | null
is_pantry_item?: boolean | null
created_at?: string
}

export interface UserSavedRecipe {
id: UUID
user_id: UUID
recipe_id: UUID
saved_at?: string
}

export interface InstacartIngredient {
name: string
display_text?: string
quantity?: number
unit?: string
brand_filters?: string[]
health_filters?: string[]
}

export interface InstacartRecipeRequest {
title: string
author?: string
image_url?: string
servings?: number
cooking_time?: number
instructions?: string[]
ingredients: InstacartIngredient[]
partner_linkback_url?: string
enable_pantry_items?: boolean
expires_in?: number
}

export interface InstacartRecipeResponse {
products_link_url: string
}

export interface InstacartShoppingListItem {
name: string
quantity?: number
unit?: string
category?: string
}

export interface InstacartShoppingListRequest {
items: InstacartShoppingListItem[]
title?: string
}

export interface InstacartShoppingListResponse {
products_link_url: string
}

export interface Retailer {
retailer_key: string
name: string
retailer_logo_url: string
}

export interface GetNearbyRetailersRequest {
postal_code: string
country_code: 'US' | 'CA'
}

export interface GetNearbyRetailersResponse {
retailers: Retailer[]
}

export interface UserPreferredRetailer {
id: UUID
user_id: UUID
retailer_key: string
retailer_name: string
retailer_logo_url?: string | null
is_primary?: boolean | null
display_order?: number | null
created_at?: string
updated_at?: string
}

export interface RecipeFilter {
search?: string
author?: string
maxCookingTime?: number
minServings?: number
maxServings?: number
}

export interface Affirmation {
id: UUID
user_id: UUID
affirmation_text: string
generated_date: string
data_sources?: {
calendar?: boolean
tasks?: boolean
family?: boolean
shopping?: boolean
ai_generated?: boolean
fallback?: boolean
} | null
viewed?: boolean | null
favorited?: boolean | null
created_at?: string
updated_at?: string
}

export interface AffirmationSettings {
id: UUID
user_id: UUID
enabled?: boolean | null
frequency?: 'once_daily' | 'twice_daily' | 'custom' | null
preferred_time?: string | null
secondary_time?: string | null
timezone?: string | null
include_calendar?: boolean | null
include_tasks?: boolean | null
include_family?: boolean | null
include_shopping?: boolean | null
created_at?: string
updated_at?: string
}

export type AddressType = 'home' | 'work' | 'other'

export interface Address {
id: UUID
user_id: UUID
address_type: AddressType
display_name: string
street_address: string
apartment_unit?: string | null
city: string
state_province: string
postal_code: string
country: string
is_default?: boolean | null
validated?: boolean | null
validation_metadata?: Record<string, any> | null
created_at?: string
updated_at?: string
}

export interface AddressValidationResult {
valid: boolean
formatted_address?: string
suggestions?: string[]
latitude?: number
longitude?: number
error_message?: string
}

export interface UserMeasurementPreferences {
id: UUID
user_id: UUID
preferred_system: 'metric' | 'imperial'
default_volume_unit?: string | null
default_weight_unit?: string | null
auto_convert?: boolean | null
created_at?: string
updated_at?: string
}

export interface MeasurementOverride {
id: UUID
user_id: UUID
recipe_ingredient_id?: UUID | null
shopping_list_id?: UUID | null
original_quantity?: number | null
original_unit?: string | null
override_quantity: number
override_unit: string
reason?: string | null
created_at?: string
updated_at?: string
}