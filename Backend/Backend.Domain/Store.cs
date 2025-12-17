using System;

namespace Backend.Domain
{
    /// <summary>
    /// Domain model representing a Store location.
    /// Stores are mapped from AutoCount Debtors with specific attributes
    /// to distinguish between owned stores and franchise locations.
    /// </summary>
    public class Store
    {
        /// <summary>
        /// Unique store code (maps to AutoCount Debtor code).
        /// </summary>
        public string Code { get; set; }

        /// <summary>
        /// Store display name.
        /// </summary>
        public string Name { get; set; }

        /// <summary>
        /// Store type: "own" for company-owned stores, "franchise" for franchise locations.
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// Store address.
        /// </summary>
        public string Address { get; set; }

        /// <summary>
        /// City/Municipality.
        /// </summary>
        public string City { get; set; }

        /// <summary>
        /// Contact phone number.
        /// </summary>
        public string Phone { get; set; }

        /// <summary>
        /// Contact email address.
        /// </summary>
        public string Email { get; set; }

        /// <summary>
        /// Whether the store is currently active.
        /// </summary>
        public bool IsActive { get; set; }

        /// <summary>
        /// Optional region/area grouping for reporting.
        /// </summary>
        public string Region { get; set; }

        /// <summary>
        /// Date when the store was opened/registered.
        /// </summary>
        public DateTime? OpenedDate { get; set; }
    }
}

