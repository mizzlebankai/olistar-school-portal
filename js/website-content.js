export const WEBSITE_CONTENT = Object.freeze({
    news: "olistar_website_news",
    events: "olistar_website_events",
    gallery: "olistar_website_gallery",
    leaders: "olistar_website_leaders",
    heroes: "olistar_website_heroes",
    media: "olistar_website_media"
});

export const CONTENT_TYPES = Object.freeze({
    news: { collection: WEBSITE_CONTENT.news, label: "News article", imageCategory: "news" },
    event: { collection: WEBSITE_CONTENT.events, label: "Event", imageCategory: "gallery" },
    gallery: { collection: WEBSITE_CONTENT.gallery, label: "Gallery photo", imageCategory: "gallery" },
    leader: { collection: WEBSITE_CONTENT.leaders, label: "Leadership profile", imageCategory: "headshots" },
    hero: { collection: WEBSITE_CONTENT.heroes, label: "Page hero", imageCategory: "hero" }
});

export const PAGE_HEROES = Object.freeze([
    { id: "home-slide-1", label: "Home page — slide 1" },
    { id: "home-slide-2", label: "Home page — slide 2" },
    { id: "home-slide-3", label: "Home page — slide 3" },
    { id: "about", label: "About page" },
    { id: "early-grade", label: "Early Grade page" },
    { id: "primary", label: "Primary page" },
    { id: "shs-tech", label: "SHS & Technical page" },
    { id: "news", label: "News page" },
    { id: "events", label: "Events page" },
    { id: "gallery", label: "Gallery page" },
    { id: "contact", label: "Contact page" },
    { id: "application", label: "Application page" },
    { id: "success", label: "Application success page" }
]);

export const LEADERSHIP_PROFILES = Object.freeze([
    { id: "site-a-headmaster", label: "Site A Headmaster" },
    { id: "site-b-headmaster", label: "Site B Headmaster" },
    { id: "shs-tech-headmaster", label: "SHS / Technical Headmaster" },
    { id: "proprietor", label: "Proprietor" }
]);
