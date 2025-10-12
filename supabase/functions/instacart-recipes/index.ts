import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InstacartIngredient {
  name: string;
  display_text?: string;
  quantity?: number;
  unit?: string;
  brand_filters?: string[];
  health_filters?: string[];
}

interface CreateRecipePageRequest {
  title: string;
  author?: string;
  image_url?: string;
  servings?: number;
  cooking_time?: number;
  instructions?: string[];
  ingredients: InstacartIngredient[];
  partner_linkback_url?: string;
  enable_pantry_items?: boolean;
  expires_in?: number;
}

interface InstacartRecipeResponse {
  products_link_url: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const instacartApiKey = Deno.env.get("INSTACART_API_KEY");
    if (!instacartApiKey) {
      throw new Error("INSTACART_API_KEY environment variable is not set");
    }

    const { action, ...payload } = await req.json();

    // Use development server for testing
    const instacartBaseUrl = "https://connect.dev.instacart.tools";

    switch (action) {
      case "create_recipe_page": {
        const recipeRequest: CreateRecipePageRequest = payload;

        // Validate required fields
        if (!recipeRequest.title || !recipeRequest.ingredients || recipeRequest.ingredients.length === 0) {
          return new Response(
            JSON.stringify({ error: "Title and at least one ingredient are required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Format ingredients for Instacart API
        const formattedIngredients = recipeRequest.ingredients.map((ing) => {
          const ingredient: any = {
            name: ing.name,
          };

          if (ing.display_text) ingredient.display_text = ing.display_text;
          
          if (ing.quantity && ing.unit) {
            ingredient.measurements = [{
              quantity: ing.quantity,
              unit: ing.unit,
            }];
          }

          if (ing.brand_filters && ing.brand_filters.length > 0) {
            ingredient.filters = ingredient.filters || {};
            ingredient.filters.brand_filters = ing.brand_filters;
          }

          if (ing.health_filters && ing.health_filters.length > 0) {
            ingredient.filters = ingredient.filters || {};
            ingredient.filters.health_filters = ing.health_filters;
          }

          return ingredient;
        });

        // Build Instacart API request
        const instacartPayload: any = {
          title: recipeRequest.title,
          ingredients: formattedIngredients,
        };

        if (recipeRequest.author) instacartPayload.author = recipeRequest.author;
        if (recipeRequest.image_url) instacartPayload.image_url = recipeRequest.image_url;
        if (recipeRequest.servings) instacartPayload.servings = recipeRequest.servings;
        if (recipeRequest.cooking_time) instacartPayload.cooking_time = recipeRequest.cooking_time;
        if (recipeRequest.instructions) instacartPayload.instructions = recipeRequest.instructions;
        if (recipeRequest.partner_linkback_url) instacartPayload.partner_linkback_url = recipeRequest.partner_linkback_url;
        if (recipeRequest.enable_pantry_items !== undefined) instacartPayload.enable_pantry_items = recipeRequest.enable_pantry_items;
        if (recipeRequest.expires_in) instacartPayload.expires_in = recipeRequest.expires_in;

        // Make request to Instacart API
        const response = await fetch(`${instacartBaseUrl}/idp/v1/products/recipe`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${instacartApiKey}`,
          },
          body: JSON.stringify(instacartPayload),
        });

        const responseData = await response.json();

        if (!response.ok) {
          console.error("Instacart API error:", responseData);
          return new Response(
            JSON.stringify({ 
              error: "Failed to create Instacart recipe page",
              details: responseData,
              status: response.status,
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        return new Response(
          JSON.stringify(responseData),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Supported actions: create_recipe_page" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});