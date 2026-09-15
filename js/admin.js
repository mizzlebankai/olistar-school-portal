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
const tableBody = document.getElementById("applicationsTableBody");
const adminUserEmail = document.getElementById("adminUserEmail");
const logoutBtn = document.getElementById("logoutBtn");

// ---------------------------------------------------------------------
// AUTH GUARD: wait for a confirmed login before touching Firestore.
// ---------------------------------------------------------------------
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.replace("admin-login.html");
        return;
    }
    if (adminUserEmail) adminUserEmail.textContent = user.email;
    initRealtimeListeners();
});

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => window.location.replace("admin-login.html"));
    });
}

// NOTE: no orderBy() on the query itself anymore. Firestore's orderBy()
// silently EXCLUDES any document missing that field from the results
// (no error) — and your submitted applications don't currently have a
// "createdAt" field (only "submittedAt", and some may have neither).
// Fetching unordered and sorting client-side means no document ever
// gets dropped just because a timestamp field is missing or named
// differently.
export function initRealtimeListeners() {
    const appsRef = collection(db, "applications");

    onSnapshot(appsRef, (snapshot) => {
        rawApplications = mapSnapshot(snapshot);
        rawApplications.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
        updateSummaryStats(rawApplications);
        renderApplicationsTable(rawApplications);
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
            // referenceCode is what your actual documents use; refCode kept as a fallback
            refCode: data.referenceCode || data.refCode || docSnap.id.substring(0, 8).toUpperCase(),
            fullName: data.fullName || data.applicantName || data.studentInfo?.fullName || "N/A",
            email: data.email || data.guardianEmail || "N/A",
            phone: data.guardianPhone || data.phone || data.guardianInfo?.phone || "N/A",
            guardianName: data.guardianName || data.guardianInfo?.fullName || "N/A",
            // programStream is what your actual documents use
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

// Columns match admin.html's <thead> exactly:
// checkbox | DATE/REF CODE | BATCH | APPLICANT | STREAM | GUARDIAN CONTACT | DOCS | STATUS | ACTIONS
function renderApplicationsTable(apps) {
    if (!tableBody) return;

    if (apps.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-muted">No applications found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = apps.map(app => `
        <tr>
            <td class="px-3"><input type="checkbox" class="rowCheckbox" value="${app.id}"></td>
            <td>
                <strong>${app.refCode}</strong><br>
                <span class="text-muted small">${app.createdAtFormatted}</span>
            </td>
            <td>${app.yearBatch}</td>
            <td>${app.fullName}</td>
            <td>${app.stream}</td>
            <td>
                ${app.guardianName}<br>
                <span class="text-muted small">${app.phone}</span>
            </td>
            <td>
                ${app.documentsUrl
                    ? `<a href="${app.documentsUrl}" target="_blank" class="btn btn-sm btn-outline-primary">View Doc</a>`
                    : '<span class="text-muted">None</span>'}
            </td>
            <td><span class="badge ${getStatusBadgeClass(app.status)}">${app.status}</span></td>
            <td class="text-end px-3">
                <button onclick="changeApplicationStatus('${app.id}', 'Approved')" class="btn btn-sm btn-success me-1">Approve</button>
                <button onclick="changeApplicationStatus('${app.id}', 'Rejected')" class="btn btn-sm btn-warning me-1">Reject</button>
                <button onclick="deleteApplication('${app.id}')" class="btn btn-sm btn-danger">Delete</button>
            </td>
        </tr>
    `).join('');
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Approved': return 'bg-success';
        case 'Rejected': return 'bg-danger';
        case 'Interview Scheduled': return 'bg-info text-dark';
        default: return 'bg-warning text-dark';
    }
}

window.changeApplicationStatus = async function (docId, newStatus) {
    try {
        await updateDoc(doc(db, "applications", docId), { status: newStatus });
    } catch (err) {
        alert("Status update failed: " + err.message);
    }
};

window.deleteApplication = async function (docId) {
    if (!confirm("Delete this application record permanently?")) return;
    try {
        await deleteDoc(doc(db, "applications", docId));
    } catch (err) {
        alert("Delete failed: " + err.message);
    }
};

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
