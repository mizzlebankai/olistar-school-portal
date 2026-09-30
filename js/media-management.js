import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from "./firebase-config.js";
import { supabaseConfig } from "./supabase-config.js";
import { WEBSITE_CONTENT } from "./website-content.js";

const CONTENT_COLLECTIONS = [
    WEBSITE_CONTENT.news,
    WEBSITE_CONTENT.events,
    WEBSITE_CONTENT.gallery,
    WEBSITE_CONTENT.divisions,
    WEBSITE_CONTENT.leaders,
    WEBSITE_CONTENT.heroes
];

export function getStoragePath(image) {
    if (image.path) return image.path;
    const prefix = `${supabaseConfig.url}/storage/v1/object/public/${supabaseConfig.bucket}/`;
    if (!image.publicUrl?.startsWith(prefix)) return "";
    try {
        return decodeURIComponent(image.publicUrl.slice(prefix.length).split("?")[0]);
    } catch {
        return "";
    }
}

export async function findImageUsage(imageUrl, exclude = null) {
    const snapshots = await Promise.all(CONTENT_COLLECTIONS.map((name) => getDocs(collection(db, name))));
    const references = [];

    snapshots.forEach((snapshot, index) => {
        for (const entry of snapshot.docs) {
            if (exclude?.collection === CONTENT_COLLECTIONS[index] && exclude.id === entry.id) continue;
            if (entry.data().imageUrl === imageUrl) {
                references.push({
                    collection: CONTENT_COLLECTIONS[index],
                    id: entry.id,
                    title: entry.data().title || entry.data().name || entry.id
                });
            }
        }
    });

    return references;
}

export async function deleteStorageImage(path) {
    if (
        !/^(hero|news|gallery|divisions|headshots)\/[0-9a-f-]{36}\.webp$/i.test(path)
        || path.includes("..")
        || path.includes("%")
        || path.includes("\\")
        || path.includes("?")
        || path.includes("#")
    ) {
        throw new Error("This image path is not a recognized Olistar upload, so it was not deleted.");
    }

    const user = auth.currentUser;
    if (!user || (user.email || "").trim().toLowerCase() !== "mizzlebankai@gmail.com") {
        throw new Error("Sign in with the authorized Olistar admin account to delete images.");
    }

    const response = await fetch(`${supabaseConfig.url}/functions/v1/delete-school-image`, {
        method: "POST",
        headers: {
            apikey: supabaseConfig.publishableKey,
            Authorization: `Bearer ${await user.getIdToken()}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ path })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Image deletion failed (${response.status}).`);
}

export async function deleteUnusedImage(image) {
    const path = getStoragePath(image);
    if (!path) throw new Error("Could not verify this image belongs to the configured school-media bucket.");

    const usage = await findImageUsage(image.publicUrl);
    if (usage.length) {
        throw new Error(`This image is still used by ${usage.map((item) => item.title).join(", ")}. Update or remove those items first.`);
    }

    await deleteStorageImage(path);
    if (image.id) {
        await deleteDoc(doc(db, WEBSITE_CONTENT.media, image.id));
    } else {
        const matches = await getDocs(query(collection(db, WEBSITE_CONTENT.media), where("publicUrl", "==", image.publicUrl)));
        await Promise.all(matches.docs.map((entry) => deleteDoc(entry.ref)));
    }
}

export async function cleanupImageAfterContentDelete(imageUrl) {
    if (!imageUrl) return "No image was attached.";

    const usage = await findImageUsage(imageUrl);
    if (usage.length) return `The image was kept because it is still used by ${usage.map((item) => item.title).join(", ")}.`;

    const matches = await getDocs(query(collection(db, WEBSITE_CONTENT.media), where("publicUrl", "==", imageUrl)));
    const mediaItems = matches.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
    const path = mediaItems[0] ? getStoragePath(mediaItems[0]) : getStoragePath({ publicUrl: imageUrl });

    if (!path) return "The content was deleted; its image could not be verified for storage deletion, so the file was kept.";

    await deleteStorageImage(path);
    await Promise.all(matches.docs.map((entry) => deleteDoc(entry.ref)));
    return "The unused image was also removed from Supabase.";
}
