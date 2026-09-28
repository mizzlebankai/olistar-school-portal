import { db } from "./firebase-config.js";
import {
    collection,
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadAdmissionFiles } from "./admission-files.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("admissionsForm");
    if (!form) return;

    const alertBox = document.getElementById("formAlert");
    const tierSelect = document.getElementById("academicTier");
    const streamSelect = document.getElementById("programStream");
    const fileInputs = {
        passportPhoto: document.getElementById("passportPhoto"),
        reportCard: document.getElementById("docResult"),
        birthCertificate: document.getElementById("docBirth")
    };

    // Cascade: only show programs belonging to the selected division
    if (tierSelect && streamSelect) {
        tierSelect.addEventListener("change", () => {
            const tier = tierSelect.value;
            streamSelect.disabled = false;
            streamSelect.value = "";

            streamSelect.querySelectorAll("optgroup").forEach(group => {
                group.hidden = group.dataset.tier !== tier;
            });

            const firstOption = streamSelect.querySelector('option[value=""]');
            if (firstOption) {
                firstOption.textContent = tier === "early-grade-jhs"
                    ? "Select Early Grade / JHS Path..."
                    : "Select SHS / Technical Path...";
            }

            const visibleGroups = [...streamSelect.querySelectorAll("optgroup")].filter(group => !group.hidden);
            if (visibleGroups.length === 0) {
                streamSelect.disabled = true;
            }
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

        const selectedFiles = Object.fromEntries(Object.entries(fileInputs).map(([field, input]) => [field, input?.files?.[0] || null]));
        const fileRules = {
            passportPhoto: { maxBytes: 2 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
            reportCard: { maxBytes: 5 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
            birthCertificate: { maxBytes: 5 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] }
        };
        for (const [field, file] of Object.entries(selectedFiles)) {
            if (!file) continue;
            const rule = fileRules[field];
            if (!rule.types.includes(file.type) || file.size === 0 || file.size > rule.maxBytes) {
                const readableName = field === "passportPhoto" ? "Passport photo" : field === "reportCard" ? "Report card / results" : "Birth certificate / ID";
                const maximum = field === "passportPhoto" ? "2 MB" : "5 MB";
                showAlert("danger", `${readableName} must use an allowed image/PDF format and be no larger than ${maximum}.`);
                return;
            }
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
            const uploadedFiles = await uploadAdmissionFiles(refCode, selectedFiles);
            const applicationFiles = Object.fromEntries(
                Object.entries(uploadedFiles).map(([field, file]) => [field, file.path])
            );

            const residentialAddress = document.getElementById("residentialAddress")?.value.trim() || "";
            const guardianAddress = document.getElementById("guardianAddress")?.value.trim() || residentialAddress;
            const guardianPhone = document.getElementById("guardianPhone")?.value.trim() || "";
            const guardianEmail = document.getElementById("guardianEmail")?.value.trim() || "";
            const healthCondition = document.getElementById("healthCondition")?.value || "No";
            const allergyStatus = document.getElementById("allergyStatus")?.value || "No";

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
                religion: document.getElementById("religion").value.trim(),
                prevSchool: document.getElementById("prevSchool").value.trim(),
                homeTown: document.getElementById("homeTown").value.trim(),
                residentialAddress: residentialAddress,

                // Parent / guardian details
                fatherName: document.getElementById("fatherName").value.trim(),
                fatherOccupation: document.getElementById("fatherOccupation").value.trim(),
                fatherPhone: document.getElementById("fatherPhone").value.trim(),
                fatherNationality: document.getElementById("fatherNationality").value.trim(),
                fatherHomeTown: document.getElementById("fatherHomeTown").value.trim(),
                fatherAddress: document.getElementById("fatherAddress").value.trim(),
                motherName: document.getElementById("motherName").value.trim(),
                motherOccupation: document.getElementById("motherOccupation").value.trim(),
                motherPhone: document.getElementById("motherPhone").value.trim(),
                motherNationality: document.getElementById("motherNationality").value.trim(),
                motherHomeTown: document.getElementById("motherHomeTown").value.trim(),
                motherAddress: document.getElementById("motherAddress").value.trim(),

                // Academic pathway (labels stored so the admin table is readable)
                academicTier: selectedText(document.getElementById("academicTier")),
                academicTierValue: tierSelect?.value || "",
                programStream: selectedText(streamSelect),
                programStreamValue: streamSelect?.value || "",
                entryLevel: document.getElementById("entryLevel").value.trim(),
                boardingStatus: document.getElementById("boardingStatus").value,

                // Guardian/contact
                guardianName: document.getElementById("guardianName").value.trim(),
                relationship: document.getElementById("relationship").value.trim(),
                guardianPhone: guardianPhone,
                guardianEmail: guardianEmail,
                phone: guardianPhone,
                email: guardianEmail || "No email provided",
                address: guardianAddress,

                // Health & special needs
                healthCondition: healthCondition,
                healthDetails: document.getElementById("healthDetails").value.trim(),
                allergyStatus: allergyStatus,
                allergyDetails: document.getElementById("allergyDetails").value.trim(),
                specialNeeds: document.getElementById("specialNeeds").value.trim(),
                passportPhoto: "",
                applicationFiles: applicationFiles,

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
                homeTown: applicationData.homeTown,
                academicTier: applicationData.academicTier,
                stream: applicationData.programStream,
                entryLevel: applicationData.entryLevel,
                boardingStatus: applicationData.boardingStatus === "boarding" ? "Boarding Student" : "Day Student",
                guardianName: applicationData.guardianName,
                relationship: applicationData.relationship,
                phone: applicationData.phone,
                email: applicationData.email === "No email provided" ? "Not provided" : applicationData.email,
                address: applicationData.address,
                fatherName: applicationData.fatherName,
                motherName: applicationData.motherName,
                healthCondition: applicationData.healthCondition,
                healthDetails: applicationData.healthDetails,
                allergyStatus: applicationData.allergyStatus,
                allergyDetails: applicationData.allergyDetails,
                specialNeeds: applicationData.specialNeeds,
                passportPhoto: uploadedFiles.passportPhoto?.url || "",
                applicationFiles: {
                    reportCard: uploadedFiles.reportCard?.url || "",
                    birthCertificate: uploadedFiles.birthCertificate?.url || ""
                }
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
