import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Get user roles (support multiple roles)
    const { data: roleRows } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleRows || []).map((r: any) => r.role);
    const isAdmin = roles.includes("admin");
    const isAgent = roles.includes("agent");
    const isWarehouse = roles.includes("warehouse");
    const isDualRole = isAdmin && isAgent;

    // ============================================================
    // ROUTING
    // ============================================================

    // POST /api/users/create (admin only)
    if (req.method === "POST" && path === "users/create") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { email, password, full_name, roles: newRoles } = body;
      // Support legacy single role field
      const rolesToAssign: string[] = newRoles || (body.role ? [body.role] : []);

      if (!email || !password || !full_name || rolesToAssign.length === 0) {
        return json({ error: "Missing required fields: email, password, full_name, roles" }, 400);
      }
      const validRoles = ["admin", "agent", "warehouse"];
      if (rolesToAssign.some((r: string) => !validRoles.includes(r))) {
        return json({ error: `Roles must be one of: ${validRoles.join(", ")}` }, 400);
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      // Assign all roles
      for (const r of rolesToAssign) {
        await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: r });
      }

      return json({ success: true, user_id: newUser.user.id });
    }

    // PUT /api/users/:id/roles (admin only - set roles array)
    if (req.method === "PUT" && segments[0] === "users" && segments[2] === "roles") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
      const body = await req.json();
      const { roles: newRoles } = body;

      if (!newRoles || !Array.isArray(newRoles) || newRoles.length === 0) {
        return json({ error: "At least one role is required" }, 400);
      }
      const validRoles = ["admin", "agent", "warehouse"];
      if (newRoles.some((r: string) => !validRoles.includes(r))) {
        return json({ error: `Roles must be one of: ${validRoles.join(", ")}` }, 400);
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
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
      // Prevent admin from deleting themselves
      if (userId === user.id) {
        return json({ error: "Cannot delete yourself" }, 400);
      }
      // Delete role, profile, then auth user
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("user_id", userId);
      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) return json({ error: delErr.message }, 400);
      return json({ success: true });
    }

    // GET /api/users (admin only)
    if (req.method === "GET" && path === "users") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);

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

    // GET /api/users/agents (list active agents - includes users with agent role even if also admin)
    if (req.method === "GET" && path === "users/agents") {
      const { data: agents } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true);

      // Filter to those with agent role (includes dual-role users)
      const agentUsers = [];
      for (const a of agents || []) {
        const { data: r } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", a.user_id)
          .eq("role", "agent")
          .single();
        if (r) agentUsers.push(a);
      }
      return json(agentUsers);
    }

    // POST /api/orders (create order)
    if (req.method === "POST" && path === "orders") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { product_id, product_name, customer_name, customer_phone, customer_city, customer_address, postal_code, birthday, price } = body;

      if (!product_name) return json({ error: "Product name is required" }, 400);

      const { data: order, error: orderErr } = await adminClient
        .from("orders")
        .insert({
          product_id,
          product_name,
          customer_name: customer_name || "",
          customer_phone: customer_phone || "",
          customer_city: customer_city || "",
          customer_address: customer_address || "",
          postal_code: postal_code || "",
          birthday: birthday || null,
          price: price || 0,
          status: "pending",
        })
        .select()
        .single();

      if (orderErr) return json({ error: orderErr.message }, 400);

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
      if (error) return json({ error: error.message }, 400);

      return json({ orders, total: count, page, limit });
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
      const body = await req.json();
      const { customer_name, customer_phone, customer_city, customer_address, postal_code, birthday } = body;

      const updates: Record<string, any> = {};
      if (customer_name !== undefined) updates.customer_name = customer_name;
      if (customer_phone !== undefined) updates.customer_phone = customer_phone;
      if (customer_city !== undefined) updates.customer_city = customer_city;
      if (customer_address !== undefined) updates.customer_address = customer_address;
      if (postal_code !== undefined) updates.postal_code = postal_code;
      if (birthday !== undefined) updates.birthday = birthday;

      const { data, error } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId)
        .select()
        .single();

      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // PATCH /api/orders/:id/status
    if (req.method === "PATCH" && segments[0] === "orders" && segments[2] === "status") {
      const orderId = segments[1];
      const body = await req.json();
      const { status: newStatus } = body;

      // Get current order
      const { data: order } = await adminClient
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();
      if (!order) return json({ error: "Order not found" }, 404);

      // Agent permission check
      const agentAllowed = ["pending", "take", "call_again", "confirmed"];
      if (!isAdmin && !agentAllowed.includes(newStatus)) {
        return json({ error: `Agents can only set status to: ${agentAllowed.join(", ")}` }, 403);
      }

      // Validation: require fields for certain statuses
      const requiresComplete = ["confirmed", "shipped", "returned", "paid", "cancelled"];
      if (requiresComplete.includes(newStatus)) {
        if (!order.customer_name?.trim() || !order.customer_phone?.trim() || !order.customer_city?.trim() || !order.customer_address?.trim()) {
          return json({ error: "Name, Telephone, City, and Address must be filled before changing to this status" }, 400);
        }
      }

      // Stock check on confirm
      if (newStatus === "confirmed" && order.status !== "confirmed" && order.product_id) {
        const { data: product } = await adminClient
          .from("products")
          .select("stock_quantity, name")
          .eq("id", order.product_id)
          .single();
        if (product && product.stock_quantity <= 0) {
          return json({ error: `Out of Stock: ${product.name} has no available inventory` }, 400);
        }
        if (product && product.stock_quantity > 0) {
          const newQty = product.stock_quantity - 1;
          await adminClient.from("products").update({ stock_quantity: newQty }).eq("id", order.product_id);
          await adminClient.from("inventory_logs").insert({
            product_id: order.product_id,
            change_amount: -1,
            previous_stock: product.stock_quantity,
            new_stock: newQty,
            reason: "order",
            user_id: user.id,
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
      if (updateErr) return json({ error: updateErr.message }, 400);

      // Log history
      await adminClient.from("order_history").insert({
        order_id: orderId,
        from_status: order.status,
        to_status: newStatus,
        changed_by: user.id,
        changed_by_name: profile?.full_name || user.email,
      });

      return json({ success: true });
    }

    // POST /api/orders/:id/assign
    if (req.method === "POST" && segments[0] === "orders" && segments[2] === "assign") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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

      if (error) return json({ error: error.message }, 400);
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
        const deals_won = orders.filter((o: any) => ["confirmed", "paid"].includes(o.status)).length + confirmedLeads.length;
        const deals_lost = orders.filter((o: any) => ["returned", "cancelled", "trashed"].includes(o.status)).length;
        const total_value = orders.filter((o: any) => ["confirmed", "paid", "shipped"].includes(o.status)).reduce((sum: number, o: any) => sum + Number(o.price || 0), 0);
        const tasks_completed = calls.length;
        // total_orders includes standard orders + confirmed prediction leads
        const total_orders = orders.length + confirmedLeads.length;

        // Source breakdown
        const orders_from_standard = orders.filter((o: any) => ["confirmed", "paid"].includes(o.status)).length;
        const orders_from_leads = confirmedLeads.length;

        const dailyBreakdown: Record<string, { leads: number; deals_won: number; deals_lost: number; orders: number; calls: number }> = {};
        for (const o of orders) {
          const day = o.created_at.substring(0, 10);
          if (!dailyBreakdown[day]) dailyBreakdown[day] = { leads: 0, deals_won: 0, deals_lost: 0, orders: 0, calls: 0 };
          dailyBreakdown[day].orders++;
          if (["confirmed", "paid"].includes(o.status)) dailyBreakdown[day].deals_won++;
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

      if (!isAdmin) {
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
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // POST /api/products
    if (req.method === "POST" && path === "products") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      if (!body.name?.trim()) return json({ error: "Product name is required" }, 400);

      const { data, error } = await adminClient
        .from("products")
        .insert({
          name: body.name.trim(),
          description: body.description || "",
          price: body.price || 0,
          sku: body.sku || null,
          stock_quantity: body.stock_quantity ?? 0,
          low_stock_threshold: body.low_stock_threshold ?? 5,
          photo_url: body.photo_url || null,
          is_active: body.is_active ?? true,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // PATCH /api/products/:id
    if (req.method === "PATCH" && segments[0] === "products" && segments.length === 2) {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (error) return json({ error: error.message }, 400);
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
      if (error) return json({ error: error.message }, 400);
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
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // POST /api/prediction-lists (upload)
    if (req.method === "POST" && path === "prediction-lists") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { name, entries } = body;

      if (!name?.trim()) return json({ error: "List name is required" }, 400);
      if (!entries?.length) return json({ error: "No entries provided" }, 400);

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
      if (listErr) return json({ error: listErr.message }, 400);

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
      if (leadsErr) return json({ error: leadsErr.message }, 400);

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
        .order("created_at", { ascending: true });

      return json({ ...list, entries: leads || [] });
    }

    // POST /api/prediction-lists/:id/assign (bulk assign)
    if (req.method === "POST" && segments[0] === "prediction-lists" && segments[2] === "assign") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (error) return json({ error: error.message }, 400);

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
      const { data, error } = await supabase
        .from("prediction_leads")
        .select("*, prediction_lists(name)")
        .eq("assigned_agent_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // POST /api/prediction-leads/unassign (admin: bulk unassign leads)
    if (req.method === "POST" && path === "prediction-leads/unassign") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (error) return json({ error: error.message }, 400);

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

      const { data, error } = await supabase
        .from("prediction_leads")
        .update(updates)
        .eq("id", leadId)
        .select()
        .single();
      if (error) return json({ error: error.message }, 400);
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
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // GET /api/agent-performance (admin only)
    if (req.method === "GET" && path === "agent-performance") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (error) return json({ error: error.message }, 400);
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
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
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
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // POST /api/call-logs
    if (req.method === "POST" && path === "call-logs") {
      const body = await req.json();
      const { context_type, context_id, outcome, notes } = body;
      if (!context_type || !context_id || !outcome) {
        return json({ error: "context_type, context_id, and outcome are required" }, 400);
      }

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
      if (error) return json({ error: error.message }, 400);

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
      if (!isAdmin) {
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
      if (logsErr) return json({ error: logsErr.message }, 400);

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
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // ============================================================
    // SHIFTS
    // ============================================================

    // POST /api/shifts (admin only)
    if (req.method === "POST" && path === "shifts") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { name, date, start_time, end_time, agent_ids } = body;
      if (!name?.trim() || !date || !start_time || !end_time) {
        return json({ error: "name, date, start_time, end_time are required" }, 400);
      }

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
        if (shiftErr) return json({ error: shiftErr.message }, 400);

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
      if (error) return json({ error: error.message }, 400);

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
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const shiftId = segments[1];
      const body = await req.json();
      const { agent_ids, ...shiftUpdates } = body;

      if (Object.keys(shiftUpdates).length > 0) {
        const { error } = await adminClient.from("shifts").update(shiftUpdates).eq("id", shiftId);
        if (error) return json({ error: error.message }, 400);
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
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const shiftId = segments[1];
      const { error } = await adminClient.from("shifts").delete().eq("id", shiftId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    // ============================================================
    // WAREHOUSE
    // ============================================================

    // GET /api/warehouse/incoming-orders (confirmed orders + confirmed prediction leads)
    if (req.method === "GET" && path === "warehouse/incoming-orders") {
      if (!isAdmin && !isWarehouse) return json({ error: "Forbidden" }, 403);
      const agentFilter = url.searchParams.get("agent_id");
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      const productFilter = url.searchParams.get("product");
      const sourceFilter = url.searchParams.get("source"); // "order" | "prediction_lead" | null

      const results: any[] = [];

      // 1. Confirmed orders (source = "order")
      if (!sourceFilter || sourceFilter === "order") {
        let oQuery = adminClient.from("orders").select("*").eq("status", "confirmed").order("created_at", { ascending: false });
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

      // 2. Confirmed prediction leads (source = "prediction_lead")
      if (!sourceFilter || sourceFilter === "prediction_lead") {
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
      if (!isAdmin && !isWarehouse) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 400);

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
      if (!isAdmin && !isWarehouse) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { user_id: targetUserId, product_id, quantity, notes: itemNotes } = body;
      if (!targetUserId || !product_id) return json({ error: "user_id and product_id are required" }, 400);

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
        if (error) return json({ error: error.message }, 400);
        result = data;
      } else {
        const { data, error } = await adminClient
          .from("user_warehouse")
          .insert({ user_id: targetUserId, product_id, quantity: quantity || 1, assigned_by: user.id, notes: itemNotes || "" })
          .select()
          .single();
        if (error) return json({ error: error.message }, 400);
        result = data;
      }
      return json(result);
    }

    // PATCH /api/warehouse/user-items/:id (admin: update assignment)
    if (req.method === "PATCH" && segments[0] === "warehouse" && segments[1] === "user-items" && segments.length === 3) {
      if (!isAdmin && !isWarehouse) return json({ error: "Forbidden" }, 403);
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
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    // DELETE /api/warehouse/user-items/:id (admin only)
    if (req.method === "DELETE" && segments[0] === "warehouse" && segments[1] === "user-items" && segments.length === 3) {
      if (!isAdmin && !isWarehouse) return json({ error: "Forbidden" }, 403);
      const itemId = segments[2];
      const { error } = await adminClient.from("user_warehouse").delete().eq("id", itemId);
      if (error) return json({ error: error.message }, 400);
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

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("API Error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
