import { supabase } from '../lib/supabase'
import type {
  ShoppingItem,
  InstacartShoppingListRequest,
  InstacartShoppingListResponse,
  PurchaseStatus,
  ProviderMetadata,
  GetNearbyRetailersRequest,
  GetNearbyRetailersResponse,
  UserPreferredRetailer,
  Retailer
} from '../lib/supabase'
import { InstacartUnitMapper } from '../utils/instacartUnitMapper'

export class InstacartShoppingService {
  private edgeFunctionUrl: string

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/instacart-shopping-list`
  }

  async sendToInstacart(items: ShoppingItem[], retailerKey?: string): Promise<InstacartShoppingListResponse> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('User must be authenticated to send items to Instacart')
    }

    const formattedItems = this.formatItemsForInstacart(items)

    const requestBody: any = {
      action: 'create_shopping_list',
      items: formattedItems,
      title: 'My Shopping List',
    }

    if (retailerKey) {
      requestBody.retailer_key = retailerKey
    }

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestBody),
    })

    let data: any;

    try {
      const responseText = await response.text();

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { raw: responseText };
        }

        const errorMessage = errorData.error ||
          errorData.details?.error ||
          responseText ||
          `Failed to create Instacart shopping list: ${response.statusText}`;

        throw new Error(errorMessage);
      }

      data = JSON.parse(responseText);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unexpected token')) {
        throw new Error('Invalid response from Instacart API. Please check your API configuration.');
      }
      throw error;
    }

    let retailerName: string | undefined
    if (retailerKey) {
      const retailers = await this.getPreferredRetailers(items[0]?.user_id)
      const matchingRetailer = retailers.find(r => r.retailer_key === retailerKey)
      retailerName = matchingRetailer?.retailer_name
    }

    await this.updateItemsProviderStatus(
      items,
      data,
      retailerKey,
      retailerName
    )

    return data as InstacartShoppingListResponse
  }

  async sendAllToInstacart(userId: string, retailerKey?: string): Promise<InstacartShoppingListResponse> {
    const items = await this.getItemsNotSent(userId)

    if (items.length === 0) {
      throw new Error('No items available to send to Instacart')
    }

    return this.sendToInstacart(items, retailerKey)
  }

  async sendSelectedToInstacart(itemIds: string[], retailerKey?: string): Promise<InstacartShoppingListResponse> {
    const items = await this.getItemsByIds(itemIds)

    if (items.length === 0) {
      throw new Error('No valid items found to send to Instacart')
    }

    return this.sendToInstacart(items, retailerKey)
  }

  private formatItemsForInstacart(items: ShoppingItem[]) {
    return items.map(item => {
      const formatted = InstacartUnitMapper.formatForInstacart(
        item.quantity,
        item.unit,
        item.category || undefined
      )

      return {
        name: item.item,
        quantity: formatted.quantity,
        unit: formatted.unit,
        category: item.category || 'other',
      }
    })
  }

  private async updateItemsProviderStatus(
    items: ShoppingItem[],
    response: InstacartShoppingListResponse,
    retailerKey?: string,
    retailerName?: string
  ): Promise<void> {
    const metadata: ProviderMetadata = {
      cart_url: response.products_link_url,
      timestamp: new Date().toISOString(),
    }

    if (retailerKey) {
      metadata.retailer_key = retailerKey
    }
    if (retailerName) {
      metadata.retailer_name = retailerName
    }

    const updates = items.map(item => ({
      id: item.id,
      provider_name: 'instacart' as const,
      purchase_status: 'in_cart' as PurchaseStatus,
      external_order_id: null,
      provider_metadata: metadata,
      provider_synced_at: new Date().toISOString(),
    }))

    for (const update of updates) {
      await supabase
        .from('shopping_lists')
        .update(update)
        .eq('id', update.id)
    }
  }

  async getItemsByProvider(userId: string, providerName: string): Promise<ShoppingItem[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('provider_name', providerName)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getItemsByStatus(userId: string, status: PurchaseStatus): Promise<ShoppingItem[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('purchase_status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getItemsNotSent(userId: string): Promise<ShoppingItem[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .or('purchase_status.eq.not_sent,purchase_status.is.null')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  private async getItemsByIds(itemIds: string[]): Promise<ShoppingItem[]> {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('*')
      .in('id', itemIds)

    if (error) throw error
    return data || []
  }

  buildPartnerLinkbackUrl(): string {
    return window.location.origin + '/shopping'
  }

  async updateItemStatus(
    itemId: string,
    status: PurchaseStatus,
    metadata?: ProviderMetadata
  ): Promise<void> {
    const updates: any = {
      purchase_status: status,
      provider_synced_at: new Date().toISOString(),
    }

    if (metadata) {
      updates.provider_metadata = metadata
    }

    const { error } = await supabase
      .from('shopping_lists')
      .update(updates)
      .eq('id', itemId)

    if (error) throw error
  }

  async clearProviderFromItems(itemIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('shopping_lists')
      .update({
        provider_name: null,
        purchase_status: 'not_sent',
        external_order_id: null,
        provider_metadata: null,
        provider_synced_at: null,
      })
      .in('id', itemIds)

    if (error) throw error
  }

  async getProviderStats(userId: string) {
    const { data, error } = await supabase
      .from('shopping_lists')
      .select('provider_name, purchase_status')
      .eq('user_id', userId)
      .eq('completed', false)

    if (error) throw error

    const stats = {
      instacart: { not_sent: 0, in_cart: 0, purchased: 0, failed: 0 },
      amazon: { not_sent: 0, in_cart: 0, purchased: 0, failed: 0 },
      manual: { not_sent: 0, in_cart: 0, purchased: 0, failed: 0 },
      unassigned: { not_sent: 0, in_cart: 0, purchased: 0, failed: 0 },
    }

    data?.forEach(item => {
      const provider = item.provider_name || 'unassigned'
      const status = item.purchase_status || 'not_sent'
      if (stats[provider as keyof typeof stats]) {
        stats[provider as keyof typeof stats][status as keyof typeof stats.instacart]++
      }
    })

    return stats
  }

  async getNearbyRetailers(postalCode: string, countryCode: 'US' | 'CA' = 'US'): Promise<GetNearbyRetailersResponse> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('User must be authenticated to get nearby retailers')
    }

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'get_nearby_retailers',
        postal_code: postalCode,
        country_code: countryCode,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error ||
        `Failed to get nearby retailers: ${response.statusText}`
      )
    }

    const data = await response.json()
    return data as GetNearbyRetailersResponse
  }

  async getPreferredRetailers(userId: string): Promise<UserPreferredRetailer[]> {
    if (!userId) {
      return []
    }

    try {
      const { data, error } = await supabase
        .from('user_preferred_retailers')
        .select('*')
        .eq('user_id', userId)
        .order('display_order', { ascending: true })

      if (error) {
        console.error('Error fetching preferred retailers:', error)
        throw new Error(`Failed to load preferred retailers: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Error in getPreferredRetailers:', error)
      throw error
    }
  }

  async getPrimaryRetailer(userId: string): Promise<UserPreferredRetailer | null> {
    if (!userId) {
      return null
    }

    try {
      const { data, error } = await supabase
        .from('user_preferred_retailers')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle()

      if (error) {
        console.error('Error fetching primary retailer:', error)
        throw new Error(`Failed to load primary retailer: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Error in getPrimaryRetailer:', error)
      throw error
    }
  }

  async savePreferredRetailer(userId: string, retailer: Retailer, isPrimary: boolean = false): Promise<UserPreferredRetailer> {
    if (!userId || !retailer?.retailer_key) {
      throw new Error('User ID and retailer information are required')
    }

    try {
      if (isPrimary) {
        const { error: updateError } = await supabase
          .from('user_preferred_retailers')
          .update({ is_primary: false })
          .eq('user_id', userId)

        if (updateError) {
          console.error('Error clearing primary flags:', updateError)
        }
      }

      const existingRetailers = await this.getPreferredRetailers(userId)
      const displayOrder = existingRetailers.length

      const { data, error } = await supabase
        .from('user_preferred_retailers')
        .insert({
          user_id: userId,
          retailer_key: retailer.retailer_key,
          retailer_name: retailer.name,
          retailer_logo_url: retailer.retailer_logo_url,
          is_primary: isPrimary,
          display_order: displayOrder,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('This retailer is already in your preferred list')
        }
        throw new Error(`Failed to save retailer: ${error.message}`)
      }

      if (!data) {
        throw new Error('Failed to save retailer: No data returned')
      }

      return data
    } catch (error) {
      console.error('Error in savePreferredRetailer:', error)
      throw error
    }
  }

  async setPrimaryRetailer(userId: string, retailerId: string): Promise<void> {
    if (!userId || !retailerId) {
      throw new Error('User ID and retailer ID are required')
    }

    try {
      const { error: clearError } = await supabase
        .from('user_preferred_retailers')
        .update({ is_primary: false })
        .eq('user_id', userId)

      if (clearError) {
        throw new Error(`Failed to clear primary flags: ${clearError.message}`)
      }

      const { error: setPrimaryError } = await supabase
        .from('user_preferred_retailers')
        .update({ is_primary: true })
        .eq('id', retailerId)
        .eq('user_id', userId)

      if (setPrimaryError) {
        throw new Error(`Failed to set primary retailer: ${setPrimaryError.message}`)
      }
    } catch (error) {
      console.error('Error in setPrimaryRetailer:', error)
      throw error
    }
  }

  async removePreferredRetailer(userId: string, retailerId: string): Promise<void> {
    if (!userId || !retailerId) {
      throw new Error('User ID and retailer ID are required')
    }

    try {
      const { error } = await supabase
        .from('user_preferred_retailers')
        .delete()
        .eq('id', retailerId)
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to remove retailer: ${error.message}`)
      }
    } catch (error) {
      console.error('Error in removePreferredRetailer:', error)
      throw error
    }
  }

  async updateRetailerOrder(userId: string, retailerId: string, newOrder: number): Promise<void> {
    const { error } = await supabase
      .from('user_preferred_retailers')
      .update({ display_order: newOrder })
      .eq('id', retailerId)
      .eq('user_id', userId)

    if (error) throw error
  }

  async checkRetailerExists(userId: string, retailerKey: string): Promise<boolean> {
    if (!userId || !retailerKey) {
      return false
    }

    try {
      const { data, error } = await supabase
        .from('user_preferred_retailers')
        .select('id')
        .eq('user_id', userId)
        .eq('retailer_key', retailerKey)
        .maybeSingle()

      if (error) {
        console.error('Error checking retailer existence:', error)
        return false
      }

      return data !== null
    } catch (error) {
      console.error('Error in checkRetailerExists:', error)
      return false
    }
  }
}

export const instacartShoppingService = new InstacartShoppingService()
