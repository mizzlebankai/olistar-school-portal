// js/application.js
import { db, storage } from "./firebase-config.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('admissionsForm');
    const alertBox = document.getElementById('formAlert');
    const alertMsg = document.getElementById('formAlertMessage');
    const submitBtn = document.getElementById('submitBtn');
    const academicTierSelect = document.getElementById('academicTier');
    const programStreamSelect = document.getElementById('programStream');

    // Dynamic Filter for Academic Division -> Specialization
    if (academicTierSelect && programStreamSelect) {
        const optgroups = Array.from(programStreamSelect.querySelectorAll('optgroup'));
        academicTierSelect.addEventListener('change', function () {
            const selectedTier = this.value;
            programStreamSelect.value = '';
            programStreamSelect.disabled = false;

            optgroups.forEach(group => {
                if (group.getAttribute('data-tier') === selectedTier) {
                    group.hidden = false;
                    group.disabled = false;
                } else {
                    group.hidden = true;
                    group.disabled = true;
                }
            });
        });
    }

    // Helper: Upload file to Firebase Storage
    async function uploadDocument(fileInputId, refCode, docType) {
        const input = document.getElementById(fileInputId);
        if (!input || !input.files || input.files.length === 0) return null;

        const file = input.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${docType}_${Date.now()}.${fileExt}`;
        const storagePath = `applications/${refCode}/${fileName}`;
        const fileRef = ref(storage, storagePath);

        const snapshot = await uploadBytes(fileRef, file);
        return await getDownloadURL(snapshot.ref);
    }

    // Form Submission Listener
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!form.checkValidity()) {
                form.classList.add('was-validated');
                showAlert('danger', 'Please fill out all required fields correctly before submitting.');
                return;
            }

            form.classList.add('was-validated');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span> Submitting Application...';

            try {
                // Generate Reference Code (e.g., OLI-583920)
                const refCode = 'OLI-' + Math.floor(100000 + Math.random() * 900000);

                // Upload documents concurrently
                const [docResultUrl, docBirthUrl] = await Promise.all([
                    uploadDocument('docResult', refCode, 'ReportCard'),
                    uploadDocument('docBirth', refCode, 'BirthCertificate')
                ]);

                // Application record format
                const applicationData = {
                    referenceCode: refCode,
                    academicDivision: document.getElementById('academicTier').value,
                    programStream: document.getElementById('programStream').value,
                    entryLevel: document.getElementById('entryLevel').value,
                    boardingStatus: document.getElementById('boardingStatus').value,

                    studentInfo: {
                        firstName: document.getElementById('firstName').value.trim(),
                        middleName: document.getElementById('middleName').value.trim() || '',
                        lastName: document.getElementById('lastName').value.trim(),
                        fullName: `${document.getElementById('firstName').value.trim()} ${document.getElementById('lastName').value.trim()}`,
                        dob: document.getElementById('dob').value,
                        gender: document.getElementById('gender').value,
                        nationality: document.getElementById('nationality').value.trim(),
                        previousSchool: document.getElementById('prevSchool').value.trim()
                    },

                    guardianInfo: {
                        fullName: document.getElementById('guardianName').value.trim(),
                        relationship: document.getElementById('relationship').value.trim(),
                        phone: document.getElementById('guardianPhone').value.trim(),
                        email: document.getElementById('guardianEmail').value.trim() || 'N/A',
                        address: document.getElementById('residentialAddress').value.trim()
                    },

                    documents: {
                        reportCard: docResultUrl || null,
                        birthCertificate: docBirthUrl || null
                    },

                    status: 'Pending',
                    submittedAt: serverTimestamp()
                };

                // Save into Firestore
                await addDoc(collection(db, "applications"), applicationData);

                showAlert('success', `<strong>Application Submitted Successfully!</strong> Reference Code: <strong>${refCode}</strong>.`);
                form.reset();
                form.classList.remove('was-validated');
                if (programStreamSelect) programStreamSelect.disabled = true;

            } catch (error) {
                console.error("Submission Error:", error);
                showAlert('danger', `An error occurred while submitting: ${error.message || 'Please check your connection.'}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Submit Formal Application <i class="bi bi-arrow-right ms-2"></i>';
                alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    function showAlert(type, message) {
        alertBox.className = `alert alert-${type} alert-dismissible fade show rounded-0 mb-4`;
        alertMsg.innerHTML = message;
        alertBox.classList.remove('d-none');
    }
});