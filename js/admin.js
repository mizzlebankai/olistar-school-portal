import { db, auth } from "./firebase-config.js";
import {
    collection,
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let rawApplications = [];
let filteredApplications = [];
let selectedIds = new Set();
let currentPage = 1;
const PAGE_SIZE = 10;

const tableBody = document.getElementById("applicationsTableBody");
const adminUserEmail = document.getElementById("adminUserEmail");
const logoutBtn = document.getElementById("logoutBtn");
const searchInput = document.getElementById("searchInput");
const batchFilter = document.getElementById("batchFilter");
const statusFilter = document.getElementById("statusFilter");
const selectAll = document.getElementById("selectAll");
const bulkActionsGroup = document.getElementById("bulkActionsGroup");
const bulkStatusSelect = document.getElementById("bulkStatusSelect");
const applyBulkBtn = document.getElementById("applyBulkBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const paginationInfo = document.getElementById("paginationInfo");
const paginationControls = document.getElementById("paginationControls");
const activeBatchBadge = document.getElementById("activeBatchBadge");

const applicantModalEl = document.getElementById("applicantModal");
const applicantModalBody = document.getElementById("applicantModalBody");
const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
const deleteModalMessage = document.getElementById("deleteModalMessage");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

let applicantModal = null;
let deleteConfirmModal = null;
let pendingDeleteIds = [];

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

// ---------------------------------------------------------------------
// AUTH GUARD: wait for a confirmed login before touching Firestore.
// ---------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }
    if (adminUserEmail) adminUserEmail.textContent = user.email;
    applicantModal = applicantModalEl ? new bootstrap.Modal(applicantModalEl) : null;
    deleteConfirmModal = deleteConfirmModalEl ? new bootstrap.Modal(deleteConfirmModalEl) : null;
    initRealtimeListeners();
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => window.location.replace("admin-login.html"));
    });
}

// NOTE: no orderBy() on the query itself. Firestore's orderBy() silently
// EXCLUDES documents missing that field. Fetch unordered, sort client-side.
export function initRealtimeListeners() {
    const appsRef = collection(db, "applications");

    onSnapshot(appsRef, (snapshot) => {
        rawApplications = mapSnapshot(snapshot);
        rawApplications.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
        updateSummaryStats(rawApplications);
        applyFiltersAndRender();
    }, (error) => {
        console.error("Firestore listener error:", error);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">
                Error loading applications: ${error.message}
            </td></tr>`;
        }
    });
}

function mapSnapshot(snapshot) {
    const apps = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const timestamp = data.createdAt || data.submittedAt;

        apps.push({
            id: docSnap.id,
            refCode: data.referenceCode || data.refCode || docSnap.id.substring(0, 8).toUpperCase(),
            fullName: data.fullName || data.applicantName || data.studentInfo?.fullName || "N/A",
            firstName: data.firstName || "",
            middleName: data.middleName || "",
            lastName: data.lastName || "",
            dob: data.dob || "N/A",
            gender: data.gender || "N/A",
            nationality: data.nationality || "N/A",
            prevSchool: data.prevSchool || "N/A",
            email: data.email || data.guardianEmail || "N/A",
            phone: data.guardianPhone || data.phone || data.guardianInfo?.phone || "N/A",
            guardianName: data.guardianName || data.guardianInfo?.fullName || "N/A",
            relationship: data.relationship || "N/A",
            address: data.address || data.residentialAddress || "N/A",
            academicTier: data.academicTier || "N/A",
            stream: data.programStream || data.stream || "N/A",
            entryLevel: data.entryLevel || data.studentInfo?.entryLevel || "N/A",
            boardingStatus: data.boardingStatus || "N/A",
            yearBatch: data.yearBatch || "2026/2027",
            status: data.status || "Pending",
            documentsUrl: data.documentsUrl || data.documents?.reportCard || null,
            createdAtFormatted: timestamp?.toDate
                ? timestamp.toDate().toLocaleDateString("en-GB")
                : (data.submissionDate || "N/A"),
            rawTimestamp: timestamp?.toDate ? timestamp.toDate().getTime() : 0
        });
    });
    return apps;
}

// ---------------------------------------------------------------------
// FILTERING / SEARCH / PAGINATION
// ---------------------------------------------------------------------
function applyFiltersAndRender() {
    const searchTerm = (searchInput?.value || "").trim().toLowerCase();
    const batchValue = batchFilter?.value || "All";
    const statusValue = statusFilter?.value || "All";

    filteredApplications = rawApplications.filter(app => {
        const matchesBatch = batchValue === "All" || app.yearBatch === batchValue;
        const matchesStatus = statusValue === "All" || app.status === statusValue;
        const matchesSearch = !searchTerm || [
            app.refCode, app.fullName, app.guardianName, app.phone, app.email, app.stream
        ].some(field => String(field).toLowerCase().includes(searchTerm));
        return matchesBatch && matchesStatus && matchesSearch;
    });

    // Drop selections that are no longer visible
    const visibleIds = new Set(filteredApplications.map(a => a.id));
    selectedIds.forEach(id => { if (!visibleIds.has(id)) selectedIds.delete(id); });

    const pageCount = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
    if (currentPage > pageCount) currentPage = pageCount;

    if (activeBatchBadge) {
        activeBatchBadge.innerHTML = `<i class="bi bi-calendar3 me-1"></i> Active View: ${escapeHtml(batchValue === "All" ? "All Batches" : batchValue + " Batch")}`;
    }

    renderApplicationsTable();
    renderPagination();
    updateBulkControls();
}

function renderApplicationsTable() {
    if (!tableBody) return;

    if (filteredApplications.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No applications found.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredApplications.slice(start, start + PAGE_SIZE);

    tableBody.innerHTML = pageRows.map(app => `
        <tr>
            <td class="px-3"><input type="checkbox" class="rowCheckbox" value="${app.id}" ${selectedIds.has(app.id) ? "checked" : ""}></td>
            <td>
                <strong>${escapeHtml(app.refCode)}</strong><br>
                <span class="text-muted small">${escapeHtml(app.createdAtFormatted)}</span>
            </td>
            <td>${escapeHtml(app.yearBatch)}</td>
            <td>
                <a href="#" class="fw-bold text-dark text-decoration-none viewAppLink" data-id="${app.id}">${escapeHtml(app.fullName)}</a>
            </td>
            <td>${escapeHtml(app.stream)}</td>
            <td>
                ${escapeHtml(app.guardianName)}<br>
                <span class="text-muted small">${escapeHtml(app.phone)}</span>
            </td>
            <td>
                ${app.documentsUrl
                    ? `<a href="${escapeHtml(app.documentsUrl)}" target="_blank" rel="noopener" class="btn btn-sm btn-outline-primary rounded-0">View Doc</a>`
                    : '<span class="text-muted">None</span>'}
            </td>
            <td><span class="badge ${getStatusBadgeClass(app.status)}">${escapeHtml(app.status)}</span></td>
            <td class="text-end px-3">
                <button onclick="generateApplicationForm('${app.id}')" title="Generate printable form" class="btn btn-sm btn-outline-dark me-1"><i class="bi bi-printer"></i> Form</button>
                <button onclick="changeApplicationStatus('${app.id}', 'Approved')" class="btn btn-sm btn-success me-1">Approve</button>
                <button onclick="changeApplicationStatus('${app.id}', 'Rejected')" class="btn btn-sm btn-warning me-1">Reject</button>
                <button onclick="requestDeleteApplication('${app.id}')" class="btn btn-sm btn-danger">Delete</button>
            </td>
        </tr>
    `).join('');

    updateSelectAllState(pageRows);
}

function renderPagination() {
    const total = filteredApplications.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    if (paginationInfo) paginationInfo.textContent = `Showing ${start}–${end} of ${total} applications`;
    if (!paginationControls) return;

    let pagesHtml = `<li class="page-item ${currentPage === 1 ? "disabled" : ""}">
        <a class="page-link text-dark" href="#" data-page="${currentPage - 1}">Previous</a></li>`;
    for (let p = 1; p <= pageCount; p++) {
        pagesHtml += `<li class="page-item ${p === currentPage ? "active" : ""}">
            <a class="page-link ${p === currentPage ? "bg-dark border-dark text-warning" : "text-dark"}" href="#" data-page="${p}">${p}</a></li>`;
    }
    pagesHtml += `<li class="page-item ${currentPage === pageCount ? "disabled" : ""}">
        <a class="page-link text-dark" href="#" data-page="${currentPage + 1}">Next</a></li>`;

    paginationControls.innerHTML = pagesHtml;
}

paginationControls?.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-page]");
    if (!link) return;
    e.preventDefault();
    const page = parseInt(link.dataset.page, 10);
    const pageCount = Math.max(1, Math.ceil(filteredApplications.length / PAGE_SIZE));
    if (page >= 1 && page <= pageCount) {
        currentPage = page;
        renderApplicationsTable();
        renderPagination();
    }
});

searchInput?.addEventListener("input", () => { currentPage = 1; applyFiltersAndRender(); });
batchFilter?.addEventListener("change", () => { currentPage = 1; applyFiltersAndRender(); });
statusFilter?.addEventListener("change", () => { currentPage = 1; applyFiltersAndRender(); });

// ---------------------------------------------------------------------
// ROW SELECTION & BULK ACTIONS
// ---------------------------------------------------------------------
tableBody?.addEventListener("change", (e) => {
    if (e.target.classList.contains("rowCheckbox")) {
        if (e.target.checked) selectedIds.add(e.target.value);
        else selectedIds.delete(e.target.value);
        updateBulkControls();
    }
});

tableBody?.addEventListener("click", (e) => {
    const link = e.target.closest(".viewAppLink");
    if (!link) return;
    e.preventDefault();
    viewApplication(link.dataset.id);
});

selectAll?.addEventListener("change", () => {
    const checkboxes = tableBody.querySelectorAll(".rowCheckbox");
    checkboxes.forEach(cb => {
        cb.checked = selectAll.checked;
        if (selectAll.checked) selectedIds.add(cb.value);
        else selectedIds.delete(cb.value);
    });
    updateBulkControls();
});

function updateSelectAllState(pageRows) {
    if (!selectAll) return;
    const ids = pageRows.map(a => a.id);
    selectAll.checked = ids.length > 0 && ids.every(id => selectedIds.has(id));
}

function updateBulkControls() {
    if (bulkActionsGroup) {
        bulkActionsGroup.classList.toggle("d-none", selectedIds.size === 0);
    }
    if (applyBulkBtn) {
        applyBulkBtn.textContent = selectedIds.size > 0 ? `Apply (${selectedIds.size})` : "Apply";
    }
}

applyBulkBtn?.addEventListener("click", async () => {
    const action = bulkStatusSelect?.value;
    if (!action || selectedIds.size === 0) return;

    if (action === "DELETE_SELECTED") {
        requestBulkDelete();
        return;
    }

    applyBulkBtn.disabled = true;
    try {
        await Promise.all([...selectedIds].map(id =>
            updateDoc(doc(db, "applications", id), { status: action })
        ));
        selectedIds.clear();
        bulkStatusSelect.value = "";
        // Snapshot listener re-renders automatically
    } catch (err) {
        alert("Bulk update failed: " + err.message);
    } finally {
        applyBulkBtn.disabled = false;
    }
});

// ---------------------------------------------------------------------
// DELETE (single & bulk) VIA CONFIRMATION MODAL
// ---------------------------------------------------------------------
window.requestDeleteApplication = function (docId) {
    const app = rawApplications.find(a => a.id === docId);
    pendingDeleteIds = [docId];
    if (deleteModalMessage) {
        deleteModalMessage.textContent =
            `Are you sure you want to delete the application of "${app?.fullName || docId}" (${app?.refCode || ""})? This action cannot be undone.`;
    }
    if (deleteConfirmModal) deleteConfirmModal.show();
    else if (confirm("Delete this application record permanently?")) performDelete();
};

function requestBulkDelete() {
    pendingDeleteIds = [...selectedIds];
    if (deleteModalMessage) {
        deleteModalMessage.textContent =
            `Are you sure you want to delete ${pendingDeleteIds.length} selected application(s)? This action cannot be undone.`;
    }
    if (deleteConfirmModal) deleteConfirmModal.show();
    else if (confirm("Delete selected applications permanently?")) performDelete();
}

confirmDeleteBtn?.addEventListener("click", performDelete);

async function performDelete() {
    if (pendingDeleteIds.length === 0) return;
    confirmDeleteBtn.disabled = true;
    try {
        await Promise.all(pendingDeleteIds.map(id => deleteDoc(doc(db, "applications", id))));
        pendingDeleteIds.forEach(id => selectedIds.delete(id));
        pendingDeleteIds = [];
        deleteConfirmModal?.hide();
    } catch (err) {
        alert("Delete failed: " + err.message);
    } finally {
        confirmDeleteBtn.disabled = false;
    }
}

// Keep legacy inline handler name working
window.deleteApplication = window.requestDeleteApplication;

window.changeApplicationStatus = async function (docId, newStatus) {
    try {
        await updateDoc(doc(db, "applications", docId), { status: newStatus });
    } catch (err) {
        alert("Status update failed: " + err.message);
    }
};

// ---------------------------------------------------------------------
// CSV EXPORT (exports the currently filtered view)
// ---------------------------------------------------------------------
exportCsvBtn?.addEventListener("click", () => {
    if (filteredApplications.length === 0) {
        alert("No applications to export in the current view.");
        return;
    }

    const headers = [
        "Ref Code", "Date", "Batch", "Full Name", "Gender", "Date of Birth",
        "Nationality", "Previous School", "Division", "Program / Stream",
        "Entry Level", "Boarding Status", "Guardian Name", "Relationship",
        "Guardian Phone", "Email", "Address", "Status"
    ];

    const rows = filteredApplications.map(app => [
        app.refCode, app.createdAtFormatted, app.yearBatch, app.fullName,
        app.gender, app.dob, app.nationality, app.prevSchool,
        app.academicTier, app.stream, app.entryLevel, app.boardingStatus,
        app.guardianName, app.relationship, app.phone, app.email,
        app.address, app.status
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => {
            const value = String(cell ?? "");
            return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
        }).join(","))
        .join("\r\n");

    // BOM so Excel reads UTF-8 correctly
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `olistar-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------------
// APPLICANT DETAILS MODAL
// ---------------------------------------------------------------------
function viewApplication(docId) {
    const app = rawApplications.find(a => a.id === docId);
    if (!app || !applicantModalBody) return;

    const field = (label, value) => `
        <div class="mb-2">
            <span class="text-uppercase text-muted small fw-bold d-block">${label}</span>
            <span class="text-dark">${escapeHtml(value || "N/A")}</span>
        </div>`;

    applicantModalBody.innerHTML = `
        <div class="d-flex justify-content-between align-items-start border-bottom pb-3 mb-3">
            <div>
                <h4 class="fw-bold mb-1">${escapeHtml(app.fullName)}</h4>
                <span class="badge bg-dark text-warning font-monospace">${escapeHtml(app.refCode)}</span>
                <span class="badge ${getStatusBadgeClass(app.status)} ms-1">${escapeHtml(app.status)}</span>
            </div>
            <button onclick="generateApplicationForm('${app.id}')" class="btn btn-sm btn-outline-dark rounded-0">
                <i class="bi bi-printer me-1"></i> Generate Form
            </button>
        </div>
        <div class="row">
            <div class="col-md-6">
                <h6 class="fw-bold text-danger text-uppercase small border-bottom pb-1 mb-2">Applicant</h6>
                ${field("Date of Birth", app.dob)}
                ${field("Gender", app.gender)}
                ${field("Nationality", app.nationality)}
                ${field("Previous School", app.prevSchool)}
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold text-danger text-uppercase small border-bottom pb-1 mb-2">Academic Pathway</h6>
                ${field("Division", app.academicTier)}
                ${field("Program / Stream", app.stream)}
                ${field("Entry Level", app.entryLevel)}
                ${field("Boarding Status", app.boardingStatus)}
                ${field("Academic Batch", app.yearBatch)}
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold text-danger text-uppercase small border-bottom pb-1 mb-2">Guardian</h6>
                ${field("Guardian Name", app.guardianName)}
                ${field("Relationship", app.relationship)}
                ${field("Phone", app.phone)}
                ${field("Email", app.email)}
            </div>
            <div class="col-md-6">
                <h6 class="fw-bold text-danger text-uppercase small border-bottom pb-1 mb-2">Other</h6>
                ${field("Residential Address", app.address)}
                ${field("Submitted On", app.createdAtFormatted)}
                ${field("Documents", app.documentsUrl ? "Attached" : "None")}
            </div>
        </div>`;

    applicantModal?.show();
}

// ---------------------------------------------------------------------
// PRINTABLE APPLICATION FORM GENERATOR (with school logo)
// ---------------------------------------------------------------------
window.generateApplicationForm = function (docId) {
    const app = rawApplications.find(a => a.id === docId);
    if (!app) return;

    const logoUrl = new URL("assets/images/logo.png", window.location.href).href;

    const formWindow = window.open("", "_blank", "width=900,height=1000");
    if (!formWindow) {
        alert("Please allow pop-ups for this site to generate the form.");
        return;
    }

    const row = (label, value) => `
        <tr>
            <td class="label">${label}</td>
            <td class="value">${escapeHtml(value || "N/A")}</td>
        </tr>`;

    formWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Application Form - ${escapeHtml(app.refCode)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 32px; }
        .header { display: flex; align-items: center; gap: 20px; border-bottom: 4px double #900C3F; padding-bottom: 16px; margin-bottom: 24px; }
        .header img { width: 90px; height: 90px; object-fit: contain; }
        .school-name { font-size: 26px; font-weight: bold; color: #900C3F; letter-spacing: 1px; }
        .motto { font-size: 12px; font-style: italic; color: #555; margin-top: 2px; }
        .contact { font-size: 11px; color: #555; margin-top: 4px; }
        .form-title { text-align: center; text-transform: uppercase; letter-spacing: 3px; font-size: 16px; font-weight: bold; margin-bottom: 4px; }
        .ref-line { text-align: center; font-size: 12px; margin-bottom: 24px; }
        .ref-code { font-family: 'Courier New', monospace; font-weight: bold; background: #f5f5f5; border: 1px solid #900C3F; padding: 2px 10px; }
        h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; background: #900C3F; color: #fff; padding: 6px 10px; margin: 18px 0 0 0; }
        table { width: 100%; border-collapse: collapse; }
        td { border: 1px solid #999; padding: 7px 10px; font-size: 13px; vertical-align: top; }
        td.label { width: 32%; background: #faf6f7; font-weight: bold; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; color: #444; }
        .declaration { margin-top: 24px; font-size: 12px; border: 1px solid #999; padding: 12px; background: #fafafa; }
        .signatures { display: flex; justify-content: space-between; margin-top: 56px; gap: 40px; }
        .sig-block { flex: 1; text-align: center; font-size: 12px; }
        .sig-line { border-top: 1px solid #333; margin-bottom: 6px; padding-top: 4px; }
        .footer-note { margin-top: 32px; text-align: center; font-size: 10px; color: #777; border-top: 1px solid #ccc; padding-top: 8px; }
        .status-stamp { float: right; border: 2px solid #900C3F; color: #900C3F; font-weight: bold; text-transform: uppercase; padding: 4px 12px; font-size: 12px; letter-spacing: 2px; transform: rotate(-3deg); }
        @media print { body { padding: 10px; } .no-print { display: none; } }
        .print-bar { text-align: center; margin-bottom: 20px; }
        .print-bar button { background: #900C3F; color: #fff; border: none; padding: 10px 28px; font-size: 14px; cursor: pointer; font-family: inherit; }
    </style>
</head>
<body>
    <div class="print-bar no-print">
        <button onclick="window.print()">Print / Save as PDF</button>
    </div>

    <div class="header">
        <img src="${logoUrl}" alt="Olistar School Logo"
             onerror="this.onerror=null;this.src='https://placehold.co/100x100/900C3F/ffffff?text=Olistar'">
        <div>
            <div class="school-name">OLISTAR SCHOOL</div>
            <div class="motto">Good Foundation, Firm Building &bull; Est. 1987</div>
            <div class="contact">Sunyani Abesim, Bono Region &bull; +233 (0) 24 000 0000 &bull; olistaredu.net</div>
        </div>
        <div class="status-stamp">${escapeHtml(app.status)}</div>
    </div>

    <div class="form-title">Official Student Application Form</div>
    <div class="ref-line">
        Reference No: <span class="ref-code">${escapeHtml(app.refCode)}</span>
        &nbsp;&bull;&nbsp; Academic Batch: <strong>${escapeHtml(app.yearBatch)}</strong>
        &nbsp;&bull;&nbsp; Date Submitted: <strong>${escapeHtml(app.createdAtFormatted)}</strong>
    </div>

    <h3>Section A &mdash; Academic Pathway</h3>
    <table>
        ${row("Educational Division", app.academicTier)}
        ${row("Program / Specialization", app.stream)}
        ${row("Entry Level / Grade", app.entryLevel)}
        ${row("Enrollment Status", app.boardingStatus === "boarding" ? "Boarding Student" : app.boardingStatus === "day" ? "Day Student" : app.boardingStatus)}
    </table>

    <h3>Section B &mdash; Applicant Information</h3>
    <table>
        ${row("Full Name", app.fullName)}
        ${row("Date of Birth", app.dob)}
        ${row("Gender", app.gender)}
        ${row("Nationality", app.nationality)}
        ${row("Previous School & Location", app.prevSchool)}
    </table>

    <h3>Section C &mdash; Parent / Guardian Contact</h3>
    <table>
        ${row("Guardian Full Name", app.guardianName)}
        ${row("Relationship to Student", app.relationship)}
        ${row("Primary Phone Number", app.phone)}
        ${row("Email Address", app.email)}
        ${row("Residential / Digital Address", app.address)}
    </table>

    <div class="declaration">
        <strong>DECLARATION:</strong> I hereby declare that all information provided in this
        application is authentic and accurate. I understand that falsification of academic records
        or identity will lead to immediate revocation of admission at Olistar School.
    </div>

    <div class="signatures">
        <div class="sig-block">
            <div class="sig-line"></div>
            Applicant / Guardian Signature &amp; Date
        </div>
        <div class="sig-block">
            <div class="sig-line"></div>
            Admissions Officer Signature &amp; Date
        </div>
    </div>

    <div class="footer-note">
        This form was generated electronically from the Olistar School Admissions Portal and is valid with reference number ${escapeHtml(app.refCode)}.
        <br>For official use only.
    </div>
</body>
</html>`);
    formWindow.document.close();
};

// ---------------------------------------------------------------------
// SUMMARY STATS
// ---------------------------------------------------------------------
function updateSummaryStats(apps) {
    const totalEl = document.getElementById("statTotal");
    const pendingEl = document.getElementById("statPending");
    const interviewEl = document.getElementById("statInterview");
    const approvedEl = document.getElementById("statApproved");
    const rejectedEl = document.getElementById("statRejected");

    if (totalEl) totalEl.innerText = apps.length;
    if (pendingEl) pendingEl.innerText = apps.filter(a => a.status === 'Pending').length;
    if (interviewEl) interviewEl.innerText = apps.filter(a => a.status === 'Interview Scheduled').length;
    if (approvedEl) approvedEl.innerText = apps.filter(a => a.status === 'Approved').length;
    if (rejectedEl) rejectedEl.innerText = apps.filter(a => a.status === 'Rejected').length;
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Approved': return 'bg-success';
        case 'Rejected': return 'bg-danger';
        case 'Interview Scheduled': return 'bg-info text-dark';
        default: return 'bg-warning text-dark';
    }
}
