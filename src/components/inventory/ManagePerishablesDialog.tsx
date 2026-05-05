import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, Leaf } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePerishablesDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["raw-materials-perishables-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("raw_materials")
        .select("id, sku, name, unit, is_perishable, item_group")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const togglePerishable = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { data, error } = await supabase
        .from("raw_materials")
        .update({ is_perishable: value })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Update blocked by permissions");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["raw-materials-perishables-list"] });
      queryClient.invalidateQueries({ queryKey: ["raw-materials"] });
      queryClient.invalidateQueries({ queryKey: ["perishable-raw-materials"] });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it: any) =>
        it.name?.toLowerCase().includes(q) ||
        it.sku?.toLowerCase().includes(q) ||
        it.item_group?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const perishableCount = items?.filter((i: any) => i.is_perishable).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-600" />
            Manage Perishables
          </DialogTitle>
          <DialogDescription>
            Flag raw materials that lose weight over time (fruits, produce, dairy). Only
            perishable items can have shrinkage adjustments logged against them.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, SKU, or group"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{perishableCount} perishable</Badge>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No raw materials match your search.
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((it: any) => (
                <li key={it.id} className="flex items-center justify-between p-3 gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {it.name}
                      {it.is_perishable && (
                        <Badge variant="outline" className="border-emerald-600 text-emerald-700">
                          <Leaf className="h-3 w-3 mr-1" />
                          Perishable
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {it.sku} · {it.unit}
                      {it.item_group ? ` · ${it.item_group}` : ""}
                    </div>
                  </div>
                  <Switch
                    checked={!!it.is_perishable}
                    disabled={togglePerishable.isPending}
                    onCheckedChange={(value) =>
                      togglePerishable.mutate({ id: it.id, value })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
