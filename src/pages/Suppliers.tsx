import { useState, useMemo } from "react";
import { Plus, Search, RefreshCw, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useIsMobile } from "@/hooks/use-mobile";
import { SupplierDialog } from "@/components/suppliers/SupplierDialog";
import { MobileSupplierCard } from "@/components/suppliers/MobileSupplierCard";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncSuppliersDialog } from "@/components/suppliers/SyncSuppliersDialog";
import { DeleteSupplierDialog } from "@/components/suppliers/DeleteSupplierDialog";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Supplier } from "@/types/inventory";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/useTableSort";

export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>();
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: suppliers, isLoading } = useSuppliers();

  const filteredSuppliers = useMemo(() => {
    return suppliers?.filter(supplier => {
      const matchesSearch = searchTerm === "" || 
        supplier.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        supplier.supplier_code.toLowerCase().includes(searchTerm.toLowerCase()) || 
        supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [suppliers, searchTerm]);

  const { sortKey, sortDirection, handleSort, sortedData } = useTableSort(filteredSuppliers);

  const handleEdit = (id: string) => {
    setSelectedSupplier(id);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedSupplier(undefined);
    setDialogOpen(true);
  };

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  };

  const { data: relatedPOCount } = useQuery({
    queryKey: ["supplier-po-count", supplierToDelete?.id],
    queryFn: async () => {
      if (!supplierToDelete?.id) return 0;
      const { count } = await supabase
        .from("purchase_orders")
        .select("*", { count: "exact", head: true })
        .eq("supplier_id", supplierToDelete.id);
      return count || 0;
    },
    enabled: !!supplierToDelete?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier deleted successfully");
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete supplier: ${error.message}`);
    },
  });

  const handleDeleteClick = (supplier: Supplier) => {
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (supplierToDelete) {
      deleteMutation.mutate(supplierToDelete.id);
    }
  };

  const handleSyncToAutoCount = async () => {
    const unsyncedSuppliers = filteredSuppliers?.filter(s => !s.autocount_synced) || [];
    
    if (unsyncedSuppliers.length === 0) {
      toast.info("All suppliers are already synced to AutoCount");
      return;
    }

    toast.info(`Syncing ${unsyncedSuppliers.length} supplier(s) to AutoCount...`);
    
    let successCount = 0;
    let failCount = 0;

    for (const supplier of unsyncedSuppliers) {
      try {
        const { data, error } = await supabase.functions.invoke(
          'create-autocount-supplier',
          { body: { supplierId: supplier.id } }
        );

        if (error || !data?.success) {
          failCount++;
          console.error(`Failed to sync supplier ${supplier.supplier_code}:`, error || data?.error);
        } else {
          successCount++;
        }
      } catch (error) {
        failCount++;
        console.error(`Exception syncing supplier ${supplier.supplier_code}:`, error);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['suppliers'] });

    if (successCount > 0 && failCount === 0) {
      toast.success(`Successfully synced ${successCount} supplier(s) to AutoCount`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(`Synced ${successCount} supplier(s), ${failCount} failed. Check sync logs for details.`);
    } else {
      toast.error(`Failed to sync all suppliers. Check sync logs for details.`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:items-center md:justify-between py-[24px] px-[28px] md:flex md:flex-row">
          <div>
            <h1 className="text-3xl font-bold">Suppliers</h1>
            <p className="text-muted-foreground">Manage your suppliers and creditors</p>
          </div>
          {!isMobile && (
            <div className="flex gap-2">
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : isMobile ? (
              <div className="space-y-4">
                {sortedData?.map(supplier => (
                  <MobileSupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onEdit={() => handleEdit(supplier.id)}
                    onDelete={() => handleDeleteClick(supplier)}
                  />
                ))}
                {sortedData?.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No suppliers found</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead sortKey="supplier_code" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Code</SortableTableHead>
                    <SortableTableHead sortKey="company_name" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Company Name</SortableTableHead>
                    <SortableTableHead sortKey="contact_person" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Contact Person</SortableTableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <SortableTableHead sortKey="is_active" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                    <SortableTableHead sortKey="autocount_synced" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>AutoCount</SortableTableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData?.map(supplier => (
                    <TableRow
                      key={supplier.id}
                      onClick={() => handleEdit(supplier.id)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="font-mono">{supplier.supplier_code}</TableCell>
                      <TableCell className="font-medium">{supplier.company_name}</TableCell>
                      <TableCell>{supplier.contact_person || "-"}</TableCell>
                      <TableCell>{supplier.phone || "-"}</TableCell>
                      <TableCell>{supplier.email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={supplier.is_active ? "default" : "secondary"}>
                          {supplier.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.autocount_synced ? "default" : "outline"}>
                          {supplier.autocount_synced ? "Synced" : "Not Synced"}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(supplier.id)}>
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteClick(supplier)}
                            className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedData?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No suppliers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {isMobile && <FloatingActionButton onClick={handleCreate} icon={Plus} />}

        <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplierId={selectedSupplier} />
        <SyncSuppliersDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen} onSyncComplete={handleSyncComplete} />
        <DeleteSupplierDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleConfirmDelete}
          supplierName={supplierToDelete?.company_name || ""}
          relatedPOCount={relatedPOCount || 0}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
