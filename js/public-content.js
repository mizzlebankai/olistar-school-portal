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

function dateMillis(value) {
    if (value?.toMillis) return value.toMillis();
    if (value?.toDate) return value.toDate().getTime();
    return Date.parse(value || "") || 0;
}

function sortByDate(items, key, direction = "desc") {
    return [...items].sort((left, right) => {
        const leftDate = dateMillis(left[key]) || left.updatedAt?.toMillis?.() || 0;
        const rightDate = dateMillis(right[key]) || right.updatedAt?.toMillis?.() || 0;
        return direction === "asc" ? leftDate - rightDate : rightDate - leftDate;
    });
}

function newsCard(item) {
    const title = escapeHtml(item.title || "School update");
    const category = escapeHtml(item.category || "News");
    const summary = formattedText(item, ["summary", "body"]);
    const image = publishedImage(item, title);
    const link = safeLink(item.link);
    const imageMarkup = image ? `<div class="tile-img-container" style="height:220px;">${image}</div>` : "";
    const storyUrl = link && new URL(link).pathname !== window.location.pathname ? link : "news.html";
    const titleMarkup = `<a href="${escapeHtml(storyUrl)}" class="text-decoration-none text-dark">${title}</a>`;

    return `<div class="col-lg-6">
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

function homeNewsSlide(item, index, total) {
    const title = escapeHtml(item.title || "School update");
    const category = escapeHtml(item.category || "News");
    const summary = formattedText(item, ["summary", "body"]);
    const image = publishedImage(item, title)
        || '<img src="assets/images/image-placeholder.svg" alt="Olistar School news" class="tile-img">';
    const date = formatDate(item.date || item.publishedAt);
    const link = safeLink(item.link);
    const storyUrl = link && new URL(link).pathname !== window.location.pathname ? link : "news.html";

    return `<article class="home-news-feature" data-home-news-slide="${index}" role="group" aria-roledescription="slide" aria-label="Story ${index + 1} of ${total}"${index ? " hidden" : ""}>
        <div class="home-news-photo">${image}</div>
        <div class="home-news-content">
            <div class="home-news-meta">
                <span class="badge bg-primary-soft text-primary">${category}</span>
                <time>${escapeHtml(date || "Latest update")}</time>
            </div>
            <h3 class="home-news-title">${title}</h3>
            <div class="home-news-summary website-rich-summary">${summary}</div>
            <a class="home-news-link" href="${escapeHtml(storyUrl)}">Read the full story <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
        </div>
    </article>`;
}

function homeNewsCarousel(items) {
    return `<div class="home-news-carousel" role="region" aria-label="Latest school news" data-home-news-carousel>
        <div class="home-news-stage">${items.map((item, index) => homeNewsSlide(item, index, items.length)).join("")}</div>
        <div class="home-news-controls">
            <button class="home-news-arrow" type="button" data-news-direction="previous" aria-label="Previous story"${items.length < 2 ? " disabled" : ""}><i class="bi bi-arrow-left" aria-hidden="true"></i></button>
            <div class="home-news-pagination" role="group" aria-label="Choose a news story">
                ${items.map((_, index) => `<button class="home-news-dot" type="button" data-news-index="${index}" aria-label="Show story ${index + 1}" aria-pressed="${index === 0}"></button>`).join("")}
            </div>
            <span class="home-news-status" data-news-status aria-live="polite">Story 1 of ${items.length}</span>
            <button class="home-news-arrow" type="button" data-news-direction="next" aria-label="Next story"${items.length < 2 ? " disabled" : ""}><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
        </div>
    </div>`;
}

function bindHomeNewsCarousel(container, total) {
    const slides = [...container.querySelectorAll("[data-home-news-slide]")];
    const dots = [...container.querySelectorAll("[data-news-index]")];
    const status = container.querySelector("[data-news-status]");
    let currentIndex = 0;
    let transitionId = 0;
    let flipTimer = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updateControls() {
        dots.forEach((dot, dotIndex) => {
            dot.setAttribute("aria-pressed", String(dotIndex === currentIndex));
        });
        status.textContent = `Story ${currentIndex + 1} of ${total}`;
    }

    function showSlide(index) {
        const nextIndex = (index + total) % total;
        if (nextIndex === currentIndex) return;

        const previousIndex = currentIndex;
        const previousSlide = slides[previousIndex];
        const nextSlide = slides[nextIndex];
        const direction = nextIndex > previousIndex ? "forward" : "backward";
        const currentTransition = ++transitionId;

        window.clearTimeout(flipTimer);
        slides.forEach((slide) => {
            slide.classList.remove("is-flipping-in-forward", "is-flipping-in-backward", "is-flipping-out-forward", "is-flipping-out-backward");
            slide.hidden = true;
        });
        previousSlide.hidden = false;
        nextSlide.hidden = false;
        currentIndex = nextIndex;
        updateControls();

        const finishTransition = () => {
            if (currentTransition !== transitionId) return;
            previousSlide.hidden = true;
            previousSlide.classList.remove("is-flipping-out-forward", "is-flipping-out-backward");
            nextSlide.classList.remove("is-flipping-in-forward", "is-flipping-in-backward");
        };

        if (reducedMotion.matches) {
            finishTransition();
            return;
        }

        previousSlide.classList.add(`is-flipping-out-${direction}`);
        nextSlide.classList.add(`is-flipping-in-${direction}`);
        flipTimer = window.setTimeout(finishTransition, 520);
    }

    container.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-news-direction], button[data-news-index]");
        if (!button) return;
        if (button.hasAttribute("data-news-index")) {
            showSlide(Number(button.dataset.newsIndex));
        } else {
            showSlide(currentIndex + (button.dataset.newsDirection === "next" ? 1 : -1));
        }
    });
}

async function loadHomeNewsCarousel() {
    const container = document.getElementById("homeNewsGrid");
    if (!container) return;
    try {
        const items = sortByDate(await loadPublished(WEBSITE_CONTENT.news), "date").slice(0, 5);
        if (items.length) {
            container.innerHTML = homeNewsCarousel(items);
            bindHomeNewsCarousel(container, items.length);
        } else {
            container.innerHTML = '<p class="text-secondary small mb-0">No school news has been published yet.</p>';
        }
        container.dataset.contentLoaded = "true";
    } catch (error) {
        console.error("Could not load homepage news:", error);
        container.innerHTML = '<p class="text-secondary small mb-0">Latest school news is temporarily unavailable.</p>';
        if (!container.previousElementSibling?.classList.contains("content-load-warning")) {
            container.insertAdjacentHTML("beforebegin", '<p class="content-load-warning small text-warning-emphasis" role="status">Some website content could not be refreshed.</p>');
        }
    }
}

function eventCard(item, compact = false) {
    const title = escapeHtml(item.title || "School event");
    const category = escapeHtml(item.category || "Event");
    const summary = formattedText(item, ["summary", "body"]);
    const image = publishedImage(item, title);
    const date = formatDate(item.date);
    const link = safeLink(item.link);

    if (compact) {
        const dateObject = item.date ? (item.date.toDate ? item.date.toDate() : new Date(item.date)) : null;
        const day = dateObject && !Number.isNaN(dateObject.getTime()) ? dateObject.toLocaleDateString("en", { day: "2-digit" }) : "—";
        const month = dateObject && !Number.isNaN(dateObject.getTime()) ? dateObject.toLocaleDateString("en", { month: "short" }) : "";
        const details = [item.time, item.location].filter(Boolean).map(escapeHtml).join(" · ") || `${escapeHtml(date)} · ${category}`;
        return `<div class="col-lg-6">
            <div class="p-3 bg-white border rounded-3 shadow-sm d-flex align-items-center gap-3 event-card">
                <div class="event-date-badge text-center flex-shrink-0 px-3 py-2 rounded-2 bg-primary text-white">
                    <span class="d-block h4 fw-bold mb-0 leading-none">${escapeHtml(day)}</span>
                    <span class="text-uppercase small fw-semibold">${escapeHtml(month)}</span>
                </div>
                <div class="flex-grow-1">
                    <div class="text-muted small mb-1">${details}</div>
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
                ${item.time || item.location ? `<div class="small text-muted mb-2">${[item.time, item.location].filter(Boolean).map(escapeHtml).join(" · ")}</div>` : ""}
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

async function replaceIfAvailable(container, loader, render, emptyMessage = "") {
    if (!container) return;
    try {
        const items = await loader();
        if (items.length) {
            container.innerHTML = items.map(render).join("");
            container.dataset.contentLoaded = "true";
        } else if (emptyMessage) {
            container.innerHTML = `<p class="col-12 text-secondary small mb-0">${escapeHtml(emptyMessage)}</p>`;
            container.dataset.contentLoaded = "true";
        }
    } catch (error) {
        console.error(`Could not load public content for #${container.id}:`, error);
        if (emptyMessage) {
            container.innerHTML = `<p class="col-12 text-secondary small mb-0">${escapeHtml(emptyMessage)}</p>`;
        }
        if (!container.previousElementSibling?.classList.contains("content-load-warning")) {
            container.insertAdjacentHTML("beforebegin", '<p class="content-load-warning small text-warning-emphasis" role="status">Some website content could not be refreshed.</p>');
        }
    }
}

async function applyDivisions() {
    await Promise.all([...document.querySelectorAll("[data-managed-division]")].map(async (card) => {
        try {
            const result = await getDoc(doc(db, WEBSITE_CONTENT.divisions, card.dataset.managedDivision));
            if (!result.exists()) return;
            const division = result.data();
            const image = card.querySelector("[data-division-image]");
            const title = card.querySelector("[data-division-title]");
            const description = card.querySelector("[data-division-description]");
            if (image && division.imageUrl) image.src = division.imageUrl;
            if (image && division.altText) image.alt = division.altText;
            if (title && division.title) title.textContent = division.title;
            if (description && (division.body || division.summary)) description.textContent = division.body || division.summary;
        } catch (error) {
            console.error(`Could not load homepage division "${card.dataset.managedDivision}":`, error);
        }
    }));
}

function upcomingEvents(items) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sortByDate(items, "date", "asc").filter((item) => {
        if (!item.date) return false;
        const eventDate = item.date.toDate ? item.date.toDate() : new Date(item.date);
        return !Number.isNaN(eventDate.getTime()) && eventDate >= today;
    });
}

function preloadHeroImage(url) {
    if (!url) return Promise.resolve(false);

    return new Promise((resolve) => {
        const image = new Image();
        const timeout = window.setTimeout(() => finish(false), 3000);

        function finish(loaded) {
            window.clearTimeout(timeout);
            image.onload = null;
            image.onerror = null;
            resolve(loaded);
        }

        image.decoding = "async";
        image.onload = () => finish(true);
        image.onerror = () => finish(false);
        image.src = url;

        if (image.complete) {
            finish(image.naturalWidth > 0);
        }
    });
}

function revealHeroState(element, homepageHero = null) {
    requestAnimationFrame(() => {
        element.classList.remove("hero-image-pending");
        element.classList.add("hero-image-ready");

        if (element.dataset.managedHero === "home-slide-1" && homepageHero) {
            homepageHero.classList.remove("hero-image-pending");
            homepageHero.classList.add("hero-image-ready");
        }
    });
}

async function applyHeroes() {
    const targets = [...document.querySelectorAll("[data-managed-hero]")];
    const homepageHero = targets.find((element) => element.dataset.managedHero === "home-slide-1")?.closest(".editorial-hero");
    if (homepageHero) {
        homepageHero.classList.remove("hero-image-ready");
        homepageHero.classList.add("hero-image-pending");
    }
    targets.forEach((element) => {
        element.classList.remove("hero-image-ready");
        element.classList.add("hero-image-pending");
    });

    await Promise.all(targets.map(async (element) => {
        const id = element.dataset.managedHero;
        try {
            const result = await getDoc(doc(db, WEBSITE_CONTENT.heroes, id));
            if (!result.exists()) {
                revealHeroState(element, homepageHero);
                return;
            }

            const imageUrl = String(result.data().imageUrl || "").trim();
            if (!imageUrl) {
                revealHeroState(element, homepageHero);
                return;
            }

            element.style.backgroundImage = `url("${imageUrl.replaceAll('"', "%22")}")`;
            const loaded = await preloadHeroImage(imageUrl);

            if (loaded) {
                revealHeroState(element, homepageHero);
            } else {
                revealHeroState(element, homepageHero);
            }
        } catch (error) {
            console.error(`Could not load page hero "${id}":`, error);
            revealHeroState(element, homepageHero);
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

async function applyManagedImages() {
    for (const image of document.querySelectorAll("[data-managed-image]")) {
        const id = image.dataset.managedImage;
        try {
            const result = await getDoc(doc(db, WEBSITE_CONTENT.heroes, id));
            if (!result.exists()) continue;
            const hero = result.data();
            if (hero.imageUrl) {
                image.src = hero.imageUrl;
                if (hero.altText) image.alt = hero.altText;
            }
        } catch (error) {
            console.error(`Could not load managed image "${id}":`, error);
        }
    }
}

async function initializePublicContent() {
    await Promise.all([
        replaceIfAvailable(document.getElementById("newsContentGrid"), () => loadPublished(WEBSITE_CONTENT.news), (item) => newsCard(item)),
        loadHomeNewsCarousel(),
        replaceIfAvailable(document.getElementById("eventsContentGrid"), async () => upcomingEvents(await loadPublished(WEBSITE_CONTENT.events)), (item) => eventCard(item), "No upcoming events have been published yet."),
        replaceIfAvailable(document.getElementById("homeEventsGrid"), async () => {
            return upcomingEvents(await loadPublished(WEBSITE_CONTENT.events)).slice(0, 4);
        }, (item) => eventCard(item, true), "No upcoming events have been published yet."),
        replaceIfAvailable(document.getElementById("galleryGrid"), () => loadPublished(WEBSITE_CONTENT.gallery), galleryCard),
        applyHeroes(),
        applyManagedImages(),
        applyLeadership(),
        applyDivisions()
    ]);
}

initializePublicContent();
