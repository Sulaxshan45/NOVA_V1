import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBLOu3-fQ4RIbJg4nHn4_z-KPV2qrKJ_qA",
  authDomain: "nova-pm-c2b4f.firebaseapp.com",
  projectId: "nova-pm-c2b4f",
  storageBucket: "nova-pm-c2b4f.firebasestorage.app",
  messagingSenderId: "81021758204",
  appId: "1:81021758204:web:f7d426ef423c1afadd8579",
  measurementId: "G-TXG6R3QFGT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, deleteUser, db, storage };
