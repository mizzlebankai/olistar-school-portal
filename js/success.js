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
    set("sumPrevSchool", summary.prevSchool);

    set("sumTier", summary.academicTier);
    set("sumStream", summary.stream);
    set("sumEntryLevel", summary.entryLevel);
    set("sumBoarding", summary.boardingStatus);

    set("sumGuardianName", summary.guardianName);
    set("sumRelationship", summary.relationship);
    set("sumPhone", summary.phone);
    set("sumEmail", summary.email);
    set("sumAddress", summary.address);

    sheet.classList.remove("d-none");

    // One-time view: clear so a refresh doesn't show stale data
    sessionStorage.removeItem("olistarApplicationSummary");
});
