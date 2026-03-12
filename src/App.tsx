// App entry
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
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

import InboundLeadsPage from "./pages/InboundLeadsPage";
import WebhookManagementPage from "./pages/WebhookManagementPage";
import SearchPredictionPage from "./pages/SearchPredictionPage";
import ManagementInsightsPage from "./pages/ManagementInsightsPage";
import OperationsPage from "./pages/OperationsPage";
import LeadDistributionPage from "./pages/LeadDistributionPage";
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
          <PermissionsProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute moduleKey="dashboard"><Dashboard /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute moduleKey="orders"><Orders /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute moduleKey="users"><UsersPage /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute moduleKey="products"><ProductsPage /></ProtectedRoute>} />
              <Route path="/assigned" element={<ProtectedRoute moduleKey="assigned"><AssignedPage /></ProtectedRoute>} />
              <Route path="/assigner" element={<ProtectedRoute moduleKey="assigner"><AssignerPage /></ProtectedRoute>} />
              <Route path="/predictions" element={<ProtectedRoute moduleKey="prediction_lists"><PredictionListsPage /></ProtectedRoute>} />
              <Route path="/predictions/:id" element={<ProtectedRoute moduleKey="prediction_lists"><PredictionListDetail /></ProtectedRoute>} />
              <Route path="/prediction-leads" element={<ProtectedRoute moduleKey="prediction_leads"><PredictionLeadsPage /></ProtectedRoute>} />
              <Route path="/performance" element={<ProtectedRoute moduleKey="performance"><AgentPerformancePage /></ProtectedRoute>} />
              <Route path="/shifts" element={<ProtectedRoute moduleKey="shifts"><ShiftsManagementPage /></ProtectedRoute>} />
              <Route path="/my-shifts" element={<ProtectedRoute moduleKey="my_shifts"><MyShiftsPage /></ProtectedRoute>} />
              <Route path="/call-scripts" element={<ProtectedRoute moduleKey="call_scripts"><CallScriptsPage /></ProtectedRoute>} />
              <Route path="/call-history" element={<ProtectedRoute moduleKey="call_history"><CallHistoryPage /></ProtectedRoute>} />
              <Route path="/warehouse" element={<ProtectedRoute moduleKey="warehouse"><WarehousePage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute moduleKey="settings"><SettingsPage /></ProtectedRoute>} />
              <Route path="/ads" element={<Navigate to="/webhooks" replace />} />
              <Route path="/inbound-leads" element={<ProtectedRoute moduleKey="inbound_leads"><InboundLeadsPage /></ProtectedRoute>} />
              <Route path="/webhooks" element={<ProtectedRoute moduleKey="webhooks"><WebhookManagementPage /></ProtectedRoute>} />
              <Route path="/search-prediction" element={<ProtectedRoute moduleKey="search_prediction"><SearchPredictionPage /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute moduleKey="insights"><ManagementInsightsPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PermissionsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
