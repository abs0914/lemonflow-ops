import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, Pencil, Trash2, Download } from "lucide-react";
import { useStores, useDeleteStore } from "@/hooks/useStores";
import { StoreDialog } from "@/components/stores/StoreDialog";
import { ImportDebtorsDialog } from "@/components/stores/ImportDebtorsDialog";
import { Store } from "@/types/sales-order";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function StoresManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showStoreDialog, setShowStoreDialog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | undefined>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const { data: stores, isLoading } = useStores();
  const deleteMutation = useDeleteStore();

  const filteredStores = stores?.filter((store) => {
    const search = searchTerm.toLowerCase();
    return (
      (store.store_name?.toLowerCase() || '').includes(search) ||
      (store.store_code?.toLowerCase() || '').includes(search) ||
      (store.debtor_code?.toLowerCase() || '').includes(search)
    );
  });

  const handleEdit = (store: Store) => {
    setSelectedStore(store);
    setShowStoreDialog(true);
  };

  const handleDelete = (store: Store) => {
    setStoreToDelete(store);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (storeToDelete) {
      await deleteMutation.mutateAsync(storeToDelete.id);
      setShowDeleteDialog(false);
      setStoreToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowStoreDialog(open);
    if (!open) {
      setSelectedStore(undefined);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stores Management</h1>
            <p className="text-muted-foreground">
              Manage store records and their AutoCount integration
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <Download className="mr-2 h-4 w-4" />
              Import from AutoCount
            </Button>
            <Button onClick={() => setShowStoreDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Store
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by store name, code, or debtor code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredStores?.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground">No stores found</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store Code</TableHead>
                  <TableHead>Store Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Debtor Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStores?.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell className="font-medium">{store.store_code}</TableCell>
                    <TableCell>{store.store_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {store.store_type === "own_store" ? "Own Store" : "Franchisee"}
                      </Badge>
                    </TableCell>
                    <TableCell>{store.debtor_code}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {store.contact_person && <div>{store.contact_person}</div>}
                        {store.phone && <div className="text-muted-foreground">{store.phone}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={store.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                        {store.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(store)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(store)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <StoreDialog
        open={showStoreDialog}
        onOpenChange={handleDialogClose}
        store={selectedStore}
      />

      <ImportDebtorsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{storeToDelete?.store_name}</strong>?
              This will also remove all user assignments for this store. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
