import { auth } from "./firebase-config.js";
import { supabaseConfig } from "./supabase-config.js";

const FUNCTION_URL = `${supabaseConfig.url}/functions/v1/admission-files`;

export async function uploadAdmissionFiles(reference, files) {
    const body = new FormData();
    body.append("reference", reference);
    for (const [field, file] of Object.entries(files)) {
        if (file) body.append(field, file, file.name);
    }
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: { apikey: supabaseConfig.publishableKey },
        body
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Application-file upload failed (${response.status}).`);
    return result.files || {};
}

export async function getAdmissionFileUrls(paths) {
    const user = auth.currentUser;
    if (!user) throw new Error("Sign in as an authorized administrator to view applicant files.");
    const response = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${await user.getIdToken()}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ paths })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Could not open applicant files (${response.status}).`);
    return result.urls || {};
}

export async function deleteAdmissionFiles(paths) {
    const uniquePaths = [...new Set(paths.filter((path) => typeof path === "string" && path))];
    if (!uniquePaths.length) return;

    const user = auth.currentUser;
    if (!user) throw new Error("Sign in as an authorized administrator to delete applicant files.");

    for (let index = 0; index < uniquePaths.length; index += 60) {
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                apikey: supabaseConfig.publishableKey,
                Authorization: `Bearer ${await user.getIdToken()}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "delete", paths: uniquePaths.slice(index, index + 60) })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Could not delete applicant files (${response.status}).`);
    }
}
