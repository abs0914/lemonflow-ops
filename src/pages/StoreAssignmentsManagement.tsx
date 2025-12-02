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
import { Plus, Search, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useStoreAssignments, useDeleteStoreAssignment } from "@/hooks/useStoreAssignments";
import { StoreAssignmentDialog } from "@/components/stores/StoreAssignmentDialog";
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

export default function StoreAssignmentsManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any | undefined>();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<any | null>(null);

  const { data: assignments, isLoading } = useStoreAssignments();
  const deleteMutation = useDeleteStoreAssignment();

  const filteredAssignments = assignments?.filter((assignment) => {
    const userName = assignment.user_profiles?.full_name || "";
    const storeName = assignment.stores?.store_name || "";
    const storeCode = assignment.stores?.store_code || "";
    
    return (
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      storeCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleEdit = (assignment: any) => {
    setSelectedAssignment(assignment);
    setShowAssignmentDialog(true);
  };

  const handleDelete = (assignment: any) => {
    setAssignmentToDelete(assignment);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (assignmentToDelete) {
      await deleteMutation.mutateAsync(assignmentToDelete.id);
      setShowDeleteDialog(false);
      setAssignmentToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowAssignmentDialog(open);
    if (!open) {
      setSelectedAssignment(undefined);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Store Assignments</h1>
            <p className="text-muted-foreground">
              Manage user access to stores and ordering permissions
            </p>
          </div>
          <Button onClick={() => setShowAssignmentDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Assignment
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by user or store..."
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
        ) : filteredAssignments?.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground">No store assignments found</p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Store Code</TableHead>
                  <TableHead className="text-center">Primary</TableHead>
                  <TableHead className="text-center">Can Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments?.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.user_profiles?.full_name || "Unknown User"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {assignment.user_profiles?.role || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>{assignment.stores?.store_name || "N/A"}</TableCell>
                    <TableCell>{assignment.stores?.store_code || "N/A"}</TableCell>
                    <TableCell className="text-center">
                      {assignment.is_primary ? (
                        <CheckCircle className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {assignment.can_place_orders ? (
                        <CheckCircle className="h-4 w-4 text-green-600 inline" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 inline" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(assignment)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(assignment)}
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

      <StoreAssignmentDialog
        open={showAssignmentDialog}
        onOpenChange={handleDialogClose}
        assignment={selectedAssignment}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this store assignment? The user will no longer have access to this store.
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
