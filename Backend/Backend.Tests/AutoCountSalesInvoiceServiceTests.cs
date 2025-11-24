using System;
using System.Collections.Generic;
using NUnit.Framework;
using Moq;
using Backend.Domain;
using Backend.Infrastructure.AutoCount;

namespace Backend.Tests
{
    /// <summary>
    /// Unit tests for AutoCountSalesInvoiceService.
    /// Tests the sales invoice service logic without requiring actual AutoCount connection.
    /// </summary>
    [TestFixture]
    public class AutoCountSalesInvoiceServiceTests
    {
        private Mock<IAutoCountSessionProvider> _mockSessionProvider;
        private AutoCountSalesInvoiceService _service;

        [SetUp]
        public void Setup()
        {
            _mockSessionProvider = new Mock<IAutoCountSessionProvider>();
            _service = new AutoCountSalesInvoiceService(_mockSessionProvider.Object);
        }

        [Test]
        public void Constructor_ThrowsWhenSessionProviderIsNull()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentNullException>(() => new AutoCountSalesInvoiceService(null));
        }

        [Test]
        public void GetSalesInvoiceByDocumentNo_ThrowsWhenDocumentNoIsEmpty()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentException>(() => _service.GetSalesInvoiceByDocumentNo(""));
            Assert.Throws<ArgumentException>(() => _service.GetSalesInvoiceByDocumentNo(null));
        }

        [Test]
        public void CreateSalesInvoice_ThrowsWhenInvoiceIsNull()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentNullException>(() => _service.CreateSalesInvoice(null));
        }

        [Test]
        public void CreateSalesInvoice_ThrowsWhenDebtorCodeIsEmpty()
        {
            // Arrange
            var invoice = new SalesInvoice
            {
                Lines = new List<SalesInvoiceLine> { new SalesInvoiceLine() }
            };

            // Act, Assert
            Assert.Throws<ArgumentException>(() => _service.CreateSalesInvoice(invoice));
        }

        [Test]
        public void CreateSalesInvoice_ThrowsWhenNoLineItems()
        {
            // Arrange
            var invoice = new SalesInvoice
            {
                DebtorCode = "CUST001",
                Lines = new List<SalesInvoiceLine>()
            };

            // Act, Assert
            Assert.Throws<ArgumentException>(() => _service.CreateSalesInvoice(invoice));
        }

        [Test]
        public void UpdateSalesInvoice_ThrowsWhenInvoiceIsNull()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentNullException>(() => _service.UpdateSalesInvoice(null));
        }

        [Test]
        public void UpdateSalesInvoice_ThrowsWhenDocumentNoIsEmpty()
        {
            // Arrange
            var invoice = new SalesInvoice { DebtorCode = "CUST001" };

            // Act, Assert
            Assert.Throws<ArgumentException>(() => _service.UpdateSalesInvoice(invoice));
        }

        [Test]
        public void PostSalesInvoice_ThrowsWhenDocumentNoIsEmpty()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentException>(() => _service.PostSalesInvoice(""));
            Assert.Throws<ArgumentException>(() => _service.PostSalesInvoice(null));
        }

        [Test]
        public void SalesInvoiceExists_ThrowsWhenDocumentNoIsEmpty()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentException>(() => _service.SalesInvoiceExists(""));
            Assert.Throws<ArgumentException>(() => _service.SalesInvoiceExists(null));
        }

        [Test]
        public void GetTaxRate_ThrowsWhenTaxCodeIsEmpty()
        {
            // Arrange, Act, Assert
            Assert.Throws<ArgumentException>(() => _service.GetTaxRate(""));
            Assert.Throws<ArgumentException>(() => _service.GetTaxRate(null));
        }

        [Test]
        public void SalesInvoiceExists_ReturnsFalseWhenInvoiceNotFound()
        {
            // Arrange
            _mockSessionProvider.Setup(x => x.GetUserSession()).Returns(new object());

            // Act
            var exists = _service.SalesInvoiceExists("INV-NONEXISTENT");

            // Assert
            Assert.IsFalse(exists);
        }
    }
}

