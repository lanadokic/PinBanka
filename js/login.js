
import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const loginCard = document.getElementById('login-card');
const loginForm = document.getElementById('login-form');
const errorMessage = document.getElementById('error-message');

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'index.html';
  } else {
    // prikaži karticu tek kad znamo da nije prijavljen
    loginCard.style.display = 'block';
  }
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorMessage.textContent = ''; // očisti staru grešku

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    console.log('Uspješno prijavljen:', user.uid, user.email);
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Greška pri prijavi:', error.code, error.message);
    errorMessage.textContent = 'Pogrešan email ili lozinka.';
  }
});
