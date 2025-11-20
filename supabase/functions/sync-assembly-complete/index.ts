import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AssemblyCompleteRequest {
  assemblyOrderId: string;
  productId: string;
  productQuantity: number;
  componentConsumptions: Array<{
    componentId: string;
    quantity: number;
  }>;
  warehouseLocation: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: AssemblyCompleteRequest = await req.json();
    console.log("Assembly complete sync request:", body);

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name, sku, component_id")
      .eq("id", body.productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!product) throw new Error("Product not found");

    // Fetch finished good component details if linked
    let finishedGoodItemCode = product.sku;
    if (product.component_id) {
      const { data: finishedComponent } = await supabase
        .from("components")
        .select("autocount_item_code, sku")
        .eq("id", product.component_id)
        .maybeSingle();
      
      if (finishedComponent?.autocount_item_code) {
        finishedGoodItemCode = finishedComponent.autocount_item_code;
      }
    }

    // Fetch component details for consumptions
    const componentIds = body.componentConsumptions.map(c => c.componentId);
    const { data: components, error: componentsError } = await supabase
      .from("components")
      .select("id, autocount_item_code, sku, name")
      .in("id", componentIds);

    if (componentsError) throw componentsError;

    // Build AutoCount Stock Assembly payload
    const docDate = new Date().toISOString().split("T")[0];
    
    // Map components to AutoCount detail lines
    const detailKeys: number[] = [];
    const itemCodes: string[] = [];
    const locations: string[] = [];
    const quantities: number[] = [];
    const uoms: string[] = [];
    const descriptions: string[] = [];

    body.componentConsumptions.forEach((consumption, index) => {
      const component = components?.find(c => c.id === consumption.componentId);
      if (component) {
        detailKeys.push(0);
        itemCodes.push(component.autocount_item_code || component.sku);
        locations.push(body.warehouseLocation);
        quantities.push(consumption.quantity);
        uoms.push("");
        descriptions.push(`Consumed for ${product.name}`);
      }
    });

    const autoCountPayload = {
      DocKey: 0,
      DocNo: "",
      DocDate: docDate,
      Description: body.notes || `Assembly: ${product.name}`,
      Location: body.warehouseLocation,
      ItemCode: finishedGoodItemCode,
      Qty: body.productQuantity,
      UOM: "",
      // Detail lines for component consumption
      DetailKey: detailKeys,
      DItemCode: itemCodes,
      DLocation: locations,
      DQty: quantities,
      DUOM: uoms,
      DDescription: descriptions,
    };

    console.log("Sending to AutoCount Stock Assembly API:", autoCountPayload);

    // Call AutoCount API
    const autoCountUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!autoCountUrl || !username || !password) {
      throw new Error("AutoCount API credentials not configured");
    }

    const response = await fetch(`${autoCountUrl}/api/StockAssembly`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify(autoCountPayload),
    });

    const responseText = await response.text();
    console.log("AutoCount API response:", response.status, responseText);

    if (!response.ok) {
      throw new Error(`AutoCount API error: ${response.status} - ${responseText}`);
    }

    let autoCountData;
    try {
      autoCountData = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse AutoCount response:", e);
      autoCountData = { DocNo: "UNKNOWN" };
    }

    // Update assembly order with AutoCount sync status
    await supabase
      .from("assembly_orders")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.assemblyOrderId);

    // Log sync success
    await supabase.from("autocount_sync_log").insert({
      reference_id: body.assemblyOrderId,
      reference_type: "assembly_order",
      sync_type: "stock_assembly",
      sync_status: "success",
      autocount_doc_no: autoCountData.DocNo,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        autoCountDocNo: autoCountData.DocNo,
        message: "Assembly completed and synced to AutoCount successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error syncing assembly completion:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log sync failure
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const body: AssemblyCompleteRequest = await req.json();
      
      await supabase.from("autocount_sync_log").insert({
        reference_id: body.assemblyOrderId,
        reference_type: "assembly_order",
        sync_type: "stock_assembly",
        sync_status: "failed",
        error_message: errorMessage,
      });
    } catch (logError) {
      console.error("Failed to log sync error:", logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
