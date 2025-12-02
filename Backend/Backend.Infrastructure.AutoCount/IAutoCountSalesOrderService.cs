using System.Collections.Generic;
using Backend.Domain;

namespace Backend.Infrastructure.AutoCount
{
    /// <summary>
    /// Service interface for Sales Order operations in AutoCount.
    /// 
    /// Sales Orders are used for Franchisee/Own Store orders from central inventory.
    /// Per AutoCount 2.2 API documentation:
    /// https://wiki.autocountsoft.com/wiki/Programmer:Sales_Order_v2
    /// 
    /// This service uses AutoCount.Invoicing.Sales.SalesOrder.SalesOrderCommand
    /// to create, retrieve, and manage Sales Order documents.
    /// </summary>
    public interface IAutoCountSalesOrderService
    {
        /// <summary>
        /// Retrieves a list of all sales orders.
        /// </summary>
        /// <param name="limit">Optional limit on number of records to return.</param>
        /// <returns>List of sales orders.</returns>
        List<SalesOrder> GetSalesOrders(int? limit = null);

        /// <summary>
        /// Retrieves a specific sales order by document number.
        /// </summary>
        /// <param name="docNo">The document number.</param>
        /// <returns>The sales order with line details, or null if not found.</returns>
        SalesOrder GetSalesOrderByDocNo(string docNo);

        /// <summary>
        /// Creates a new sales order in AutoCount.
        /// </summary>
        /// <param name="salesOrder">The sales order to create.</param>
        /// <returns>The created sales order with auto-generated document number.</returns>
        SalesOrder CreateSalesOrder(SalesOrder salesOrder);

        /// <summary>
        /// Cancels an existing sales order in AutoCount.
        /// </summary>
        /// <param name="docNo">The document number of the order to cancel.</param>
        /// <returns>True if cancelled successfully, false otherwise.</returns>
        bool CancelSalesOrder(string docNo);

        /// <summary>
        /// Checks if a sales order exists.
        /// </summary>
        /// <param name="docNo">The document number.</param>
        /// <returns>True if the order exists, false otherwise.</returns>
        bool SalesOrderExists(string docNo);
    }
}

