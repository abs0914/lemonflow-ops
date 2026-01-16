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
import { DeleteInventoryDialog } from "@/components/inventory/DeleteInventoryDialog";
import { AddInventoryDialog } from "@/components/inventory/AddInventoryDialog";
import { EditInventoryDialog } from "@/components/inventory/EditInventoryDialog";
import { RawMaterialsCsvUpload } from "@/components/inventory/RawMaterialsCsvUpload";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, AlertCircle, Database, Plus, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { RawMaterial } from "@/types/inventory";

export default function RawMaterials() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [itemGroupFilter, setItemGroupFilter] = useState<string>("all");
  const [itemTypeFilter, setItemTypeFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [selectedRawMaterial, setSelectedRawMaterial] = useState<RawMaterial | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<RawMaterial | null>(null);

  // Redirect if not authenticated or not authorized
  if (!user) {
    navigate("/login");
    return null;
  }
  if (profile?.role !== "Admin" && profile?.role !== "Warehouse") {
    navigate("/login");
    return null;
  }

  // Fetch raw materials data
  const { data: rawMaterials, isLoading, refetch } = useQuery({
    queryKey: ["raw-materials", searchTerm, itemGroupFilter, itemTypeFilter, stockStatusFilter],
    queryFn: async () => {
      let query = supabase.from("raw_materials").select("*").order("name");

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
        filteredData = filteredData.filter(rm => rm.stock_quantity - rm.reserved_quantity > 0);
      } else if (stockStatusFilter === "low-stock") {
        filteredData = filteredData.filter(rm => rm.stock_quantity - rm.reserved_quantity > 0 && rm.stock_quantity - rm.reserved_quantity < 10);
      } else if (stockStatusFilter === "out-of-stock") {
        filteredData = filteredData.filter(rm => rm.stock_quantity - rm.reserved_quantity <= 0);
      }
      
      return filteredData;
    }
  });

  // Fetch unique item groups and types for filters
  const { data: itemGroups } = useQuery({
    queryKey: ["raw-material-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("item_group")
        .not("item_group", "is", null);
      if (error) throw error;
      const unique = Array.from(new Set(data.map(d => d.item_group)));
      return unique.filter(Boolean) as string[];
    }
  });

  const { data: itemTypes } = useQuery({
    queryKey: ["raw-material-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("item_type")
        .not("item_type", "is", null);
      if (error) throw error;
      const unique = Array.from(new Set(data.map(d => d.item_type)));
      return unique.filter(Boolean) as string[];
    }
  });

  // Calculate KPIs
  const totalItems = rawMaterials?.length || 0;
  const lowStockCount = rawMaterials?.filter(rm => rm.stock_quantity - rm.reserved_quantity > 0 && rm.stock_quantity - rm.reserved_quantity < 10).length || 0;
  const outOfStockCount = rawMaterials?.filter(rm => rm.stock_quantity - rm.reserved_quantity <= 0).length || 0;

  const handleAdjustStock = (rawMaterial: RawMaterial) => {
    setSelectedRawMaterial(rawMaterial);
    setAdjustmentDialogOpen(true);
  };

  const handleEdit = (rawMaterial: RawMaterial) => {
    setItemToEdit(rawMaterial);
    setEditDialogOpen(true);
  };

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (rawMaterialId: string) => {
      const { error: movementError } = await supabase
        .from("stock_movements")
        .delete()
        .eq("item_id", rawMaterialId)
        .eq("item_type", "raw_material");
      if (movementError) throw movementError;

      const { error: rawMaterialError } = await supabase
        .from("raw_materials")
        .delete()
        .eq("id", rawMaterialId);
      if (rawMaterialError) throw rawMaterialError;
    },
    onSuccess: () => {
      toast({
        title: "Item Deleted",
        description: "Successfully deleted the raw material"
      });
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between px-[30px] py-[21px]">
          <div>
            <h1 className="text-3xl font-bold">Raw Materials Inventory</h1>
            <p className="text-muted-foreground mt-2">
              Local raw materials for production and BOM assembly (not synced to AutoCount)
            </p>
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <RawMaterialsCsvUpload />
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
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
              <p className="text-xs text-muted-foreground">Active raw materials</p>
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

        {/* Inventory Table/Cards */}
        {isMobile ? (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rawMaterials && rawMaterials.length > 0 ? (
              rawMaterials.map(rawMaterial => (
                <MobileInventoryCard
                  key={rawMaterial.id}
                  component={rawMaterial as any}
                  onAdjustStock={handleAdjustStock as any}
                  onDelete={handleDeleteClick}
                  onEdit={handleEdit as any}
                />
              ))
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No raw materials found
              </div>
            )}
          </div>
        ) : (
          <InventoryTable
            components={rawMaterials as any || []}
            isLoading={isLoading}
            onRefetch={refetch}
            onAdjustStock={handleAdjustStock as any}
            tableName="raw_materials"
          />
        )}
      </div>

      {/* Mobile FAB */}
      {isMobile && (
        <FloatingActionButton
          icon={Plus}
          label="Add Item"
          onClick={() => setAddDialogOpen(true)}
        />
      )}

      {/* Stock Adjustment Dialog */}
      {selectedRawMaterial && (
        <StockAdjustmentDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          itemType="raw_material"
          itemId={selectedRawMaterial.id}
          itemName={selectedRawMaterial.name}
          itemSku={selectedRawMaterial.autocount_item_code || selectedRawMaterial.sku}
          currentStock={selectedRawMaterial.stock_quantity}
          itemUnit={selectedRawMaterial.unit}
          hasBatchNo={selectedRawMaterial.has_batch_no}
        />
      )}

      <DeleteInventoryDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        itemCount={1}
        isDeleting={deleteMutation.isPending}
      />

      <AddInventoryDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        isRawMaterial={true}
      />

      <EditInventoryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        component={itemToEdit as any}
      />
    </DashboardLayout>
  );
}
