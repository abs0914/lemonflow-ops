import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { InventoryFilters } from "@/components/inventory/InventoryFilters";
import { MobileInventoryCard } from "@/components/inventory/MobileInventoryCard";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { SyncInventoryDialog } from "@/components/inventory/SyncInventoryDialog";
import { PushInventoryDialog } from "@/components/inventory/PushInventoryDialog";
import { DeleteInventoryDialog } from "@/components/inventory/DeleteInventoryDialog";
import { AddInventoryDialog } from "@/components/inventory/AddInventoryDialog";
import { EditInventoryDialog } from "@/components/inventory/EditInventoryDialog";
import { ImportInventoryDialog } from "@/components/inventory/ImportInventoryDialog";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, Database, Plus, RefreshCw, Download, Upload } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { Component } from "@/types/inventory";

export default function Inventory() {
  const {
    user,
    profile
  } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    toast
  } = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [itemGroupFilter, setItemGroupFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [pushDialogOpen, setPushDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Component | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Redirect if not authenticated or not authorized
  if (!user) {
    navigate("/login");
    return null;
  }
  if (profile?.role !== "Admin" && profile?.role !== "Warehouse") {
    navigate("/login");
    return null;
  }

  // Fetch components inventory data from AutoCount
  const { data: components, isLoading, refetch } = useQuery({
    queryKey: ["inventory", searchTerm, itemGroupFilter, itemTypeFilter, stockStatusFilter],
    queryFn: async () => {
      let query = supabase.from("components").select("*").order("name");

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,autocount_item_code.ilike.%${searchTerm}%`);
      }

      if (itemGroupFilter !== "all") {
        query = query.eq("item_group", itemGroupFilter);
      }

      if (itemTypeFilter !== "all") {
        query = query.eq("item_type", itemTypeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filteredData = data || [];
      if (stockStatusFilter === "in-stock") {
        filteredData = filteredData.filter(c => {
          const available = c.stock_quantity - c.reserved_quantity;
          const threshold = c.low_stock_threshold ?? 10;
          return available > threshold;
        });
      } else if (stockStatusFilter === "low-stock") {
        filteredData = filteredData.filter(c => {
          const available = c.stock_quantity - c.reserved_quantity;
          const threshold = c.low_stock_threshold ?? 10;
          return available > 0 && available <= threshold;
        });
      } else if (stockStatusFilter === "out-of-stock") {
        filteredData = filteredData.filter(c => c.stock_quantity - c.reserved_quantity <= 0);
      }
      
      return filteredData;
    }
  });

  // Fetch unique item groups and types for filters
  const { data: itemGroups } = useQuery({
    queryKey: ["component-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("item_group")
        .not("item_group", "is", null);
      if (error) throw error;
      const unique = Array.from(new Set(data.map(d => d.item_group)));
      return unique.filter(Boolean) as string[];
    }
  });

  const { data: itemTypes } = useQuery({
    queryKey: ["component-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("components")
        .select("item_type")
        .not("item_type", "is", null);
      if (error) throw error;
      const unique = Array.from(new Set(data.map(d => d.item_type)));
      return unique.filter(Boolean) as string[];
    }
  });

  // Calculate KPIs using individual thresholds
  const totalItems = components?.length || 0;
  const lowStockCount = components?.filter(c => {
    const available = c.stock_quantity - c.reserved_quantity;
    const threshold = c.low_stock_threshold ?? 10;
    return available > 0 && available <= threshold;
  }).length || 0;
  const outOfStockCount = components?.filter(c => c.stock_quantity - c.reserved_quantity <= 0).length || 0;

  const handleAdjustStock = (component: Component) => {
    setSelectedComponent(component);
    setAdjustmentDialogOpen(true);
  };

  const handleEdit = (component: Component) => {
    setItemToEdit(component);
    setEditDialogOpen(true);
  };

  const handleExport = () => {
    if (!components || components.length === 0) {
      toast({
        title: "No Data",
        description: "No inventory data to export",
        variant: "destructive"
      });
      return;
    }

    const headers = ["SKU", "AutoCount Code", "Name", "Item Group", "Item Type", "Stock Qty", "Reserved", "Available", "Unit", "Low Stock Threshold"];
    const csvRows = [headers.join(",")];

    components.forEach((item) => {
      const available = item.stock_quantity - item.reserved_quantity;
      const row = [
        item.sku,
        item.autocount_item_code || "",
        `"${(item.name || "").replace(/"/g, '""')}"`,
        item.item_group || "",
        item.item_type || "",
        item.stock_quantity,
        item.reserved_quantity,
        available,
        item.unit,
        item.low_stock_threshold ?? 10
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory-export-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${components.length} items to CSV`
    });
  };

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({
      queryKey: ["inventory"]
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (componentId: string) => {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("item_id", componentId)
        .eq("item_type", "component");
      if (movementError) throw movementError;

      const { error: componentError } = await supabase
        .from("components")
        .delete()
        .eq("id", componentId);
      if (componentError) throw componentError;
    },
    onSuccess: () => {
      toast({
        title: "Item Deleted",
        description: "Successfully deleted the component"
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({
        queryKey: ["inventory"]
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };
  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete);
    }
  };
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between px-[30px] py-[21px]">
          <div>
            <h1 className="text-3xl font-bold">AutoCount Inventory</h1>
            <p className="text-muted-foreground mt-2">
              View and manage inventory synced from AutoCount
            </p>
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button variant="outline" onClick={() => setSyncDialogOpen(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Pull from AutoCount
              </Button>
              <Button variant="outline" onClick={() => setPushDialogOpen(true)}>
                <Database className="mr-2 h-4 w-4" />
                Sync to AutoCount
              </Button>
            </div>
          )}
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

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md hover:border-yellow-400 ${stockStatusFilter === "low-stock" ? "ring-2 ring-yellow-400 border-yellow-400" : ""}`}
            onClick={() => setStockStatusFilter(stockStatusFilter === "low-stock" ? "all" : "low-stock")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockCount}</div>
              <p className="text-xs text-muted-foreground">
                {stockStatusFilter === "low-stock" ? "Click to clear filter" : "Click to filter"}
              </p>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all hover:shadow-md hover:border-red-400 ${stockStatusFilter === "out-of-stock" ? "ring-2 ring-red-400 border-red-400" : ""}`}
            onClick={() => setStockStatusFilter(stockStatusFilter === "out-of-stock" ? "all" : "out-of-stock")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <Database className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outOfStockCount}</div>
              <p className="text-xs text-muted-foreground">
                {stockStatusFilter === "out-of-stock" ? "Click to clear filter" : "Click to filter"}
              </p>
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

        {/* Inventory Table/Cards */}
        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : components && components.length > 0 ? (
              components.map(component => (
                <MobileInventoryCard
                  key={component.id}
                  component={component as any}
                  onAdjustStock={handleAdjustStock as any}
                  onDelete={handleDeleteClick}
                />
              ))
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No inventory items found
              </div>
            )}
          </div>
        ) : (
          <InventoryTable
            components={components as any || []}
            isLoading={isLoading}
            onRefetch={refetch}
            onAdjustStock={handleAdjustStock as any}
          />
        )}
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <FloatingActionButton
          icon={Plus}
          label="Quick Actions"
          actions={[
            {
              icon: Plus,
              label: "Add Item",
              onClick: () => setAddDialogOpen(true)
            },
            {
              icon: RefreshCw,
              label: "Pull from AutoCount",
              onClick: () => setSyncDialogOpen(true)
            },
            {
              icon: Database,
              label: "Sync to AutoCount",
              onClick: () => setPushDialogOpen(true)
            }
          ]}
        />
      )}

      {/* Stock Adjustment Dialog */}
      {selectedComponent && (
        <StockAdjustmentDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          itemType="component"
          itemId={selectedComponent.id}
          itemName={selectedComponent.name}
          itemSku={selectedComponent.autocount_item_code || selectedComponent.sku}
          currentStock={selectedComponent.stock_quantity}
          itemUnit={selectedComponent.unit}
          hasBatchNo={selectedComponent.has_batch_no}
        />
      )}

      <SyncInventoryDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onSyncComplete={handleSyncComplete}
      />

      <PushInventoryDialog
        open={pushDialogOpen}
        onOpenChange={setPushDialogOpen}
        onPushComplete={handleSyncComplete}
      />

      <AddInventoryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <DeleteInventoryDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        itemCount={1}
        isDeleting={deleteMutation.isPending}
      />

      <EditInventoryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        component={itemToEdit}
      />

      <ImportInventoryDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />
    </DashboardLayout>;
}