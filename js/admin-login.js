// js/admin-login.js
import { db } from "./firebase-config.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    setPersistence, 
    browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const auth = getAuth();

// Purge any legacy persistent tokens stored in localStorage
Object.keys(localStorage).forEach(key => {
    if (key.startsWith('firebase:authUser')) {
        localStorage.removeItem(key);
    }
});

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();

        if (loginError) {
            loginError.textContent = '';
            loginError.classList.add('d-none');
        }

        try {
            // 1. Set persistence to SESSION (valid while tab/browser is open, wiped on close)
            await setPersistence(auth, browserSessionPersistence);
            
            // 2. Authenticate user
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Logged in with session persistence.");
            
            // 3. Navigate to Admin Dashboard
            window.location.href = 'admin.html';

        } catch (error) {
            console.error("Login Error:", error.code, error.message);
            
            if (loginError) {
                loginError.classList.remove('d-none');
                
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    loginError.textContent = 'Invalid email or password.';
                } else if (error.code === 'auth/too-many-requests') {
                    loginError.textContent = 'Too many failed attempts. Try again later.';
                } else {
                    loginError.textContent = `Login failed: ${error.message}`;
                }
            }
        }
    });
}