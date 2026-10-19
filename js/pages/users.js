import { db, usersRef, clientsRef } from '../firebase-config.js';
import { requireAuth, liveSearch } from '../global.js';
import {
  doc, onSnapshot, getDocs, setDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let clientsList = [];

async function loadClients(){
  const snap = await getDocs(clientsRef);
  clientsList = [];
  snap.forEach(d=> clientsList.push(d.data()));
  clientsList.sort((a,b)=> (`${a.prezime||''} ${a.ime||''}`).localeCompare(`${b.prezime||''} ${b.ime||''}`));

  const sel = $('#u_oib');
  sel.empty().append('<option value="">(nije vezan)</option>');
  clientsList.forEach(c=> sel.append(`<option value="${c.oib}">${c.ime} ${c.prezime}</option>`));
}

function renderRow(u){
  const tr = $(
    `<tr>
      <td class="text-monospace">${u.uid}</td>
      <td>${u.email||''}</td>
      <td><span class="badge badge-soft">${u.role||'user'}</span></td>
      <td>${u.oib||''}</td>
      <td class="text-right"><button class="btn btn-sm btn-outline-primary btn-edit"><i class="fas fa-edit"></i></button></td>
    </tr>`
  );

  tr.find('.btn-edit').on('click', ()=>{
    $('#user-error').addClass('d-none').text('');
    $('#u_uid').val(u.uid);
    $('#u_role').val(u.role||'user');
    $('#u_oib').val(u.oib||'');
    $('#modal-user').modal('show');
  });

  return tr;
}

requireAuth({ allowRoles:['admin'], onReady: async ()=>{
  liveSearch('#search', '#tbl-users');
  await loadClients();

  onSnapshot(usersRef, (snap)=>{
    const rows = [];
    snap.forEach(d=> rows.push({ uid:d.id, ...d.data() }));
    rows.sort((a,b)=> (a.uid||'').localeCompare(b.uid||''));
    const tbody = $('#tbl-users tbody');
    tbody.empty();
    rows.forEach(u=> tbody.append(renderRow(u)));
  });

  $('#form-user').on('submit', async (e)=>{
    e.preventDefault();
    $('#user-error').addClass('d-none').text('');
    try{
      const uid = $('#u_uid').val();
      const role = $('#u_role').val();
      const oib = $('#u_oib').val();
      await setDoc(doc(db,'users',uid), { role, oib }, { merge:true });
      $('#modal-user').modal('hide');
    }catch(err){
      $('#user-error').removeClass('d-none').text(err.message || String(err));
    }
  });
}});
