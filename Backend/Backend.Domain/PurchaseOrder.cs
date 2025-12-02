using System;
using System.Collections.Generic;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model representing a purchase order header. This aligns
    /// with the payload constructed by the Supabase sync-po-create
    /// function (DocNo, SupplierCode, DocDate, DeliveryDate, etc.).
    /// </summary>
    public class PurchaseOrder
    {
        public string DocNo { get; set; }

        public string SupplierCode { get; set; }

        public DateTime DocDate { get; set; }

        public DateTime? DeliveryDate { get; set; }

        public string Description { get; set; }

        public bool IsCancelled { get; set; }

        public List<PurchaseOrderLine> Details { get; set; }
    }

    /// <summary>
    /// Domain model for an individual purchase order line.
    /// </summary>
    public class PurchaseOrderLine
    {
        public int LineNumber { get; set; }

        public string ItemCode { get; set; }

        public string Description { get; set; }

        public decimal Quantity { get; set; }

        public decimal UnitPrice { get; set; }

        public string UOM { get; set; }

        public string LineRemarks { get; set; }
    }
}
