const ALLOWED_TAGS = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "DEL", "EM", "H2", "H3", "H4",
    "I", "LI", "OL", "P", "S", "SPAN", "STRONG", "U", "UL"
]);
const DROP_CONTENT_TAGS = new Set(["IFRAME", "OBJECT", "SCRIPT", "STYLE", "SVG", "TEMPLATE"]);
const FONT_FAMILIES = {
    arial: "Arial, sans-serif",
    "courier-new": "Courier New, monospace",
    georgia: "Georgia, serif",
    "times-new-roman": "Times New Roman, serif",
    "trebuchet-ms": "Trebuchet MS, sans-serif",
    verdana: "Verdana, sans-serif",
    serif: "Georgia, serif",
    monospace: "Courier New, monospace",
    sans: "Arial, sans-serif"
};
const FONT_SIZES = {
    small: "0.85em",
    large: "1.25em",
    huge: "1.6em"
};
const COLORS = new Set([
    "#000000", "#212529", "#495057", "#6c757d",
    "#b02a37", "#7f1d1d", "#b45309", "#198754",
    "#0d6efd", "#084298", "#6610f2", "#4c1d95"
]);

function safeColor(value) {
    const color = String(value || "").trim().toLowerCase();
    if (COLORS.has(color)) return color;
    const rgb = color.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
    if (!rgb) return "";
    const hex = `#${rgb.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("")}`;
    return COLORS.has(hex) ? hex : "";
}

function getSafeStyles(element) {
    const styles = [];
    const color = safeColor(element.style.color);
    const background = safeColor(element.style.backgroundColor);
    const font = Object.values(FONT_FAMILIES).includes(element.style.fontFamily)
        ? element.style.fontFamily
        : "";
    const size = Object.values(FONT_SIZES).includes(element.style.fontSize)
        ? element.style.fontSize
        : "";
    const alignment = ["center", "right", "justify"].includes(element.style.textAlign)
        ? element.style.textAlign
        : "";

    if (color) styles.push(`color:${color}`);
    if (background) styles.push(`background-color:${background}`);
    if (font) styles.push(`font-family:${font}`);
    if (size) styles.push(`font-size:${size}`);
    if (alignment) styles.push(`text-align:${alignment}`);
    return styles;
}

function copySafeNode(node, targetDocument) {
    if (node.nodeType === Node.TEXT_NODE) {
        return targetDocument.createTextNode(node.nodeValue || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const source = node;
    if (DROP_CONTENT_TAGS.has(source.tagName)) return null;
    const children = Array.from(source.childNodes)
        .map((child) => copySafeNode(child, targetDocument))
        .filter(Boolean);
    if (!ALLOWED_TAGS.has(source.tagName)) {
        const fragment = targetDocument.createDocumentFragment();
        children.forEach((child) => fragment.append(child));
        return fragment;
    }

    const safeElement = targetDocument.createElement(source.tagName.toLowerCase());
    children.forEach((child) => safeElement.append(child));
    if (source.tagName === "LI" && ["bullet", "ordered"].includes(source.getAttribute("data-list"))) {
        safeElement.setAttribute("data-list", source.getAttribute("data-list"));
    }
    if (source.tagName === "A") {
        const href = source.getAttribute("href") || "";
        try {
            const url = new URL(href, window.location.href);
            if (url.protocol === "http:" || url.protocol === "https:") {
                safeElement.setAttribute("href", url.href);
                safeElement.setAttribute("target", "_blank");
                safeElement.setAttribute("rel", "noopener noreferrer");
            } else {
                const fragment = targetDocument.createDocumentFragment();
                fragment.append(...safeElement.childNodes);
                return fragment;
            }
        } catch {
            const fragment = targetDocument.createDocumentFragment();
            fragment.append(...safeElement.childNodes);
            return fragment;
        }
    }

    const classes = Array.from(source.classList || []);
    const fontClass = classes.find((name) => name.startsWith("ql-font-"));
    const sizeClass = classes.find((name) => name.startsWith("ql-size-"));
    const alignClass = classes.find((name) => name.startsWith("ql-align-"));
    const styles = getSafeStyles(source);
    if (fontClass && FONT_FAMILIES[fontClass.slice("ql-font-".length)]) {
        styles.push(`font-family:${FONT_FAMILIES[fontClass.slice("ql-font-".length)]}`);
    }
    if (sizeClass && FONT_SIZES[sizeClass.slice("ql-size-".length)]) {
        styles.push(`font-size:${FONT_SIZES[sizeClass.slice("ql-size-".length)]}`);
    }
    if (alignClass && ["center", "right", "justify"].includes(alignClass.slice("ql-align-".length))) {
        styles.push(`text-align:${alignClass.slice("ql-align-".length)}`);
    }
    if (styles.length) safeElement.setAttribute("style", styles.join(";"));
    return safeElement;
}

export function sanitizeRichHtml(value) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(String(value || ""), "text/html");
    const output = document.implementation.createHTMLDocument("");
    const fragment = output.createDocumentFragment();
    Array.from(parsed.body.childNodes).forEach((node) => {
        const safeNode = copySafeNode(node, output);
        if (safeNode) fragment.append(safeNode);
    });
    const container = output.createElement("div");
    container.append(fragment);
    return container.innerHTML;
}

export function richHtmlToText(value) {
    const parsed = new DOMParser().parseFromString(sanitizeRichHtml(value), "text/html");
    function readText(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        if (node.tagName === "BR") return "\n";
        const content = Array.from(node.childNodes).map(readText).join("");
        return /^(BLOCKQUOTE|H2|H3|H4|LI|P)$/.test(node.tagName) ? `${content}\n` : content;
    }
    return readText(parsed.body).replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function plainTextToRichHtml(value) {
    return String(value || "")
        .split(/\r?\n/)
        .map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "<br>"}</p>`)
        .join("");
}
