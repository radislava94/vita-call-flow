import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import UsersPage from "./pages/UsersPage";
import ProductsPage from "./pages/ProductsPage";
import AssignedPage from "./pages/AssignedPage";
import AssignerPage from "./pages/AssignerPage";
import PredictionListsPage from "./pages/PredictionListsPage";
import PredictionListDetail from "./pages/PredictionListDetail";
import PredictionLeadsPage from "./pages/PredictionLeadsPage";
import AgentPerformancePage from "./pages/AgentPerformancePage";
import ShiftsManagementPage from "./pages/ShiftsManagementPage";
import MyShiftsPage from "./pages/MyShiftsPage";
import CallScriptsPage from "./pages/CallScriptsPage";
import CallHistoryPage from "./pages/CallHistoryPage";
import WarehousePage from "./pages/WarehousePage";
import SettingsPage from "./pages/SettingsPage";
import AdsPanelPage from "./pages/AdsPanelPage";
import InboundLeadsPage from "./pages/InboundLeadsPage";
import WebhookManagementPage from "./pages/WebhookManagementPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Dashboard /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent']}><OrderDetails /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><UsersPage /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/assigned" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent']}><AssignedPage /></ProtectedRoute>} />
            <Route path="/assigner" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><AssignerPage /></ProtectedRoute>} />
            <Route path="/predictions" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><PredictionListsPage /></ProtectedRoute>} />
            <Route path="/predictions/:id" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><PredictionListDetail /></ProtectedRoute>} />
            <Route path="/prediction-leads" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'prediction_agent']}><PredictionLeadsPage /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent']}><AgentPerformancePage /></ProtectedRoute>} />
            <Route path="/shifts" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><ShiftsManagementPage /></ProtectedRoute>} />
            <Route path="/my-shifts" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent']}><MyShiftsPage /></ProtectedRoute>} />
            <Route path="/call-scripts" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent']}><CallScriptsPage /></ProtectedRoute>} />
            <Route path="/call-history" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'pending_agent', 'prediction_agent', 'agent']}><CallHistoryPage /></ProtectedRoute>} />
            <Route path="/warehouse" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'warehouse']}><WarehousePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/ads" element={<ProtectedRoute allowedRoles={['admin', 'ads_admin']}><AdsPanelPage /></ProtectedRoute>} />
            <Route path="/inbound-leads" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><InboundLeadsPage /></ProtectedRoute>} />
            <Route path="/webhooks" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><WebhookManagementPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
