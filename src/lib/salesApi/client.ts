// Sales API Client - Uses Edge Function Proxy
import { supabase } from "@/integrations/supabase/client";
import type {
  StoresResponse,
  POSDailySalesResponse,
  SalesOrder,
} from "./types";
import { format } from "date-fns";

// API request helper using edge function proxy
async function apiRequest<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sales-api-proxy', {
    body: { endpoint, method: 'GET', params },
  });

  if (error) {
    console.error('API request error:', error);
    throw new Error(error.message || 'API request failed');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as T;
}

// Stores API
export async function getStores(type?: "own" | "franchise"): Promise<StoresResponse> {
  const params: Record<string, string> = {};
  if (type) params.type = type;
  return apiRequest<StoresResponse>('/api/stores', params);
}

// POS Daily Sales API
export interface POSSalesParams {
  startDate?: Date;
  endDate?: Date;
  storeCode?: string;
  limit?: number;
}

export async function getPOSDailySales(
  params: POSSalesParams = {}
): Promise<POSDailySalesResponse> {
  const queryParams: Record<string, string> = {};

  if (params.startDate) {
    queryParams.startDate = format(params.startDate, "yyyy-MM-dd");
  }
  if (params.endDate) {
    queryParams.endDate = format(params.endDate, "yyyy-MM-dd");
  }
  if (params.storeCode) {
    queryParams.storeCode = params.storeCode;
  }
  if (params.limit) {
    queryParams.limit = params.limit.toString();
  }

  return apiRequest<POSDailySalesResponse>('/api/pos/daily-sales', queryParams);
}

// NOTE: Sales Orders are now fetched from local Supabase database
// See useSalesOrdersData hook in src/hooks/useSalesData.ts
// The /autocount/sales-orders endpoint does not exist on the external API
