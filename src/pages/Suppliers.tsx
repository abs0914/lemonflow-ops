import { useState } from "react";
import { Plus, Search, RefreshCw, Upload } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
export default function Suppliers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | undefined>();
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const {
    data: suppliers,
    isLoading
  } = useSuppliers();
  const filteredSuppliers = suppliers?.filter(supplier => supplier.company_name.toLowerCase().includes(searchTerm.toLowerCase()) || supplier.supplier_code.toLowerCase().includes(searchTerm.toLowerCase()) || supplier.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()));
  const handleEdit = (id: string) => {
    setSelectedSupplier(id);
    setDialogOpen(true);
  };
  const handleCreate = () => {
    setSelectedSupplier(undefined);
    setDialogOpen(true);
  };
  const handleSyncComplete = () => {
    queryClient.invalidateQueries({
      queryKey: ["suppliers"]
    });
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
  return <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:items-center md:justify-between py-[24px] px-[28px] md:flex md:flex-row">
          <div>
            <h1 className="text-3xl font-bold">Suppliers</h1>
            <p className="text-muted-foreground">Manage your suppliers and creditors</p>
          </div>
          {!isMobile && <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSyncDialogOpen(true)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync from AutoCount
              </Button>
              <Button variant="outline" onClick={handleSyncToAutoCount}>
                <Upload className="mr-2 h-4 w-4" />
                Sync to AutoCount
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            </div>}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search suppliers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-sm" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div> : isMobile ? <div className="space-y-4">
                {filteredSuppliers?.map(supplier => <MobileSupplierCard key={supplier.id} supplier={supplier} onEdit={() => handleEdit(supplier.id)} />)}
                {filteredSuppliers?.length === 0 && <p className="text-center text-muted-foreground py-8">No suppliers found</p>}
              </div> : <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AutoCount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers?.map(supplier => <TableRow key={supplier.id}>
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
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => handleEdit(supplier.id)}>
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>)}
                  {filteredSuppliers?.length === 0 && <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No suppliers found
                      </TableCell>
                    </TableRow>}
                </TableBody>
              </Table>}
          </CardContent>
        </Card>

        {isMobile && <FloatingActionButton onClick={handleCreate} icon={Plus} />}

        <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplierId={selectedSupplier} />

        <SyncSuppliersDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen} onSyncComplete={handleSyncComplete} />
      </div>
    </DashboardLayout>;
}