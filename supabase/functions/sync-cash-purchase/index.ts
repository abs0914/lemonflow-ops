import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CashPurchaseRequest {
  movementId: string;
  supplierId: string;
  componentId: string;
  quantity: number;
  unitPrice: number;
  batchNumber?: string;
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

    const body: CashPurchaseRequest = await req.json();
    console.log("Cash Purchase sync request:", body);

    // Fetch supplier details
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("supplier_code, company_name")
      .eq("id", body.supplierId)
      .single();

    if (supplierError) throw supplierError;

    // Fetch component details
    const { data: component, error: componentError } = await supabase
      .from("components")
      .select("autocount_item_code, name, sku")
      .eq("id", body.componentId)
      .single();

    if (componentError) throw componentError;

    const itemCode = component.autocount_item_code || component.sku;

    // Prepare AutoCount Purchase Invoice payload
    const docDate = new Date().toISOString().split("T")[0];
    const totalAmount = body.quantity * body.unitPrice;

    const autCountPayload = {
      DocKey: 0,
      DocNo: "",
      DocDate: docDate,
      CreditorCode: supplier.supplier_code,
      Description: body.notes || `Cash Purchase - ${component.name}`,
      DetailKey: [0],
      ItemCode: [itemCode],
      Location: [body.warehouseLocation],
      Description2: [body.batchNumber || ""],
      Qty: [body.quantity],
      UOM: [""],
      UnitPrice: [body.unitPrice],
      Amount: [totalAmount],
      TaxType: ["None"],
      TaxRate: [0],
      TaxAmt: [0],
      TaxInclusive: [false],
    };

    console.log("Sending to AutoCount Purchase Invoice API:", autCountPayload);

    // Call AutoCount API
    const autoCountUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!autoCountUrl || !username || !password) {
      throw new Error("AutoCount API credentials not configured");
    }

    const response = await fetch(`${autoCountUrl}/api/PurchaseInvoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${username}:${password}`)}`,
      },
      body: JSON.stringify(autCountPayload),
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

    // Update stock movement with AutoCount doc number
    await supabase
      .from("stock_movements")
      .update({
        autocount_synced: true,
        autocount_doc_no: autoCountData.DocNo || "SYNCED",
      })
      .eq("id", body.movementId);

    // Log sync success
    await supabase.from("autocount_sync_log").insert({
      reference_id: body.movementId,
      reference_type: "cash_purchase",
      sync_type: "purchase_invoice",
      sync_status: "success",
      autocount_doc_no: autoCountData.DocNo,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        autoCountDocNo: autoCountData.DocNo,
        message: "Cash purchase synced to AutoCount successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error syncing cash purchase:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

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
