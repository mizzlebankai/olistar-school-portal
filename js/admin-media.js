import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { addDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { supabaseConfig } from "./supabase-config.js";
import { WEBSITE_CONTENT } from "./website-content.js";
import { deleteUnusedImage } from "./media-management.js";

const ADMIN_EMAIL = "mizzlebankai@gmail.com";
const UPLOAD_FUNCTION = "upload-school-image";
const PRESETS = {
    hero: { width: 1920, height: 900 },
    news: { width: 1200, height: 675 },
    gallery: { width: 1200, height: 800 },
    headshots: { width: 600, height: 600 }
};
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const notice = document.getElementById("mediaNotice");
const form = document.getElementById("mediaUploadForm");
const categorySelect = document.getElementById("mediaCategory");
const fileInput = document.getElementById("mediaFile");
const preview = document.getElementById("mediaPreview");
const previewEmpty = document.getElementById("previewEmpty");
const previewFrame = document.getElementById("previewFrame");
const focusControls = document.getElementById("focusControls");
const focusX = document.getElementById("focusX");
const focusY = document.getElementById("focusY");
const dimensions = document.getElementById("mediaDimensions");
const uploadButton = document.getElementById("mediaUploadBtn");
const result = document.getElementById("uploadResult");
const uploadedUrl = document.getElementById("uploadedImageUrl");
const emailLabel = document.getElementById("mediaAdminEmail");
const mediaLibraryList = document.getElementById("mediaLibraryList");

let selectedImage = null;
let previewUrl = "";

function showNotice(message, type = "info") {
    notice.className = `alert alert-${type}`;
    notice.textContent = message;
}

function currentPreset() {
    return PRESETS[categorySelect.value];
}

function setPreviewShape() {
    const preset = currentPreset();
    previewFrame.classList.toggle("preview-headshot", categorySelect.value === "headshots");
    previewFrame.style.aspectRatio = `${preset.width} / ${preset.height}`;
    if (selectedImage) updatePreviewPosition();
}

function updatePreviewPosition() {
    preview.style.objectPosition = `${focusX.value}% ${focusY.value}%`;
}

function releasePreviewUrl() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
}

function drawCroppedImage(image, preset, horizontalFocus, verticalFocus) {
    const sourceAspect = image.width / image.height;
    const targetAspect = preset.width / preset.height;
    let cropWidth = image.width;
    let cropHeight = image.height;

    if (sourceAspect > targetAspect) {
        cropWidth = image.height * targetAspect;
    } else {
        cropHeight = image.width / targetAspect;
    }

    const sourceX = (image.width - cropWidth) * horizontalFocus;
    const sourceY = (image.height - cropHeight) * verticalFocus;
    const canvas = document.createElement("canvas");
    canvas.width = preset.width;
    canvas.height = preset.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the image in this browser.");

    context.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        preset.width,
        preset.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not compress this image. Try a different photo."));
        }, "image/webp", 0.82);
    });
}

async function refreshPreview() {
    if (!selectedImage) return;
    try {
        const blob = await drawCroppedImage(
            selectedImage,
            currentPreset(),
            Number(focusX.value) / 100,
            Number(focusY.value) / 100
        );
        releasePreviewUrl();
        previewUrl = URL.createObjectURL(blob);
        preview.src = previewUrl;
        preview.hidden = false;
        previewEmpty.hidden = true;
        dimensions.textContent = `${currentPreset().width} × ${currentPreset().height} px · WebP · ${(blob.size / 1024).toFixed(0)} KB`;
    } catch (error) {
        showNotice(error.message, "danger");
    }
}

function validateConfiguration() {
    if (!supabaseConfig.url || !supabaseConfig.publishableKey || supabaseConfig.publishableKey === "ADD_SUPABASE_PUBLISHABLE_KEY_HERE") {
        showNotice("Setup needed: add the Supabase publishable key in js/supabase-config.js. Do not use the service-role key here.", "warning");
        return false;
    }
    return true;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function loadMediaLibrary() {
    mediaLibraryList.innerHTML = '<p class="text-secondary mb-0">Loading images…</p>';
    try {
        const snapshot = await getDocs(collection(db, WEBSITE_CONTENT.media));
        const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
            .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0));
        if (!items.length) {
            mediaLibraryList.innerHTML = '<p class="text-secondary mb-0">No indexed uploads yet. New uploads will appear here.</p>';
            return;
        }
        mediaLibraryList.innerHTML = items.map((item) => `
            <div class="d-flex align-items-center gap-3 py-3 border-top">
                <img src="${escapeHtml(item.publicUrl)}" alt="${escapeHtml(item.altText || item.name || "Uploaded school image")}" class="rounded" style="width:96px;height:64px;object-fit:cover" loading="lazy" onerror="this.hidden=true">
                <div class="flex-grow-1 min-w-0">
                    <div class="fw-semibold text-break">${escapeHtml(item.name || item.path || "Uploaded image")}</div>
                    <div class="small text-secondary">${escapeHtml(item.category || "Image")}</div>
                </div>
                <button class="btn btn-sm btn-outline-danger" type="button" data-delete-media="${escapeHtml(item.id)}">Delete if unused</button>
            </div>
        `).join("");
    } catch (error) {
        console.error("Could not load media library:", error);
        mediaLibraryList.innerHTML = `<p class="text-danger mb-0">Could not load image library: ${escapeHtml(error.message)}</p>`;
    }
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }

    if ((user.email || "").toLowerCase() !== ADMIN_EMAIL) {
        showNotice("This account is not authorized to upload school images.", "danger");
        form.hidden = true;
        return;
    }

    emailLabel.textContent = user.email;
    form.hidden = false;
    validateConfiguration();
    loadMediaLibrary();
});

document.getElementById("mediaLogoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("admin-login.html");
});

categorySelect.addEventListener("change", () => {
    setPreviewShape();
    refreshPreview();
});

fileInput.addEventListener("change", async () => {
    selectedImage = null;
    releasePreviewUrl();
    result.hidden = true;
    const file = fileInput.files?.[0];

    if (!file) {
        preview.hidden = true;
        previewEmpty.hidden = false;
        focusControls.hidden = true;
        dimensions.textContent = "";
        return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > MAX_SOURCE_BYTES) {
        fileInput.value = "";
        showNotice("Choose a JPEG, PNG, or WebP image smaller than 15 MB.", "warning");
        return;
    }

    try {
        selectedImage = await createImageBitmap(file);
        focusControls.hidden = false;
        focusX.value = "50";
        focusY.value = "50";
        setPreviewShape();
        await refreshPreview();
        showNotice("Adjust the crop if needed, then upload.", "info");
    } catch {
        showNotice("This image could not be opened. Please choose another image.", "danger");
    }
});

focusX.addEventListener("input", refreshPreview);
focusY.addEventListener("input", refreshPreview);

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateConfiguration()) return;

    const user = auth.currentUser;
    if (!user || (user.email || "").toLowerCase() !== ADMIN_EMAIL) {
        showNotice("Please sign in with the authorized school administrator account.", "danger");
        return;
    }
    if (!selectedImage) {
        showNotice("Choose an image before uploading.", "warning");
        return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = "Preparing image…";
    result.hidden = true;

    try {
        const preset = currentPreset();
        const image = await drawCroppedImage(
            selectedImage,
            preset,
            Number(focusX.value) / 100,
            Number(focusY.value) / 100
        );
        if (image.size > MAX_OUTPUT_BYTES) {
            throw new Error("The compressed image is still too large. Choose a simpler or smaller photo.");
        }

        uploadButton.textContent = "Uploading image…";
        const token = await user.getIdToken();
        const body = new FormData();
        body.append("image", image, `${categorySelect.value}.webp`);
        body.append("category", categorySelect.value);

        const response = await fetch(`${supabaseConfig.url}/functions/v1/${UPLOAD_FUNCTION}`, {
            method: "POST",
            headers: {
                apikey: supabaseConfig.publishableKey,
                Authorization: `Bearer ${token}`
            },
            body
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Image upload failed (${response.status}).`);
        if (!payload.publicUrl) throw new Error("The upload completed without returning an image URL.");

        uploadedUrl.value = payload.publicUrl;
        result.hidden = false;
        try {
            await addDoc(collection(db, WEBSITE_CONTENT.media), {
                publicUrl: payload.publicUrl,
                path: payload.path || "",
                category: categorySelect.value,
                name: fileInput.files?.[0]?.name || "",
                createdBy: user.email || "",
                createdAt: serverTimestamp()
            });
            await loadMediaLibrary();
            showNotice(`Uploaded ${preset.width} × ${preset.height} ${categorySelect.value} image and added it to the media library.`, "success");
        } catch (error) {
            console.error("Image uploaded but could not be added to the Firestore media library:", error);
            showNotice(`Image uploaded, but it could not be added to the image picker: ${error.message}. Copy the URL below and check the media collection rules.`, "warning");
        }
    } catch (error) {
        showNotice(error.message || "Image upload failed. Please try again.", "danger");
    } finally {
        uploadButton.disabled = false;
        uploadButton.innerHTML = '<i class="bi bi-cloud-arrow-up me-1"></i> Prepare and upload';
    }
});

document.getElementById("copyImageUrlBtn").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(uploadedUrl.value);
        showNotice("Image URL copied to the clipboard.", "success");
    } catch {
        uploadedUrl.select();
        showNotice("Select and copy the image URL from the field.", "warning");
    }
});

document.getElementById("refreshMediaBtn").addEventListener("click", loadMediaLibrary);

mediaLibraryList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-media]");
    if (!button) return;
    const imageId = button.dataset.deleteMedia;
    button.disabled = true;
    try {
        const snapshot = await getDocs(collection(db, WEBSITE_CONTENT.media));
        const imageDoc = snapshot.docs.find((entry) => entry.id === imageId);
        if (!imageDoc) throw new Error("This image is no longer in the media library.");
        const image = { id: imageDoc.id, ...imageDoc.data() };
        if (!window.confirm(`Delete "${image.name || image.path || "this image"}" from Supabase? It will be removed only if no website content is using it.`)) return;
        await deleteUnusedImage(image);
        showNotice("Unused image and its media-library entry were deleted.", "success");
        await loadMediaLibrary();
    } catch (error) {
        showNotice(error.message, "warning");
    } finally {
        button.disabled = false;
    }
});

window.addEventListener("beforeunload", releasePreviewUrl);
setPreviewShape();
