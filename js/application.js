import { db } from "./firebase-config.js";
import { 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("applicationForm");

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : "Submit";

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = `Submitting...`;
        }

        try {
            const refCode = "APP-" + Math.floor(100000 + Math.random() * 900000);

            // Read values using your existing input IDs
            const firstName = document.getElementById("firstName")?.value.trim() || "";
            const lastName = document.getElementById("lastName")?.value.trim() || "";
            const fullName = `${firstName} ${lastName}`.trim();

            const guardianName = document.getElementById("guardianName")?.value.trim() || "";
            const guardianPhone = document.getElementById("guardianPhone")?.value.trim() || "";
            const guardianEmail = document.getElementById("guardianEmail")?.value.trim() || "";

            const stream = document.getElementById("programStream")?.value || "";
            const academicTier = document.getElementById("academicTier")?.value || "";
            const entryLevel = document.getElementById("entryLevel")?.value || "";
            const boardingStatus = document.getElementById("boardingStatus")?.value || "";
            const address = document.getElementById("residentialAddress")?.value.trim() || "";

            const applicationData = {
                refCode: refCode,
                fullName: fullName,
                applicantName: fullName,
                email: guardianEmail || "No email provided",
                phone: guardianPhone,
                guardianName: guardianName,
                guardianPhone: guardianPhone,
                stream: stream,
                academicTier: academicTier,
                entryLevel: entryLevel,
                boardingStatus: boardingStatus,
                address: address,
                yearBatch: "2026/2027",
                documentsUrl: window.uploadedDocUrl || null,
                status: "Pending",
                createdAt: serverTimestamp(),  // Required for orderBy("createdAt") query
                submittedAt: serverTimestamp() // Maintained for backward compatibility
            };

            await addDoc(collection(db, "applications"), applicationData);

            alert(`Application submitted successfully! Ref Code: ${refCode}`);
            form.reset();

        } catch (error) {
            console.error("Error submitting application:", error);
            alert(`Submission failed: ${error.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    });
});