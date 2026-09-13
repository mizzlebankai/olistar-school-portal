// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCzEXDrGHSB9IZpZHZIorRcziJCDzNd60Y",
  authDomain: "cararide-58e30.firebaseapp.com",
  projectId: "cararide-58e30",
  storageBucket: "cararide-58e30.firebasestorage.app",
  messagingSenderId: "316214448661",
  appId: "1:316214448661:web:f1d11af589e5deb3ed741c"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);