import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, Database } from "lucide-react";

export default function Inventory() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState("");
  const [itemGroupFilter, setItemGroupFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");

  // Redirect if not authenticated or not authorized
  if (!user) {
    navigate("/login");
    return null;
  }

  if (profile?.role !== "Admin" && profile?.role !== "Warehouse") {
    navigate("/dashboard");
    return null;
  }

  // Fetch inventory data
  const { data: components, isLoading, refetch } = useQuery({
    queryKey: ["inventory", searchTerm, itemGroupFilter, itemTypeFilter, stockStatusFilter],
    queryFn: async () => {
      let query = supabase
        .from("components")
        .select("*")
        .order("name");

      // Apply search filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,autocount_item_code.ilike.%${searchTerm}%`);
      }

      // Apply item group filter
      if (itemGroupFilter !== "all") {
        query = query.eq("item_group", itemGroupFilter);
      }

      // Apply item type filter
      if (itemTypeFilter !== "all") {
        query = query.eq("item_type", itemTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply stock status filter (client-side since it involves calculations)
      let filteredData = data || [];
      if (stockStatusFilter === "in-stock") {
        filteredData = filteredData.filter(c => (c.stock_quantity - c.reserved_quantity) > 0);
      } else if (stockStatusFilter === "low-stock") {
        filteredData = filteredData.filter(c => (c.stock_quantity - c.reserved_quantity) > 0 && (c.stock_quantity - c.reserved_quantity) < 10);
      } else if (stockStatusFilter === "out-of-stock") {
        filteredData = filteredData.filter(c => (c.stock_quantity - c.reserved_quantity) <= 0);
      }

      return filteredData;
    },
  });

  // Fetch unique item groups and types for filters
  const { data: itemGroups } = useQuery({
    queryKey: ["item-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("item_group")
        .not("item_group", "is", null);

      if (error) throw error;
      
      const unique = Array.from(new Set(data.map(d => d.item_group)));
      return unique.filter(Boolean) as string[];
    },
  });

  const { data: itemTypes } = useQuery({
    queryKey: ["item-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("item_type")
        .not("item_type", "is", null);

      if (error) throw error;
      
      const unique = Array.from(new Set(data.map(d => d.item_type)));
      return unique.filter(Boolean) as string[];
    },
  });

  // Calculate KPIs
  const totalItems = components?.length || 0;
  const lowStockCount = components?.filter(c => (c.stock_quantity - c.reserved_quantity) > 0 && (c.stock_quantity - c.reserved_quantity) < 10).length || 0;
  const outOfStockCount = components?.filter(c => (c.stock_quantity - c.reserved_quantity) <= 0).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage your inventory, update stock quantities, and sync with AutoCount
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground">Active inventory items</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockCount}</div>
              <p className="text-xs text-muted-foreground">Items below threshold</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <Database className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outOfStockCount}</div>
              <p className="text-xs text-muted-foreground">Items unavailable</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <InventoryFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          itemGroupFilter={itemGroupFilter}
          onItemGroupChange={setItemGroupFilter}
          itemTypeFilter={itemTypeFilter}
          onItemTypeChange={setItemTypeFilter}
          stockStatusFilter={stockStatusFilter}
          onStockStatusChange={setStockStatusFilter}
          itemGroups={itemGroups || []}
          itemTypes={itemTypes || []}
        />

        {/* Inventory Table */}
        <InventoryTable
          components={components || []}
          isLoading={isLoading}
          onRefetch={refetch}
        />
      </div>
    </DashboardLayout>
  );
}
