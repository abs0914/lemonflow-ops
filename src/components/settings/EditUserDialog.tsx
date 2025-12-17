import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronUp, KeyRound } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
}

interface EditUserDialogProps {
  user: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setFullName(user.full_name);
    setRole(user.role);
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordOpen(false);
  }, [user]);

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: fullName,
          role: role,
        })
        .eq("id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({
        title: "User updated",
        description: "User has been successfully updated",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "reset-password",
          userId: user.id,
          newPassword: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({
        title: "Password reset",
        description: "User password has been successfully updated",
      });
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUserMutation.mutate();
  };

  const handlePasswordReset = () => {
    resetPasswordMutation.mutate();
  };

  const passwordsMatch = newPassword === confirmPassword;
  const passwordValid = newPassword.length >= 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editFullName">Full Name</Label>
              <Input
                id="editFullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editRole">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="CEO">CEO</SelectItem>
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Warehouse">Warehouse</SelectItem>
                  <SelectItem value="Store">Store</SelectItem>
                  <SelectItem value="Fulfillment">Fulfillment</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Collapsible open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4" />
                    Change Password
                  </span>
                  {isPasswordOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  {newPassword && !passwordValid && (
                    <p className="text-sm text-destructive">
                      Password must be at least 6 characters
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-sm text-destructive">
                      Passwords do not match
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handlePasswordReset}
                  disabled={
                    !passwordValid ||
                    !passwordsMatch ||
                    resetPasswordMutation.isPending
                  }
                >
                  {resetPasswordMutation.isPending
                    ? "Resetting..."
                    : "Reset Password"}
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
