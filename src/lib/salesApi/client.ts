// External Sales API Client
import type {
  LoginCredentials,
  LoginResponse,
  StoresResponse,
  POSDailySalesResponse,
  SalesOrder,
} from "./types";
import { format } from "date-fns";

const BASE_URL = "https://api.thelemonco.online";

// Token management
const TOKEN_KEY = "lemonco_sales_token";
const TOKEN_EXPIRY_KEY = "lemonco_sales_token_expiry";

export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiry) return null;

  const expiryDate = new Date(expiry);
  if (expiryDate < new Date()) {
    clearStoredToken();
    return null;
  }

  return token;
}

export function setStoredToken(token: string, expiresAt: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();

  if (!token && !endpoint.includes("/auth/login")) {
    throw new Error("Not authenticated");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    throw new Error("Session expired. Please login again.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Auth API
export async function login(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  setStoredToken(response.token, response.expiresAt);
  return response;
}

export function logout(): void {
  clearStoredToken();
}

// Stores API
export async function getStores(type?: "own" | "franchise"): Promise<StoresResponse> {
  const params = type ? `?type=${type}` : "";
  return apiRequest<StoresResponse>(`/api/stores${params}`);
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
  const queryParams = new URLSearchParams();

  if (params.startDate) {
    queryParams.set("startDate", format(params.startDate, "yyyy-MM-dd"));
  }
  if (params.endDate) {
    queryParams.set("endDate", format(params.endDate, "yyyy-MM-dd"));
  }
  if (params.storeCode) {
    queryParams.set("storeCode", params.storeCode);
  }
  if (params.limit) {
    queryParams.set("limit", params.limit.toString());
  }

  const queryString = queryParams.toString();
  return apiRequest<POSDailySalesResponse>(
    `/api/pos/daily-sales${queryString ? `?${queryString}` : ""}`
  );
}

// Sales Orders API
export async function getSalesOrders(limit?: number): Promise<SalesOrder[]> {
  const params = limit ? `?limit=${limit}` : "";
  return apiRequest<SalesOrder[]>(`/autocount/sales-orders${params}`);
}

export async function getSalesOrderByDocNo(docNo: string): Promise<SalesOrder> {
  return apiRequest<SalesOrder>(`/autocount/sales-orders/${docNo}`);
}
