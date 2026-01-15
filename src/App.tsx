import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BomManager from "./pages/BomManager";
import Production from "./pages/Production";
import ProductionCreate from "./pages/ProductionCreate";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import Purchasing from "./pages/Purchasing";
import PurchasingCreate from "./pages/PurchasingCreate";
import PurchasingEdit from "./pages/PurchasingEdit";
import PurchaseOrderDetail from "./pages/PurchaseOrderDetail";
import RawMaterials from "./pages/RawMaterials";
import IncomingInventory from "./pages/IncomingInventory";
import CEODashboard from "./pages/CEODashboard";
import Settings from "./pages/Settings";
import StoreOrders from "./pages/StoreOrders";
import StoreOrderCreate from "./pages/StoreOrderCreate";
import StoreOrderQuickEntry from "./pages/StoreOrderQuickEntry";
import StoreOrderDetail from "./pages/StoreOrderDetail";
import StoresManagement from "./pages/StoresManagement";
import StoreAssignmentsManagement from "./pages/StoreAssignmentsManagement";
import FulfillmentDashboard from "./pages/FulfillmentDashboard";
import FulfillmentOrderDetail from "./pages/FulfillmentOrderDetail";
import FinanceDashboard from "./pages/FinanceDashboard";
import FinanceOrderDetail from "./pages/FinanceOrderDetail";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

// Create QueryClient instance outside component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bom" element={<BomManager />} />
            <Route path="/production" element={<Production />} />
            <Route path="/production/create" element={<ProductionCreate />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchasing" element={<Purchasing />} />
            <Route path="/purchasing/create" element={<PurchasingCreate />} />
            <Route path="/purchasing/:id" element={<PurchaseOrderDetail />} />
            <Route path="/purchasing/:id/edit" element={<PurchasingEdit />} />
            <Route path="/raw-materials" element={<RawMaterials />} />
            <Route path="/incoming-inventory" element={<IncomingInventory />} />
            <Route path="/ceo-dashboard" element={<CEODashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/store/orders" element={<StoreOrders />} />
            <Route path="/store/orders/create" element={<StoreOrderCreate />} />
            <Route path="/store/orders/quick-entry" element={<StoreOrderQuickEntry />} />
            <Route path="/store/orders/:id" element={<StoreOrderDetail />} />
            <Route path="/settings/stores" element={<StoresManagement />} />
            <Route path="/settings/store-assignments" element={<StoreAssignmentsManagement />} />
            <Route path="/fulfillment" element={<FulfillmentDashboard />} />
            <Route path="/fulfillment/orders/:id" element={<FulfillmentOrderDetail />} />
            <Route path="/finance" element={<FinanceDashboard />} />
            <Route path="/finance/orders/:id" element={<FinanceOrderDetail />} />
            <Route path="/reports" element={<Reports />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
