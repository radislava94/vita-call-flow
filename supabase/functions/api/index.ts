import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

// ============================================================
// INPUT VALIDATION SCHEMAS
// ============================================================

const createUserSchema = z.object({
  email: z.string().trim().email("Invalid email format").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  full_name: z.string().trim().min(1, "Name is required").max(200),
  roles: z.array(z.enum(["admin", "manager", "agent", "pending_agent", "prediction_agent", "warehouse", "ads_admin"])).min(1).optional(),
  role: z.string().optional(),
});

const createOrderSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().trim().min(1, "Product name is required").max(200),
  customer_name: z.string().max(200).optional().default(""),
  customer_phone: z.string().max(30).optional().default(""),
  customer_city: z.string().max(200).optional().default(""),
  customer_address: z.string().max(500).optional().default(""),
  postal_code: z.string().max(20).optional().default(""),
  birthday: z.string().nullable().optional().default(null),
  price: z.number().min(0).max(10000000).optional().default(0),
  quantity: z.number().int().min(1).max(100000).optional().default(1),
});

const updateCustomerSchema = z.object({
  customer_name: z.string().max(200).optional(),
  customer_phone: z.string().max(30).optional(),
  customer_city: z.string().max(200).optional(),
  customer_address: z.string().max(500).optional(),
  postal_code: z.string().max(20).optional(),
  birthday: z.string().nullable().optional(),
  price: z.number().min(0).max(10000000).optional(),
  quantity: z.number().int().min(1).max(100000).optional(),
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().max(200).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "take", "call_again", "confirmed", "shipped", "delivered", "returned", "paid", "trashed", "cancelled"]),
});

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  description: z.string().max(2000).optional().default(""),
  price: z.number().min(0).max(10000000).optional().default(0),
  cost_price: z.number().min(0).max(10000000).optional().default(0),
  sku: z.string().max(50).nullable().optional().default(null),
  stock_quantity: z.number().int().min(0).max(1000000).optional().default(0),
  low_stock_threshold: z.number().int().min(0).max(100000).optional().default(5),
  photo_url: z.string().url().max(2000).nullable().optional().default(null),
  is_active: z.boolean().optional().default(true),
  category: z.string().max(200).optional().default(""),
  supplier_id: z.string().uuid().nullable().optional().default(null),
});

const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(200),
  contact_info: z.string().max(500).optional().default(""),
  email: z.string().max(255).optional().default(""),
  phone: z.string().max(30).optional().default(""),
  address: z.string().max(500).optional().default(""),
});

const restockSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(1000000),
  supplier_name: z.string().max(200).optional().default(""),
  invoice_number: z.string().max(100).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

const createCampaignSchema = z.object({
  campaign_name: z.string().trim().min(1, "Campaign name is required").max(200),
  platform: z.string().max(50).optional().default("meta"),
  budget: z.number().min(0).max(100000000).optional().default(0),
  notes: z.string().max(5000).optional().default(""),
});

const createShiftSchema = z.object({
  name: z.string().trim().min(1, "Shift name is required").max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  date_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format"),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time format"),
  agent_ids: z.array(z.string().uuid()).optional(),
});

const callLogSchema = z.object({
  context_type: z.enum(["order", "prediction_lead"]),
  context_id: z.string().uuid(),
  outcome: z.string().min(1).max(100),
  notes: z.string().max(5000).optional().default(""),
});

const predictionListSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(200),
  entries: z.array(z.object({
    name: z.string().max(200).optional().default(""),
    telephone: z.string().max(30).optional().default(""),
    address: z.string().max(500).optional().default(""),
    city: z.string().max(200).optional().default(""),
    product: z.string().max(200).optional().default(""),
  })).min(1, "No entries provided"),
});

const inboundLeadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().min(1, "Phone is required").max(30),
  status: z.string().max(50).optional().default("pending"),
  source: z.string().max(100).optional().default("landing_page"),
});

const warehouseItemSchema = z.object({
  user_id: z.string().uuid("Invalid user ID"),
  product_id: z.string().uuid("Invalid product ID"),
  quantity: z.number().int().min(1).max(100000).optional().default(1),
  notes: z.string().max(1000).optional().default(""),
});

function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.errors.map(e => e.message).join("; ");
    throw new ValidationError(msg);
  }
  return result.data;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // User client for RLS-respecting operations
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    });

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
    const segments = path.split("/");

    // ── PUBLIC WEBHOOK (no auth required) ──
    // Legacy generic webhook
    if (req.method === "POST" && path === "webhook/leads") {
      let body;
      try { body = parseBody(inboundLeadSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { data: lead, error } = await adminClient
        .from("inbound_leads")
        .insert({ name: body.name, phone: body.phone, status: "pending", source: body.source })
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Auto-create order for this lead
      const { data: order } = await adminClient
        .from("orders")
        .insert({
          product_name: "From Landing Page",
          customer_name: body.name,
          customer_phone: body.phone,
          status: "pending",
          source_type: "inbound_lead",
          inbound_lead_id: lead.id,
        })
        .select("id, display_id")
        .single();

      return json({ success: true, id: lead.id, order_id: order?.id });
    }

    // Dynamic webhook by slug: POST /api/webhook/:slug
    if (req.method === "POST" && segments[0] === "webhook" && segments.length === 2 && segments[1] !== "leads") {
      const slug = segments[1];
      const { data: webhook } = await adminClient
        .from("webhooks")
        .select("id, product_name, status, total_leads")
        .eq("slug", slug)
        .single();
      if (!webhook) return json({ error: "Webhook not found" }, 404);
      if (webhook.status !== "active") return json({ error: "Webhook is disabled" }, 403);

      let body;
      try { body = parseBody(inboundLeadSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }

      const { data: lead, error } = await adminClient
        .from("inbound_leads")
        .insert({
          name: body.name,
          phone: body.phone,
          status: "pending",
          source: body.source || "webhook",
          webhook_id: webhook.id,
          product_name: webhook.product_name,
        })
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Increment total_leads
      await adminClient.from("webhooks").update({ total_leads: (webhook.total_leads || 0) + 1 }).eq("id", webhook.id);

      // Auto-create order for this lead
      const { data: order } = await adminClient
        .from("orders")
        .insert({
          product_name: webhook.product_name,
          customer_name: body.name,
          customer_phone: body.phone,
          status: "pending",
          source_type: "inbound_lead",
          inbound_lead_id: lead.id,
        })
        .select("id, display_id")
        .single();

      return json({ success: true, id: lead.id, order_id: order?.id, product: webhook.product_name });
    }

    // Verify auth using getClaims for signing-keys compatibility
    const token = (authHeader || "").replace("Bearer ", "");
    if (!token) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { data: claimsData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const user = { id: claimsData.claims.sub as string, email: (claimsData.claims.email as string) || "" };

    // Get user roles (support multiple roles)
    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin");
    const isManager = roles.includes("manager");
    const isAgent = roles.includes("agent") || roles.includes("pending_agent") || roles.includes("prediction_agent");
    const isWarehouse = roles.includes("warehouse");
    const isAdsAdmin = roles.includes("ads_admin");
    const isAdminOrManager = isAdmin || isManager;
    const isDualRole = isAdmin && isAgent;

    // ============================================================
    // ROUTING
    // ============================================================

    // POST /api/users/create (admin only)
    if (req.method === "POST" && path === "users/create") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(createUserSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { email, password, full_name } = body;
      const rolesToAssign: string[] = body.roles || (body.role ? [body.role] : []);

      if (rolesToAssign.length === 0) {
        return json({ error: "At least one role is required" }, 400);
      }
      const validRoles = ["admin", "manager", "agent", "pending_agent", "prediction_agent", "warehouse", "ads_admin"];
      if (rolesToAssign.some((r: string) => !validRoles.includes(r))) {
        return json({ error: `Roles must be one of: ${validRoles.join(", ")}` }, 400);
      }
      // Managers can only create pending_agent and prediction_agent
      if (isManager && !isAdmin) {
        const allowedForManager = ["pending_agent", "prediction_agent"];
        if (rolesToAssign.some((r: string) => !allowedForManager.includes(r))) {
          return json({ error: "Managers can only create Pending Agent or Prediction Agent users" }, 400);
        }
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) return json({ error: sanitizeDbError(createErr) }, 400);

      // Assign all roles
      for (const r of rolesToAssign) {
        await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: r });
      }

      return json({ success: true, user_id: newUser.user.id });
    }

    // PUT /api/users/:id/roles (admin only - set roles array)
    if (req.method === "PUT" && segments[0] === "users" && segments[2] === "roles") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
      const body = await req.json();
      const { roles: newRoles } = body;

      if (!newRoles || !Array.isArray(newRoles) || newRoles.length === 0) {
        return json({ error: "At least one role is required" }, 400);
      }
      const validRoles = ["admin", "manager", "agent", "pending_agent", "prediction_agent", "warehouse", "ads_admin"];
      if (newRoles.some((r: string) => !validRoles.includes(r))) {
        return json({ error: `Roles must be one of: ${validRoles.join(", ")}` }, 400);
      }
      // Managers can only set agent-level roles
      if (isManager && !isAdmin) {
        const allowedForManager = ["pending_agent", "prediction_agent"];
        if (newRoles.some((r: string) => !allowedForManager.includes(r))) {
          return json({ error: "Managers can only assign Pending Agent or Prediction Agent roles" }, 400);
        }
      }
      // Prevent admin from changing own roles
      if (userId === user.id) {
        return json({ error: "Cannot change your own roles" }, 400);
      }

      // Delete existing roles and insert new ones
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      for (const r of newRoles) {
        await adminClient.from("user_roles").insert({ user_id: userId, role: r });
      }

      return json({ success: true, roles: newRoles });
    }

    // PATCH /api/users/:id/role (legacy - admin only)
    if (req.method === "PATCH" && segments[0] === "users" && segments[2] === "role") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
      const body = await req.json();
      const { role: newRole } = body;
      if (!newRole || !["admin", "agent", "warehouse"].includes(newRole)) {
        return json({ error: "Role must be admin or agent" }, 400);
      }
      if (userId === user.id) {
        return json({ error: "Cannot change your own role" }, 400);
      }
      // Replace all roles with the single one (legacy behavior)
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("user_roles").insert({ user_id: userId, role: newRole });
      return json({ success: true });
    }

    // POST /api/users/:id/toggle-active (admin only)
    if (req.method === "POST" && segments[0] === "users" && segments[2] === "toggle-active") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
      // Prevent admin from suspending themselves
      if (userId === user.id) {
        return json({ error: "Cannot suspend yourself" }, 400);
      }
      const { data: profile } = await adminClient
        .from("profiles")
        .select("is_active")
        .eq("user_id", userId)
        .single();
      if (!profile) return json({ error: "User not found" }, 404);

      await adminClient
        .from("profiles")
        .update({ is_active: !profile.is_active })
        .eq("user_id", userId);

      return json({ success: true, is_active: !profile.is_active });
    }

    // DELETE /api/users/:id (admin only)
    if (req.method === "DELETE" && segments[0] === "users" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
      // Prevent admin from deleting themselves
      if (userId === user.id) {
        return json({ error: "Cannot delete yourself" }, 400);
      }
      // Delete role, profile, then auth user
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("user_id", userId);
      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) return json({ error: sanitizeDbError(delErr) }, 400);
      return json({ success: true });
    }

    // GET /api/users (admin only)
    if (req.method === "GET" && path === "users") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);

      const { data: users } = await adminClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Get all roles in one query (multiple roles per user)
      const userIds = (users || []).map((u: any) => u.user_id);
      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      const roleMap: Record<string, string[]> = {};
      for (const r of allRoles || []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      }

      // Get stats for each user
      const enriched = await Promise.all(
        (users || []).map(async (u: any) => {
          const { count: ordersProcessed } = await adminClient
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("assigned_agent_id", u.user_id);

          const { count: leadsProcessed } = await adminClient
            .from("prediction_leads")
            .select("id", { count: "exact", head: true })
            .eq("assigned_agent_id", u.user_id);

          const userRoles = roleMap[u.user_id] || ["agent"];
          return {
            ...u,
            roles: userRoles,
            role: userRoles.includes("admin") ? "admin" : userRoles[0] || "agent", // legacy compat
            orders_processed: ordersProcessed || 0,
            leads_processed: leadsProcessed || 0,
          };
        })
      );

      return json(enriched);
    }

    // GET /api/users/agents (list active assignable users - agents and admins)
    if (req.method === "GET" && path === "users/agents") {
      const { data: allUsers } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true);

      // Get all roles for active users
      const userIds = (allUsers || []).map((u: any) => u.user_id);
      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      const roleMap: Record<string, string[]> = {};
      for (const r of allRoles || []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      }

      // Filter to users with agent OR admin role (assignable users)
      const assignableUsers = (allUsers || [])
        .filter((u: any) => {
          const roles = roleMap[u.user_id] || [];
          return roles.includes("agent") || roles.includes("pending_agent") || roles.includes("prediction_agent") || roles.includes("admin");
        })
        .map((u: any) => ({
          ...u,
          roles: roleMap[u.user_id] || [],
        }));

      return json(assignableUsers);
    }

    // POST /api/orders (create order)
    if (req.method === "POST" && path === "orders") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(createOrderSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }

      const { data: order, error: orderErr } = await adminClient
        .from("orders")
        .insert({
          product_id: body.product_id,
          product_name: body.product_name,
          customer_name: body.customer_name,
          customer_phone: body.customer_phone,
          customer_city: body.customer_city,
          customer_address: body.customer_address,
          postal_code: body.postal_code,
          birthday: body.birthday,
          price: body.price,
          quantity: body.quantity,
          status: "pending",
        })
        .select()
        .single();

      if (orderErr) return json({ error: sanitizeDbError(orderErr) }, 400);

      // Log initial status
      await adminClient.from("order_history").insert({
        order_id: order.id,
        to_status: "pending",
        changed_by: user.id,
        changed_by_name: "System",
      });

      return json(order);
    }

    // GET /api/orders
    if (req.method === "GET" && path === "orders") {
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search");
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");

      let query = supabase
        .from("orders")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (status && status !== "all") query = query.eq("status", status);
      if (search) query = query.or(`display_id.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`);

      const { data: orders, count, error } = await query;
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      return json({ orders, total: count, page, limit });
    }

    // GET /api/orders/unassigned-pending (admin only - for assigner)
    if (req.method === "GET" && path === "orders/unassigned-pending") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const { data: orders, error } = await adminClient
        .from("orders")
        .select("*")
        .eq("status", "pending")
        .is("assigned_agent_id", null)
        .order("created_at", { ascending: false });
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(orders || []);
    }

    // POST /api/orders/bulk-assign (admin only)
    if (req.method === "POST" && path === "orders/bulk-assign") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { order_ids, agent_id } = body;
      if (!order_ids?.length || !agent_id) return json({ error: "order_ids and agent_id required" }, 400);

      const { data: agentProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", agent_id)
        .single();
      if (!agentProfile) return json({ error: "Agent not found" }, 404);

      const { data: adminProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { error: updateErr } = await adminClient
        .from("orders")
        .update({
          assigned_agent_id: agent_id,
          assigned_agent_name: agentProfile.full_name,
          assigned_at: new Date().toISOString(),
          assigned_by: adminProfile?.full_name || "Admin",
        })
        .in("id", order_ids);
      if (updateErr) return json({ error: sanitizeDbError(updateErr) }, 400);

      return json({ success: true, assigned: order_ids.length });
    }

    // GET /api/agents/online (admin only - active agents with load info)
    if (req.method === "GET" && path === "agents/online") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);

      // Get active users with agent or admin role
      const { data: allUsers } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true);

      const userIds = (allUsers || []).map((u: any) => u.user_id);
      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      const roleMap: Record<string, string[]> = {};
      for (const r of allRoles || []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id].push(r.role);
      }

      const agents = (allUsers || []).filter((u: any) => {
        const roles = roleMap[u.user_id] || [];
        return roles.includes("agent") || roles.includes("pending_agent") || roles.includes("prediction_agent") || roles.includes("admin");
      });

      // Get assigned active order counts per agent
      const agentIds = agents.map((a: any) => a.user_id);
      const { data: orderCounts } = await adminClient
        .from("orders")
        .select("assigned_agent_id")
        .in("assigned_agent_id", agentIds.length > 0 ? agentIds : ["__none__"])
        .in("status", ["pending", "take", "call_again"]);

      const countMap: Record<string, number> = {};
      for (const o of orderCounts || []) {
        countMap[o.assigned_agent_id] = (countMap[o.assigned_agent_id] || 0) + 1;
      }

      // Check today's shifts
      const today = new Date().toISOString().split("T")[0];
      const { data: todayShifts } = await adminClient
        .from("shift_assignments")
        .select("user_id, shift_id, shifts(start_time, end_time)")
        .in("user_id", agentIds.length > 0 ? agentIds : ["__none__"]);

      const shiftMap: Record<string, any> = {};
      for (const sa of todayShifts || []) {
        shiftMap[sa.user_id] = sa.shifts;
      }

      const result = agents.map((a: any) => ({
        user_id: a.user_id,
        full_name: a.full_name,
        email: a.email,
        roles: roleMap[a.user_id] || [],
        active_leads: countMap[a.user_id] || 0,
        shift: shiftMap[a.user_id] || null,
        is_online: true, // Active users are considered online
      }));

      return json(result);
    }

    // GET /api/orders/:id
    if (req.method === "GET" && segments[0] === "orders" && segments.length === 2 && segments[1] !== "stats") {
      const orderId = segments[1];
      const { data: order, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (error || !order) return json({ error: "Order not found" }, 404);

      // Get history and notes
      const { data: history } = await supabase
        .from("order_history")
        .select("*")
        .eq("order_id", orderId)
        .order("changed_at", { ascending: false });

      const { data: notes } = await supabase
        .from("order_notes")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });

      // Check phone duplicates
      const { data: dupes } = await adminClient.rpc("check_phone_duplicates", {
        _phone: order.customer_phone,
        _exclude_order_id: order.id,
      });

      return json({ ...order, history, notes, phone_duplicates: dupes });
    }

    // PATCH /api/orders/:id/customer (update editable fields)
    if (req.method === "PATCH" && segments[0] === "orders" && segments[2] === "customer") {
      const orderId = segments[1];
      let body;
      try { body = parseBody(updateCustomerSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }

      const updates: Record<string, any> = {};
      if (body.customer_name !== undefined) updates.customer_name = body.customer_name;
      if (body.customer_phone !== undefined) updates.customer_phone = body.customer_phone;
      if (body.customer_city !== undefined) updates.customer_city = body.customer_city;
      if (body.customer_address !== undefined) updates.customer_address = body.customer_address;
      if (body.postal_code !== undefined) updates.postal_code = body.postal_code;
      if (body.birthday !== undefined) updates.birthday = body.birthday;
      if (body.price !== undefined) updates.price = body.price;
      if (body.quantity !== undefined) updates.quantity = body.quantity;
      if (body.product_id !== undefined) updates.product_id = body.product_id;
      if (body.product_name !== undefined) updates.product_name = body.product_name;

      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId)
        .select()
        .single();

      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // PATCH /api/orders/:id/status
    if (req.method === "PATCH" && segments[0] === "orders" && segments[2] === "status") {
      const orderId = segments[1];
      let body;
      try { body = parseBody(updateStatusSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const newStatus = body.status;

      // Get current order
      const { data: order } = await adminClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (!order) return json({ error: "Order not found" }, 404);

      // Permission check for non-admins
      const agentAllowed = ["pending", "take", "call_again", "confirmed"];
      const warehouseAllowed = ["confirmed", "shipped", "delivered", "paid"];
      if (!isAdminOrManager) {
        if (isWarehouse && warehouseAllowed.includes(newStatus)) {
          // Warehouse users can set confirmed/shipped
        } else if (!agentAllowed.includes(newStatus)) {
          return json({ error: `You can only set status to: ${agentAllowed.join(", ")}` }, 403);
        }
      }

      // Validation: require fields for certain statuses
      const requiresComplete = ["confirmed", "shipped", "returned", "paid", "cancelled"];
      if (requiresComplete.includes(newStatus)) {
        if (!order.customer_name?.trim() || !order.customer_phone?.trim() || !order.customer_city?.trim() || !order.customer_address?.trim()) {
          return json({ error: "Name, Telephone, City, and Address must be filled before changing to this status" }, 400);
        }
      }

      // Stock check on confirm
      const orderQty = order.quantity || 1;
      if (newStatus === "confirmed" && order.status !== "confirmed" && order.product_id) {
        const { data: product } = await adminClient
          .from("products")
          .select("stock_quantity, name")
          .eq("id", order.product_id)
          .single();
        if (product && product.stock_quantity < orderQty) {
          return json({ error: `Insufficient stock: ${product.name} has ${product.stock_quantity} available, but order requires ${orderQty}` }, 400);
        }
        if (product && product.stock_quantity >= orderQty) {
          const newQty = product.stock_quantity - orderQty;
          await adminClient.from("products").update({ stock_quantity: newQty }).eq("id", order.product_id);
          await adminClient.from("inventory_logs").insert({
            product_id: order.product_id,
            change_amount: -orderQty,
            previous_stock: product.stock_quantity,
            new_stock: newQty,
            reason: "order_deduction",
            movement_type: "order_deduction",
            user_id: user.id,
            notes: `Order ${order.display_id} confirmed`,
          });
        }
      }

      // Get profile name
      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      // Update status
      const { error: updateErr } = await adminClient
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (updateErr) return json({ error: sanitizeDbError(updateErr) }, 400);

      // Log history
      await adminClient.from("order_history").insert({
        order_id: orderId,
        from_status: order.status,
        to_status: newStatus,
        changed_by: user.id,
        changed_by_name: profile?.full_name || user.email,
      });

      // Sync status to linked inbound lead
      if (order.inbound_lead_id) {
        const inboundStatusMap: Record<string, string> = {
          pending: "pending", take: "contacted", call_again: "contacted",
          confirmed: "converted", shipped: "converted", delivered: "converted",
          paid: "converted", returned: "rejected", trashed: "rejected", cancelled: "rejected",
        };
        const inboundStatus = inboundStatusMap[newStatus] || "contacted";
        await adminClient.from("inbound_leads").update({ status: inboundStatus }).eq("id", order.inbound_lead_id);
      }

      return json({ success: true });
    }

    // POST /api/orders/:id/assign
    if (req.method === "POST" && segments[0] === "orders" && segments[2] === "assign") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const orderId = segments[1];
      const body = await req.json();
      const { agent_id } = body;

      const { data: agentProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", agent_id)
        .single();
      if (!agentProfile) return json({ error: "Agent not found" }, 404);

      const { data: adminProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      await adminClient
        .from("orders")
        .update({
          assigned_agent_id: agent_id,
          assigned_agent_name: agentProfile.full_name,
          assigned_at: new Date().toISOString(),
          assigned_by: adminProfile?.full_name || "Admin",
        })
        .eq("id", orderId);

      return json({ success: true });
    }

    // POST /api/orders/:id/notes
    if (req.method === "POST" && segments[0] === "orders" && segments[2] === "notes") {
      const orderId = segments[1];
      const body = await req.json();
      if (!body.text?.trim()) return json({ error: "Note text is required" }, 400);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      const { data: note, error } = await supabase
        .from("order_notes")
        .insert({
          order_id: orderId,
          text: body.text.trim(),
          author_id: user.id,
          author_name: profile?.full_name || user.email || "Unknown",
        })
        .select()
        .single();

      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(note);
    }

    // GET /api/dashboard-stats?period=today|yesterday|month&agent_id=xxx
    if (req.method === "GET" && path === "dashboard-stats") {
      const period = url.searchParams.get("period") || "today";
      const agentFilter = url.searchParams.get("agent_id");

      const now = new Date();
      const todayStr = now.toISOString().substring(0, 10);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().substring(0, 10);
      const monthStart = todayStr.substring(0, 7) + "-01";

      let fromDate: string, toDate: string;
      if (period === "yesterday") {
        fromDate = yesterdayStr + "T00:00:00Z";
        toDate = yesterdayStr + "T23:59:59Z";
      } else if (period === "month") {
        fromDate = monthStart + "T00:00:00Z";
        toDate = now.toISOString();
      } else {
        fromDate = todayStr + "T00:00:00Z";
        toDate = now.toISOString();
      }

      // Helper to compute metrics for a given agent filter
      async function computeMetrics(effectiveAgentId: string | null) {
        let ordersQ = adminClient.from("orders").select("id, status, price, created_at, assigned_agent_id").gte("created_at", fromDate).lte("created_at", toDate);
        if (effectiveAgentId) ordersQ = ordersQ.eq("assigned_agent_id", effectiveAgentId);
        const { data: periodOrders } = await ordersQ;

        let leadsQ = adminClient.from("prediction_leads").select("id, status, created_at, assigned_agent_id, product").gte("created_at", fromDate).lte("created_at", toDate);
        if (effectiveAgentId) leadsQ = leadsQ.eq("assigned_agent_id", effectiveAgentId);
        const { data: periodLeads } = await leadsQ;

        let callsQ = adminClient.from("call_logs").select("id, agent_id, created_at").gte("created_at", fromDate).lte("created_at", toDate);
        if (effectiveAgentId) callsQ = callsQ.eq("agent_id", effectiveAgentId);
        const { data: periodCalls } = await callsQ;

        const orders = periodOrders || [];
        const leads = periodLeads || [];
        const calls = periodCalls || [];

        const lead_count = leads.length;
        const confirmedLeads = leads.filter((l: any) => l.status === "confirmed");
        // deals_won includes confirmed/paid orders AND confirmed prediction leads
        const deals_won = orders.filter((o: any) => ["confirmed", "shipped", "delivered", "paid"].includes(o.status)).length + confirmedLeads.length;
        const deals_lost = orders.filter((o: any) => ["returned", "cancelled", "trashed"].includes(o.status)).length;
        const total_value = orders.filter((o: any) => ["confirmed", "shipped", "delivered", "paid"].includes(o.status)).reduce((sum: number, o: any) => sum + Number(o.price || 0), 0);
        const tasks_completed = calls.length;
        // total_orders includes standard orders + confirmed prediction leads
        const total_orders = orders.length + confirmedLeads.length;

        // Source breakdown
        const orders_from_standard = orders.filter((o: any) => ["confirmed", "shipped", "delivered", "paid"].includes(o.status)).length;
        const orders_from_leads = confirmedLeads.length;

        const dailyBreakdown: Record<string, { leads: number; deals_won: number; deals_lost: number; orders: number; calls: number }> = {};
        for (const o of orders) {
          const day = o.created_at.substring(0, 10);
          if (!dailyBreakdown[day]) dailyBreakdown[day] = { leads: 0, deals_won: 0, deals_lost: 0, orders: 0, calls: 0 };
          dailyBreakdown[day].orders++;
          if (["confirmed", "shipped", "delivered", "paid"].includes(o.status)) dailyBreakdown[day].deals_won++;
          if (["returned", "cancelled", "trashed"].includes(o.status)) dailyBreakdown[day].deals_lost++;
        }
        for (const l of leads) {
          const day = l.created_at.substring(0, 10);
          if (!dailyBreakdown[day]) dailyBreakdown[day] = { leads: 0, deals_won: 0, deals_lost: 0, orders: 0, calls: 0 };
          dailyBreakdown[day].leads++;
          if (l.status === "confirmed") {
            dailyBreakdown[day].deals_won++;
            dailyBreakdown[day].orders++;
          }
        }
        for (const c of calls) {
          const day = c.created_at.substring(0, 10);
          if (!dailyBreakdown[day]) dailyBreakdown[day] = { leads: 0, deals_won: 0, deals_lost: 0, orders: 0, calls: 0 };
          dailyBreakdown[day].calls++;
        }

        const statusCounts: Record<string, number> = {};
        for (const o of orders) {
          statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        }
        // Add confirmed leads to the confirmed status count
        if (confirmedLeads.length > 0) {
          statusCounts["confirmed"] = (statusCounts["confirmed"] || 0) + confirmedLeads.length;
        }

        return { lead_count, deals_won, deals_lost, total_value, tasks_completed, total_orders, daily: dailyBreakdown, statusCounts, orders_from_standard, orders_from_leads };
      }

      if (!isAdminOrManager) {
        // Pure agent: personal stats only
        const metrics = await computeMetrics(user.id);
        return json({ ...metrics, period, from: fromDate, to: toDate });
      }

      // Admin or dual-role: compute admin-level metrics (with optional agent filter)
      const effectiveAgentId = agentFilter || null;
      const adminMetrics = await computeMetrics(effectiveAgentId);

      // For dual-role users, also compute personal metrics
      let personalMetrics = null;
      if (isDualRole && !agentFilter) {
        personalMetrics = await computeMetrics(user.id);
      }

      return json({
        ...adminMetrics,
        personalMetrics,
        isDualRole,
        period, from: fromDate, to: toDate,
      });
    }

    // GET /api/orders/stats
    if (req.method === "GET" && path === "orders/stats") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      let query = adminClient.from("orders").select("status, created_at, assigned_agent_id, assigned_agent_name");
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);

      const { data: orders } = await query;

      // Also fetch confirmed prediction leads
      let leadsQuery = adminClient.from("prediction_leads").select("status, created_at, assigned_agent_id, assigned_agent_name").eq("status", "confirmed");
      if (from) leadsQuery = leadsQuery.gte("created_at", from);
      if (to) leadsQuery = leadsQuery.lte("created_at", to);
      const { data: confirmedLeads } = await leadsQuery;
      
      // Status counts
      const statusCounts: Record<string, number> = {};
      const agentCounts: Record<string, number> = {};
      const dailyCounts: Record<string, number> = {};
      
      for (const o of orders || []) {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        if (o.assigned_agent_name) {
          agentCounts[o.assigned_agent_name] = (agentCounts[o.assigned_agent_name] || 0) + 1;
        }
        const day = o.created_at.substring(0, 10);
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      }

      // Include confirmed prediction leads in counts
      for (const l of confirmedLeads || []) {
        statusCounts["confirmed"] = (statusCounts["confirmed"] || 0) + 1;
        if (l.assigned_agent_name) {
          agentCounts[l.assigned_agent_name] = (agentCounts[l.assigned_agent_name] || 0) + 1;
        }
        const day = l.created_at.substring(0, 10);
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      }

      const total = (orders?.length || 0) + (confirmedLeads?.length || 0);
      return json({ statusCounts, agentCounts, dailyCounts, total });
    }

    // ============================================================
    // PRODUCTS
    // ============================================================

    // GET /api/products
    if (req.method === "GET" && path === "products") {
      const { data, error } = await supabase
        .from("products")
        .select("*, suppliers:supplier_id(id, name)")
        .order("created_at", { ascending: false });
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // POST /api/products
    if (req.method === "POST" && path === "products") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(createProductSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }

      const { data, error } = await adminClient
        .from("products")
        .insert({
          name: body.name,
          description: body.description,
          price: body.price,
          cost_price: body.cost_price,
          sku: body.sku,
          stock_quantity: body.stock_quantity,
          low_stock_threshold: body.low_stock_threshold,
          photo_url: body.photo_url,
          is_active: body.is_active,
          category: body.category,
          supplier_id: body.supplier_id,
        })
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // PATCH /api/products/:id
    if (req.method === "PATCH" && segments[0] === "products" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const productId = segments[1];
      const body = await req.json();

      // If stock_quantity is changing, log it
      if (body.stock_quantity !== undefined) {
        const { data: current } = await adminClient
          .from("products")
          .select("stock_quantity")
          .eq("id", productId)
          .single();
        if (current && current.stock_quantity !== body.stock_quantity) {
          await adminClient.from("inventory_logs").insert({
            product_id: productId,
            change_amount: body.stock_quantity - current.stock_quantity,
            previous_stock: current.stock_quantity,
            new_stock: body.stock_quantity,
            reason: "manual",
            movement_type: "manual_adjust",
            user_id: user.id,
          });
        }
      }

      const { data, error } = await adminClient
        .from("products")
        .update(body)
        .eq("id", productId)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // GET /api/products/:id/inventory-logs
    if (req.method === "GET" && segments[0] === "products" && segments[2] === "inventory-logs") {
      const productId = segments[1];
      const { data, error } = await adminClient
        .from("inventory_logs")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // ============================================================
    // PREDICTION LISTS & LEADS
    // ============================================================

    // GET /api/prediction-lists
    if (req.method === "GET" && path === "prediction-lists") {
      const { data, error } = await supabase
        .from("prediction_lists")
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // POST /api/prediction-lists (upload)
    if (req.method === "POST" && path === "prediction-lists") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(predictionListSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { name, entries } = body;

      const { data: list, error: listErr } = await adminClient
        .from("prediction_lists")
        .insert({
          name: name.trim(),
          uploaded_by: user.id,
          total_records: entries.length,
          assigned_count: 0,
        })
        .select()
        .single();
      if (listErr) return json({ error: sanitizeDbError(listErr) }, 400);

      // Insert leads
      const leads = entries.map((e: any) => ({
        list_id: list.id,
        name: e.name || "",
        telephone: e.telephone || "",
        address: e.address || "",
        city: e.city || "",
        product: e.product || "",
      }));

      const { error: leadsErr } = await adminClient.from("prediction_leads").insert(leads);
      if (leadsErr) return json({ error: sanitizeDbError(leadsErr) }, 400);

      return json(list);
    }

    // GET /api/prediction-lists/:id
    if (req.method === "GET" && segments[0] === "prediction-lists" && segments.length === 2) {
      const listId = segments[1];
      const { data: list } = await supabase
        .from("prediction_lists")
        .select("*")
        .eq("id", listId)
        .single();
      if (!list) return json({ error: "List not found" }, 404);

      const { data: leads } = await adminClient
        .from("prediction_leads")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true })
        .limit(5000);

      return json({ ...list, entries: leads || [] });
    }

    // POST /api/prediction-lists/:id/assign (bulk assign)
    if (req.method === "POST" && segments[0] === "prediction-lists" && segments[2] === "assign") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const listId = segments[1];
      const body = await req.json();
      const { agent_id, lead_ids } = body;

      const { data: agentProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", agent_id)
        .single();
      if (!agentProfile) return json({ error: "Agent not found" }, 404);

      const { error } = await adminClient
        .from("prediction_leads")
        .update({
          assigned_agent_id: agent_id,
          assigned_agent_name: agentProfile.full_name,
        })
        .in("id", lead_ids)
        .eq("list_id", listId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Update assigned count
      const { count } = await adminClient
        .from("prediction_leads")
        .select("id", { count: "exact", head: true })
        .eq("list_id", listId)
        .not("assigned_agent_id", "is", null);

      await adminClient
        .from("prediction_lists")
        .update({ assigned_count: count || 0 })
        .eq("id", listId);

      return json({ success: true, assigned_count: count });
    }

    // GET /api/prediction-leads/my (agent's assigned leads)
    if (req.method === "GET" && path === "prediction-leads/my") {
      // Admins/managers see all assigned leads; agents see only their own
      let query = isAdminOrManager
        ? adminClient
            .from("prediction_leads")
            .select("*, prediction_lists(name)")
            .not("assigned_agent_id", "is", null)
        : supabase
            .from("prediction_leads")
            .select("*, prediction_lists(name)")
            .eq("assigned_agent_id", user.id);

      const { data, error } = await query
        .order("updated_at", { ascending: false })
        .limit(3000);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data || []);
    }

    // POST /api/prediction-leads/unassign (admin: bulk unassign leads)
    if (req.method === "POST" && path === "prediction-leads/unassign") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { lead_ids } = body;
      if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
        return json({ error: "lead_ids array is required" }, 400);
      }

      // Get leads to find their list_ids for updating assigned_count
      const { data: leadsToUnassign } = await adminClient
        .from("prediction_leads")
        .select("id, list_id, assigned_agent_name")
        .in("id", lead_ids);

      const { error } = await adminClient
        .from("prediction_leads")
        .update({ assigned_agent_id: null, assigned_agent_name: null })
        .in("id", lead_ids);
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Update assigned_count for affected lists
      const affectedListIds = [...new Set((leadsToUnassign || []).map((l: any) => l.list_id))];
      for (const listId of affectedListIds) {
        const { count } = await adminClient
          .from("prediction_leads")
          .select("id", { count: "exact", head: true })
          .eq("list_id", listId)
          .not("assigned_agent_id", "is", null);
        await adminClient
          .from("prediction_lists")
          .update({ assigned_count: count || 0 })
          .eq("id", listId);
      }

      return json({ success: true, unassigned: lead_ids.length });
    }

    // PATCH /api/prediction-leads/:id (update status/notes/details)
    if (req.method === "PATCH" && segments[0] === "prediction-leads" && segments.length === 2) {
      const leadId = segments[1];
      const body = await req.json();

      const updates: Record<string, any> = {};
      if (body.status) updates.status = body.status;
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.address !== undefined) updates.address = body.address;
      if (body.city !== undefined) updates.city = body.city;
      if (body.telephone !== undefined) updates.telephone = body.telephone;
      if (body.product !== undefined) updates.product = body.product;
      if (body.quantity !== undefined) updates.quantity = body.quantity;
      if (body.price !== undefined) updates.price = body.price;

      const { data, error } = await supabase
        .from("prediction_leads")
        .update(updates)
        .eq("id", leadId)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Auto-create order when prediction lead reaches call_again or confirmed
      if (body.status && ["call_again", "confirmed"].includes(body.status)) {
        // Check if an order already exists for this lead
        const { data: existingOrder } = await adminClient
          .from("orders")
          .select("id")
          .eq("source_lead_id", leadId)
          .maybeSingle();

        if (!existingOrder) {
          // Get the lead data for order creation
          const lead = data;
          const { data: agentProfile } = lead.assigned_agent_id
            ? await adminClient.from("profiles").select("full_name").eq("user_id", lead.assigned_agent_id).single()
            : { data: null };

          const { data: newOrder } = await adminClient
            .from("orders")
            .insert({
              product_name: lead.product || "From Prediction Lead",
              customer_name: lead.name || "",
              customer_phone: lead.telephone || "",
              customer_city: lead.city || "",
              customer_address: lead.address || "",
              price: lead.price || 0,
              quantity: lead.quantity || 1,
              status: body.status === "confirmed" ? "confirmed" : "call_again",
              source_type: "prediction_lead",
              source_lead_id: leadId,
              assigned_agent_id: lead.assigned_agent_id,
              assigned_agent_name: agentProfile?.full_name || lead.assigned_agent_name || null,
              assigned_at: lead.assigned_agent_id ? new Date().toISOString() : null,
            })
            .select()
            .single();

          if (newOrder) {
            // Log initial status in order history
            await adminClient.from("order_history").insert({
              order_id: newOrder.id,
              to_status: newOrder.status,
              changed_by: user.id,
              changed_by_name: "System (from Prediction Lead)",
            });
          }
        } else {
          // Update existing order status to match lead
          const newStatus = body.status === "confirmed" ? "confirmed" : "call_again";
          const { data: currentOrder } = await adminClient
            .from("orders")
            .select("status")
            .eq("id", existingOrder.id)
            .single();

          if (currentOrder && currentOrder.status !== newStatus) {
            await adminClient.from("orders").update({ status: newStatus }).eq("id", existingOrder.id);
            const { data: profile } = await adminClient.from("profiles").select("full_name").eq("user_id", user.id).single();
            await adminClient.from("order_history").insert({
              order_id: existingOrder.id,
              from_status: currentOrder.status,
              to_status: newStatus,
              changed_by: user.id,
              changed_by_name: profile?.full_name || "System",
            });
          }
        }
      }

      return json(data);
    }

    // POST /api/check-phone-duplicates
    if (req.method === "POST" && path === "check-phone-duplicates") {
      const body = await req.json();
      const { phone, exclude_order_id } = body;
      if (!phone) return json({ error: "Phone is required" }, 400);

      const { data, error } = await adminClient.rpc("check_phone_duplicates", {
        _phone: phone,
        _exclude_order_id: exclude_order_id || null,
      });
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // GET /api/agent-performance (admin only)
    if (req.method === "GET" && path === "agent-performance") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      // Get all agents
      const { data: agents } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true);

      const { data: agentRoles } = await adminClient
        .from("user_roles")
        .select("user_id")
        .eq("role", "agent");
      const agentUserIds = new Set((agentRoles || []).map((r: any) => r.user_id));
      const agentProfiles = (agents || []).filter((a: any) => agentUserIds.has(a.user_id));

      // Get all orders (optionally filtered by date)
      let ordersQuery = adminClient.from("orders").select("id, status, assigned_agent_id, assigned_at, created_at, updated_at");
      if (from) ordersQuery = ordersQuery.gte("created_at", from);
      if (to) ordersQuery = ordersQuery.lte("created_at", to);
      const { data: allOrders } = await ordersQuery;

      // Get all prediction leads
      let leadsQuery = adminClient.from("prediction_leads").select("id, status, assigned_agent_id, created_at, updated_at");
      if (from) leadsQuery = leadsQuery.gte("created_at", from);
      if (to) leadsQuery = leadsQuery.lte("created_at", to);
      const { data: allLeads } = await leadsQuery;

      // Get call logs for avg time calculation
      let logsQuery = adminClient.from("call_logs").select("agent_id, context_type, context_id, created_at");
      if (from) logsQuery = logsQuery.gte("created_at", from);
      if (to) logsQuery = logsQuery.lte("created_at", to);
      const { data: callLogs } = await logsQuery;

      const todayStr = new Date().toISOString().substring(0, 10);

      const results = agentProfiles.map((agent: any) => {
        const agentOrders = (allOrders || []).filter((o: any) => o.assigned_agent_id === agent.user_id);
        const agentLeads = (allLeads || []).filter((l: any) => l.assigned_agent_id === agent.user_id);
        const agentLogs = (callLogs || []).filter((l: any) => l.agent_id === agent.user_id);

        const totalOrders = agentOrders.length;
        const confirmedOrders = agentOrders.filter((o: any) => o.status === "confirmed").length;
        const returnedOrders = agentOrders.filter((o: any) => o.status === "returned").length;
        const totalLeads = agentLeads.length;
        const leadsContactedToday = agentLeads.filter((l: any) => l.status !== "not_contacted" && l.updated_at?.substring(0, 10) === todayStr).length;

        // Conversion rate: confirmed / total assigned (orders + leads)
        const totalAssigned = totalOrders + totalLeads;
        const totalConfirmed = confirmedOrders + agentLeads.filter((l: any) => l.status === "confirmed").length;
        const conversionRate = totalAssigned > 0 ? Math.round((totalConfirmed / totalAssigned) * 100) : 0;

        // Avg time from assignment to first action (using call logs)
        let avgTimeMinutes: number | null = null;
        const orderFirstActions: number[] = [];
        for (const o of agentOrders) {
          if (!o.assigned_at) continue;
          const firstLog = agentLogs
            .filter((l: any) => l.context_id === o.id && l.context_type === "order")
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
          if (firstLog) {
            const diff = new Date(firstLog.created_at).getTime() - new Date(o.assigned_at).getTime();
            if (diff > 0) orderFirstActions.push(diff);
          }
        }
        for (const l of agentLeads) {
          const firstLog = agentLogs
            .filter((lg: any) => lg.context_id === l.id && lg.context_type === "prediction_lead")
            .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
          if (firstLog) {
            const diff = new Date(firstLog.created_at).getTime() - new Date(l.created_at).getTime();
            if (diff > 0) orderFirstActions.push(diff);
          }
        }
        if (orderFirstActions.length > 0) {
          avgTimeMinutes = Math.round(orderFirstActions.reduce((a, b) => a + b, 0) / orderFirstActions.length / 60000);
        }

        return {
          user_id: agent.user_id,
          full_name: agent.full_name,
          email: agent.email,
          total_orders: totalOrders,
          confirmed_orders: confirmedOrders,
          returned_orders: returnedOrders,
          total_leads: totalLeads,
          leads_contacted_today: leadsContactedToday,
          conversion_rate: conversionRate,
          avg_time_minutes: avgTimeMinutes,
        };
      });

      return json(results);
    }

    // ============================================================
    // CALL SCRIPTS & LOGS
    // ============================================================

    // GET /api/call-scripts (list all scripts - for admin management page)
    if (req.method === "GET" && path === "call-scripts") {
      const { data, error } = await supabase
        .from("call_scripts")
        .select("*")
        .order("context_type");
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data || []);
    }

    // GET /api/call-scripts/:contextType
    if (req.method === "GET" && segments[0] === "call-scripts" && segments.length === 2) {
      const contextType = segments[1];
      const { data, error } = await supabase
        .from("call_scripts")
        .select("*")
        .eq("context_type", contextType)
        .single();
      if (error) return json({ script_text: "" });
      return json(data);
    }

    // PATCH /api/call-scripts/:contextType (admin only - upsert)
    if (req.method === "PATCH" && segments[0] === "call-scripts" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const contextType = segments[1];
      const body = await req.json();

      // Try update first
      const { data: existing } = await adminClient
        .from("call_scripts")
        .select("id")
        .eq("context_type", contextType)
        .single();

      let data, error;
      if (existing) {
        ({ data, error } = await adminClient
          .from("call_scripts")
          .update({ script_text: body.script_text, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq("context_type", contextType)
          .select()
          .single());
      } else {
        ({ data, error } = await adminClient
          .from("call_scripts")
          .insert({ context_type: contextType, script_text: body.script_text, updated_by: user.id })
          .select()
          .single());
      }
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // POST /api/call-logs
    if (req.method === "POST" && path === "call-logs") {
      let body;
      try { body = parseBody(callLogSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { context_type, context_id, outcome, notes } = body;

      const { data, error } = await adminClient
        .from("call_logs")
        .insert({
          agent_id: user.id,
          context_type,
          context_id,
          outcome,
          notes: notes || "",
        })
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Auto-update prediction lead status based on outcome
      if (context_type === "prediction_lead") {
        const statusMap: Record<string, string> = {
          no_answer: "no_answer",
          interested: "interested",
          not_interested: "not_interested",
          call_again: "not_contacted",
        };
        const newStatus = statusMap[outcome];
        if (newStatus) {
          await adminClient
            .from("prediction_leads")
            .update({ status: newStatus })
            .eq("id", context_id);
        }
      }

      return json(data);
    }

    // GET /api/call-history (list all call logs with filters, pagination, enriched data)
    if (req.method === "GET" && path === "call-history") {
      const agentFilter = url.searchParams.get("agent_id");
      const outcomeFilter = url.searchParams.get("outcome");
      const sourceFilter = url.searchParams.get("source"); // prediction_lead | order
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const search = url.searchParams.get("search");
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "25");

      let query = adminClient.from("call_logs").select("*", { count: "exact" }).order("created_at", { ascending: false });

      // Agent filter: non-admin can only see own
      if (!isAdminOrManager) {
        query = query.eq("agent_id", user.id);
      } else if (agentFilter) {
        query = query.eq("agent_id", agentFilter);
      }

      if (outcomeFilter) query = query.eq("outcome", outcomeFilter);
      if (sourceFilter) query = query.eq("context_type", sourceFilter);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);

      query = query.range((page - 1) * limit, page * limit - 1);
      const { data: logs, count, error: logsErr } = await query;
      if (logsErr) return json({ error: sanitizeDbError(logsErr) }, 400);

      // Enrich with agent names, customer info
      const agentIds = [...new Set((logs || []).map((l: any) => l.agent_id))];
      let agentMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name").in("user_id", agentIds);
        for (const p of profiles || []) agentMap[p.user_id] = p.full_name;
      }

      // Batch lookup context info
      const orderContextIds = (logs || []).filter((l: any) => l.context_type === "order").map((l: any) => l.context_id);
      const leadContextIds = (logs || []).filter((l: any) => l.context_type === "prediction_lead").map((l: any) => l.context_id);

      let orderMap: Record<string, any> = {};
      let leadMap: Record<string, any> = {};

      if (orderContextIds.length > 0) {
        const { data: orders } = await adminClient.from("orders").select("id, display_id, customer_name, customer_phone, product_name").in("id", orderContextIds);
        for (const o of orders || []) orderMap[o.id] = o;
      }
      if (leadContextIds.length > 0) {
        const { data: leads } = await adminClient.from("prediction_leads").select("id, name, telephone, product").in("id", leadContextIds);
        for (const l of leads || []) leadMap[l.id] = l;
      }

      // Search filter (post-query on enriched data if search provided)
      let enriched = (logs || []).map((l: any) => {
        const isOrder = l.context_type === "order";
        const ctx = isOrder ? orderMap[l.context_id] : leadMap[l.context_id];
        return {
          ...l,
          agent_name: agentMap[l.agent_id] || "Unknown",
          customer_name: isOrder ? ctx?.customer_name : ctx?.name || "Unknown",
          customer_phone: isOrder ? ctx?.customer_phone : ctx?.telephone || "",
          product_name: isOrder ? ctx?.product_name : ctx?.product || "",
          display_id: isOrder ? ctx?.display_id : l.context_id.substring(0, 8),
          source: l.context_type,
        };
      });

      if (search) {
        const s = search.toLowerCase();
        enriched = enriched.filter((l: any) =>
          l.customer_name?.toLowerCase().includes(s) ||
          l.agent_name?.toLowerCase().includes(s) ||
          l.display_id?.toLowerCase().includes(s) ||
          l.notes?.toLowerCase().includes(s)
        );
      }

      return json({ logs: enriched, total: count, page, limit });
    }

    // GET /api/call-logs/:contextType/:contextId
    if (req.method === "GET" && segments[0] === "call-logs" && segments.length === 3) {
      const contextType = segments[1];
      const contextId = segments[2];
      const { data, error } = await adminClient
        .from("call_logs")
        .select("*")
        .eq("context_type", contextType)
        .eq("context_id", contextId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // ============================================================
    // SHIFTS
    // ============================================================

    // POST /api/shifts (admin only)
    if (req.method === "POST" && path === "shifts") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(createShiftSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { name, date, start_time, end_time, agent_ids } = body;

      // Support date range
      const dates: string[] = [];
      if (body.date_end && body.date_end !== date) {
        let cur = new Date(date);
        const end = new Date(body.date_end);
        while (cur <= end) {
          dates.push(cur.toISOString().substring(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        dates.push(date);
      }

      const createdShifts = [];
      for (const d of dates) {
        const { data: shift, error: shiftErr } = await adminClient
          .from("shifts")
          .insert({ name: name.trim(), date: d, start_time, end_time, created_by: user.id })
          .select()
          .single();
        if (shiftErr) return json({ error: sanitizeDbError(shiftErr) }, 400);

        if (agent_ids?.length) {
          const assignments = agent_ids.map((aid: string) => ({ shift_id: shift.id, user_id: aid }));
          await adminClient.from("shift_assignments").insert(assignments);
        }
        createdShifts.push(shift);
      }

      return json(createdShifts.length === 1 ? createdShifts[0] : createdShifts);
    }

    // GET /api/shifts
    if (req.method === "GET" && path === "shifts") {
      const agentFilter = url.searchParams.get("agent_id");
      const dateFrom = url.searchParams.get("from");
      const dateTo = url.searchParams.get("to");

      let query = adminClient.from("shifts").select("*").order("date", { ascending: true }).order("start_time", { ascending: true });
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data: shifts, error } = await query;
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Get all assignments
      const shiftIds = (shifts || []).map((s: any) => s.id);
      let assignments: any[] = [];
      if (shiftIds.length > 0) {
        const { data: a } = await adminClient.from("shift_assignments").select("shift_id, user_id").in("shift_id", shiftIds);
        assignments = a || [];
      }

      // Get agent profiles
      const agentUserIds = [...new Set(assignments.map((a: any) => a.user_id))];
      let agentMap: Record<string, string> = {};
      if (agentUserIds.length > 0) {
        const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name").in("user_id", agentUserIds);
        for (const p of profiles || []) agentMap[p.user_id] = p.full_name;
      }

      const enriched = (shifts || []).map((s: any) => {
        const sAssignments = assignments.filter((a: any) => a.shift_id === s.id);
        return {
          ...s,
          agents: sAssignments.map((a: any) => ({ user_id: a.user_id, full_name: agentMap[a.user_id] || "Unknown" })),
        };
      });

      // Filter by agent if requested
      const result = agentFilter
        ? enriched.filter((s: any) => s.agents.some((a: any) => a.user_id === agentFilter))
        : enriched;

      return json(result);
    }

    // GET /api/shifts/my (agent's shifts)
    if (req.method === "GET" && path === "shifts/my") {
      const { data: myAssignments } = await adminClient.from("shift_assignments").select("shift_id").eq("user_id", user.id);
      const myShiftIds = (myAssignments || []).map((a: any) => a.shift_id);
      if (myShiftIds.length === 0) return json([]);

      const { data: shifts } = await adminClient.from("shifts").select("*").in("id", myShiftIds).order("date", { ascending: true }).order("start_time", { ascending: true });
      return json(shifts || []);
    }

    // PATCH /api/shifts/:id (admin only)
    if (req.method === "PATCH" && segments[0] === "shifts" && segments.length === 2 && segments[1] !== "my") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const shiftId = segments[1];
      const body = await req.json();
      const { agent_ids, ...shiftUpdates } = body;

      if (Object.keys(shiftUpdates).length > 0) {
        const { error } = await adminClient.from("shifts").update(shiftUpdates).eq("id", shiftId);
        if (error) return json({ error: sanitizeDbError(error) }, 400);
      }

      if (agent_ids !== undefined) {
        await adminClient.from("shift_assignments").delete().eq("shift_id", shiftId);
        if (agent_ids.length > 0) {
          const assignments = agent_ids.map((aid: string) => ({ shift_id: shiftId, user_id: aid }));
          await adminClient.from("shift_assignments").insert(assignments);
        }
      }

      return json({ success: true });
    }

    // DELETE /api/shifts/:id (admin only)
    if (req.method === "DELETE" && segments[0] === "shifts" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const shiftId = segments[1];
      const { error } = await adminClient.from("shifts").delete().eq("id", shiftId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json({ success: true });
    }

    // ============================================================
    // WAREHOUSE
    // ============================================================

    // GET /api/warehouse/incoming-orders (confirmed orders + confirmed prediction leads)
    if (req.method === "GET" && path === "warehouse/incoming-orders") {
      if (!isAdminOrManager && !isWarehouse) return json({ error: "Forbidden" }, 403);
      const agentFilter = url.searchParams.get("agent_id");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const productFilter = url.searchParams.get("product");
      const sourceFilter = url.searchParams.get("source"); // "order" | "prediction_lead" | null

      const results: any[] = [];

      // Filter by status (default: confirmed + shipped)
      const statusFilter = url.searchParams.get("status"); // "confirmed" | "shipped" | null (both)

      // 1. Orders (source = "order")
      if (!sourceFilter || sourceFilter === "order") {
        let oQuery = adminClient.from("orders").select("*").order("created_at", { ascending: false });
        if (statusFilter) {
          oQuery = oQuery.eq("status", statusFilter);
        } else {
          oQuery = oQuery.in("status", ["confirmed", "shipped", "delivered", "paid"]);
        }
        if (agentFilter && agentFilter !== "all") oQuery = oQuery.eq("assigned_agent_id", agentFilter);
        if (from) oQuery = oQuery.gte("created_at", from);
        if (to) oQuery = oQuery.lte("created_at", to);
        if (productFilter) oQuery = oQuery.ilike("product_name", `%${productFilter}%`);
        const { data: orders } = await oQuery;
        for (const o of orders || []) {
          results.push({
            id: o.id,
            display_id: o.display_id,
            customer_name: o.customer_name,
            customer_phone: o.customer_phone,
            product_name: o.product_name,
            price: o.price,
            assigned_agent_name: o.assigned_agent_name,
            assigned_agent_id: o.assigned_agent_id,
            created_at: o.created_at,
            status: o.status,
            source: "order",
          });
        }
      }

      // 2. Prediction leads (source = "prediction_lead") - only confirmed (no shipped status for leads)
      if ((!sourceFilter || sourceFilter === "prediction_lead") && (!statusFilter || statusFilter === "confirmed")) {
        let lQuery = adminClient.from("prediction_leads").select("*, prediction_lists(name)").eq("status", "confirmed").order("created_at", { ascending: false });
        if (agentFilter && agentFilter !== "all") lQuery = lQuery.eq("assigned_agent_id", agentFilter);
        if (from) lQuery = lQuery.gte("created_at", from);
        if (to) lQuery = lQuery.lte("created_at", to);
        if (productFilter) lQuery = lQuery.ilike("product", `%${productFilter}%`);
        const { data: leads } = await lQuery;
        for (const l of leads || []) {
          results.push({
            id: l.id,
            display_id: `LEAD-${l.name?.substring(0, 8) || l.id.substring(0, 8)}`,
            customer_name: l.name,
            customer_phone: l.telephone,
            product_name: l.product || "—",
            price: 0,
            assigned_agent_name: l.assigned_agent_name,
            assigned_agent_id: l.assigned_agent_id,
            created_at: l.created_at,
            status: "confirmed",
            source: "prediction_lead",
            list_name: l.prediction_lists?.name || "",
          });
        }
      }

      // Sort combined by date desc
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return json(results);
    }

    // GET /api/warehouse/user-items (admin: all, agent: own)
    if (req.method === "GET" && path === "warehouse/user-items") {
      let query = adminClient.from("user_warehouse").select("*, products(name, sku, price, stock_quantity)").order("created_at", { ascending: false });
      if (!isAdminOrManager && !isWarehouse) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query;
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Enrich with user names
      const userIds = [...new Set((data || []).map((d: any) => d.user_id))];
      let userMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await adminClient.from("profiles").select("user_id, full_name").in("user_id", userIds);
        for (const p of profiles || []) userMap[p.user_id] = p.full_name;
      }

      const enriched = (data || []).map((d: any) => ({
        ...d,
        user_name: userMap[d.user_id] || "Unknown",
        product_name: d.products?.name || "Unknown",
        product_sku: d.products?.sku || null,
        product_price: d.products?.price || 0,
      }));
      return json(enriched);
    }

    // POST /api/warehouse/user-items (admin: assign product to user)
    if (req.method === "POST" && path === "warehouse/user-items") {
      if (!isAdminOrManager && !isWarehouse) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(warehouseItemSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { user_id: targetUserId, product_id, quantity, notes: itemNotes } = body;

      // Upsert: if exists, add quantity
      const { data: existing } = await adminClient
        .from("user_warehouse")
        .select("id, quantity")
        .eq("user_id", targetUserId)
        .eq("product_id", product_id)
        .single();

      let result;
      if (existing) {
        const { data, error } = await adminClient
          .from("user_warehouse")
          .update({ quantity: existing.quantity + (quantity || 1), assigned_by: user.id, notes: itemNotes || "" })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) return json({ error: sanitizeDbError(error) }, 400);
        result = data;
      } else {
        const { data, error } = await adminClient
          .from("user_warehouse")
          .insert({ user_id: targetUserId, product_id, quantity: quantity || 1, assigned_by: user.id, notes: itemNotes || "" })
          .select()
          .single();
        if (error) return json({ error: sanitizeDbError(error) }, 400);
        result = data;
      }
      return json(result);
    }

    // PATCH /api/warehouse/user-items/:id (admin: update assignment)
    if (req.method === "PATCH" && segments[0] === "warehouse" && segments[1] === "user-items" && segments.length === 3) {
      if (!isAdminOrManager && !isWarehouse) return json({ error: "Forbidden" }, 403);
      const itemId = segments[2];
      const body = await req.json();
      const updates: Record<string, any> = {};
      if (body.quantity !== undefined) updates.quantity = body.quantity;
      if (body.user_id !== undefined) updates.user_id = body.user_id;
      if (body.notes !== undefined) updates.notes = body.notes;

      const { data, error } = await adminClient
        .from("user_warehouse")
        .update(updates)
        .eq("id", itemId)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // DELETE /api/warehouse/user-items/:id (admin only)
    if (req.method === "DELETE" && segments[0] === "warehouse" && segments[1] === "user-items" && segments.length === 3) {
      if (!isAdminOrManager && !isWarehouse) return json({ error: "Forbidden" }, 403);
      const itemId = segments[2];
      const { error } = await adminClient.from("user_warehouse").delete().eq("id", itemId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json({ success: true });
    }

    // GET /api/me
    if (req.method === "GET" && path === "me") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return json({ ...profile, role });
    }

    // GET /api/recent-activity
    if (req.method === "GET" && path === "recent-activity") {
      const limit = parseInt(url.searchParams.get("limit") || "20");

      // Fetch recent order status changes
      const { data: statusChanges } = await adminClient
        .from("order_history")
        .select("id, order_id, from_status, to_status, changed_by_name, changed_at")
        .order("changed_at", { ascending: false })
        .limit(limit);

      // Fetch recent call logs
      const { data: callLogs } = await adminClient
        .from("call_logs")
        .select("id, context_type, context_id, outcome, notes, agent_id, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      // Fetch recent order notes
      const { data: orderNotes } = await adminClient
        .from("order_notes")
        .select("id, order_id, author_name, text, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      // Get agent names for call logs
      const agentIds = [...new Set((callLogs || []).map((c: any) => c.agent_id))];
      const agentNameMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", agentIds);
        for (const p of profiles || []) {
          agentNameMap[p.user_id] = p.full_name;
        }
      }

      // Get display_ids for orders referenced in status changes and notes
      const orderIds = [
        ...new Set([
          ...(statusChanges || []).map((s: any) => s.order_id),
          ...(orderNotes || []).map((n: any) => n.order_id),
        ]),
      ];
      const orderDisplayMap: Record<string, string> = {};
      if (orderIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, display_id")
          .in("id", orderIds);
        for (const o of orders || []) {
          orderDisplayMap[o.id] = o.display_id;
        }
      }

      // Merge into unified activity feed
      const activities: any[] = [];

      for (const s of statusChanges || []) {
        activities.push({
          id: s.id,
          type: "status_change",
          actor: s.changed_by_name || "System",
          description: `Changed order ${orderDisplayMap[s.order_id] || "?"} from ${s.from_status || "new"} to ${s.to_status}`,
          order_id: s.order_id,
          display_id: orderDisplayMap[s.order_id],
          metadata: { from: s.from_status, to: s.to_status },
          timestamp: s.changed_at,
        });
      }

      for (const c of callLogs || []) {
        activities.push({
          id: c.id,
          type: "call",
          actor: agentNameMap[c.agent_id] || "Agent",
          description: `Made a ${c.outcome} call (${c.context_type})`,
          metadata: { outcome: c.outcome, context_type: c.context_type, notes: c.notes },
          timestamp: c.created_at,
        });
      }

      for (const n of orderNotes || []) {
        activities.push({
          id: n.id,
          type: "note",
          actor: n.author_name,
          description: `Added note on ${orderDisplayMap[n.order_id] || "order"}: "${n.text.substring(0, 60)}${n.text.length > 60 ? "..." : ""}"`,
          order_id: n.order_id,
          display_id: orderDisplayMap[n.order_id],
          timestamp: n.created_at,
        });
      }

      // Sort by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return json(activities.slice(0, limit));
    }

    // ============================================================
    // ADS CAMPAIGNS
    // ============================================================

    // GET /api/ads-campaigns
    if (req.method === "GET" && path === "ads-campaigns") {
      if (!isAdmin && !isAdsAdmin) return json({ error: "Forbidden" }, 403);
      const platform = url.searchParams.get("platform");
      const status = url.searchParams.get("status");
      const search = url.searchParams.get("search");

      let query = adminClient
        .from("ads_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (platform) query = query.eq("platform", platform);
      if (status) query = query.eq("status", status);
      if (search) query = query.ilike("campaign_name", `%${search}%`);

      const { data, error } = await query;
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data || []);
    }

    // POST /api/ads-campaigns
    if (req.method === "POST" && path === "ads-campaigns") {
      if (!isAdmin && !isAdsAdmin) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(createCampaignSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }

      const { data, error } = await adminClient
        .from("ads_campaigns")
        .insert({ campaign_name: body.campaign_name, platform: body.platform, budget: body.budget, notes: body.notes })
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Audit log
      await adminClient.from("ads_audit_logs").insert({
        campaign_id: data.id,
        action: "created",
        details: `Campaign "${body.campaign_name}" created on ${body.platform}`,
        performed_by: user.id,
      });

      return json(data);
    }

    // PATCH /api/ads-campaigns/:id
    if (req.method === "PATCH" && segments[0] === "ads-campaigns" && segments.length === 2) {
      if (!isAdmin && !isAdsAdmin) return json({ error: "Forbidden" }, 403);
      const campaignId = segments[1];
      const body = await req.json();

      const updates: Record<string, any> = {};
      if (body.campaign_name !== undefined) updates.campaign_name = body.campaign_name;
      if (body.platform !== undefined) updates.platform = body.platform;
      if (body.status !== undefined) updates.status = body.status;
      if (body.budget !== undefined) updates.budget = body.budget;
      if (body.notes !== undefined) updates.notes = body.notes;

      const { data, error } = await adminClient
        .from("ads_campaigns")
        .update(updates)
        .eq("id", campaignId)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Audit log
      await adminClient.from("ads_audit_logs").insert({
        campaign_id: campaignId,
        action: "updated",
        details: `Updated fields: ${Object.keys(updates).join(", ")}`,
        performed_by: user.id,
      });

      return json(data);
    }

    // DELETE /api/ads-campaigns/:id
    if (req.method === "DELETE" && segments[0] === "ads-campaigns" && segments.length === 2) {
      if (!isAdmin && !isAdsAdmin) return json({ error: "Forbidden" }, 403);
      const campaignId = segments[1];

      // Audit log before delete
      await adminClient.from("ads_audit_logs").insert({
        campaign_id: campaignId,
        action: "deleted",
        details: `Campaign deleted`,
        performed_by: user.id,
      });

      const { error } = await adminClient.from("ads_campaigns").delete().eq("id", campaignId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json({ success: true });
    }

    // GET /api/inbound-leads (admin only)
    if (req.method === "GET" && path === "inbound-leads") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const status = url.searchParams.get("status");
      let query = adminClient
        .from("inbound_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // PATCH /api/inbound-leads/:id (admin only)
    if (req.method === "PATCH" && segments[0] === "inbound-leads" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const leadId = segments[1];
      const body = await req.json();
      const allowed: Record<string, boolean> = { status: true, name: true, phone: true, source: true };
      const updates: Record<string, any> = {};
      for (const [k, v] of Object.entries(body)) {
        if (allowed[k]) updates[k] = v;
      }
      if (Object.keys(updates).length === 0) return json({ error: "No valid fields" }, 400);
      const { error } = await adminClient.from("inbound_leads").update(updates).eq("id", leadId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Sync status to linked order
      if (updates.status) {
        const validOrderStatuses = ["pending", "take", "call_again", "confirmed", "shipped", "delivered", "returned", "paid", "trashed", "cancelled"];
        if (validOrderStatuses.includes(updates.status)) {
          await adminClient
            .from("orders")
            .update({ status: updates.status })
            .eq("inbound_lead_id", leadId);
        }
      }

      return json({ success: true });
    }

    // DELETE /api/inbound-leads/:id (admin only)
    if (req.method === "DELETE" && segments[0] === "inbound-leads" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const leadId = segments[1];
      const { error } = await adminClient.from("inbound_leads").delete().eq("id", leadId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json({ success: true });
    }

    // ── WEBHOOKS CRUD (admin only) ──

    // GET /api/webhooks
    if (req.method === "GET" && path === "webhooks") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const { data, error } = await adminClient
        .from("webhooks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // POST /api/webhooks
    if (req.method === "POST" && path === "webhooks") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const productName = (body.product_name || "").trim();
      if (!productName || productName.length > 200) return json({ error: "Product name is required (max 200 chars)" }, 400);
      const description = (body.description || "").substring(0, 2000);

      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 60) + "-" + crypto.randomUUID().substring(0, 8);

      const { data, error } = await adminClient
        .from("webhooks")
        .insert({ product_name: productName, description, slug, created_by: user.id })
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // PATCH /api/webhooks/:id
    if (req.method === "PATCH" && segments[0] === "webhooks" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const webhookId = segments[1];
      const body = await req.json();
      const updates: Record<string, any> = {};
      if (body.product_name !== undefined) updates.product_name = body.product_name.substring(0, 200);
      if (body.description !== undefined) updates.description = body.description.substring(0, 2000);
      if (body.status !== undefined && ["active", "disabled"].includes(body.status)) updates.status = body.status;
      if (Object.keys(updates).length === 0) return json({ error: "No valid fields" }, 400);

      const { data, error } = await adminClient
        .from("webhooks")
        .update(updates)
        .eq("id", webhookId)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // DELETE /api/webhooks/:id
    if (req.method === "DELETE" && segments[0] === "webhooks" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const webhookId = segments[1];
      const { error } = await adminClient.from("webhooks").delete().eq("id", webhookId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json({ success: true });
    }

    // ============================================================
    // SUPPLIERS
    // ============================================================

    // GET /api/suppliers
    if (req.method === "GET" && path === "suppliers") {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // POST /api/suppliers
    if (req.method === "POST" && path === "suppliers") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(createSupplierSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }
      const { data, error } = await adminClient
        .from("suppliers")
        .insert(body)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // PATCH /api/suppliers/:id
    if (req.method === "PATCH" && segments[0] === "suppliers" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const supplierId = segments[1];
      const body = await req.json();
      const updates: Record<string, any> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.contact_info !== undefined) updates.contact_info = body.contact_info;
      if (body.email !== undefined) updates.email = body.email;
      if (body.phone !== undefined) updates.phone = body.phone;
      if (body.address !== undefined) updates.address = body.address;
      const { data, error } = await adminClient
        .from("suppliers")
        .update(updates)
        .eq("id", supplierId)
        .select()
        .single();
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json(data);
    }

    // DELETE /api/suppliers/:id
    if (req.method === "DELETE" && segments[0] === "suppliers" && segments.length === 2) {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      const supplierId = segments[1];
      const { error } = await adminClient.from("suppliers").delete().eq("id", supplierId);
      if (error) return json({ error: sanitizeDbError(error) }, 400);
      return json({ success: true });
    }

    // ============================================================
    // RESTOCK
    // ============================================================

    // POST /api/restock
    if (req.method === "POST" && path === "restock") {
      if (!isAdminOrManager) return json({ error: "Forbidden" }, 403);
      let body;
      try { body = parseBody(restockSchema, await req.json()); } catch (e: any) { return json({ error: e.message }, 400); }

      const { data: product } = await adminClient
        .from("products")
        .select("stock_quantity, name")
        .eq("id", body.product_id)
        .single();
      if (!product) return json({ error: "Product not found" }, 404);

      const newQty = product.stock_quantity + body.quantity;
      await adminClient.from("products").update({ stock_quantity: newQty }).eq("id", body.product_id);
      await adminClient.from("inventory_logs").insert({
        product_id: body.product_id,
        change_amount: body.quantity,
        previous_stock: product.stock_quantity,
        new_stock: newQty,
        reason: "restock",
        movement_type: "restock",
        user_id: user.id,
        supplier_name: body.supplier_name,
        invoice_number: body.invoice_number,
        notes: body.notes,
      });

      return json({ success: true, product_name: product.name, new_stock: newQty });
    }

    // GET /api/stock-movements (all movements across products)
    if (req.method === "GET" && path === "stock-movements") {
      const productId = url.searchParams.get("product_id");
      const movementType = url.searchParams.get("movement_type");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      let query = adminClient
        .from("inventory_logs")
        .select("*, products:product_id(name, sku)")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (productId) query = query.eq("product_id", productId);
      if (movementType) query = query.eq("movement_type", movementType);

      const { data, error } = await query;
      if (error) return json({ error: sanitizeDbError(error) }, 400);

      // Enrich with user names
      const userIds = [...new Set((data || []).map((d: any) => d.user_id).filter(Boolean))];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);
      const profileMap: Record<string, string> = {};
      for (const p of profiles || []) profileMap[p.user_id] = p.full_name;

      const enriched = (data || []).map((d: any) => ({
        ...d,
        user_name: profileMap[d.user_id] || "System",
        product_name: d.products?.name || "Unknown",
        product_sku: d.products?.sku || "",
      }));

      return json(enriched);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("API Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function sanitizeDbError(err: any): string {
  if (err?.code === '23505') return 'Duplicate entry';
  if (err?.code === '23503') return 'Referenced record not found';
  if (err?.code === '23502') return 'Required field missing';
  if (err?.code === '42P01') return 'Operation failed';
  if (err?.code === '42703') return 'Operation failed';
  console.error('Database error:', JSON.stringify(err));
  return 'Operation failed';
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
