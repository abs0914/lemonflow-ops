import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { format } from "date-fns";
import tlcLogo from "@/assets/tlc-logo.png";

interface DeliveryOrderDocumentProps {
  order: {
    id: string;
    order_number: string;
    doc_date: string;
    delivery_date?: string;
    total_amount?: number;
    description?: string;
    debtor_code: string;
    stores?: {
      store_name: string;
      store_code: string;
      address?: string;
      contact_person?: string;
      phone?: string;
    };
  };
  lines: Array<{
    line_number: number;
    item_code: string;
    item_name: string;
    quantity: number;
    unit_price?: number;
    uom?: string;
    sub_total?: number;
  }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryOrderDocument({
  order,
  lines,
  open,
  onOpenChange,
}: DeliveryOrderDocumentProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Delivery Order - ${order.order_number}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                .company-name { font-size: 24px; font-weight: bold; }
                .document-title { font-size: 18px; margin-top: 5px; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                .info-box { padding: 10px; border: 1px solid #ddd; }
                .info-label { font-size: 11px; color: #666; text-transform: uppercase; }
                .info-value { font-size: 14px; font-weight: 500; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f5f5f5; font-size: 12px; }
                .total-row { font-weight: bold; background-color: #f9f9f9; }
                .signature-section { display: flex; justify-content: space-between; margin-top: 40px; }
                .signature-box { width: 45%; }
                .signature-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; text-align: center; }
                .copy-label { text-align: right; font-size: 12px; color: #666; margin-bottom: 10px; }
                @media print { 
                  button { display: none; }
                  .page-break { page-break-after: always; }
                }
              </style>
            </head>
            <body>
              <div class="copy-label">STORE COPY</div>
              ${printContent}
              <div class="page-break"></div>
              <div class="copy-label">WAREHOUSE COPY</div>
              ${printContent}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Delivery Order</span>
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print (2 copies)
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="container">
          <div className="header" style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px", marginBottom: "20px" }}>
            <img src={tlcLogo} alt="The Lemon Co" style={{ height: "60px", marginBottom: "10px" }} />
            <div className="company-name" style={{ fontSize: "24px", fontWeight: "bold" }}>THE LEMON CO</div>
            <div className="document-title" style={{ fontSize: "18px", marginTop: "5px" }}>DELIVERY ORDER</div>
          </div>

          <div className="info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            <div className="info-box" style={{ padding: "10px", border: "1px solid #ddd" }}>
              <div className="info-label" style={{ fontSize: "11px", color: "#666", textTransform: "uppercase" }}>
                Order Number
              </div>
              <div className="info-value" style={{ fontSize: "14px", fontWeight: "500" }}>
                {order.order_number}
              </div>
              <div className="info-label" style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", marginTop: "10px" }}>
                Order Date
              </div>
              <div className="info-value" style={{ fontSize: "14px", fontWeight: "500" }}>
                {format(new Date(order.doc_date), "MMMM dd, yyyy")}
              </div>
              {order.delivery_date && (
                <>
                  <div className="info-label" style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", marginTop: "10px" }}>
                    Delivery Date
                  </div>
                  <div className="info-value" style={{ fontSize: "14px", fontWeight: "500" }}>
                    {format(new Date(order.delivery_date), "MMMM dd, yyyy")}
                  </div>
                </>
              )}
            </div>

            <div className="info-box" style={{ padding: "10px", border: "1px solid #ddd" }}>
              <div className="info-label" style={{ fontSize: "11px", color: "#666", textTransform: "uppercase" }}>
                Deliver To
              </div>
              <div className="info-value" style={{ fontSize: "14px", fontWeight: "500" }}>
                {order.stores?.store_name}
              </div>
              <div style={{ fontSize: "12px", marginTop: "5px" }}>
                {order.stores?.address && <div>{order.stores.address}</div>}
                {order.stores?.contact_person && <div>Contact: {order.stores.contact_person}</div>}
                {order.stores?.phone && <div>Phone: {order.stores.phone}</div>}
              </div>
              <div className="info-label" style={{ fontSize: "11px", color: "#666", textTransform: "uppercase", marginTop: "10px" }}>
                Debtor Code
              </div>
              <div className="info-value" style={{ fontSize: "14px", fontWeight: "500" }}>
                {order.debtor_code}
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: "40px" }}>#</th>
                <th style={{ width: "120px" }}>Item Code</th>
                <th>Description</th>
                <th style={{ width: "60px", textAlign: "center" }}>Qty</th>
                <th style={{ width: "60px", textAlign: "center" }}>UOM</th>
                <th style={{ width: "100px", textAlign: "right" }}>Unit Price</th>
                <th style={{ width: "100px", textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.line_number}>
                  <td>{line.line_number}</td>
                  <td>{line.item_code}</td>
                  <td>{line.item_name}</td>
                  <td style={{ textAlign: "center" }}>{line.quantity}</td>
                  <td style={{ textAlign: "center" }}>{line.uom}</td>
                  <td style={{ textAlign: "right" }}>
                    ₱{(line.unit_price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    ₱{(line.sub_total || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="total-row" style={{ fontWeight: "bold", backgroundColor: "#f9f9f9" }}>
                <td colSpan={6} style={{ textAlign: "right" }}>Total Amount</td>
                <td style={{ textAlign: "right" }}>
                  ₱{(order.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {order.description && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>Remarks:</div>
              <div style={{ fontSize: "14px" }}>{order.description}</div>
            </div>
          )}

          <div className="signature-section" style={{ display: "flex", justifyContent: "space-between", marginTop: "40px" }}>
            <div className="signature-box" style={{ width: "45%" }}>
              <div className="signature-line" style={{ borderTop: "1px solid #000", marginTop: "40px", paddingTop: "5px", textAlign: "center" }}>
                Prepared By
              </div>
            </div>
            <div className="signature-box" style={{ width: "45%" }}>
              <div className="signature-line" style={{ borderTop: "1px solid #000", marginTop: "40px", paddingTop: "5px", textAlign: "center" }}>
                Received By (Store)
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
