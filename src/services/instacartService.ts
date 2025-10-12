import { supabase } from '../lib/supabase'
import type { InstacartRecipeRequest, InstacartRecipeResponse } from '../lib/supabase'

export class InstacartService {
  private edgeFunctionUrl: string

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    this.edgeFunctionUrl = `${supabaseUrl}/functions/v1/instacart-recipes`
  }

  async createRecipePage(request: InstacartRecipeRequest): Promise<InstacartRecipeResponse> {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session?.access_token) {
      throw new Error('User must be authenticated to create Instacart recipe pages')
    }

    const response = await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: 'create_recipe_page',
        ...request,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error ||
        `Failed to create Instacart recipe page: ${response.statusText}`
      )
    }

    const data = await response.json()
    return data as InstacartRecipeResponse
  }

  buildPartnerLinkbackUrl(): string {
    return window.location.origin + '/shopping?tab=recipes'
  }

  getCachedUrl(cachedUrl: string | null | undefined, expiresAt: string | null | undefined): string | null {
    if (!cachedUrl || !expiresAt) {
      return null
    }

    const expirationDate = new Date(expiresAt)
    const now = new Date()
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    if (expirationDate > oneDayFromNow) {
      return cachedUrl
    }

    return null
  }

  calculateExpiresAt(expiresInDays: number = 30): string {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    return expiresAt.toISOString()
  }
}

export const instacartService = new InstacartService()
