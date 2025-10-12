import { supabase } from '../lib/supabase'
import type {
  ShoppingItem,
  InstacartShoppingListRequest,
  InstacartShoppingListResponse,
  PurchaseStatus,
  ProviderMetadata,
  GetNearbyRetailersRequest,
  GetNearbyRetailersResponse
} from '../lib/supabase'

export class InstacartShoppingService {
  private edgeFunctionUrl: string

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/instacart-shopping-list`
  }

  async sendToInstacart(items: ShoppingItem[]): Promise<InstacartShoppingListResponse> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('User must be authenticated to send items to Instacart')
    }

    const formattedItems = this.formatItemsForInstacart(items)

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'create_shopping_list',
        items: formattedItems,
        title: 'My Shopping List',
      }),
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
    await this.updateItemsProviderStatus(items, data)

    return data as InstacartShoppingListResponse
  }

  async sendAllToInstacart(userId: string): Promise<InstacartShoppingListResponse> {
    const items = await this.getItemsNotSent(userId)

    if (items.length === 0) {
      throw new Error('No items available to send to Instacart')
    }

    return this.sendToInstacart(items)
  }

  async sendSelectedToInstacart(itemIds: string[]): Promise<InstacartShoppingListResponse> {
    const items = await this.getItemsByIds(itemIds)

    if (items.length === 0) {
      throw new Error('No valid items found to send to Instacart')
    }

    return this.sendToInstacart(items)
  }

  private formatItemsForInstacart(items: ShoppingItem[]) {
    return items.map(item => ({
      name: item.item,
      quantity: item.quantity || 1,
      unit: this.mapCategoryToUnit(item.category),
      category: item.category || 'other',
    }))
  }

  private mapCategoryToUnit(category?: string | null): string {
    const unitMap: Record<string, string> = {
      dairy: 'item',
      produce: 'item',
      meat: 'pound',
      bakery: 'item',
      baby: 'item',
      beverages: 'item',
      frozen: 'item',
      household: 'item',
      snacks: 'item',
      health: 'item',
      pantry: 'item',
      other: 'item',
    }
    return unitMap[category || 'other'] || 'item'
  }

  private async updateItemsProviderStatus(
    items: ShoppingItem[],
    response: InstacartShoppingListResponse
  ): Promise<void> {
    const metadata: ProviderMetadata = {
      cart_url: response.products_link_url,
      timestamp: new Date().toISOString(),
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
}

export const instacartShoppingService = new InstacartShoppingService()
