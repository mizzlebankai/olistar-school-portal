import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// IDs matched to admin-login.html: form="loginForm", inputs="loginEmail"/"loginPassword",
// button="submitBtn" (NOT adminLoginForm / email / password / loginBtn)
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");

if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        // UI Loading State
        submitBtn.disabled = true;
        btnText.textContent = "Signing in...";
        btnSpinner.classList.remove("d-none");
        loginError.classList.add("d-none");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Redirect to admin.html on success
            window.location.replace("admin.html");
        } catch (error) {
            console.error("Login failed:", error);
            loginError.textContent = "Invalid email or password.";
            loginError.classList.remove("d-none");

            // Reset UI
            submitBtn.disabled = false;
            btnText.textContent = "Log In";
            btnSpinner.classList.add("d-none");
        }
    });
} else {
    console.error("admin-login.js: #loginForm not found on this page — check the HTML.");
}
