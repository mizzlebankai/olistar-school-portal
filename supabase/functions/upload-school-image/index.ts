const BUCKET = "school-media";
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const CATEGORIES = new Set(["hero", "news", "gallery", "divisions", "headshots"]);
const DEFAULT_ALLOWED_ORIGINS = [
  "https://olistaredu.com",
  "https://www.olistaredu.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
];
const ALLOWED_ORIGINS = [...new Set([
  ...DEFAULT_ALLOWED_ORIGINS,
  ...(Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
])];

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
    if (!headers["Access-Control-Allow-Origin"]) {
      return new Response(null, { status: 403, headers });
    }
    return new Response("ok", { headers });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }
  if (!origin || !headers["Access-Control-Allow-Origin"]) {
    return jsonResponse({ error: "This website is not allowed to upload images." }, 403, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseApiKey = Deno.env.get("FIREBASE_WEB_API_KEY");
  const adminEmails = (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!supabaseUrl || !serviceRoleKey || !firebaseApiKey || adminEmails.length === 0) {
    return jsonResponse({ error: "Image upload is not configured on the server." }, 500, origin);
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Sign in to upload an image." }, 401, origin);

  try {
    const identityResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token })
      }
    );
    if (!identityResponse.ok) {
      return jsonResponse({ error: "Your sign-in has expired. Please sign in again." }, 401, origin);
    }

    const identity = await identityResponse.json();
    const user = identity.users?.[0];
    const email = String(user?.email || "").trim().toLowerCase();
    if (!user || user.disabled || !adminEmails.includes(email)) {
      return jsonResponse({ error: "This account is not authorized to upload images." }, 403, origin);
    }

    const form = await request.formData();
    const category = String(form.get("category") || "");
    const image = form.get("image");
    if (!CATEGORIES.has(category) || !(image instanceof File)) {
      return jsonResponse({ error: "Choose a valid image category and file." }, 400, origin);
    }
    if (image.type !== "image/webp" || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: "Upload a compressed WebP image no larger than 2 MB." }, 400, origin);
    }

    const path = `${category}/${crypto.randomUUID()}.webp`;
    const storagePath = path.split("/").map(encodeURIComponent).join("/");
    const uploadResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "image/webp",
          "Cache-Control": "31536000",
          "x-upsert": "false"
        },
        body: image
      }
    );

    if (!uploadResponse.ok) {
      console.error("Supabase Storage upload failed:", uploadResponse.status, await uploadResponse.text());
      return jsonResponse({ error: "Storage could not save the image. Please try again." }, 502, origin);
    }

    return jsonResponse({
      path,
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
    }, 201, origin);
  } catch (error) {
    console.error("Image upload function failed:", error);
    return jsonResponse({ error: "The image upload failed. Please try again." }, 500, origin);
  }
});
