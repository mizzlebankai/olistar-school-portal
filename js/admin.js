// js/admin.js
import { db } from "./firebase-config.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut, 
    setPersistence, 
    browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { 
    collection, 
    onSnapshot, 
    doc, 
    updateDoc, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const auth = getAuth();
let globalApplications = [];

// Enforce session persistence on dashboard load
setPersistence(auth, browserSessionPersistence).catch((err) => {
    console.error("Failed to set session persistence:", err);
});

// --- PHASE 1: Auth Guard ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        console.log("No active session found. Redirecting to login...");
        window.location.href = 'admin-login.html';
    } else {
        console.log("Admin Authenticated:", user.email);
        
        const emailSpan = document.getElementById('adminUserEmail');
        if (emailSpan) emailSpan.textContent = user.email;
        
        initializeDashboard();
    }
});

// Logout Action Handler
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("Admin logged out.");
            window.location.href = 'admin-login.html';
        }).catch((err) => {
            console.error("Logout error:", err);
            alert("Logout failed.");
        });
    });
}

// --- PHASE 2: Dashboard Real-time Listener & Controls ---

function initializeDashboard() {
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');
    const exportCsvBtn = document.getElementById('exportCsvBtn');

    const q = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        globalApplications = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
        }));
        
        console.log(`Synced ${globalApplications.length} records.`);
        
        // Update Stats & Render Table
        updateMetricCards(globalApplications);
        applyFiltersAndRender();
    }, (error) => {
        console.error("Firestore Listener Error:", error);
        const tableBody = document.getElementById('applicationsTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Error loading data. Verify security rules.</td></tr>`;
        }
    });

    if (statusFilter) statusFilter.addEventListener('change', applyFiltersAndRender);
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndRender);
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportToCSV);
}

// --- PHASE 3: Resilient Metrics Counter ---

function updateMetricCards(apps) {
    const totalEl = document.getElementById('statTotal');
    const pendingEl = document.getElementById('statPending');
    const interviewEl = document.getElementById('statInterview');
    const approvedEl = document.getElementById('statApproved');
    const rejectedEl = document.getElementById('statRejected');

    if (!totalEl) return;

    const counts = { total: apps.length, pending: 0, interview: 0, approved: 0, rejected: 0 };

    apps.forEach(app => {
        const status = (app.status || 'Pending').toLowerCase().trim();
        if (status === 'pending') {
            counts.pending++;
        } else if (status.includes('interview')) {
            counts.interview++;
        } else if (status === 'approved') {
            counts.approved++;
        } else if (status === 'rejected') {
            counts.rejected++;
        } else {
            counts.pending++;
        }
    });

    console.log("Calculated Metric Counts:", counts);

    totalEl.textContent = counts.total;
    if (pendingEl) pendingEl.textContent = counts.pending;
    if (interviewEl) interviewEl.textContent = counts.interview;
    if (approvedEl) approvedEl.textContent = counts.approved;
    if (rejectedEl) rejectedEl.textContent = counts.rejected;
}

// --- PHASE 4: Dual Filter (Status + Text Search) & Rendering ---

function applyFiltersAndRender() {
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchInput');

    const selectedStatus = statusFilter ? statusFilter.value : 'All';
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filtered = globalApplications.filter(app => {
        const matchesStatus = (selectedStatus === 'All') || (app.status === selectedStatus);

        const studentName = app.studentInfo?.fullName?.toLowerCase() || '';
        const refCode = app.referenceCode?.toLowerCase() || '';
        const guardianPhone = app.guardianInfo?.phone?.toLowerCase() || '';
        const guardianName = app.guardianInfo?.fullName?.toLowerCase() || '';

        const matchesSearch = !searchTerm || 
            studentName.includes(searchTerm) || 
            refCode.includes(searchTerm) || 
            guardianPhone.includes(searchTerm) ||
            guardianName.includes(searchTerm);

        return matchesStatus && matchesSearch;
    });

    renderTable(filtered);
}

function renderTable(apps) {
    const tableBody = document.getElementById('applicationsTableBody');
    if (!tableBody) return;

    if (apps.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                    No matching applications found.
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = apps.map(app => {
        const studentName = app.studentInfo ? app.studentInfo.fullName : 'N/A';
        const dob = app.studentInfo ? app.studentInfo.dob : 'N/A';
        const guardianName = app.guardianInfo ? app.guardianInfo.fullName : 'N/A';
        const guardianPhone = app.guardianInfo ? app.guardianInfo.phone : 'N/A';
        const division = app.academicDivision ? app.academicDivision.toUpperCase() : 'N/A';
        const stream = app.programStream || '';
        const boarding = app.boardingStatus || 'Day';
        
        let submissionDateStr = 'N/A';
        if (app.submittedAt) {
            submissionDateStr = app.submittedAt.toDate().toLocaleDateString('en-GH', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        }

        let badgeClass = 'bg-warning text-dark';
        if (app.status === 'Approved') badgeClass = 'bg-success';
        if (app.status === 'Rejected') badgeClass = 'bg-danger';
        if (app.status === 'Interview Scheduled') badgeClass = 'bg-info text-dark';

        return `
            <tr class="border-bottom">
                <td class="px-3"><input type="checkbox" class="application-checkbox" value="${app.id}"></td>
                
                <td>
                    <div class="small fw-bold text-dark">${submissionDateStr}</div>
                    <small class="fw-bold text-danger font-monospace" style="font-size: 0.75rem;">${app.referenceCode || 'N/A'}</small>
                </td>
                
                <td>
                    <div class="fw-bold">${studentName}</div>
                    <small class="text-muted">DOB: ${dob}</small>
                </td>
                
                <td>
                    <span class="badge bg-secondary rounded-0 mb-1" style="font-size: 0.7rem;">${division}</span>
                    <div class="small text-muted">${stream} (${boarding})</div>
                </td>
                
                <td>
                    <div class="small fw-semibold">${guardianName}</div>
                    <a href="tel:${guardianPhone}" class="small text-decoration-none text-muted">
                        <i class="bi bi-telephone me-1"></i>${guardianPhone}
                    </a>
                </td>
                
                <td>
                    <div class="d-flex flex-column gap-1">
                        ${app.documents?.reportCard ? `<a href="${app.documents.reportCard}" target="_blank" class="btn btn-outline-dark btn-sm rounded-0 py-0 text-start" style="font-size: 0.7rem;"><i class="bi bi-file-earmark-pdf me-1"></i>Report Card</a>` : '<span class="text-muted small">No Report</span>'}
                        ${app.documents?.birthCertificate ? `<a href="${app.documents.birthCertificate}" target="_blank" class="btn btn-outline-dark btn-sm rounded-0 py-0 text-start" style="font-size: 0.7rem;"><i class="bi bi-card-heading me-1"></i>Birth Cert/ID</a>` : '<span class="text-muted small">No ID</span>'}
                    </div>
                </td>
                
                <td>
                    <span class="badge ${badgeClass} rounded-0 px-2 py-1" style="font-size: 0.7rem;">${app.status || 'Pending'}</span>
                </td>
                
                <td class="px-3 text-end">
                    <select 
                        class="form-select form-select-sm rounded-0 border-dark" 
                        style="min-width: 150px; font-size: 0.75rem;"
                        onchange="window.updateApplicationStatus('${app.id}', this.value)"
                    >
                        <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Set: Pending</option>
                        <option value="Interview Scheduled" ${app.status === 'Interview Scheduled' ? 'selected' : ''}>Set: Interview</option>
                        <option value="Approved" ${app.status === 'Approved' ? 'selected' : ''}>Set: Approve</option>
                        <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Set: Reject</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

// --- PHASE 5: Real-time Inline Status Update ---

window.updateApplicationStatus = async (applicationId, newStatus) => {
    try {
        const appRef = doc(db, "applications", applicationId);
        await updateDoc(appRef, {
            status: newStatus,
            lastUpdated: serverTimestamp()
        });
        console.log(`Status updated successfully for ${applicationId}`);
    } catch (error) {
        console.error("Firestore Update Error:", error);
        alert(`Failed to update status: ${error.message}`);
    }
};

// --- PHASE 6: Export Data to CSV ---

function exportToCSV() {
    if (globalApplications.length === 0) {
        alert("No applications available to export.");
        return;
    }

    const headers = ["Reference Code", "Student Name", "DOB", "Division", "Stream", "Boarding", "Guardian Name", "Guardian Phone", "Status", "Submitted At"];
    
    const rows = globalApplications.map(app => {
        const subDate = app.submittedAt ? app.submittedAt.toDate().toISOString().split('T')[0] : '';
        return [
            `"${app.referenceCode || ''}"`,
            `"${app.studentInfo?.fullName || ''}"`,
            `"${app.studentInfo?.dob || ''}"`,
            `"${app.academicDivision || ''}"`,
            `"${app.programStream || ''}"`,
            `"${app.boardingStatus || ''}"`,
            `"${app.guardianInfo?.fullName || ''}"`,
            `"${app.guardianInfo?.phone || ''}"`,
            `"${app.status || 'Pending'}"`,
            `"${subDate}"`
        ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `olistar_admissions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}