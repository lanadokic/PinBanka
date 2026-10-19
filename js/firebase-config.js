
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAj_8TkIT_YFozawWl7h5BkR-CV3KZrHWg",
  authDomain: "pin-banka-bbeec.firebaseapp.com",
  projectId: "pin-banka-bbeec",
  storageBucket: "pin-banka-bbeec.firebasestorage.app",
  messagingSenderId: "345341109778",
  appId: "1:345341109778:web:f755ac545b859fdfaa1acb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const clientsRef = collection(db, "clients");
const accountsRef = collection(db, "accounts");
const transactionsRef = collection(db, "transactions");
const usersRef = collection(db, "users");

export { auth, db, clientsRef, accountsRef, transactionsRef, usersRef };
