using System;
using NUnit.Framework;
using Moq;
using Backend.Infrastructure.AutoCount;

namespace Backend.Tests
{
    /// <summary>
    /// Unit tests for AutoCountSupplierService that cover argument validation
    /// and constructor invariants. These tests do not require a live AutoCount
    /// connection and therefore can run in isolation.
    /// </summary>
    [TestFixture]
    public class AutoCountSupplierServiceTests
    {
        private Mock<IAutoCountSessionProvider> _mockSessionProvider;
        private AutoCountSupplierService _service;

        [SetUp]
        public void Setup()
        {
            _mockSessionProvider = new Mock<IAutoCountSessionProvider>();
            _service = new AutoCountSupplierService(_mockSessionProvider.Object);
        }

        [Test]
        public void Constructor_ThrowsWhenSessionProviderIsNull()
        {
            Assert.Throws<ArgumentNullException>(() => new AutoCountSupplierService(null));
        }

        [Test]
        public void GetSupplierByCode_ThrowsWhenCodeIsEmpty()
        {
            Assert.Throws<ArgumentException>(() => _service.GetSupplierByCode(""));
            Assert.Throws<ArgumentException>(() => _service.GetSupplierByCode(null));
        }

        [Test]
        public void SupplierExists_ThrowsWhenCodeIsEmpty()
        {
            Assert.Throws<ArgumentException>(() => _service.SupplierExists(""));
            Assert.Throws<ArgumentException>(() => _service.SupplierExists(null));
        }
    }
}

