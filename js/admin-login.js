// js/admin-login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Exact project credentials for cararide-58e30
const firebaseConfig = {
  apiKey: "AIzaSyCzEXDrGHSB9IZpZHZIorRcziJCDzNd60Y",
  authDomain: "cararide-58e30.firebaseapp.com",
  projectId: "cararide-58e30",
  storageBucket: "cararide-58e30.firebasestorage.app",
  messagingSenderId: "316214448661",
  appId: "1:316214448661:web:f1d11af589e5deb3ed741c"
};

// 1. Initialize Firebase App
const app = initializeApp(firebaseConfig);

// 2. Initialize Auth explicitly passing the initialized app
const auth = getAuth(app);

// 3. Redirect to dashboard if session exists
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin session active:", user.email);
        window.location.href = 'admin.html';
    }
});

// 4. Form Submission
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorBox = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const emailInput = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            if (!emailInput || !passwordInput) return;

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            submitBtn.disabled = true;
            submitBtn.textContent = 'Authenticating...';
            if (errorBox) errorBox.classList.add('d-none');

            try {
                await signInWithEmailAndPassword(auth, email, password);
                // Redirect happens automatically via onAuthStateChanged above
            } catch (error) {
                console.error("Login Error:", error);

                if (errorBox) {
                    if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                        errorBox.textContent = "Invalid email or password.";
                    } else if (error.code === 'auth/too-many-requests') {
                        errorBox.textContent = "Too many attempts. Account temporarily locked.";
                    } else {
                        errorBox.textContent = `Login failed: ${error.message}`;
                    }
                    errorBox.classList.remove('d-none');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Log In';
            }
        });
    }
});