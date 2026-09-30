const BUCKET = "school-applications";
const SIGNED_URL_SECONDS = 15 * 60;
const MAX_PASSPORT_BYTES = 2 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
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
const FILES: Record<string, { folder: string; maxBytes: number; types: string[] }> = {
  passportPhoto: { folder: "passport-photo", maxBytes: MAX_PASSPORT_BYTES, types: ["image/jpeg", "image/png", "image/webp"] },
  reportCard: { folder: "report-card", maxBytes: MAX_DOCUMENT_BYTES, types: ["application/pdf", "image/jpeg", "image/png"] },
  birthCertificate: { folder: "birth-certificate", maxBytes: MAX_DOCUMENT_BYTES, types: ["application/pdf", "image/jpeg", "image/png"] }
};

class ApplicationFileError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" }
  });
}

function validReference(reference: string) {
  return /^OLS-[A-Z0-9]{8}$/i.test(reference);
}

function validPath(path: unknown): path is string {
  return typeof path === "string"
    && /^OLS-[A-Z0-9]{8}\/(passport-photo|report-card|birth-certificate)\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/i.test(path)
    && !path.includes("..")
    && !path.includes("%")
    && !path.includes("\\");
}

function fileExtension(contentType: string) {
  return contentType === "image/jpeg" ? "jpg"
    : contentType === "image/png" ? "png"
    : contentType === "image/webp" ? "webp"
    : "pdf";
}

async function hasValidSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47].every((byte, index) => bytes[index] === byte);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (file.type === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  return false;
}

async function signObject(supabaseUrl: string, serviceRoleKey: string, path: string) {
  const storagePath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_SECONDS })
  });
  if (!response.ok) {
    console.error("Could not create a private application-file link:", response.status, await response.text());
    throw new Error("Could not prepare a secure file preview.");
  }
  const result = await response.json();
  const signedUrl = String(result.signedURL || result.signedUrl || "");
  if (!signedUrl) throw new Error("Storage did not return a secure file preview.");
  return signedUrl.startsWith("http") ? signedUrl : `${supabaseUrl}/storage/v1${signedUrl}`;
}

async function verifyAdmin(request: Request, firebaseApiKey: string, adminEmails: string[]) {
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    }
  );
  if (!response.ok) return false;
  const identity = await response.json();
  const user = identity.users?.[0];
  return Boolean(user && !user.disabled && adminEmails.includes(String(user.email || "").trim().toLowerCase()));
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (request.method === "OPTIONS") {
    return headers["Access-Control-Allow-Origin"]
      ? new Response("ok", { headers })
      : new Response(null, { status: 403, headers });
  }
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, origin);
  if (!origin || !headers["Access-Control-Allow-Origin"]) {
    return jsonResponse({ error: "This website is not allowed to access application files." }, 403, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Private application-file storage is not configured." }, 500, origin);
  }

  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const reference = String(form.get("reference") || "");
      if (!validReference(reference)) return jsonResponse({ error: "Invalid application reference." }, 400, origin);

      const uploaded: Record<string, string> = {};
      const result: Record<string, { path: string; url: string; contentType: string }> = {};
      try {
        for (const [field, config] of Object.entries(FILES)) {
          const file = form.get(field);
          if (!(file instanceof File) || file.size === 0) continue;
          if (!config.types.includes(file.type) || file.size > config.maxBytes) {
            throw new Error(`${field} has an unsupported file type or exceeds its size limit.`);
          }
          if (!await hasValidSignature(file)) throw new Error(`${field} does not match its declared file type.`);

          const path = `${reference}/${config.folder}/${crypto.randomUUID()}.${fileExtension(file.type)}`;
          const storagePath = path.split("/").map(encodeURIComponent).join("/");
          const response = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
            method: "POST",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              "Content-Type": file.type,
              "x-upsert": "false"
            },
            body: file
          });
          if (!response.ok) {
            const storageError = await response.text();
            console.error("Private application-file upload failed:", response.status, storageError);
            if (/bucket not found/i.test(storageError)) {
              throw new ApplicationFileError(
                `The private "${BUCKET}" storage bucket has not been created yet. Create it in Supabase Storage with public access turned off, then submit again.`,
                503
              );
            }
            throw new ApplicationFileError(
              `Supabase Storage rejected the ${field} upload (HTTP ${response.status}). Check the private bucket's file-size and allowed-type settings, then try again.`,
              502
            );
          }
          uploaded[field] = path;
          result[field] = { path, url: await signObject(supabaseUrl, serviceRoleKey, path), contentType: file.type };
        }
      } catch (error) {
        const cleanup = Object.values(uploaded).map((path) => {
          const storagePath = path.split("/").map(encodeURIComponent).join("/");
          return fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`, {
            method: "DELETE",
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
          });
        });
        const cleanupResponses = await Promise.all(cleanup);
        if (cleanupResponses.some((response) => !response.ok)) {
          console.error("Some incomplete application uploads could not be cleaned up.");
        }
        throw error;
      }
      return jsonResponse({ files: result }, 201, origin);
    }

    const firebaseApiKey = Deno.env.get("FIREBASE_WEB_API_KEY");
    const adminEmails = (Deno.env.get("ADMIN_EMAILS") || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (!firebaseApiKey || adminEmails.length === 0) {
      return jsonResponse({ error: "Application-file access is not configured." }, 500, origin);
    }
    if (!await verifyAdmin(request, firebaseApiKey, adminEmails)) {
      return jsonResponse({ error: "Only an authorized administrator can view application files." }, 403, origin);
    }

    const body = await request.json();
    if (body?.action === "delete") {
      const paths = body.paths;
      if (!Array.isArray(paths) || paths.length > 60 || paths.some((path) => !validPath(path))) {
        return jsonResponse({ error: "Invalid applicant-file deletion request." }, 400, origin);
      }

      for (const path of [...new Set(paths as string[])]) {
        const storagePath = path.split("/").map(encodeURIComponent).join("/");
        const response = await fetch(
          `${supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
          {
            method: "DELETE",
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
          }
        );
        if (!response.ok && response.status !== 404) {
          const storageError = await response.text();
          console.error("Private applicant-file deletion failed:", response.status, storageError);
          throw new ApplicationFileError("Supabase could not remove an applicant file. The application record was kept; try deleting it again.", 502);
        }
      }
      return jsonResponse({ message: "Applicant files deleted." }, 200, origin);
    }

    const paths = body?.paths;
    if (!paths || typeof paths !== "object" || Array.isArray(paths)) {
      return jsonResponse({ error: "Application file paths are missing." }, 400, origin);
    }
    const urls: Record<string, string> = {};
    for (const [field, path] of Object.entries(paths)) {
      if (!Object.hasOwn(FILES, field) || !validPath(path)) {
        return jsonResponse({ error: "Invalid application file path." }, 400, origin);
      }
      urls[field] = await signObject(supabaseUrl, serviceRoleKey, path);
    }
    return jsonResponse({ urls }, 200, origin);
  } catch (error) {
    console.error("Application file request failed:", error);
    const status = error instanceof ApplicationFileError ? error.status : 400;
    return jsonResponse({ error: error instanceof Error ? error.message : "Could not process application files." }, status, origin);
  }
});
