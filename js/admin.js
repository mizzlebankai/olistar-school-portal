// js/admin.js
import { db } from "./firebase-config.js";
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('applicationsTableBody');
    const statusFilter = document.getElementById('statusFilter');
    let applications = [];

    // Real-time listener for Firestore collection "applications"
    const q = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
    
    onSnapshot(q, (snapshot) => {
        applications = snapshot.docs.map(docSnapshot => ({
            id: docSnapshot.id,
            ...docSnapshot.data()
        }));
        renderTable();
    }, (error) => {
        console.error("Error fetching applications:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load submissions. Check Firebase setup.</td></tr>`;
    });

    function renderTable() {
        const selectedFilter = statusFilter.value;
        const filteredList = selectedFilter === 'All' 
            ? applications 
            : applications.filter(app => app.status === selectedFilter);

        if (filteredList.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                        No applications found for current filter.
                    </td>
                </tr>`;
            return;
        }

        tableBody.innerHTML = filteredList.map(app => {
            const studentName = app.studentInfo ? app.studentInfo.fullName : 'N/A';
            const guardianName = app.guardianInfo ? app.guardianInfo.fullName : 'N/A';
            const guardianPhone = app.guardianInfo ? app.guardianInfo.phone : 'N/A';
            const division = app.academicDivision ? app.academicDivision.toUpperCase() : 'N/A';
            const stream = app.programStream || '';

            let badgeClass = 'bg-warning text-dark';
            if (app.status === 'Approved') badgeClass = 'bg-success';
            if (app.status === 'Rejected') badgeClass = 'bg-danger';
            if (app.status === 'Interview Scheduled') badgeClass = 'bg-info text-dark';

            return `
                <tr class="border-bottom">
                    <td class="px-3 fw-bold font-monospace text-danger">${app.referenceCode || 'N/A'}</td>
                    <td>
                        <div class="fw-bold">${studentName}</div>
                        <small class="text-muted">DOB: ${app.studentInfo?.dob || 'N/A'}</small>
                    </td>
                    <td>
                        <span class="badge bg-secondary rounded-0 mb-1">${division}</span>
                        <div class="small text-muted">${stream} (${app.boardingStatus || 'Day'})</div>
                    </td>
                    <td>
                        <div class="small fw-semibold">${guardianName}</div>
                        <a href="tel:${guardianPhone}" class="small text-decoration-none text-muted">
                            <i class="bi bi-telephone me-1"></i>${guardianPhone}
                        </a>
                    </td>
                    <td>
                        <div class="d-flex flex-column gap-1">
                            ${app.documents?.reportCard ? `<a href="${app.documents.reportCard}" target="_blank" class="btn btn-outline-dark btn-sm rounded-0 py-0 text-start" style="font-size: 0.75rem;"><i class="bi bi-file-earmark-pdf me-1"></i>Report Card</a>` : '<span class="text-muted small">No Report</span>'}
                            ${app.documents?.birthCertificate ? `<a href="${app.documents.birthCertificate}" target="_blank" class="btn btn-outline-dark btn-sm rounded-0 py-0 text-start" style="font-size: 0.75rem;"><i class="bi bi-card-heading me-1"></i>Birth Cert/ID</a>` : '<span class="text-muted small">No ID</span>'}
                        </div>
                    </td>
                    <td>
                        <span class="badge ${badgeClass} rounded-0 px-2 py-1">${app.status || 'Pending'}</span>
                    </td>
                    <td class="px-3">
                        <select onchange="window.updateStatus('${app.id}', this.value)" class="form-select form-select-sm rounded-0 border-dark" style="min-width: 140px;">
                            <option value="Pending" ${app.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Interview Scheduled" ${app.status === 'Interview Scheduled' ? 'selected' : ''}>Interview</option>
                            <option value="Approved" ${app.status === 'Approved' ? 'selected' : ''}>Approve</option>
                            <option value="Rejected" ${app.status === 'Rejected' ? 'selected' : ''}>Reject</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.updateStatus = async (docId, newStatus) => {
        try {
            const docRef = doc(db, "applications", docId);
            await updateDoc(docRef, { status: newStatus });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
        }
    };

    statusFilter.addEventListener('change', renderTable);
});