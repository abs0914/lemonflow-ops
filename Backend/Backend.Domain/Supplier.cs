using System;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model for an AutoCount supplier (creditor).
    /// This is the shape the HTTP API exposes before JSON projection.
    /// </summary>
    public class Supplier
    {
        /// <summary>
        /// Unique supplier/creditor code in AutoCount.
        /// </summary>
        public string Code { get; set; }

        /// <summary>
        /// Supplier company name.
        /// </summary>
        public string CompanyName { get; set; }

        /// <summary>
        /// Contact person for the supplier.
        /// </summary>
        public string ContactPerson { get; set; }

        /// <summary>
        /// Primary phone number.
        /// </summary>
        public string Phone { get; set; }

        /// <summary>
        /// Primary email address.
        /// </summary>
        public string Email { get; set; }

        /// <summary>
        /// Combined postal address (flattened from AutoCount address lines).
        /// </summary>
        public string Address { get; set; }

        /// <summary>
        /// Credit terms in days (optional). When 0 or null, treated as "no terms configured".
        /// </summary>
        public int? CreditTerms { get; set; }

        /// <summary>
        /// Indicates if the supplier is active in AutoCount.
        /// </summary>
        public bool IsActive { get; set; }
    }
}

