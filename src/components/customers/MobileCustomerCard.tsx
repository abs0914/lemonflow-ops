import { Building2, Phone, Mail, Calendar } from "lucide-react";
import { MobileDataCard, MobileDataRow } from "@/components/ui/mobile-data-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Customer } from "@/types/inventory";
import { format } from "date-fns";

interface MobileCustomerCardProps {
  customer: Customer;
  onEdit: () => void;
}

export function MobileCustomerCard({ customer, onEdit }: MobileCustomerCardProps) {
  return (
    <MobileDataCard
      expandableContent={
        customer.address ? (
          <div className="text-sm text-muted-foreground">
            <strong>Address:</strong> {customer.address}
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
            <h3 className="font-semibold text-base">{customer.company_name}</h3>
            <p className="text-sm text-muted-foreground">{customer.contact_person || "—"}</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <Badge variant={customer.is_active ? "default" : "secondary"} className="text-xs">
              {customer.is_active ? "Active" : "Inactive"}
            </Badge>
            <Badge variant={customer.autocount_synced ? "default" : "outline"} className="text-xs">
              {customer.autocount_synced ? "Synced" : "Not Synced"}
            </Badge>
          </div>
        </div>
        <MobileDataRow label="Code" value={customer.customer_code} />
        <MobileDataRow label="Phone" value={customer.phone || "—"} />
        <MobileDataRow label="Email" value={customer.email || "—"} />
        <MobileDataRow 
          label="Created" 
          value={format(new Date(customer.created_at), "dd/MM/yyyy")} 
        />
      </div>
    </MobileDataCard>
  );
}
