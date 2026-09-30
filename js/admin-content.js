import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { CONTENT_TYPES, DIVISIONS, LEADERSHIP_PROFILES, PAGE_HEROES, WEBSITE_CONTENT } from "./website-content.js";
import { cleanupImageAfterContentDelete } from "./media-management.js";
import { plainTextToRichHtml, richHtmlToText, sanitizeRichHtml } from "./rich-content.js?v=20260928-rich-text";

const ADMIN_EMAIL = "mizzlebankai@gmail.com";
const editor = document.getElementById("contentEditor");
const notice = document.getElementById("contentNotice");
const form = document.getElementById("contentForm");
const idInput = document.getElementById("contentId");
const slotField = document.getElementById("slotField");
const slotLabel = document.getElementById("slotLabel");
const slotSelect = document.getElementById("contentSlot");
const titleInput = document.getElementById("contentTitle");
const categoryInput = document.getElementById("contentCategory");
const bodyEditor = document.getElementById("contentBodyEditor");
const dateInput = document.getElementById("contentDate");
const eventTimeInput = document.getElementById("contentEventTime");
const eventLocationInput = document.getElementById("contentEventLocation");
const linkInput = document.getElementById("contentLink");
const imageInput = document.getElementById("contentImageUrl");
const altInput = document.getElementById("contentAlt");
const descriptionInput = document.getElementById("contentDescription");
const publishedInput = document.getElementById("contentPublished");
const list = document.getElementById("contentList");
const filter = document.getElementById("contentFilter");
const saveButton = document.getElementById("saveContentBtn");
const savedImages = document.getElementById("savedImages");
const previewCategory = document.getElementById("previewCategory");
const previewTitle = document.getElementById("previewTitle");
const previewBody = document.getElementById("contentPreviewBody");
const previewImage = document.getElementById("previewImage");
const previewDate = document.getElementById("previewDate");
const previewNote = document.getElementById("previewNote");

let currentType = "news";
let currentItems = [];
let saving = false;
let quill = null;

function createRichEditor() {
    if (!window.Quill) {
        const editorNotice = document.getElementById("richEditorNotice");
        editorNotice.textContent = "The text-formatting editor did not load. Check your internet connection and reload this page before saving content.";
        editorNotice.hidden = false;
        return;
    }

    const Font = window.Quill.import("formats/font");
    Font.whitelist = ["arial", "georgia", "times-new-roman", "trebuchet-ms", "verdana", "serif", "monospace"];
    window.Quill.register(Font, true);
    const palette = [
        "#000000", "#212529", "#495057", "#6c757d",
        "#b02a37", "#7f1d1d", "#b45309", "#198754",
        "#0d6efd", "#084298", "#6610f2", "#4c1d95"
    ];
    document.querySelectorAll("#contentBodyToolbar .ql-color, #contentBodyToolbar .ql-background").forEach((select) => {
        const clearOption = document.createElement("option");
        clearOption.value = "";
        clearOption.selected = true;
        clearOption.setAttribute("aria-label", "Default");
        select.append(clearOption);
        palette.forEach((color) => {
            const option = document.createElement("option");
            option.value = color;
            option.style.backgroundColor = color;
            option.setAttribute("aria-label", color);
            select.append(option);
        });
    });
    quill = new window.Quill(bodyEditor, {
        theme: "snow",
        modules: {
            toolbar: {
                container: "#contentBodyToolbar",
                handlers: {
                    link(value) {
                        if (!value) {
                            this.quill.format("link", false);
                            return;
                        }
                        const url = window.prompt("Enter a website link (https://…):");
                        if (url) this.quill.format("link", url);
                    }
                }
            }
        },
        formats: ["align", "background", "bold", "color", "font", "header", "italic", "link", "list", "size", "strike", "underline"]
    });

    quill.on("text-change", updatePreview);
}

function editorHtml() {
    return quill ? sanitizeRichHtml(quill.root.innerHTML) : "";
}

function editorText() {
    return quill ? richHtmlToText(quill.root.innerHTML) : "";
}

function setEditorHtml(html) {
    if (!quill) return;
    quill.clipboard.dangerouslyPasteHTML(sanitizeRichHtml(html));
}

function setNotice(message, kind = "info") {
    notice.className = `alert alert-${kind}`;
    notice.textContent = message;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function selectedConfig() {
    return CONTENT_TYPES[currentType];
}

function optionList(items) {
    return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join("");
}

function setType(type) {
    if (!CONTENT_TYPES[type]) return;
    currentType = type;
    const config = selectedConfig();
    const isSlot = type === "leader" || type === "hero" || type === "division";
    slotField.hidden = !isSlot;
    categoryInput.closest("#categoryField").hidden = isSlot;
    titleInput.closest(".mb-3").hidden = type === "hero";
    document.getElementById("dateField").hidden = type !== "event";
    document.getElementById("eventTimeField").hidden = type !== "event";
    document.getElementById("eventLocationField").hidden = type !== "event";
    dateInput.required = type === "event";
    document.getElementById("linkField").hidden = type !== "news" && type !== "event";
    document.getElementById("descriptionField").hidden = type !== "leader";
    document.getElementById("bodyField").hidden = type === "hero" || type === "leader";
    document.getElementById("publishField").hidden = type === "leader" || type === "hero" || type === "division";
    document.getElementById("historyDraftTools").hidden = type !== "news";
    slotSelect.required = isSlot;
    titleInput.required = type !== "hero";
    const categories = {
        news: [["academic", "Academic"], ["technical", "Technical"], ["campus-life", "Campus Life"], ["community", "Community"], ["admissions", "Admissions"], ["other", "Other"]],
        event: [["open-day", "Open Day"], ["stem", "STEM"], ["sports", "Sports"], ["tvet", "TVET"], ["other", "Other"]],
        gallery: [["tvet", "TVET & Workshops"], ["academics", "Academic Life"], ["campus", "Campus Facilities"], ["events", "Events & Culture"]]
    }[type] || [];
    categoryInput.innerHTML = categories.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

    if (type === "leader") {
        slotLabel.textContent = "Leadership role";
        slotSelect.innerHTML = optionList(LEADERSHIP_PROFILES);
    } else if (type === "hero") {
        slotLabel.textContent = "Page image slot";
        slotSelect.innerHTML = optionList(PAGE_HEROES);
    } else if (type === "division") {
        slotLabel.textContent = "Homepage division";
        slotSelect.innerHTML = optionList(DIVISIONS);
    }

    document.getElementById("editorHeading").textContent = `Add ${config.label.toLowerCase()}`;
    document.getElementById("listHeading").textContent = `${config.label}s`;
    document.getElementById("editorHelp").textContent = type === "hero"
        ? "Select a page slot and add an image URL. The home slides use the Hero preset."
        : type === "division"
            ? "Choose a division, then select an uploaded Divisions image. Changes appear on the homepage."
        : type === "leader"
            ? "Select a role and add the headshot, display name, and profile details."
            : "New items start as drafts. Check Published when you are ready for visitors to see them.";
    document.getElementById("titleLabel").textContent = type === "leader" ? "Display name" : "Title";
    document.getElementById("bodyLabel").textContent = type === "news" ? "Summary / story" : type === "event" ? "Event details" : "Caption";
    previewNote.textContent = type === "hero"
        ? "Previewing the selected page background image."
        : type === "division"
            ? "The image and copy appear in the homepage divisions section."
        : type === "leader"
            ? "Headshots display cropped into circles on the About page."
            : "Approximate card preview. Final crop depends on the page layout.";
    clearForm();
    renderList();
    loadItems();
    updatePreview();
}

function clearForm() {
    form.reset();
    if (quill) quill.setText("");
    idInput.value = "";
    document.getElementById("cancelEditBtn").hidden = true;
    saveButton.textContent = "Save";
    if (currentType === "leader" || currentType === "hero" || currentType === "division") {
        slotSelect.selectedIndex = 0;
    }
    if (currentType === "division") {
        titleInput.value = DIVISIONS.find((division) => division.id === slotSelect.value)?.label || "";
    }
    updatePreview();
}

function updatePreview() {
    const config = selectedConfig();
    previewCategory.textContent = currentType === "hero"
        ? PAGE_HEROES.find((item) => item.id === slotSelect.value)?.label || "Page image"
        : currentType === "leader"
            ? LEADERSHIP_PROFILES.find((item) => item.id === slotSelect.value)?.label || "Leadership"
            : categoryInput.selectedOptions[0]?.textContent || config.label;
    previewTitle.textContent = titleInput.value.trim()
        || (currentType === "hero" ? "Page hero image" : currentType === "leader" ? "Leader name" : "Your title will appear here");
    const previewHtml = currentType === "leader"
        ? plainTextToRichHtml(descriptionInput.value.trim() || "Leadership profile description.")
        : editorHtml();
    previewBody.innerHTML = previewHtml || "Your summary will appear here.";
    previewBody.hidden = currentType === "hero";
    const imageUrl = imageInput.value.trim();
    previewImage.hidden = !imageUrl;
    if (imageUrl) {
        previewImage.src = imageUrl;
        previewImage.alt = altInput.value.trim() || titleInput.value.trim();
        previewImage.style.width = currentType === "leader" ? "120px" : "100%";
        previewImage.style.maxHeight = currentType === "leader" ? "120px" : currentType === "hero" ? "180px" : "220px";
        previewImage.style.objectFit = "cover";
        previewImage.style.borderRadius = currentType === "leader" ? "50%" : "";
        previewImage.onerror = () => {
            previewImage.hidden = true;
            setNotice("The preview image could not be loaded. Check its URL.", "warning");
        };
    }
    previewDate.textContent = currentType === "event" || currentType === "news" ? dateInput.value : "";
    previewDate.hidden = !previewDate.textContent;
}

async function loadSavedImages() {
    try {
        const snapshot = await getDocs(collection(db, WEBSITE_CONTENT.media));
        const images = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
            .filter((entry) => entry.publicUrl)
            .sort((left, right) => (right.createdAt?.toMillis?.() || 0) - (left.createdAt?.toMillis?.() || 0));
        savedImages.innerHTML = `<option value="">Select an image from your library…</option>${images.map((image) => {
            const label = [image.category || "image", image.name || image.path?.split("/").pop() || image.id].join(" — ");
            return `<option value="${escapeHtml(image.publicUrl)}" data-alt="${escapeHtml(image.altText || image.name || "")}">${escapeHtml(label)}</option>`;
        }).join("")}`;
    } catch (error) {
        console.error("Could not load saved media library:", error);
        savedImages.innerHTML = '<option value="">Image library unavailable — check Firestore rules</option>';
    }
}

function renderList() {
    const filtered = currentItems.filter((item) => {
        if (filter.value === "published") return item.published === true;
        if (filter.value === "draft") return item.published !== true;
        return true;
    });

    if (!filtered.length) {
        list.innerHTML = '<p class="text-secondary mb-0">No matching entries yet.</p>';
        return;
    }

    list.innerHTML = filtered.map((item) => {
        const title = item.title || item.name || PAGE_HEROES.find((slot) => slot.id === item.id)?.label || LEADERSHIP_PROFILES.find((slot) => slot.id === item.id)?.label || DIVISIONS.find((slot) => slot.id === item.id)?.label || item.id;
        const subtitle = currentType === "leader" ? item.role || "" : item.category || item.description || "";
        const status = currentType === "hero" || currentType === "leader" || currentType === "division"
            ? '<span class="badge text-bg-secondary">Page setting</span>'
            : item.published
                ? '<span class="badge text-bg-success">Published</span>'
                : '<span class="badge text-bg-secondary">Draft</span>';
        const image = item.imageUrl
            ? `<img src="${escapeHtml(item.imageUrl)}" alt="" class="rounded" loading="lazy" onerror="this.hidden=true">`
            : '<span class="d-inline-block rounded bg-light border" style="width:72px;height:52px"></span>';
        return `<div class="content-row d-flex align-items-center gap-3 py-3">
            ${image}
            <div class="flex-grow-1 min-w-0">
                <div class="fw-semibold text-break">${escapeHtml(title)}</div>
                <div class="small text-secondary text-truncate">${escapeHtml(subtitle)}</div>
                <div class="mt-1">${status}</div>
            </div>
            <div class="d-flex gap-2 flex-shrink-0">
                <button class="btn btn-sm btn-outline-dark" type="button" data-edit="${escapeHtml(item.id)}">Edit</button>
                <button class="btn btn-sm btn-outline-danger" type="button" data-delete="${escapeHtml(item.id)}">Delete</button>
            </div>
        </div>`;
    }).join("");
}

async function loadItems() {
    list.innerHTML = '<p class="text-secondary mb-0">Loading content…</p>';
    try {
        const config = selectedConfig();
        const ref = collection(db, config.collection);
        if (currentType === "news" || currentType === "event" || currentType === "gallery") {
            const snapshot = await getDocs(ref);
            currentItems = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        } else {
            const snapshot = await getDocs(ref);
            currentItems = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        }
        currentItems.sort((left, right) => {
            const leftDate = left.updatedAt?.toMillis?.() || 0;
            const rightDate = right.updatedAt?.toMillis?.() || 0;
            return rightDate - leftDate;
        });
        renderList();
        await loadSavedImages();
        setNotice("Connected to Firestore. Public pages show only items marked Published.", "success");
    } catch (error) {
        console.error(`Could not load ${currentType} content:`, error);
        list.innerHTML = '<p class="text-danger mb-0">Could not read this Firestore collection. Check Firestore rules and browser console.</p>';
        setNotice(`Could not load content: ${error.message}`, "danger");
    }
}

function editItem(id) {
    const item = currentItems.find((entry) => entry.id === id);
    if (!item) return;
    idInput.value = item.id;
    slotSelect.value = item.id;
    titleInput.value = item.title || item.name || "";
    categoryInput.value = item.category || "";
    setEditorHtml(item.bodyHtml || plainTextToRichHtml(item.body || item.summary || item.caption || ""));
    if (item.date?.toDate) {
        const date = item.date.toDate();
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        dateInput.value = date.toISOString().slice(0, 16);
    } else {
        dateInput.value = item.date || "";
    }
    eventTimeInput.value = item.time || "";
    eventLocationInput.value = item.location || "";
    linkInput.value = item.link || "";
    imageInput.value = item.imageUrl || "";
    altInput.value = item.altText || "";
    descriptionInput.value = item.description || "";
    publishedInput.checked = item.published === true;
    document.getElementById("cancelEditBtn").hidden = false;
    saveButton.textContent = "Update";
    updatePreview();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function loadHistoryDraft() {
    clearForm();
    categoryInput.value = "community";
    titleInput.value = "Olistar School: A journey that began in a clay house";
    const history = "According to the founding proprietor, Olistar School began on 16 August 1987 in a modest clay building in Abesim. The school started small and grew over time. The proprietor recalls that the first JHS cohort sat its exams in 1992 and all ten students passed. The school also received its technical institute certificate that year, with Building and Construction and Electrical Installation among its early courses. Later, when Site B opened, enrollment was about 800 students; the opening date is still being confirmed. This account reflects the proprietor’s recollections.";
    setEditorHtml(plainTextToRichHtml(history));
    publishedInput.checked = false;
    updatePreview();
    setNotice("History draft loaded. Review it and keep it unpublished until the proprietor approves the wording.", "info");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function saveItem(event) {
    event.preventDefault();
    if (saving) return;
    if (!quill && !document.getElementById("bodyField").hidden) {
        setNotice("The formatting editor is unavailable. Reload the page before saving this content.", "danger");
        return;
    }
    const type = currentType;
    const config = selectedConfig();
    const id = idInput.value || (type === "hero" || type === "leader" || type === "division" ? slotSelect.value : "");
    const now = serverTimestamp();
    const bodyHtml = editorHtml();
    const bodyText = editorText();
    const data = {
        title: titleInput.value.trim(),
        category: categoryInput.value.trim(),
        body: bodyText,
        bodyHtml,
        summary: bodyText,
        caption: bodyText,
        description: descriptionInput.value.trim(),
        date: dateInput.value || "",
        time: eventTimeInput.value.trim(),
        location: eventLocationInput.value.trim(),
        link: linkInput.value.trim(),
        imageUrl: imageInput.value.trim(),
        altText: altInput.value.trim(),
        published: type === "hero" || type === "leader" || type === "division" ? true : publishedInput.checked,
        updatedAt: now,
        updatedBy: ADMIN_EMAIL
    };

    if (type === "leader") {
        data.name = data.title;
        data.role = LEADERSHIP_PROFILES.find((profile) => profile.id === id)?.label || "";
        data.description = descriptionInput.value.trim();
    }
    if (type === "hero") {
        data.altText = altInput.value.trim() || titleInput.value.trim();
        data.title = titleInput.value.trim() || PAGE_HEROES.find((slot) => slot.id === id)?.label || "";
    }

    saving = true;
    saveButton.disabled = true;
    try {
        const ref = collection(db, config.collection);
        if (id) {
            await setDoc(doc(db, config.collection, id), data, { merge: true });
        } else {
            data.createdAt = now;
            data.createdBy = ADMIN_EMAIL;
            await addDoc(ref, data);
        }
        setNotice(`${config.label} saved. ${data.published ? "Published pages can now display it." : "It remains a draft until published."}`, "success");
        clearForm();
        await loadItems();
    } catch (error) {
        console.error(`Could not save ${type} content:`, error);
        setNotice(`Could not save content: ${error.message}. Check Firestore write rules.`, "danger");
    } finally {
        saving = false;
        saveButton.disabled = false;
    }
}

async function deleteItem(id) {
    const item = currentItems.find((entry) => entry.id === id);
    if (!item || !window.confirm(`Delete "${item.title || item.name || id}" from the website content? Its image will be deleted from Supabase only if no other content uses it.`)) return;
    try {
        await deleteDoc(doc(db, selectedConfig().collection, id));
        let imageMessage = "";
        try {
            imageMessage = await cleanupImageAfterContentDelete(item.imageUrl || "");
        } catch (error) {
            console.error("Content was deleted, but its image cleanup failed:", error);
            imageMessage = ` Content was deleted, but image cleanup failed: ${error.message}`;
        }
        setNotice(`Content deleted. ${imageMessage}`, imageMessage.includes("failed") ? "warning" : "success");
        await loadItems();
    } catch (error) {
        console.error(`Could not delete ${currentType} content:`, error);
        setNotice(`Could not delete content: ${error.message}. Check Firestore write rules.`, "danger");
    }
}

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }
    if ((user.email || "").trim().toLowerCase() !== ADMIN_EMAIL) {
        setNotice("This account is not authorized to manage public website content.", "danger");
        return;
    }
    document.getElementById("contentAdminEmail").textContent = user.email;
    editor.hidden = false;
    setType(currentType);
});

document.getElementById("contentLogoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("admin-login.html");
});

document.getElementById("contentTabs").addEventListener("click", (event) => {
    const button = event.target.closest("[data-content-type]");
    if (!button) return;
    document.querySelectorAll("#contentTabs .nav-link").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    setType(button.dataset.contentType);
});

slotSelect.addEventListener("change", () => {
    if (currentType === "division" && !idInput.value) {
        titleInput.value = DIVISIONS.find((division) => division.id === slotSelect.value)?.label || "";
        updatePreview();
    }
});

form.addEventListener("submit", saveItem);
filter.addEventListener("change", renderList);
document.getElementById("cancelEditBtn").addEventListener("click", clearForm);
document.getElementById("createHistoryDraftBtn").addEventListener("click", loadHistoryDraft);
document.getElementById("useSavedImageBtn").addEventListener("click", () => {
    const option = savedImages.selectedOptions[0];
    if (!option?.value) {
        setNotice("Select an uploaded image first.", "warning");
        return;
    }
    imageInput.value = option.value;
    if (!altInput.value) altInput.value = option.dataset.alt || "";
    updatePreview();
    setNotice("Image selected from the media library.", "success");
});
list.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) editItem(editButton.dataset.edit);
    if (deleteButton) deleteItem(deleteButton.dataset.delete);
});

[slotSelect, titleInput, categoryInput, dateInput, imageInput, altInput, descriptionInput].forEach((field) => {
    field.addEventListener("input", updatePreview);
    field.addEventListener("change", updatePreview);
});

createRichEditor();
