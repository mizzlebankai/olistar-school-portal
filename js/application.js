import { db } from "./firebase-config.js";
import {
    collection,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("admissionsForm");
    if (!form) return;

    const alertBox = document.getElementById("formAlert");
    const tierSelect = document.getElementById("academicTier");
    const streamSelect = document.getElementById("programStream");

    // Cascade: only show programs belonging to the selected division
    if (tierSelect && streamSelect) {
        tierSelect.addEventListener("change", () => {
            const tier = tierSelect.value;
            streamSelect.disabled = false;
            streamSelect.value = "";

            streamSelect.querySelectorAll("optgroup").forEach(group => {
                group.hidden = group.dataset.tier !== tier;
            });
            streamSelect.querySelector('option[value=""]').textContent =
                "Select Program / Specialization...";
        });
    }

    function showAlert(type, message) {
        if (!alertBox) {
            alert(message);
            return;
        }
        alertBox.className = `alert alert-${type} alert-dismissible fade show rounded-0 mb-4`;
        alertBox.querySelector("#formAlertMessage").innerHTML = message;
        alertBox.classList.remove("d-none");
        alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function selectedText(select) {
        return select?.selectedIndex > 0
            ? select.options[select.selectedIndex].text
            : "";
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Bootstrap-style validation (form uses novalidate)
        if (!form.checkValidity()) {
            form.classList.add("was-validated");
            showAlert("danger", "Please complete all required fields before submitting.");
            return;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : "Submit";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "Submitting...";
        }

        try {
            const firstName = document.getElementById("firstName").value.trim();
            const middleName = document.getElementById("middleName").value.trim();
            const lastName = document.getElementById("lastName").value.trim();
            const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

            // Unique reference code derived from the Firestore document ID
            // (Firestore guarantees ID uniqueness, so codes can never collide)
            const newDocRef = doc(collection(db, "applications"));
            const refCode = "OLS-" + newDocRef.id.substring(0, 8).toUpperCase();

            const applicationData = {
                refCode: refCode,

                // Applicant
                fullName: fullName,
                firstName: firstName,
                middleName: middleName,
                lastName: lastName,
                dob: document.getElementById("dob").value,
                gender: document.getElementById("gender").value,
                nationality: document.getElementById("nationality").value.trim(),
                prevSchool: document.getElementById("prevSchool").value.trim(),

                // Academic pathway (labels stored so the admin table is readable)
                academicTier: selectedText(document.getElementById("academicTier")),
                academicTierValue: tierSelect?.value || "",
                programStream: selectedText(streamSelect),
                programStreamValue: streamSelect?.value || "",
                entryLevel: document.getElementById("entryLevel").value.trim(),
                boardingStatus: document.getElementById("boardingStatus").value,

                // Guardian
                guardianName: document.getElementById("guardianName").value.trim(),
                relationship: document.getElementById("relationship").value.trim(),
                guardianPhone: document.getElementById("guardianPhone").value.trim(),
                guardianEmail: document.getElementById("guardianEmail").value.trim(),
                phone: document.getElementById("guardianPhone").value.trim(),
                email: document.getElementById("guardianEmail").value.trim() || "No email provided",
                address: document.getElementById("residentialAddress").value.trim(),

                yearBatch: "2026/2027",
                documentsUrl: null,
                status: "Pending",
                createdAt: serverTimestamp(),
                submittedAt: serverTimestamp()
            };

            await setDoc(newDocRef, applicationData);

            // Hand the submission summary to success.html
            sessionStorage.setItem("olistarApplicationSummary", JSON.stringify({
                refCode: refCode,
                dateSubmitted: new Date().toLocaleString("en-GB"),
                yearBatch: applicationData.yearBatch,
                fullName: fullName,
                dob: applicationData.dob,
                gender: applicationData.gender,
                nationality: applicationData.nationality,
                prevSchool: applicationData.prevSchool,
                academicTier: applicationData.academicTier,
                stream: applicationData.programStream,
                entryLevel: applicationData.entryLevel,
                boardingStatus: applicationData.boardingStatus === "boarding" ? "Boarding Student" : "Day Student",
                guardianName: applicationData.guardianName,
                relationship: applicationData.relationship,
                phone: applicationData.phone,
                email: applicationData.email === "No email provided" ? "Not provided" : applicationData.email,
                address: applicationData.address
            }));

            window.location.href = "success.html";

        } catch (error) {
            console.error("Error submitting application:", error);
            showAlert("danger", "Submission failed: " + error.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    });
});
