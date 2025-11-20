import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface POLine {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  uom: string;
  lineRemarks?: string;
}

interface CreatePORequest {
  poNumber: string;
  supplierId: string;
  docDate: string;
  deliveryDate?: string;
  remarks?: string;
  lines: POLine[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const requestData: CreatePORequest = await req.json();

    console.log("Creating PO in AutoCount:", requestData);

    // Get AutoCount credentials
    const apiUrl = Deno.env.get("LEMONCO_API_URL");
    const username = Deno.env.get("LEMONCO_USERNAME");
    const password = Deno.env.get("LEMONCO_PASSWORD");

    if (!apiUrl || !username || !password) {
      throw new Error("AutoCount configuration is incomplete");
    }

    // Get supplier details from Supabase
    const { data: supplier, error: supplierError } = await supabaseClient
      .from("suppliers")
      .select("*")
      .eq("id", requestData.supplierId)
      .single();

    if (supplierError || !supplier) {
      throw new Error("Supplier not found");
    }

    const credentials = btoa(`${username}:${password}`);
    const basicAuth = `Basic ${credentials}`;

    // Create PO in AutoCount
    const poPayload = {
      DocNo: requestData.poNumber,
      SupplierCode: supplier.supplier_code,
      DocDate: requestData.docDate,
      DeliveryDate: requestData.deliveryDate || requestData.docDate,
      Description: requestData.remarks || "",
      Details: requestData.lines.map((line, index) => ({
        LineNumber: index + 1,
        ItemCode: line.itemCode,
        Description: line.description,
        Quantity: line.quantity,
        UnitPrice: line.unitPrice,
        UOM: line.uom,
        LineRemarks: line.lineRemarks || "",
      })),
    };

    console.log("Calling AutoCount API to create PO:", poPayload);

    const response = await fetch(`${apiUrl}/api/purchase/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: basicAuth,
      },
      body: JSON.stringify(poPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AutoCount API error:", errorText);
      throw new Error(`AutoCount API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("AutoCount PO created successfully:", result);

    return new Response(
      JSON.stringify({
        success: true,
        message: "PO created in AutoCount successfully",
        data: result,
        docNo: result.docNo || requestData.poNumber,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating PO in AutoCount:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});