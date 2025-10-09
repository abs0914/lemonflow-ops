import { Building2, Phone, Mail, Calendar } from "lucide-react";
import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Supplier } from "@/types/inventory";
import { format } from "date-fns";

interface MobileSupplierCardProps {
  supplier: Supplier;
  onEdit: () => void;
}

export function MobileSupplierCard({ supplier, onEdit }: MobileSupplierCardProps) {
  return (
    <MobileDataCard
      expandableContent={
        supplier.address ? (
          <div className="text-sm text-muted-foreground">
            <strong>Address:</strong> {supplier.address}
          </div>
        ) : undefined
      }
      actions={
        <Button variant="outline" size="sm" onClick={onEdit} className="w-full">
          Edit
        </Button>
      }
      onClick={onEdit}
    >
      <div className="space-y-2">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-semibold text-base">{supplier.company_name}</h3>
            <p className="text-sm text-muted-foreground">{supplier.contact_person || "—"}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Badge variant={supplier.is_active ? "default" : "secondary"} className="text-xs">
              {supplier.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant={supplier.autocount_synced ? "default" : "outline"} className="text-xs">
              {supplier.autocount_synced ? "Synced" : "Not Synced"}
            </Badge>
          </div>
        </div>
        <MobileDataRow label="Code" value={supplier.supplier_code} />
        <MobileDataRow label="Phone" value={supplier.phone || "—"} />
        <MobileDataRow label="Email" value={supplier.email || "—"} />
        <MobileDataRow 
          label="Created" 
          value={format(new Date(supplier.created_at), "dd/MM/yyyy")} 
        />
      </div>
    </MobileDataCard>
  );
}
