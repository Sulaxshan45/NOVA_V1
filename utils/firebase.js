import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

export { auth, googleProvider, signInWithPopup, signOut, deleteUser };
