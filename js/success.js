document.addEventListener("DOMContentLoaded", () => {
    const sheet = document.getElementById("summarySheet");
    let summary = null;

    try {
        summary = JSON.parse(sessionStorage.getItem("olistarApplicationSummary"));
    } catch (err) {
        console.error("Could not read application summary:", err);
    }

    if (!summary) {
        // Direct visit without a submission — send them to the application form
        window.location.replace("application.html");
        return;
    }

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value || "—";
    };

    set("summaryRefCode", summary.refCode);
    set("summaryDate", summary.dateSubmitted);
    set("summaryBatch", summary.yearBatch);

    set("sumFullName", summary.fullName);
    set("sumDob", summary.dob);
    set("sumGender", summary.gender);
    set("sumNationality", summary.nationality);
    set("sumHomeTown", summary.homeTown);
    set("sumPrevSchool", summary.prevSchool);

    set("sumTier", summary.academicTier);
    set("sumStream", summary.stream);
    set("sumEntryLevel", summary.entryLevel);
    set("sumBoarding", summary.boardingStatus);

    set("sumFatherName", summary.fatherName);
    set("sumMotherName", summary.motherName);
    set("sumGuardianName", summary.guardianName);
    set("sumRelationship", summary.relationship);
    set("sumPhone", summary.phone);
    set("sumEmail", summary.email);
    set("sumAddress", summary.address);

    set("sumHealthCondition", summary.healthCondition);
    set("sumAllergyStatus", summary.allergyStatus);
    set("sumHealthDetails", summary.healthDetails);
    set("sumAllergyDetails", summary.allergyDetails);
    set("sumSpecialNeeds", summary.specialNeeds);

    const passportImg = document.getElementById("summaryPassport");
    const passportPlaceholder = document.getElementById("summaryPassportPlaceholder");
    if (summary.passportPhoto && passportImg) {
        passportImg.src = summary.passportPhoto;
        passportImg.style.display = "block";
        if (passportPlaceholder) passportPlaceholder.style.display = "none";
    }

    const documents = summary.applicationFiles || {};
    const documentSection = document.getElementById("summaryDocuments");
    const documentLinks = [
        ["reportCard", "summaryReportCard", "Report card / results slip"],
        ["birthCertificate", "summaryBirthCertificate", "Birth certificate / ID copy"]
    ];
    let hasDocument = false;
    for (const [key, id, label] of documentLinks) {
        const item = document.getElementById(id);
        const url = documents[key];
        if (!item || !url) continue;
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `View ${label}`;
        item.replaceChildren(link);
        item.hidden = false;
        hasDocument = true;
    }
    if (documentSection) documentSection.hidden = !hasDocument;

    sheet.classList.remove("d-none");

    // One-time view: clear so a refresh doesn't show stale data
    sessionStorage.removeItem("olistarApplicationSummary");
});
