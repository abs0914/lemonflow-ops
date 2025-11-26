import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CashPurchaseRequest {
  purchaseOrderId: string;
  lines: {
    componentId: string;
    quantity: number;
    unitCost: number;
    batchNumber: string;
    lineNumber: number;
  }[];
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

    // Fetch PO details
    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .select(`
        po_number,
        supplier_id,
        suppliers (
          supplier_code,
          company_name
        )
      `)
      .eq("id", body.purchaseOrderId)
      .single();

    if (poError) throw poError;

    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;

    // Fetch all component details
    const componentIds = body.lines.map(line => line.componentId);
    const { data: components, error: compError } = await supabase
      .from("components")
      .select("id, autocount_item_code, name, sku")
      .in("id", componentIds);

    if (compError) throw compError;

    const componentMap = new Map(components?.map(c => [c.id, c]) || []);

    // Prepare AutoCount Purchase Invoice payload with multiple lines
    const docDate = new Date().toISOString().split("T")[0];
    
    const detailKeys = body.lines.map(() => 0);
    const itemCodes = body.lines.map(line => {
      const comp = componentMap.get(line.componentId);
      return comp?.autocount_item_code || comp?.sku || "";
    });
    const locations = body.lines.map(() => "MAIN");
    const descriptions = body.lines.map(line => line.batchNumber);
    const quantities = body.lines.map(line => line.quantity);
    const uoms = body.lines.map(() => "");
    const unitPrices = body.lines.map(line => line.unitCost);
    const amounts = body.lines.map(line => line.quantity * line.unitCost);
    const taxTypes = body.lines.map(() => "None");
    const taxRates = body.lines.map(() => 0);
    const taxAmts = body.lines.map(() => 0);
    const taxInclusives = body.lines.map(() => false);

    const autCountPayload = {
      DocKey: 0,
      DocNo: "",
      DocDate: docDate,
      CreditorCode: supplier?.supplier_code || "",
      Description: `Cash Purchase PO - ${po.po_number}`,
      DetailKey: detailKeys,
      ItemCode: itemCodes,
      Location: locations,
      Description2: descriptions,
      Qty: quantities,
      UOM: uoms,
      UnitPrice: unitPrices,
      Amount: amounts,
      TaxType: taxTypes,
      TaxRate: taxRates,
      TaxAmt: taxAmts,
      TaxInclusive: taxInclusives,
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

    // Update PO with AutoCount doc number
    await supabase
      .from("purchase_orders")
      .update({
        autocount_synced: true,
        autocount_doc_no: autoCountData.DocNo || "SYNCED",
      })
      .eq("id", body.purchaseOrderId);

    // Log sync success
    await supabase.from("autocount_sync_log").insert({
      reference_id: body.purchaseOrderId,
      reference_type: "cash_purchase_po",
      sync_type: "purchase_invoice",
      sync_status: "success",
      autocount_doc_no: autoCountData.DocNo,
      synced_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        autoCountDocNo: autoCountData.DocNo,
        message: "Cash purchase PO synced to AutoCount successfully",
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
