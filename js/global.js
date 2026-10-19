import { auth, db, usersRef } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

//formatiranje novca
export function fmtIznos(iznos){
  const n = Number(iznos||0);
  return n.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

//tražilica za tablice
export function liveSearch(inputSelector, tableSelector){
  $(inputSelector).on('keyup', function(){
    const value = $(this).val().toLowerCase();
    $(tableSelector + ' tbody tr').filter(function(){
      $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
    });
  });
}

//veza Auth ↔ Firestore
export async function getUserProfile(uid){
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

//zaštita stranica
export function requireAuth(options={}){
  const {
    allowRoles = null, // null -> allow any logged in
    onReady = null,
  } = options;

  onAuthStateChanged(auth, async (user) => {
    if(!user){
      window.location.href = 'login.html';
      return;
    }
    const profile = await getUserProfile(user.uid);
    const role = profile?.role || 'user';

    if(Array.isArray(allowRoles) && !allowRoles.includes(role)){
      // nema prava
      window.location.href = (role === 'admin') ? 'clients.html' : 'my.html';
      return;
    }

    renderNavbar(role);
    $('#main-content').show();
    //poziva logiku konkretne stranice
    if(typeof onReady === 'function') onReady({ user, profile, role });
  });
}

export function renderNavbar(role){
  const isAdmin = role === 'admin';

  const links = [];
  if(isAdmin){
    links.push({ href:'clients.html', text:'Klijenti', icon:'fa-users' });
    links.push({ href:'transactions.html', text:'Transakcije', icon:'fa-exchange-alt' });
    links.push({ href:'users.html', text:'Korisnici', icon:'fa-user-shield' });
  } else {
    links.push({ href:'my.html', text:'Moji računi', icon:'fa-wallet' });
  }

  //generira HTML <li> elemente
  //dodaje active klasu ako si na toj stranici
  const li = links.map(l => `
    <li class="nav-item ${location.pathname.endsWith('/'+l.href) || location.pathname.endsWith(l.href) ? 'active':''}">
      <a class="nav-link" href="${l.href}"><i class="fas ${l.icon} mr-1"></i>${l.text}</a>
    </li>`).join('');

  $('#navbar-links').html(li);

  //odjava
  $('#logout-button').off('click').on('click', async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  });
}

export function initDatepicker(selector){
  // bootstrap-datepicker (jquery)
  $(selector).datepicker({
    format: 'dd.mm.yyyy',
    language: 'hr',
    autoclose: true,
    todayHighlight: true
  });
}


