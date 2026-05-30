import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { formatCurrency } from "@/lib/currency";
import { dateFormatters } from "@/lib/datetime";
import { supabase } from "@/integrations/supabase/client";
import tlcLogo from "@/assets/tlc-logo.png";

interface POPrintViewProps {
  purchaseOrder: any;
  lines: any[];
  onClose: () => void;
}

async function resolveSignatureUrl(signatureUrl: string | null | undefined): Promise<string | null> {
  if (!signatureUrl) return null;
  let path = signatureUrl;
  const marker = "/user-signatures/";
  const idx = signatureUrl.indexOf(marker);
  if (idx !== -1) path = signatureUrl.substring(idx + marker.length);
  const { data } = await supabase.storage.from("user-signatures").createSignedUrl(path, 600);
  return data?.signedUrl || null;
}

export function POPrintView({ purchaseOrder, lines, onClose }: POPrintViewProps) {
  const [ready, setReady] = useState(false);
  const [urlsResolved, setUrlsResolved] = useState(false);
  const [preparedSigUrl, setPreparedSigUrl] = useState<string | null>(null);
  const [approvedSigUrl, setApprovedSigUrl] = useState<string | null>(null);
  const [verifiedSigUrl, setVerifiedSigUrl] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      resolveSignatureUrl(purchaseOrder.user_profiles?.signature_url),
      resolveSignatureUrl(purchaseOrder.approved_by_profile?.signature_url),
      resolveSignatureUrl(purchaseOrder.verified_by_profile?.signature_url),
    ]).then(([p, a, v]) => {
      setPreparedSigUrl(p);
      setApprovedSigUrl(a);
      setVerifiedSigUrl(v);
      setUrlsResolved(true);
    }).catch(() => setUrlsResolved(true));
  }, [purchaseOrder]);

  // Wait for signature images to load, then print
  useEffect(() => {
    if (!urlsResolved) return;

    const imageUrls = [preparedSigUrl, approvedSigUrl, verifiedSigUrl].filter(Boolean) as string[];

    if (imageUrls.length === 0) {
      setReady(true);
      return;
    }

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded >= imageUrls.length) setReady(true);
    };

    imageUrls.forEach(url => {
      const img = new Image();
      img.onload = onLoad;
      img.onerror = onLoad; // Don't block print on error
      img.src = url;
    });

    // Fallback timeout in case images never load
    const timeout = setTimeout(() => setReady(true), 3000);
    return () => clearTimeout(timeout);
  }, [urlsResolved, preparedSigUrl, approvedSigUrl, verifiedSigUrl]);

  useEffect(() => {
    if (!ready) return;

    const timer = setTimeout(() => {
      window.print();
    }, 200);

    const handleAfterPrint = () => onClose();
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [ready, onClose]);

  const totalAmount = lines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);

  const content = (
    <>
      <style>{`
        @media print {
          body > *:not(#po-print-portal) {
            display: none !important;
          }
          #po-print-portal {
            display: block !important;
            position: static !important;
          }
          .po-print-container {
            position: relative;
            width: 100%;
          }
          .po-page-break {
            page-break-after: always;
            break-after: page;
          }
          @page {
            margin: 15mm;
            size: A4;
          }
        }
        @media screen {
          #po-print-portal {
            display: none;
          }
        }
      `}</style>

      {/* Print 2 copies */}
      {[1, 2].map((copyNumber) => (
        <div key={copyNumber} className={`po-print-container ${copyNumber === 1 ? 'po-page-break' : ''}`}>
          <div style={{ padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '2px solid #1f2937', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img src={tlcLogo} alt="The Lemon Co" style={{ height: '4rem', width: 'auto' }} />
                <div>
                  <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', margin: 0 }}>PURCHASE ORDER</h1>
                  <p style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.25rem' }}>
                    Copy {copyNumber} of 2 — {copyNumber === 1 ? 'CEO Copy' : 'Accounting Copy'}
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '1.125rem', fontWeight: '600' }}>PO #: {purchaseOrder.po_number}</p>
                <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>Date: {dateFormatters.medium(purchaseOrder.doc_date)}</p>
                {purchaseOrder.is_cash_purchase && (
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ea580c', marginTop: '0.25rem' }}>CASH PURCHASE</p>
                )}
              </div>
            </div>

            {/* Supplier Info */}
            <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
              <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Supplier Information:</h3>
              <p style={{ fontSize: '0.875rem' }}><strong>Company:</strong> {purchaseOrder.suppliers?.company_name}</p>
              <p style={{ fontSize: '0.875rem' }}><strong>Code:</strong> {purchaseOrder.suppliers?.supplier_code}</p>
              {purchaseOrder.suppliers?.address && (
                <p style={{ fontSize: '0.875rem' }}><strong>Address:</strong> {purchaseOrder.suppliers?.address}</p>
              )}
            </div>

            {/* PO Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem' }}>
                  <strong>Delivery Date:</strong>{' '}
                  {purchaseOrder.delivery_date ? dateFormatters.medium(purchaseOrder.delivery_date) : 'Not specified'}
                </p>
                <p style={{ fontSize: '0.875rem' }}>
                  <strong>Status:</strong> <span style={{ textTransform: 'uppercase' }}>{purchaseOrder.status}</span>
                </p>
              </div>
              <div>
                {purchaseOrder.approved_by && (
                  <>
                    <p style={{ fontSize: '0.875rem' }}><strong>Approved By:</strong> CEO</p>
                    <p style={{ fontSize: '0.875rem' }}><strong>Approved On:</strong> {dateFormatters.medium(purchaseOrder.approved_at)}</p>
                  </>
                )}
              </div>
            </div>

            {/* Cash Purchase Details */}
            {purchaseOrder.is_cash_purchase && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '2px solid #f97316', borderRadius: '0.375rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#ea580c' }}>Cash Purchase Details:</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <p><strong>Cash Advance:</strong> {formatCurrency(purchaseOrder.cash_advance || 0)}</p>
                  {purchaseOrder.cash_returned > 0 && (
                    <p><strong>Cash Returned:</strong> {formatCurrency(purchaseOrder.cash_returned)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1f2937' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.875rem' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.875rem' }}>Item Description</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.875rem' }}>SKU</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.875rem' }}>Qty</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.875rem' }}>Unit Price</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem', fontSize: '0.875rem' }}>UOM</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.875rem' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const item = line.item_type === 'raw_material' ? line.raw_materials : line.components;
                    return (
                      <tr key={line.id} style={{ borderBottom: '1px solid #d1d5db' }}>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{index + 1}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem' }}>{item?.name}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>{item?.sku}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem', textAlign: 'right' }}>{line.quantity}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem', textAlign: 'right' }}>{formatCurrency(line.unit_price)}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem', textAlign: 'center' }}>{line.uom}</td>
                        <td style={{ padding: '0.5rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: '600' }}>
                          {formatCurrency(line.quantity * line.unit_price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #1f2937' }}>
                    <td colSpan={6} style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.125rem' }}>
                      TOTAL AMOUNT:
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', fontSize: '1.125rem' }}>
                      {formatCurrency(totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Remarks */}
            {purchaseOrder.remarks && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Remarks:</h3>
                <p style={{ fontSize: '0.875rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{purchaseOrder.remarks}</p>
              </div>
            )}

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #9ca3af' }}>
              <div>
                <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', textAlign: 'center' }}>Prepared By</p>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.25rem' }}>
                    {preparedSigUrl && (
                      <img src={preparedSigUrl} alt="Preparer signature" style={{ height: '3rem', width: 'auto', maxWidth: '6rem', objectFit: 'contain' }} />
                    )}
                    <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#4b5563', marginTop: '0.25rem' }}>
                      {purchaseOrder.user_profiles?.full_name}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', textAlign: 'center' }}>Approved By (CEO)</p>
                  {purchaseOrder.approved_at ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.25rem' }}>
                      {approvedSigUrl && (
                        <img src={approvedSigUrl} alt="Approver signature" style={{ height: '3rem', width: 'auto', maxWidth: '6rem', objectFit: 'contain' }} />
                      )}
                      <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#4b5563', marginTop: '0.25rem' }}>
                        {purchaseOrder.approved_by_profile?.full_name}
                      </p>
                      <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#4b5563', marginTop: '0.25rem' }}>
                        {dateFormatters.medium(purchaseOrder.approved_at)}
                      </p>
                    </div>
                  ) : (
                    <div style={{ borderBottom: '1px solid #9ca3af', width: '100%', height: '3rem', marginTop: '0.5rem' }} />
                  )}
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #9ca3af', paddingTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.875rem', textAlign: 'center' }}>Received By</p>
                  {purchaseOrder.verified_at ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '0.25rem' }}>
                      {verifiedSigUrl && (
                        <img src={verifiedSigUrl} alt="Verifier signature" style={{ height: '3rem', width: 'auto', maxWidth: '6rem', objectFit: 'contain' }} />
                      )}
                      <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#4b5563', marginTop: '0.25rem' }}>
                        {purchaseOrder.verified_by_profile?.full_name}
                      </p>
                      <p style={{ fontSize: '0.75rem', textAlign: 'center', color: '#4b5563', marginTop: '0.25rem' }}>
                        {dateFormatters.medium(purchaseOrder.verified_at)}
                      </p>
                    </div>
                  ) : (
                    <div style={{ borderBottom: '1px solid #9ca3af', width: '100%', height: '3rem', marginTop: '0.5rem' }} />
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#6b7280' }}>
              <p>This is a computer-generated document. No signature is required.</p>
              <p style={{ marginTop: '0.25rem' }}>Generated on: {dateFormatters.medium(new Date().toISOString())}</p>
            </div>
          </div>
        </div>
      ))}
    </>
  );

  // Render into a direct child of body via portal to avoid being hidden by parent CSS
  const portalTarget = (() => {
    let el = document.getElementById('po-print-portal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'po-print-portal';
      document.body.appendChild(el);
    }
    return el;
  })();

  return createPortal(content, portalTarget);
}
