import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

    // Get user role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const role = roleData?.role || "agent";
    const isAdmin = role === "admin";

    // ============================================================
    // ROUTING
    // ============================================================

    // POST /api/users/create (admin only)
    if (req.method === "POST" && path === "users/create") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const body = await req.json();
      const { email, password, full_name, role: newRole } = body;

      if (!email || !password || !full_name || !newRole) {
        return json({ error: "Missing required fields: email, password, full_name, role" }, 400);
      }
      if (!["admin", "agent"].includes(newRole)) {
        return json({ error: "Role must be admin or agent" }, 400);
      }

      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) return json({ error: createErr.message }, 400);

      // Assign role
      await adminClient.from("user_roles").insert({ user_id: newUser.user.id, role: newRole });

      return json({ success: true, user_id: newUser.user.id });
    }

    // POST /api/users/:id/toggle-active (admin only)
    if (req.method === "POST" && segments[0] === "users" && segments[2] === "toggle-active") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);
      const userId = segments[1];
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

    // GET /api/users (admin only)
    if (req.method === "GET" && path === "users") {
      if (!isAdmin) return json({ error: "Forbidden" }, 403);

      const { data: users } = await adminClient
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Get all roles in one query
      const userIds = (users || []).map((u: any) => u.user_id);
      const { data: allRoles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      const roleMap: Record<string, string> = {};
      for (const r of allRoles || []) {
        roleMap[r.user_id] = r.role;
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

          return {
            ...u,
            role: roleMap[u.user_id] || "agent",
            orders_processed: ordersProcessed || 0,
            leads_processed: leadsProcessed || 0,
          };
        })
      );

      return json(enriched);
    }

    // GET /api/users/agents (list active agents)
    if (req.method === "GET" && path === "users/agents") {
      const { data: agents } = await adminClient
        .from("profiles")
        .select("user_id, full_name, email")
        .eq("is_active", true);

      // Filter to those with agent role
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

    // GET /api/orders/stats
    if (req.method === "GET" && path === "orders/stats") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");

      let query = adminClient.from("orders").select("status, created_at, assigned_agent_id, assigned_agent_name");
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);

      const { data: orders } = await query;
      
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

      return json({ statusCounts, agentCounts, dailyCounts, total: orders?.length || 0 });
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

    // PATCH /api/prediction-leads/:id (update status/notes)
    if (req.method === "PATCH" && segments[0] === "prediction-leads" && segments.length === 2) {
      const leadId = segments[1];
      const body = await req.json();

      const updates: Record<string, any> = {};
      if (body.status) updates.status = body.status;
      if (body.notes !== undefined) updates.notes = body.notes;

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
