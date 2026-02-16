import { supabase } from '@/integrations/supabase/client';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api`;

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const headers = await getHeaders();
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

// Auth
export const apiGetMe = () => apiFetch('me');

// Users
export const apiGetUsers = () => apiFetch('users');
export const apiGetAgents = () => apiFetch('users/agents');
export const apiCreateUser = (body: { email: string; password: string; full_name: string; role: string }) =>
  apiFetch('users/create', { method: 'POST', body: JSON.stringify(body) });
export const apiToggleUserActive = (userId: string) =>
  apiFetch(`users/${userId}/toggle-active`, { method: 'POST' });
export const apiUpdateUserRole = (userId: string, role: string) =>
  apiFetch(`users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
export const apiSetUserRoles = (userId: string, roles: string[]) =>
  apiFetch(`users/${userId}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) });
export const apiDeleteUser = (userId: string) =>
  apiFetch(`users/${userId}`, { method: 'DELETE' });

// Orders
export const apiGetOrders = (params?: { status?: string; search?: string; page?: number; limit?: number }) => {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.search) sp.set('search', params.search);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  return apiFetch(`orders?${sp.toString()}`);
};
export const apiGetOrder = (id: string) => apiFetch(`orders/${id}`);
export const apiCreateOrder = (body: any) =>
  apiFetch('orders', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateCustomer = (orderId: string, body: any) =>
  apiFetch(`orders/${orderId}/customer`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiUpdateOrderStatus = (orderId: string, status: string) =>
  apiFetch(`orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const apiAssignOrder = (orderId: string, agentId: string) =>
  apiFetch(`orders/${orderId}/assign`, { method: 'POST', body: JSON.stringify({ agent_id: agentId }) });
export const apiAddOrderNote = (orderId: string, text: string) =>
  apiFetch(`orders/${orderId}/notes`, { method: 'POST', body: JSON.stringify({ text }) });
export const apiGetOrderStats = (from?: string, to?: string) => {
  const sp = new URLSearchParams();
  if (from) sp.set('from', from);
  if (to) sp.set('to', to);
  return apiFetch(`orders/stats?${sp.toString()}`);
};
export const apiGetDashboardStats = (params?: { period?: string; agent_id?: string }) => {
  const sp = new URLSearchParams();
  if (params?.period) sp.set('period', params.period);
  if (params?.agent_id) sp.set('agent_id', params.agent_id);
  return apiFetch(`dashboard-stats?${sp.toString()}`);
};

// Products
export const apiGetProducts = () => apiFetch('products');
export const apiCreateProduct = (body: any) =>
  apiFetch('products', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateProduct = (id: string, body: any) =>
  apiFetch(`products/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiGetInventoryLogs = (productId: string) =>
  apiFetch(`products/${productId}/inventory-logs`);

// Suppliers
export const apiGetSuppliers = () => apiFetch('suppliers');
export const apiCreateSupplier = (body: { name: string; contact_info?: string; email?: string; phone?: string; address?: string }) =>
  apiFetch('suppliers', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateSupplier = (id: string, body: any) =>
  apiFetch(`suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteSupplier = (id: string) =>
  apiFetch(`suppliers/${id}`, { method: 'DELETE' });

// Restock & Stock Movements
export const apiRestock = (body: { product_id: string; quantity: number; supplier_name?: string; invoice_number?: string; notes?: string }) =>
  apiFetch('restock', { method: 'POST', body: JSON.stringify(body) });
export const apiGetStockMovements = (params?: { product_id?: string; movement_type?: string; limit?: number }) => {
  const sp = new URLSearchParams();
  if (params?.product_id) sp.set('product_id', params.product_id);
  if (params?.movement_type) sp.set('movement_type', params.movement_type);
  if (params?.limit) sp.set('limit', String(params.limit));
  return apiFetch(`stock-movements?${sp.toString()}`);
};

// Prediction Lists
export const apiGetPredictionLists = () => apiFetch('prediction-lists');
export const apiGetPredictionList = (id: string) => apiFetch(`prediction-lists/${id}`);
export const apiCreatePredictionList = (body: { name: string; entries: any[] }) =>
  apiFetch('prediction-lists', { method: 'POST', body: JSON.stringify(body) });
export const apiAssignLeads = (listId: string, agentId: string, leadIds: string[]) =>
  apiFetch(`prediction-lists/${listId}/assign`, { method: 'POST', body: JSON.stringify({ agent_id: agentId, lead_ids: leadIds }) });

// Prediction Leads
export const apiGetMyLeads = () => apiFetch('prediction-leads/my');
export const apiUpdateLead = (id: string, body: { status?: string; notes?: string; address?: string; city?: string; telephone?: string; product?: string; quantity?: number; price?: number }) =>
  apiFetch(`prediction-leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiUnassignLeads = (leadIds: string[]) =>
  apiFetch('prediction-leads/unassign', { method: 'POST', body: JSON.stringify({ lead_ids: leadIds }) });

// Phone duplicate check
export const apiCheckPhoneDuplicates = (phone: string, excludeOrderId?: string) =>
  apiFetch('check-phone-duplicates', { method: 'POST', body: JSON.stringify({ phone, exclude_order_id: excludeOrderId }) });

// Call Scripts
export const apiGetCallScript = (contextType: string) => apiFetch(`call-scripts/${contextType}`);
export const apiUpdateCallScript = (contextType: string, scriptText: string) =>
  apiFetch(`call-scripts/${contextType}`, { method: 'PATCH', body: JSON.stringify({ script_text: scriptText }) });

// Call Logs
export const apiLogCall = (body: { context_type: string; context_id: string; outcome: string; notes?: string }) =>
  apiFetch('call-logs', { method: 'POST', body: JSON.stringify(body) });
export const apiGetCallLogs = (contextType: string, contextId: string) =>
  apiFetch(`call-logs/${contextType}/${contextId}`);

// Call History
export const apiGetCallHistory = (params?: { agent_id?: string; outcome?: string; source?: string; from?: string; to?: string; search?: string; page?: number; limit?: number }) => {
  const sp = new URLSearchParams();
  if (params?.agent_id) sp.set('agent_id', params.agent_id);
  if (params?.outcome) sp.set('outcome', params.outcome);
  if (params?.source) sp.set('source', params.source);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  if (params?.search) sp.set('search', params.search);
  if (params?.page) sp.set('page', String(params.page));
  if (params?.limit) sp.set('limit', String(params.limit));
  return apiFetch(`call-history?${sp.toString()}`);
};

// Warehouse
export const apiGetIncomingOrders = (params?: { agent_id?: string; from?: string; to?: string; product?: string; source?: string; status?: string }) => {
  const sp = new URLSearchParams();
  if (params?.agent_id) sp.set('agent_id', params.agent_id);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  if (params?.product) sp.set('product', params.product);
  if (params?.source) sp.set('source', params.source);
  if (params?.status) sp.set('status', params.status);
  return apiFetch(`warehouse/incoming-orders?${sp.toString()}`);
};
export const apiGetUserWarehouseItems = () => apiFetch('warehouse/user-items');
export const apiAssignWarehouseItem = (body: { user_id: string; product_id: string; quantity: number; notes?: string }) =>
  apiFetch('warehouse/user-items', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateWarehouseItem = (id: string, body: any) =>
  apiFetch(`warehouse/user-items/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteWarehouseItem = (id: string) =>
  apiFetch(`warehouse/user-items/${id}`, { method: 'DELETE' });
export const apiUpdateWarehouseOrder = (id: string, body: any) =>
  apiFetch(`warehouse/incoming-orders/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteWarehouseOrder = (id: string, source: string) =>
  apiFetch(`warehouse/incoming-orders/${id}?source=${source}`, { method: 'DELETE' });

export const apiGetShifts = (params?: { agent_id?: string; from?: string; to?: string }) => {
  const sp = new URLSearchParams();
  if (params?.agent_id) sp.set('agent_id', params.agent_id);
  if (params?.from) sp.set('from', params.from);
  if (params?.to) sp.set('to', params.to);
  return apiFetch(`shifts?${sp.toString()}`);
};
export const apiGetMyShifts = () => apiFetch('shifts/my');
export const apiCreateShift = (body: { name: string; date: string; date_end?: string; start_time: string; end_time: string; agent_ids?: string[] }) =>
  apiFetch('shifts', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateShift = (id: string, body: any) =>
  apiFetch(`shifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteShift = (id: string) =>
  apiFetch(`shifts/${id}`, { method: 'DELETE' });

// Recent Activity
export const apiGetRecentActivity = (limit?: number) => {
  const sp = new URLSearchParams();
  if (limit) sp.set('limit', String(limit));
  return apiFetch(`recent-activity?${sp.toString()}`);
};

// Ads Campaigns
export const apiGetAdsCampaigns = (params?: { platform?: string; status?: string; search?: string }) => {
  const sp = new URLSearchParams();
  if (params?.platform) sp.set('platform', params.platform);
  if (params?.status) sp.set('status', params.status);
  if (params?.search) sp.set('search', params.search);
  return apiFetch(`ads-campaigns?${sp.toString()}`);
};
export const apiCreateAdsCampaign = (body: { campaign_name: string; platform: string; budget: number; notes?: string }) =>
  apiFetch('ads-campaigns', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateAdsCampaign = (id: string, body: any) =>
  apiFetch(`ads-campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteAdsCampaign = (id: string) =>
  apiFetch(`ads-campaigns/${id}`, { method: 'DELETE' });

// Inbound Leads (webhook)
export const apiGetInboundLeads = (status?: string) => {
  const sp = new URLSearchParams();
  if (status && status !== 'all') sp.set('status', status);
  return apiFetch(`inbound-leads?${sp.toString()}`);
};
export const apiUpdateInboundLead = (id: string, body: any) =>
  apiFetch(`inbound-leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteInboundLead = (id: string) =>
  apiFetch(`inbound-leads/${id}`, { method: 'DELETE' });

// Assigner
export const apiGetUnassignedPending = () => apiFetch('orders/unassigned-pending');
export const apiGetAssignedOrders = () => apiFetch('orders/assigned');
export const apiBulkAssignOrders = (orderIds: string[], agentId: string) =>
  apiFetch('orders/bulk-assign', { method: 'POST', body: JSON.stringify({ order_ids: orderIds, agent_id: agentId }) });
export const apiBulkUnassignOrders = (orderIds: string[]) =>
  apiFetch('orders/bulk-unassign', { method: 'POST', body: JSON.stringify({ order_ids: orderIds }) });
export const apiGetOnlineAgents = () => apiFetch('agents/online');

// Webhooks
export const apiGetWebhooks = () => apiFetch('webhooks');
export const apiCreateWebhook = (body: { product_name: string; description?: string }) =>
  apiFetch('webhooks', { method: 'POST', body: JSON.stringify(body) });
export const apiUpdateWebhook = (id: string, body: any) =>
  apiFetch(`webhooks/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const apiDeleteWebhook = (id: string) =>
  apiFetch(`webhooks/${id}`, { method: 'DELETE' });
