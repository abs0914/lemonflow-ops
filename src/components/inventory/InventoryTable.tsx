import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteInventoryDialog } from "./DeleteInventoryDialog";
import { Pencil, Check, X, RefreshCw, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Component } from "@/types/inventory";

interface InventoryTableProps {
  components: Component[];
  isLoading: boolean;
  onRefetch: () => void;
}

export function InventoryTable({ components, isLoading, onRefetch }: InventoryTableProps) {
  const { user } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const updateStockMutation = useMutation({
    mutationFn: async ({ componentId, newQuantity, oldQuantity }: { 
      componentId: string; 
      newQuantity: number; 
      oldQuantity: number;
    }) => {
      const quantityDiff = newQuantity - oldQuantity;

      // Update component stock quantity
      const { error: updateError } = await supabase
        .from("components")
        .update({ stock_quantity: newQuantity })
        .eq("id", componentId);

      if (updateError) throw updateError;

      // Create stock movement record
      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          item_id: componentId,
          item_type: "component",
          movement_type: "adjustment",
          quantity: quantityDiff,
          performed_by: user?.id,
          notes: "Manual stock adjustment from inventory page",
        });

      if (movementError) throw movementError;
    },
    onSuccess: () => {
      toast({
        title: "Stock Updated",
        description: "Stock quantity has been updated successfully",
      });
      setEditingId(null);
      onRefetch();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (componentIds: string[]) => {
      // Delete associated stock movements first
      const { error: movementError } = await supabase
        .from("stock_movements")
        .delete()
        .in("item_id", componentIds)
        .eq("item_type", "component");

      if (movementError) throw movementError;

      // Delete components
      const { error: componentError } = await supabase
        .from("components")
        .delete()
        .in("id", componentIds);

      if (componentError) throw componentError;
    },
    onSuccess: (_, componentIds) => {
      toast({
        title: "Items Deleted",
        description: `Successfully deleted ${componentIds.length} ${componentIds.length === 1 ? 'item' : 'items'}`,
      });
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      onRefetch();
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (component: Component) => {
    setEditingId(component.id);
    setEditValue(component.stock_quantity.toString());
  };

  const handleSave = (component: Component) => {
    const newQuantity = parseFloat(editValue);
    if (isNaN(newQuantity) || newQuantity < 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a valid non-negative number",
        variant: "destructive",
      });
      return;
    }

    updateStockMutation.mutate({
      componentId: component.id,
      newQuantity,
      oldQuantity: component.stock_quantity,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === components.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(components.map(c => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleDeleteClick = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleBulkDeleteClick = () => {
    setItemToDelete(null);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate([itemToDelete]);
    } else if (selectedIds.size > 0) {
      deleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const getStockStatusBadge = (available: number) => {
    if (available <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (available < 10) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600">Low Stock</Badge>;
    }
    return <Badge variant="secondary">In Stock</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No inventory items found
      </div>
    );
  }

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between bg-muted p-3 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} {selectedIds.size === 1 ? 'item' : 'items'} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDeleteClick}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === components.length && components.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Item Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Stock Qty</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead>UOM</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Synced</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((component) => {
              const available = component.stock_quantity - component.reserved_quantity;
              const isEditing = editingId === component.id;
              const isSelected = selectedIds.has(component.id);

              return (
                <TableRow 
                  key={component.id}
                  className={available <= 0 ? "bg-red-50 dark:bg-red-950/20" : available < 10 ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(component.id)}
                    />
                  </TableCell>
                <TableCell className="font-medium">{component.autocount_item_code || component.sku}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{component.name}</div>
                    {component.description && (
                      <div className="text-xs text-muted-foreground">{component.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{component.item_group || "-"}</TableCell>
                <TableCell>{component.item_type || "-"}</TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-24 text-right"
                      min="0"
                      step="0.01"
                    />
                  ) : (
                    component.stock_quantity
                  )}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {component.reserved_quantity}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {available}
                </TableCell>
                <TableCell>{component.unit}</TableCell>
                <TableCell className="text-right">
                  {component.price ? `$${component.price.toFixed(2)}` : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {component.cost_per_unit ? `$${component.cost_per_unit.toFixed(2)}` : "-"}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {getStockStatusBadge(available)}
                    {component.stock_control && (
                      <Badge variant="outline" className="ml-1">SC</Badge>
                    )}
                    {component.has_batch_no && (
                      <Badge variant="outline" className="ml-1">Batch</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {component.last_synced_at ? (
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(component.last_synced_at), { addSuffix: true })}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSave(component)}
                          disabled={updateStockMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancel}
                          disabled={updateStockMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(component)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick(component.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>

    <DeleteInventoryDialog
      open={deleteDialogOpen}
      onOpenChange={setDeleteDialogOpen}
      onConfirm={handleConfirmDelete}
      itemCount={itemToDelete ? 1 : selectedIds.size}
      isDeleting={deleteMutation.isPending}
    />
  </>
  );
}
