import { db, accountsRef, transactionsRef } from '../firebase-config.js';
import { requireAuth, liveSearch, fmtIznos } from '../global.js';
import { query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let unsubTx = null;

function typeLabel(v){
  return v === 'ziro' ? 'Žiro račun' : 'Tekući račun';
}

function vrstaLabel(v){
  return v === 'isplata' ? 'Isplata' : 'Uplata';
}

function openTxModal(account){
  $('#my-tx-title').text(`Transakcije - ${account.brojRacuna}`);
  $('#tbl-my-tx tbody').empty();
  $('#modal-my-tx').modal('show');

  if(unsubTx) unsubTx();
  const qTx = query(transactionsRef, where('accountId','==',account.id), orderBy('datum','desc'));
  unsubTx = onSnapshot(qTx, (snap)=>{
    const tbody = $('#tbl-my-tx tbody');
    tbody.empty();
    snap.forEach(d=>{
      const t = d.data();
      tbody.append(`<tr><td>${t.datumStr||''}</td><td>${vrstaLabel(t.vrsta)}</td><td>${fmtIznos(t.iznos)}</td></tr>`);
    });
  });

  liveSearch('#search2', '#tbl-my-tx');
}

requireAuth({ allowRoles:['user'], onReady: ({profile})=>{
  const oib = profile?.oib;
  if(!oib){
    alert('Tvoj korisnički račun nema povezan OIB (users/{uid}.oib). Obrati se administratoru.');
    return;
  }

  liveSearch('#search', '#tbl-my');

  const qAcc = query(accountsRef, where('clientOib','==',oib));
  onSnapshot(qAcc, (snap)=>{
    const arr = [];
    snap.forEach(d=> arr.push({id:d.id, ...d.data()}));
    arr.sort((a,b)=> (a.brojRacuna||'').localeCompare(b.brojRacuna||''));
    const tbody = $('#tbl-my tbody');
    tbody.empty();
    arr.forEach(a=>{
      const tr = $(`<tr><td>${a.brojRacuna||''}</td><td>${typeLabel(a.type)}</td><td>${fmtIznos(a.stanje)}</td></tr>`);
      tr.on('click', ()=> openTxModal(a));
      tbody.append(tr);
    });
  });

  $('#modal-my-tx').on('hidden.bs.modal', ()=>{
    if(unsubTx) { unsubTx(); unsubTx = null; }
  });
}});
