// BinBuddy Edge Function: log in with a linked student ID.
//   action "request": emails a one-time code to the account that has this ID. Always answers { ok: true }, so nobody can test which IDs exist.
//   action "verify":  trades that code for a session. Any failure answers the same generic 401.
// The student ID alone never logs anyone in: the code only goes to the email on the account.
// Deploy with "Verify JWT" OFF (the site's publishable key is not a JWT). See SETUP.md.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { action, student_id, code } = await req.json();
    const id = String(student_id ?? "").trim().toUpperCase();
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? req.headers.get("apikey") ?? "", { auth: { persistSession: false } });

    let email: string | null = null;
    if (/^[A-Z0-9-]{4,20}$/.test(id)) {
      const { data: row } = await admin.from("private_info").select("id").eq("student_id", id).maybeSingle();
      if (row) {
        const { data } = await admin.auth.admin.getUserById(row.id);
        email = data?.user?.email ?? null;
      }
    }

    if (action === "request") {
      if (email) await anon.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      return json({ ok: true });
    }
    if (action === "verify") {
      const token = String(code ?? "").trim();
      if (!email || !/^\d{6,10}$/.test(token)) return json({ error: "invalid" }, 401);
      const { data, error } = await anon.auth.verifyOtp({ email, token, type: "email" });
      if (error || !data.session) return json({ error: "invalid" }, 401);
      return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    }
    return json({ error: "bad_request" }, 400);
  } catch (_e) {
    return json({ error: "bad_request" }, 400);
  }
});
