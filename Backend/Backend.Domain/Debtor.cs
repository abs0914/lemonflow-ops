using System;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model for a Debtor (Customer) in AutoCount Accounting.
    /// This represents the HTTP API model, separate from AutoCount's internal entities.
    /// </summary>
    public class Debtor
    {
        /// <summary>
        /// Unique debtor code in AutoCount.
        /// </summary>
        public string Code { get; set; }

        /// <summary>
        /// Debtor name.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Contact person name.
        /// </summary>
        public string ContactPerson { get; set; }

        /// <summary>
        /// Email address.
        /// </summary>
        public string Email { get; set; }

        /// <summary>
        /// Phone number.
        /// </summary>
        public string Phone { get; set; }

        /// <summary>
        /// Address line 1.
        /// </summary>
        public string Address1 { get; set; }

        /// <summary>
        /// Address line 2.
        /// </summary>
        public string Address2 { get; set; }

        /// <summary>
        /// City.
        /// </summary>
        public string City { get; set; }

        /// <summary>
        /// State/Province.
        /// </summary>
        public string State { get; set; }

        /// <summary>
        /// Postal code.
        /// </summary>
        public string PostalCode { get; set; }

        /// <summary>
        /// Country.
        /// </summary>
        public string Country { get; set; }

        /// <summary>
        /// Tax registration number (e.g., GST/VAT ID).
        /// </summary>
        public string TaxRegistrationNumber { get; set; }

        /// <summary>
        /// Credit limit.
        /// </summary>
        public decimal CreditLimit { get; set; }

        /// <summary>
        /// Payment terms (e.g., "Net 30").
        /// </summary>
        public string PaymentTerms { get; set; }

        /// <summary>
        /// Currency code (e.g., "USD", "MYR").
        /// </summary>
        public string CurrencyCode { get; set; }

        /// <summary>
        /// Indicates if the debtor is active.
        /// </summary>
        public bool IsActive { get; set; }

        /// <summary>
        /// Remarks or notes.
        /// </summary>
        public string Remarks { get; set; }

        /// <summary>
        /// Date created.
        /// </summary>
        public DateTime CreatedDate { get; set; }

        /// <summary>
        /// Date last modified.
        /// </summary>
        public DateTime ModifiedDate { get; set; }
    }
}

