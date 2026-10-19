import { db, clientsRef, accountsRef } from '../firebase-config.js';
import { requireAuth, liveSearch } from '../global.js';
import {
  doc, setDoc, getDoc, deleteDoc, onSnapshot, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let editingOib = null;

function clearForm(){
  editingOib = null;
  $('#modal-client-title').text('Novi klijent');
  $('#c_oib').prop('disabled', false).val('');
  $('#c_ime').val('');
  $('#c_prezime').val('');
  $('#c_adresa').val('');
  $('#c_telefon').val('');
  $('#c_email').val('');
  $('#client-error').addClass('d-none').text('');
}

function renderRow(c){
  const tr = $(
    `<tr data-oib="${c.oib}">
      <td>${c.oib||''}</td>
      <td>${c.ime||''}</td>
      <td>${c.prezime||''}</td>
      <td>${c.adresa||''}</td>
      <td>${c.telefon||''}</td>
      <td>${c.email||''}</td>
      <td class="text-right">
        <button class="btn btn-sm btn-outline-primary mr-1 btn-edit" title="Uredi"><i class="fas fa-edit"></i></button>
        <button class="btn btn-sm btn-outline-danger btn-del" title="Obriši"><i class="fas fa-trash"></i></button>
      </td>
    </tr>`
  );

  tr.on('click', (e)=>{
    if($(e.target).closest('button').length) return;
    window.location.href = `client.html?oib=${encodeURIComponent(c.oib)}`;
  });

  tr.find('.btn-edit').on('click', async (e)=>{
    e.stopPropagation();
    clearForm();
    editingOib = c.oib;
    $('#modal-client-title').text('Uredi klijenta');
    $('#c_oib').val(c.oib).prop('disabled', true);
    $('#c_ime').val(c.ime||'');
    $('#c_prezime').val(c.prezime||'');
    $('#c_adresa').val(c.adresa||'');
    $('#c_telefon').val(c.telefon||'');
    $('#c_email').val(c.email||'');
    $('#modal-client').modal('show');
  });

  tr.find('.btn-del').on('click', async (e)=>{
    e.stopPropagation();
    if(!confirm(`Obrisati klijenta ${c.ime} ${c.prezime} (${c.oib})?`)) return;

    // Klijenta nije moguće obrisati ako posjeduje račun
    const qAcc = query(accountsRef, where('clientOib','==',c.oib));
    const accSnap = await getDocs(qAcc);
    if(!accSnap.empty){
      alert('Klijenta nije moguće obrisati jer posjeduje račun. Prvo obriši njegove račune.');
      return;
    }

    await deleteDoc(doc(db,'clients',c.oib));
  });

  return tr;
}

async function saveClient(){
  const oib = $('#c_oib').val().trim();
  const data = {
    oib,
    ime: $('#c_ime').val().trim(),
    prezime: $('#c_prezime').val().trim(),
    adresa: $('#c_adresa').val().trim(),
    telefon: $('#c_telefon').val().trim(),
    email: $('#c_email').val().trim(),
  };

  if(!/^[0-9]{11}$/.test(oib)) throw new Error('OIB mora imati točno 11 znamenki.');

  await setDoc(doc(db,'clients',oib), data, { merge: true });
}

requireAuth({ allowRoles:['admin'], onReady: () => {
  liveSearch('#search', '#tbl-clients');

  $('#modal-client').on('hidden.bs.modal', clearForm);
  $('#form-client').on('submit', async (e)=>{
    e.preventDefault();
    try{
      await saveClient();
      $('#modal-client').modal('hide');
    }catch(err){
      $('#client-error').removeClass('d-none').text(err.message || String(err));
    }
  });

  onSnapshot(clientsRef, (snap)=>{
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    rows.sort((a,b)=> (a.prezime||'').localeCompare(b.prezime||''));
    const tbody = $('#tbl-clients tbody');
    tbody.empty();
    rows.forEach(c => tbody.append(renderRow(c)));
  });
}});
