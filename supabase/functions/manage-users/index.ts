import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "Admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...data } = await req.json();
    console.log("Action received:", action, "Data:", JSON.stringify(data));

    switch (action) {
      case "list": {
        // Get all users from auth.users with their emails
        const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers();
        
        if (error) {
          console.error("List users error:", error);
          throw error;
        }

        console.log("Listed", authUsers.users.length, "users");
        return new Response(JSON.stringify({ users: authUsers.users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "create": {
        const { email, password, fullName, role } = data;
        
        const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            role: role,
          },
        });

        if (error) {
          console.error("Create user error:", error);
          // Handle duplicate email error gracefully
          if (error.message?.includes("already been registered") || error.message?.includes("already exists")) {
            return new Response(JSON.stringify({ error: "A user with this email already exists. Please use a different email address." }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw error;
        }

        console.log("User created successfully:", newUser.user?.id);
        return new Response(JSON.stringify({ user: newUser }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        const { userId } = data;
        
        console.log("Deleting user and related records:", userId);

        // Delete related records first to avoid foreign key constraint errors
        // Order matters: delete child records before parent
        const cleanupTables = [
          { table: "user_store_assignments", column: "user_id" },
          { table: "notifications", column: "user_id" },
        ];

        for (const { table, column } of cleanupTables) {
          const { error: cleanupError } = await supabaseAdmin
            .from(table)
            .delete()
            .eq(column, userId);
          if (cleanupError) {
            console.error(`Failed to clean up ${table}:`, cleanupError);
          }
        }

        // Nullify references in sales_orders (don't delete orders, just unlink user)
        const nullifyColumns = [
          { table: "sales_orders", column: "created_by" },
          { table: "sales_orders", column: "submitted_by" },
          { table: "sales_orders", column: "approved_by" },
          { table: "sales_orders", column: "fulfilled_by" },
          { table: "sales_orders", column: "payment_confirmed_by" },
          { table: "purchase_orders", column: "created_by" },
          { table: "purchase_orders", column: "approved_by" },
          { table: "purchase_orders", column: "received_by" },
          { table: "purchase_orders", column: "verified_by" },
          { table: "purchase_orders", column: "cash_given_by" },
          { table: "purchase_orders", column: "cash_returned_to" },
          { table: "stock_movements", column: "performed_by" },
          { table: "stock_movements", column: "marked_expired_by" },
          { table: "assembly_orders", column: "created_by" },
          { table: "audit_logs", column: "user_id" },
        ];

        for (const { table, column } of nullifyColumns) {
          const { error: nullifyError } = await supabaseAdmin
            .from(table)
            .update({ [column]: null })
            .eq(column, userId);
          if (nullifyError) {
            console.log(`Note: could not nullify ${table}.${column}:`, nullifyError.message);
          }
        }

        // Delete user profile
        const { error: profileError } = await supabaseAdmin
          .from("user_profiles")
          .delete()
          .eq("id", userId);
        if (profileError) {
          console.error("Failed to delete user profile:", profileError);
        }

        // Finally delete the auth user
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) throw error;

        console.log("User deleted successfully:", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset-password": {
        const { userId, newPassword } = data;
        
        console.log("Password reset requested for user:", userId);
        
        if (!newPassword || newPassword.length < 6) {
          console.log("Password validation failed: too short");
          return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: updateData, error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (error) {
          console.error("Password reset error:", error);
          throw error;
        }

        console.log("Password reset successful for user:", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
