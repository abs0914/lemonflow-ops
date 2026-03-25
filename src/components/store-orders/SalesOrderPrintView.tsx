import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/currency";
import { dateFormatters } from "@/lib/datetime";
import tlcLogo from "@/assets/tlc-logo.png";

interface SalesOrderPrintViewProps {
  order: any;
  lines: any[];
  mode: "print" | "download";
  onClose: () => void;
}

export function SalesOrderPrintView({ order, lines, mode, onClose }: SalesOrderPrintViewProps) {
  const [ready, setReady] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (mode === "print") {
      const timer = setTimeout(() => {
        window.print();
      }, 200);

      const handleAfterPrint = () => onClose();
      window.addEventListener("afterprint", handleAfterPrint);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }

    if (mode === "download") {
      const timer = setTimeout(async () => {
        try {
          const el = contentRef.current;
          if (!el) return;

          // Temporarily make the portal visible for capture
          const portal = document.getElementById("so-print-portal");
          if (portal) {
            portal.style.display = "block";
            portal.style.position = "absolute";
            portal.style.left = "-9999px";
            portal.style.top = "0";
          }

          const html2canvas = (await import("html2canvas")).default;
          const { jsPDF } = await import("jspdf");

          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          });

          const imgData = canvas.toDataURL("image/png");
          const pdf = new jsPDF("p", "mm", "a4");
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = pdfWidth - 20; // 10mm margin each side
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 10; // top margin

          pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
          heightLeft -= (pdfHeight - 20);

          while (heightLeft > 0) {
            position = -(pdfHeight - 20) + 10;
            pdf.addPage();
            pdf.addImage(imgData, "PNG", 10, position + (pdfHeight - 20) - imgHeight + heightLeft, imgWidth, imgHeight);
            heightLeft -= (pdfHeight - 20);
          }

          pdf.save(`${order.order_number}.pdf`);
        } catch (error) {
          console.error("PDF generation failed:", error);
        } finally {
          onClose();
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [ready, mode, onClose, order.order_number]);

  const totalAmount = order.total_amount || 0;
  const deliveryFee = order.delivery_fee || 0;
  const shippingFee = order.shipping_fee || 0;
  const grandTotal = totalAmount + deliveryFee + shippingFee;

  const content = (
    <>
      <style>{`
        @media print {
          body > *:not(#so-print-portal) {
            display: none !important;
          }
          #so-print-portal {
            display: block !important;
            position: static !important;
          }
          @page {
            margin: 15mm;
            size: A4;
          }
        }
        @media screen {
          #so-print-portal {
            display: none;
          }
        }
      `}</style>

      <div ref={contentRef} style={{ padding: "2rem", backgroundColor: "#ffffff", width: "210mm", fontFamily: "Arial, sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem", borderBottom: "2px solid #1f2937", paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <img src={tlcLogo} alt="The Lemon Co" style={{ height: "4rem", width: "auto" }} />
            <div>
              <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", margin: 0 }}>SALES ORDER</h1>
              <p style={{ fontSize: "0.875rem", color: "#4b5563", marginTop: "0.25rem" }}>
                {order.stores?.store_name}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "1.125rem", fontWeight: "600" }}>SO #: {order.order_number}</p>
            <p style={{ fontSize: "0.875rem", color: "#4b5563" }}>Order Date: {dateFormatters.medium(order.doc_date)}</p>
            {order.delivery_date && (
              <p style={{ fontSize: "0.875rem", color: "#4b5563" }}>Delivery: {dateFormatters.medium(order.delivery_date)}</p>
            )}
          </div>
        </div>

        {/* Order Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.875rem" }}>
              <strong>Status:</strong> <span style={{ textTransform: "uppercase" }}>{order.status}</span>
            </p>
            <p style={{ fontSize: "0.875rem" }}>
              <strong>Debtor Code:</strong> {order.debtor_code}
            </p>
          </div>
          <div>
            {order.autocount_doc_no && (
              <p style={{ fontSize: "0.875rem" }}>
                <strong>AutoCount Doc:</strong> {order.autocount_doc_no}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {order.description && (
          <div style={{ marginBottom: "1.5rem" }}>
            <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Description:</h3>
            <p style={{ fontSize: "0.875rem", color: "#374151", whiteSpace: "pre-wrap" }}>{order.description}</p>
          </div>
        )}

        {/* Line Items Table */}
        <div style={{ marginBottom: "1.5rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #1f2937" }}>
                <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.875rem" }}>#</th>
                <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.875rem" }}>Item Code</th>
                <th style={{ textAlign: "left", padding: "0.5rem", fontSize: "0.875rem" }}>Item Name</th>
                <th style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.875rem" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.875rem" }}>Unit Price</th>
                <th style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.875rem" }}>UOM</th>
                <th style={{ textAlign: "right", padding: "0.5rem", fontSize: "0.875rem" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={line.id} style={{ borderBottom: "1px solid #d1d5db" }}>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>{index + 1}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem", fontFamily: "monospace" }}>{line.item_code}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>{line.item_name}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem", textAlign: "right" }}>{line.quantity}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem", textAlign: "right" }}>{formatCurrency(line.unit_price || 0)}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem", textAlign: "center" }}>{line.uom || "-"}</td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem", textAlign: "right", fontWeight: "600" }}>
                    {formatCurrency(line.sub_total || (line.quantity * (line.unit_price || 0)))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #1f2937" }}>
                <td colSpan={6} style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600", fontSize: "0.875rem" }}>
                  Order Total:
                </td>
                <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: "600", fontSize: "0.875rem" }}>
                  {formatCurrency(totalAmount)}
                </td>
              </tr>
              {deliveryFee > 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "0.25rem 0.5rem", textAlign: "right", fontSize: "0.875rem" }}>
                    Delivery Fee:
                  </td>
                  <td style={{ padding: "0.25rem 0.5rem", textAlign: "right", fontSize: "0.875rem" }}>
                    {formatCurrency(deliveryFee)}
                  </td>
                </tr>
              )}
              {shippingFee > 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "0.25rem 0.5rem", textAlign: "right", fontSize: "0.875rem" }}>
                    Shipping Fee:
                  </td>
                  <td style={{ padding: "0.25rem 0.5rem", textAlign: "right", fontSize: "0.875rem" }}>
                    {formatCurrency(shippingFee)}
                  </td>
                </tr>
              )}
              {(deliveryFee > 0 || shippingFee > 0) && (
                <tr style={{ borderTop: "1px solid #1f2937" }}>
                  <td colSpan={6} style={{ padding: "0.75rem 0.5rem", textAlign: "right", fontWeight: "bold", fontSize: "1.125rem" }}>
                    GRAND TOTAL:
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", fontWeight: "bold", fontSize: "1.125rem" }}>
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.75rem", color: "#6b7280" }}>
          <p>This is a computer-generated document.</p>
          <p style={{ marginTop: "0.25rem" }}>Generated on: {dateFormatters.medium(new Date().toISOString())}</p>
        </div>
      </div>
    </>
  );

  const portalTarget = (() => {
    let el = document.getElementById("so-print-portal");
    if (!el) {
      el = document.createElement("div");
      el.id = "so-print-portal";
      document.body.appendChild(el);
    }
    return el;
  })();

  return createPortal(content, portalTarget);
}
