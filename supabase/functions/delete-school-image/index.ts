const BUCKET = "school-media";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function jsonResponse(body: Record<string, string>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    if (!headers["Access-Control-Allow-Origin"]) return new Response(null, { status: 403, headers });
    return new Response("ok", { headers });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);
  if (!origin || !headers["Access-Control-Allow-Origin"]) {
    return jsonResponse({ error: "This website is not allowed to delete images." }, 403, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseApiKey = Deno.env.get("FIREBASE_WEB_API_KEY");
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!supabaseUrl || !serviceRoleKey || !firebaseApiKey || adminEmails.length === 0) {
    return jsonResponse({ error: "Image deletion is not configured on the server." }, 500, origin);
  }

  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Sign in to delete an image." }, 401, origin);

  try {
    const identityResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      }
    );
    if (!identityResponse.ok) return jsonResponse({ error: "Your sign-in has expired. Please sign in again." }, 401, origin);

    const identity = await identityResponse.json();
    const user = identity.users?.[0];
    const email = String(user?.email || "").trim().toLowerCase();
    if (!user || user.disabled || !adminEmails.includes(email)) {
      return jsonResponse({ error: "This account is not authorized to delete images." }, 403, origin);
    }

    const body = await request.json().catch(() => null);
    const path = typeof body?.path === "string" ? body.path : "";
    if (
      !/^(hero|news|gallery|headshots)\/[0-9a-f-]{36}\.webp$/i.test(path)
      || path.includes("..")
      || path.includes("%")
      || path.includes("\\")
      || path.includes("?")
      || path.includes("#")
    ) {
      return jsonResponse({ error: "Invalid Olistar image path." }, 400, origin);
    }

    const storagePath = path.split("/").map(encodeURIComponent).join("/");
    const deleteResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      }
    );
    if (!deleteResponse.ok) {
      console.error("Supabase Storage image deletion failed:", deleteResponse.status, await deleteResponse.text());
      return jsonResponse({ error: "Storage could not delete the image. Please try again." }, 502, origin);
    }

    return jsonResponse({ message: "Image deleted." }, 200, origin);
  } catch (error) {
    console.error("Image deletion function failed:", error);
    return jsonResponse({ error: "The image could not be deleted. Please try again." }, 500, origin);
  }
});
