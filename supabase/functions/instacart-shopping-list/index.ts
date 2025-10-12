import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InstacartShoppingListItem {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

interface CreateShoppingListRequest {
  items: InstacartShoppingListItem[];
  title?: string;
}

interface InstacartShoppingListResponse {
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

    const instacartBaseUrl = "https://connect.instacart.com";

    switch (action) {
      case "create_shopping_list": {
        const listRequest: CreateShoppingListRequest = payload;

        if (!listRequest.items || listRequest.items.length === 0) {
          return new Response(
            JSON.stringify({ error: "At least one item is required" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const formattedItems = listRequest.items.map((item) => {
          const formattedItem: any = {
            name: item.name,
          };

          if (item.quantity && item.unit) {
            formattedItem.measurements = [{
              quantity: item.quantity,
              unit: item.unit,
            }];
          }

          if (item.category) {
            formattedItem.category = item.category;
          }

          return formattedItem;
        });

        const instacartPayload: any = {
          title: listRequest.title || "Shopping List",
          line_items: formattedItems,
        };

        console.log("Calling Instacart API:", `${instacartBaseUrl}/idp/v1/products/products_link`);
        console.log("Payload:", JSON.stringify(instacartPayload, null, 2));

        const response = await fetch(`${instacartBaseUrl}/idp/v1/products/products_link`, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${instacartApiKey}`,
          },
          body: JSON.stringify(instacartPayload),
        });

        const contentType = response.headers.get("content-type");
        let responseData: any;
        let responseText: string;

        try {
          responseText = await response.text();
          console.log("Raw response:", responseText);
          console.log("Response status:", response.status);
          console.log("Content-Type:", contentType);

          if (contentType?.includes("application/json") && responseText) {
            responseData = JSON.parse(responseText);
          } else {
            responseData = { raw: responseText };
          }
        } catch (parseError) {
          console.error("Failed to parse response:", parseError);
          responseData = { raw: responseText || "Empty response" };
        }

        if (!response.ok) {
          console.error("Instacart API error:", responseData);
          return new Response(
            JSON.stringify({
              error: "Failed to create Instacart shopping list",
              details: responseData,
              status: response.status,
              endpoint: `${instacartBaseUrl}/idp/v1/products/products_link`,
            }),
            {
              status: response.status,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        console.log("Success! Response data:", responseData);

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
          JSON.stringify({ error: "Invalid action. Supported actions: create_shopping_list" }),
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