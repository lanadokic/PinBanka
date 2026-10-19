import { db, clientsRef, accountsRef, transactionsRef } from '../firebase-config.js';
import { requireAuth, liveSearch, fmtIznos } from '../global.js';
import {
  doc, getDoc, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function qs(name){
  return new URLSearchParams(window.location.search).get(name);
}

let clientOib = qs('oib');
let editingAccountId = null;
let backTo = 'clients.html';

function clearAccountForm(){
  editingAccountId = null;
  $('#modal-account-title').text('Novi račun');
  $('#a_broj').val('');
  $('#a_type').val('tekuci');
  $('#account-error').addClass('d-none').text('');
}

function accountTypeLabel(v){
  return v === 'ziro' ? 'Žiro račun' : 'Tekući račun';
}

function renderAccountRow(a){
  const tr = $(
    `<tr data-id="${a.id}">
      <td>${a.brojRacuna||''}</td>
      <td>${accountTypeLabel(a.type)}</td>
      <td>${fmtIznos(a.stanje)}</td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline-primary mr-1 btn-edit"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-danger btn-del"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`
  );

  tr.on('click', (e)=>{
    if($(e.target).closest('button').length) return;
    window.location.href = `account.html?id=${encodeURIComponent(a.id)}&oib=${encodeURIComponent(clientOib)}`;
  });

  tr.find('.btn-edit').on('click', (e)=>{
    e.stopPropagation();
    clearAccountForm();
    editingAccountId = a.id;
    $('#modal-account-title').text('Uredi račun');
    $('#a_broj').val(a.brojRacuna||'');
    $('#a_type').val(a.type||'tekuci');
    $('#modal-account').modal('show');
  });

  tr.find('.btn-del').on('click', async (e)=>{
    e.stopPropagation();
    if(!confirm(`Obrisati račun ${a.brojRacuna}? (Obrisat će se i sve povezane transakcije)`)) return;

    // Brisanje računa briše sve povezane transakcije
    const qTx = query(transactionsRef, where('accountId','==',a.id));
    const txSnap = await getDocs(qTx);
    const batch = writeBatch(db);
    txSnap.forEach(t => batch.delete(t.ref));
    batch.delete(doc(db,'accounts',a.id));
    await batch.commit();
  });

  return tr;
}

async function saveAccount(){
  const brojRacuna = $('#a_broj').val().trim();
  const type = $('#a_type').val();
  if(!brojRacuna) throw new Error('Unesi broj računa.');

  if(editingAccountId){
    await updateDoc(doc(db,'accounts',editingAccountId), { brojRacuna, type });
  } else {
    await addDoc(accountsRef, { clientOib, brojRacuna, type, stanje: 0, limit: (type === 'tekuci' ? -1000 : 0) });
  }
}

requireAuth({ allowRoles:['admin'], onReady: async ()=>{
  liveSearch('#search', '#tbl-accounts');

  if(!clientOib){
    alert('Nedostaje OIB.');
    window.location.href = backTo;
    return;
  }

  const cSnap = await getDoc(doc(db,'clients',clientOib));
  if(!cSnap.exists()){
    alert('Klijent ne postoji.');
    window.location.href = backTo;
    return;
  }

  const c = cSnap.data();
  $('#client-title').text(`${c.ime} ${c.prezime}`);
  $('#client-sub').text(`OIB: ${c.oib}`);
  $('#client-info').html(`
    <div class="row">
      <div class="col-md-3"><div class="text-muted small">OIB</div><div>${c.oib}</div></div>
      <div class="col-md-3"><div class="text-muted small">Telefon</div><div>${c.telefon||''}</div></div>
      <div class="col-md-3"><div class="text-muted small">Email</div><div>${c.email||''}</div></div>
      <div class="col-md-3"><div class="text-muted small">Adresa</div><div>${c.adresa||''}</div></div>
    </div>
  `);

  $('#modal-account').on('hidden.bs.modal', clearAccountForm);
  $('#form-account').on('submit', async (e)=>{
    e.preventDefault();
    try{
      await saveAccount();
      $('#modal-account').modal('hide');
    }catch(err){
      $('#account-error').removeClass('d-none').text(err.message || String(err));
    }
  });

  const qAcc = query(accountsRef, where('clientOib','==',clientOib));
  onSnapshot(qAcc, (snap)=>{
    const rows = [];
    snap.forEach(d=> rows.push({id:d.id, ...d.data()}));
    rows.sort((a,b)=> (a.brojRacuna||'').localeCompare(b.brojRacuna||''));
    const tbody = $('#tbl-accounts tbody');
    tbody.empty();
    rows.forEach(a => tbody.append(renderAccountRow(a)));
  });
}});
