// js/admin-login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// You can use your credentials from firebase-config.js here
const firebaseConfig = { /* ... pasted credentials ... */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    errorBox.classList.add('d-none'); // Hide previous errors

    try {
        // Firebase attempts to sign in
        await signInWithEmailAndPassword(auth, email, password);
        // On success, redirect to the admin dashboard
        window.location.href = 'admin.html';
    } catch (error) {
        console.error("Login Error:", error);
        errorBox.textContent = "Invalid admin email or password.";
        errorBox.classList.remove('d-none');
    }
});