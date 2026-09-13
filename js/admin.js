// js/admin.js
import { db } from "./firebase-config.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const auth = getAuth();

// --- PHASE 1: Authentication Gateway & Initialization ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // User is NOT logged in. Redirect to the login page immediately.
        console.log("Unauthorized admin access detected. Redirecting to login.");
        window.location.href = 'admin-login.html';
    } else {
        // User IS authenticated as Admin. Proceed to initialize dashboard data.
        console.log("Admin Authenticated:", user.email);
        
        // Optional: Display Admin Email in Navbar if the element exists
        const emailSpan = document.getElementById('adminUserEmail');
        if (emailSpan) emailSpan.textContent = user.email;
        
        // Start the workflow
        initializeDashboard();
    }
});

// Handling Logout Action
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            // Sign-out successful, authentication state listener above will handle redirect.
            console.log("Admin logged out successfully.");
        }).catch((error) => {
            console.error("Logout error:", error);
            alert("Error logging out.");
        });
    });
}

// --- PHASE 2: Dashboard Logic (Filtering & Real-Time Listener) ---

function initializeDashboard() {
    const tableBody = document.getElementById('applicationsTableBody');
    const statusFilter = document.getElementById('statusFilter');
    let applicationsList = []; // Central data store for filtering

    // 1. Establish Real-Time Listener (Sorted by submission date descending)
    // This runs continuously as long as the page is open.
    const q = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        // map snapshot docs to a clean array including the ID
        applicationsList = snapshot.docs.map(docSnapshot => ({
            id: docSnapshot.id,
            ...docSnapshot.data()
        }));
        
        console.log(`Loaded ${applicationsList.length} applications.`);
        renderTable(applicationsList); // Render initial data
    }, (error) => {
        console.error("Firestore Listener Error:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Error loading data. Check security rules.</td></tr>`;
    });

    // 2. Event Listener for Main Status Dropdown Filter (Client-side filtering)
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            renderTable(applicationsList); // Re-render based on new filter selection
        });
    }
}

// --- PHASE 3: Table Rendering & Color Coding ---

function renderTable(apps) {
    const tableBody = document.getElementById('applicationsTableBody');
    const statusFilter = document.getElementById('statusFilter');
    
    if (!tableBody || !statusFilter) return; // Safety check

    const selectedStatus = statusFilter.value;
    
    // Perform client-side filter
    const filteredApps = selectedStatus === "All" 
        ? apps 
        : apps.filter(app => app.status === selectedStatus);

    // Handle Empty State
    if (filteredApps.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-5 text-muted">
                    <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                    No applications found matching the criteria.
                </td>
            </tr>`;
        return;
    }

    // Map filtered applications to table rows (<tr>)
    tableBody.innerHTML = filteredApps.map(app => {
        // Safe data extraction (handles missing fields with defaults)
        const studentName = app.studentInfo ? app.studentInfo.fullName : 'N/A';
        const dob = app.studentInfo ? app.studentInfo.dob : 'N/A';
        const guardianName = app.guardianInfo ? app.guardianInfo.fullName : 'N/A';
        const guardianPhone = app.guardianInfo ? app.guardianInfo.phone : 'N/A';
        const division = app.academicDivision ? app.academicDivision.toUpperCase() : 'N/A';
        const stream = app.programStream || '';
        const boarding = app.boardingStatus || 'Day';
        
        // Format Submission Date
        let submissionDateStr = 'N/A';
        if (app.submittedAt) {
            submissionDateStr = app.submittedAt.toDate().toLocaleDateString('en-GH', {
                year: 'numeric', month: 'short', day: 'numeric'
            });
        }

        // --- PHASE 4: Color Coding & inline Status Update ---
        
        // Define Bootstrap status badge color class
        let badgeClass = 'bg-warning text-dark'; // Default: Pending
        if (app.status === 'Approved') badgeClass = 'bg-success';
        if (app.status === 'Rejected') badgeClass = 'bg-danger';
        if (app.status === 'Interview Scheduled') badgeClass = 'bg-info text-dark';

        // Return the HTML structure for the row
        return `
            <tr class="border-bottom">
                <td class="px-3"><input type="checkbox" class="application-checkbox" value="${app.id}"></td>
                
                <!-- Date/Ref Column -->
                <td>
                    <div class="small fw-bold text-dark">${submissionDateStr}</div>
                    <small class="fw-bold text-danger font-monospace" style="font-size: 0.75rem;">${app.referenceCode || 'N/A'}</small>
                </td>
                
                <!-- Applicant Column -->
                <td>
                    <div class="fw-bold">${studentName}</div>
                    <small class="text-muted">DOB: ${dob}</small>
                </td>
                
                <!-- Stream Column -->
                <td>
                    <span class="badge bg-secondary rounded-0 mb-1" style="font-size: 0.7rem;">${division}</span>
                    <div class="small text-muted">${stream} (${boarding})</div>
                </td>
                
                <!-- Guardian Column -->
                <td>
                    <div class="small fw-semibold">${guardianName}</div>
                    <a href="tel:${guardianPhone}" class="small text-decoration-none text-muted">
                        <i class="bi bi-telephone me-1"></i>${guardianPhone}
                    </a>
                </td>
                
                <!-- Documents Column -->
                <td>
                    <div class="d-flex flex-column gap-1">
                        ${app.documents?.reportCard ? `<a href="${app.documents.reportCard}" target="_blank" class="btn btn-outline-dark btn-sm rounded-0 py-0 text-start" style="font-size: 0.7rem;"><i class="bi bi-file-earmark-pdf me-1"></i>Report Card</a>` : '<span class="text-muted small">No Report</span>'}
                        ${app.documents?.birthCertificate ? `<a href="${app.documents.birthCertificate}" target="_blank" class="btn btn-outline-dark btn-sm rounded-0 py-0 text-start" style="font-size: 0.7rem;"><i class="bi bi-card-heading me-1"></i>Birth Cert/ID</a>` : '<span class="text-muted small">No ID</span>'}
                    </div>
                </td>
                
                <!-- Status Column (Color coded) -->
                <td>
                    <span class="badge ${badgeClass} rounded-0 px-2 py-1" style="font-size: 0.7rem;">${app.status || 'Pending'}</span>
                </td>
                
                <!-- Action Column: CRITICAL INLINE STATUS UPDATE dropdown -->
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

// --- PHASE 5: The "Step Update" - Firestore persist function ---

/**
 * Persists a status change directly to Firestore.
 * Exposed to the global window scope so it can be called by inline onchange handlers.
 * @param {string} applicationId - The unique ID of the Firestore document.
 * @param {string} newStatus - The new status value selected (Pending, Approved, etc.).
 */
window.updateApplicationStatus = async (applicationId, newStatus) => {
    console.log(`Attempting status update for ${applicationId} to ${newStatus}...`);

    try {
        // 1. Reference the specific document in the "applications" collection
        const applicationRef = doc(db, "applications", applicationId);

        // 2. Perform the update operation (This will trigger the real-time listener above to re-render the table)
        await updateDoc(applicationRef, {
            status: newStatus,
            lastUpdated: serverTimestamp() // Optional: track when it was updated
        });

        console.log(`Firestore updated successfully for ${applicationId}.`);
        // UI feedback is handled automatically by the real-time listener (onSnapshot)
        
    } catch (error) {
        console.error("Firestore Update Error:", error);
        
        // Handle common security rules failure (e.g., Blaze plan upgrade issue, or user not logged in)
        if (error.code === 'permission-denied') {
            alert("Error updating status: Permission Denied. Ensure you are logged in as an Admin and that standard security rules are published.");
        } else {
            alert(`Failed to update application status: ${error.message}`);
        }
        
        // Note: The UI dropdown will automatically reset on the next real-time sync 
        // to reflect the value still stored in the database.
    }
};