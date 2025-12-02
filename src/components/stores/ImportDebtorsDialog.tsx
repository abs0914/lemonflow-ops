import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Debtor {
  debtor_code: string;
  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
}

interface ImportDebtorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportDebtorsDialog({ open, onOpenChange }: ImportDebtorsDialogProps) {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDebtors, setSelectedDebtors] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const fetchDebtors = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('pull-autocount-debtors', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);

      setDebtors(response.data.debtors);
      toast.success(`Found ${response.data.debtors.length} debtors from AutoCount`);
    } catch (error: any) {
      console.error('Error fetching debtors:', error);
      toast.error(`Failed to fetch debtors: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const importSelected = async () => {
    if (selectedDebtors.size === 0) {
      toast.error('Please select at least one debtor to import');
      return;
    }

    setImporting(true);
    try {
      const debtorsToImport = debtors.filter(d => selectedDebtors.has(d.debtor_code));
      
      const storesToInsert = debtorsToImport.map(debtor => ({
        store_code: debtor.debtor_code,
        store_name: debtor.company_name,
        debtor_code: debtor.debtor_code,
        store_type: 'franchisee',
        contact_person: debtor.contact_person,
        email: debtor.email,
        phone: debtor.phone,
        address: debtor.address,
        is_active: debtor.is_active,
      }));

      const { error } = await supabase
        .from('stores')
        .insert(storesToInsert);

      if (error) throw error;

      toast.success(`Successfully imported ${selectedDebtors.size} store(s)`);
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setSelectedDebtors(new Set());
      setDebtors([]);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error importing stores:', error);
      toast.error(`Failed to import stores: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const toggleDebtor = (debtorCode: string) => {
    const newSelected = new Set(selectedDebtors);
    if (newSelected.has(debtorCode)) {
      newSelected.delete(debtorCode);
    } else {
      newSelected.add(debtorCode);
    }
    setSelectedDebtors(newSelected);
  };

  const toggleAll = () => {
    if (selectedDebtors.size === filteredDebtors.length) {
      setSelectedDebtors(new Set());
    } else {
      setSelectedDebtors(new Set(filteredDebtors.map(d => d.debtor_code)));
    }
  };

  const filteredDebtors = debtors.filter(debtor =>
    debtor.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debtor.debtor_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Stores from AutoCount</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {debtors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Pull debtor/customer records from AutoCount to create stores
              </p>
              <Button onClick={fetchDebtors} disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                {loading ? 'Loading...' : 'Pull from AutoCount'}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search debtors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button onClick={toggleAll} variant="outline">
                  {selectedDebtors.size === filteredDebtors.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <div className="border rounded-lg">
                <div className="max-h-96 overflow-y-auto">
                  {filteredDebtors.map((debtor) => (
                    <div
                      key={debtor.debtor_code}
                      className="flex items-center gap-4 p-4 border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={selectedDebtors.has(debtor.debtor_code)}
                        onCheckedChange={() => toggleDebtor(debtor.debtor_code)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{debtor.company_name}</span>
                          <Badge variant="outline">{debtor.debtor_code}</Badge>
                          {debtor.is_active ? (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {debtor.contact_person && <div>{debtor.contact_person}</div>}
                          {debtor.phone && <div>{debtor.phone}</div>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedDebtors.size} of {filteredDebtors.length} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={importSelected} disabled={importing || selectedDebtors.size === 0}>
                    {importing ? 'Importing...' : `Import ${selectedDebtors.size} Store(s)`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
