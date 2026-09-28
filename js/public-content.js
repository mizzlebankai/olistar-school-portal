import { collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { WEBSITE_CONTENT } from "./website-content.js";
import { plainTextToRichHtml, sanitizeRichHtml } from "./rich-content.js?v=20260928-rich-text";

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function publishedImage(item, altFallback) {
    const imageUrl = String(item.imageUrl || "").trim();
    if (!imageUrl) return "";
    const alt = item.altText || altFallback || item.title || "";
    return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" class="tile-img" loading="lazy" onerror="this.onerror=null;this.src='assets/images/image-placeholder.svg'">`;
}

function formattedText(item, fallbackKeys) {
    if (item.bodyHtml) return sanitizeRichHtml(item.bodyHtml);
    const fallback = fallbackKeys.map((key) => item[key]).find((value) => typeof value === "string" && value.trim());
    return sanitizeRichHtml(plainTextToRichHtml(fallback || ""));
}

function safeLink(value) {
    const rawValue = String(value || "").trim();
    if (!rawValue || rawValue === "#" || rawValue.startsWith("#")) return "";
    try {
        const url = new URL(rawValue, window.location.href);
        if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch {
        return "";
    }
    return "";
}

function formatDate(value) {
    if (!value) return "";
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" });
}

function sortByDate(items, key, direction = "desc") {
    return [...items].sort((left, right) => {
        const leftDate = Date.parse(left[key] || "") || left.updatedAt?.toMillis?.() || 0;
        const rightDate = Date.parse(right[key] || "") || right.updatedAt?.toMillis?.() || 0;
        return direction === "asc" ? leftDate - rightDate : rightDate - leftDate;
    });
}

function newsCard(item, compact = false) {
    const title = escapeHtml(item.title || "School update");
    const category = escapeHtml(item.category || "News");
    const summary = formattedText(item, ["summary", "body"]);
    const image = publishedImage(item, title);
    const link = safeLink(item.link);
    const imageMarkup = image
        ? `<div class="tile-img-container" style="height:${compact ? 200 : 220}px;">${image}</div>`
        : "";
    const storyUrl = link && new URL(link).pathname !== window.location.pathname ? link : "news.html";
    const titleMarkup = `<a href="${escapeHtml(storyUrl)}" class="text-decoration-none text-dark">${title}</a>`;

    if (compact) {
        return `<div class="col-md-4">
            <article class="card h-100 border-0 shadow-sm news-card">
                ${image ? `<div class="tile-img-container" style="height:200px;">${image}</div>` : ""}
                <div class="card-body p-4 d-flex flex-column">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <span class="badge bg-primary-soft text-primary px-2 py-1 rounded-1">${category}</span>
                        <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${escapeHtml(formatDate(item.date || item.publishedAt))}</small>
                    </div>
                    <h3 class="h5 card-title fw-bold text-dark mb-2">${titleMarkup}</h3>
                    <div class="card-text website-rich-summary text-secondary small flex-grow-1">${summary}</div>
                    <a href="${escapeHtml(storyUrl)}" class="fw-bold text-primary text-decoration-none small mt-3">Read Full Story <i class="bi bi-chevron-right ms-1"></i></a>
                </div>
            </article>
        </div>`;
    }

    return `<div class="col-lg-4">
        <article class="tile-card bg-white h-100 shadow-sm">
            ${imageMarkup}
            <div class="p-4">
                <div class="small text-uppercase text-danger fw-bold mb-2">${category}</div>
                <h3 class="font-serif fw-bold text-dark fs-4 mb-2">${titleMarkup}</h3>
                <div class="website-rich-summary text-secondary small mb-3">${summary}</div>
                <span class="small text-muted">${escapeHtml(formatDate(item.date || item.publishedAt))}</span>
            </div>
        </article>
    </div>`;
}

function eventCard(item, compact = false) {
    const title = escapeHtml(item.title || "School event");
    const category = escapeHtml(item.category || "Event");
    const summary = formattedText(item, ["summary", "body"]);
    const image = publishedImage(item, title);
    const date = formatDate(item.date);
    const link = safeLink(item.link);

    if (compact) {
        const dateObject = item.date ? new Date(item.date) : null;
        const day = dateObject && !Number.isNaN(dateObject.getTime()) ? dateObject.toLocaleDateString("en", { day: "2-digit" }) : "—";
        const month = dateObject && !Number.isNaN(dateObject.getTime()) ? dateObject.toLocaleDateString("en", { month: "short" }) : "";
        return `<div class="col-lg-6">
            <div class="p-3 bg-white border rounded-3 shadow-sm d-flex align-items-center gap-3 event-card">
                <div class="event-date-badge text-center flex-shrink-0 px-3 py-2 rounded-2 bg-primary text-white">
                    <span class="d-block h4 fw-bold mb-0 leading-none">${escapeHtml(day)}</span>
                    <span class="text-uppercase small fw-semibold">${escapeHtml(month)}</span>
                </div>
                <div class="flex-grow-1">
                    <div class="text-muted small mb-1">${escapeHtml(date)} · ${category}</div>
                    <h4 class="h6 fw-bold text-dark mb-1"><a class="text-decoration-none text-dark" href="${escapeHtml(link || "events.html")}">${title}</a></h4>
                    <div class="website-rich-summary text-secondary small mb-0">${summary}</div>
                </div>
            </div>
        </div>`;
    }

    return `<div class="col-lg-6">
        <article class="tile-card bg-white shadow-sm h-100">
            ${image ? `<div class="tile-img-container" style="height:260px;">${image}</div>` : ""}
            <div class="p-4">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="small text-uppercase text-danger fw-bold">${category}</span>
                    <span class="small text-muted">${escapeHtml(date)}</span>
                </div>
                <h3 class="font-serif fw-bold text-dark fs-4 mb-2">${link ? `<a class="text-decoration-none text-dark" href="${escapeHtml(link)}">${title}</a>` : title}</h3>
                <div class="website-rich-summary text-secondary small mb-0">${summary}</div>
            </div>
        </article>
    </div>`;
}

function galleryCard(item) {
    const category = String(item.category || "campus").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const image = publishedImage(item, item.title);
    return `<div class="col-sm-6 col-lg-4 gallery-item ${escapeHtml(category)}" data-category="${escapeHtml(category)}">
        <div class="tile-card shadow-sm h-100 bg-white border border-dark">
            <div class="tile-img-container" style="height:230px;">
                ${image || '<img src="assets/images/image-placeholder.svg" alt="No photo provided" class="tile-img">'}
                <span class="badge bg-dark text-white rounded-0 position-absolute top-0 end-0 m-2 fw-bold text-uppercase">${escapeHtml(item.category || "Campus")}</span>
            </div>
            <div class="p-3">
                <h6 class="font-serif fw-bold text-dark mb-1">${escapeHtml(item.title || "School photo")}</h6>
                <div class="small text-secondary mb-0 website-rich-summary">${formattedText(item, ["caption", "summary"])}</div>
            </div>
        </div>
    </div>`;
}

async function loadPublished(name) {
    const snapshot = await getDocs(query(collection(db, name), where("published", "==", true)));
    return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

async function replaceIfAvailable(container, loader, render) {
    if (!container) return;
    try {
        const items = await loader();
        if (items.length) {
            container.innerHTML = items.map(render).join("");
            container.dataset.contentLoaded = "true";
        }
    } catch (error) {
        console.error(`Could not load public content for #${container.id}:`, error);
        if (!container.previousElementSibling?.classList.contains("content-load-warning")) {
            container.insertAdjacentHTML("beforebegin", '<p class="content-load-warning small text-warning-emphasis" role="status">Some website content could not be refreshed.</p>');
        }
    }
}

async function applyHeroes() {
    const targets = [...document.querySelectorAll("[data-managed-hero]")];
    await Promise.all(targets.map(async (element) => {
        const id = element.dataset.managedHero;
        try {
            const result = await getDoc(doc(db, WEBSITE_CONTENT.heroes, id));
            if (!result.exists()) return;
            const imageUrl = String(result.data().imageUrl || "").trim();
            if (imageUrl) element.style.backgroundImage = `url("${imageUrl.replaceAll('"', "%22")}")`;
        } catch (error) {
            console.error(`Could not load page hero "${id}":`, error);
        }
    }));

}

async function applyLeadership() {
    for (const image of document.querySelectorAll("[data-managed-leader]")) {
        const id = image.dataset.managedLeader;
        try {
            const result = await getDoc(doc(db, WEBSITE_CONTENT.leaders, id));
            if (!result.exists()) continue;
            const profile = result.data();
            if (profile.imageUrl) image.src = profile.imageUrl;
            if (profile.altText) image.alt = profile.altText;
            const card = image.closest("[data-leadership-card]");
            if (!card) continue;
            const name = card.querySelector("[data-leader-name]");
            const description = card.querySelector("[data-leader-description]");
            if (name && (profile.name || profile.title)) name.textContent = profile.name || profile.title;
            if (description && profile.description) description.textContent = profile.description;
        } catch (error) {
            console.error(`Could not load leadership profile "${id}":`, error);
        }
    }
}

async function initializePublicContent() {
    await Promise.all([
        replaceIfAvailable(document.getElementById("newsContentGrid"), () => loadPublished(WEBSITE_CONTENT.news), (item) => newsCard(item)),
        replaceIfAvailable(document.getElementById("homeNewsGrid"), async () => sortByDate(await loadPublished(WEBSITE_CONTENT.news), "date").slice(0, 3), (item) => newsCard(item, true)),
        replaceIfAvailable(document.getElementById("eventsContentGrid"), async () => sortByDate(await loadPublished(WEBSITE_CONTENT.events), "date", "asc"), (item) => eventCard(item)),
        replaceIfAvailable(document.getElementById("homeEventsGrid"), async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return sortByDate(await loadPublished(WEBSITE_CONTENT.events), "date", "asc")
                .filter((item) => !item.date || new Date(item.date) >= today)
                .slice(0, 4);
        }, (item) => eventCard(item, true)),
        replaceIfAvailable(document.getElementById("galleryGrid"), () => loadPublished(WEBSITE_CONTENT.gallery), galleryCard),
        applyHeroes(),
        applyLeadership()
    ]);
}

initializePublicContent();
