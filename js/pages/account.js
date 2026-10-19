import { db, accountsRef, transactionsRef } from '../firebase-config.js';
import { requireAuth, liveSearch, fmtIznos, initDatepicker } from '../global.js';
import {
  doc, getDoc, query, where, onSnapshot, orderBy, addDoc, runTransaction, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function qs(name){
  return new URLSearchParams(window.location.search).get(name);
}

const accountId = qs('id');
const clientOib = qs('oib');

function parseDatum(str){
  const m = /^([0-3]?\d)\.([01]?\d)\.(\d{4})$/.exec((str||'').trim());
  if(!m) return null;
  const d = new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
  if(isNaN(d.getTime())) return null;
  return d;
}

//Prikaz vrste transakcije
function vrstaLabel(v){
  return v === 'isplata' ? 'Isplata' : 'Uplata';
}

//Render jednog reda tablice transakcija
function renderTxRow(t){
  return `<tr><td>${t.datumStr||''}</td><td>${vrstaLabel(t.vrsta)}</td><td>${fmtIznos(t.iznos)}</td></tr>`;
}

//Dodavanje transakcije
async function addTransaction(account, input){
  const dt = parseDatum(input.datumStr);
  if(!dt) throw new Error('Datum nije ispravan (dd.mm.gggg).');
  const iznos = Number(input.iznos);
  if(!(iznos > 0)) throw new Error('Iznos mora biti veći od 0.');
  const vrsta = input.vrsta;

  //Pokreće Firestore transakciju
  await runTransaction(db, async (tx) => {
    const accRef = doc(db,'accounts',accountId);
    const accSnap = await tx.get(accRef);
    if(!accSnap.exists()) throw new Error('Račun ne postoji.');
    const acc = accSnap.data();
    const stanje = Number(acc.stanje || 0);

    //racunjanje novog stanja
    const delta = (vrsta === 'isplata') ? -iznos : iznos;
    const novo = stanje + delta;

    const type = acc.type || 'tekuci';
    const limit = (acc.limit !== undefined && acc.limit !== null)
      ? Number(acc.limit)
      : (type === 'tekuci' ? -1000 : 0);
    if (novo < limit) {
      throw new Error(type === 'tekuci'
        ? 'Prekoračen dozvoljeni minus (-1000 €).'
        : 'Žiro račun ne smije ići u minus.');
    }

    tx.update(accRef, { stanje: novo });
    const newTxRef = doc(transactionsRef);
    tx.set(newTxRef, {
      datum: Timestamp.fromDate(dt),
      datumStr: input.datumStr,
      vrsta,
      brojRacuna: account.brojRacuna,
      clientOib: account.clientOib,
      accountId,
      iznos
    });
  });
}

//samo admin smije na ovu stranicu
//kad je provjera gotova, pokreni onReady
requireAuth({ allowRoles:['admin'], onReady: async ()=>{
  if(!accountId){
    alert('Nedostaje id računa.');
    window.location.href = 'clients.html';
    return;
  }

  //Aktiviranje searcha i datepickera
  liveSearch('#search', '#tbl-tx');
  initDatepicker('#t_datum');

  //Link “Nazad”
  $('#back-link').attr('href', clientOib ? `client.html?oib=${encodeURIComponent(clientOib)}` : 'clients.html');

  //Dohvat računa jednokratno
  const aSnap = await getDoc(doc(db,'accounts',accountId));
  if(!aSnap.exists()){
    alert('Račun ne postoji.');
    window.location.href = 'clients.html';
    return;
  }
  //Sada ima podatke računa
  const account = aSnap.data();

  //Popunjavanje UI-a (naslov, podaci)
  $('#acc-title').text(account.brojRacuna || 'Račun');
  $('#acc-sub').text(`Klijent OIB: ${account.clientOib || ''}`);
  $('#acc-info').html(`
    <div class="row">
      <div class="col-md-4"><div class="text-muted small">Tip</div><div>${account.type === 'ziro' ? 'Žiro račun' : 'Tekući račun'}</div></div>
      <div class="col-md-4"><div class="text-muted small">Stanje</div><div id="stanje">${fmtIznos(account.stanje)}</div></div>
      <div class="col-md-4"><div class="text-muted small">OIB</div><div>${account.clientOib || ''}</div></div>
    </div>
  `);

  // live stanje
  //Sluša promjene na računu u Firestoreu
  //Kad se stanje promijeni (uplata/isplata) automatski osvježi prikaz
  onSnapshot(doc(db,'accounts',accountId), (s)=>{
    if(s.exists()) $('#stanje').text(fmtIznos(s.data().stanje));
  });

  //Dohvat transakcija (realtime)
  const qTx = query(transactionsRef, where('accountId','==',accountId), orderBy('datum','desc'));
  onSnapshot(qTx, (snap)=>{
    const rows = [];
    snap.forEach(d=> rows.push(d.data()));
    const tbody = $('#tbl-tx tbody');
    tbody.empty();
    rows.forEach(t=> tbody.append(renderTxRow(t)));
  });
  //Realtime: čim se doda transakcija, tablica se osvježi
  //napuni tbody redovima

  //Submit forma iz modala (Nova transakcija)
  $('#form-tx').on('submit', async (e)=>{
    e.preventDefault();
    $('#tx-error').addClass('d-none').text('');
    try{
      await addTransaction(account, {
        datumStr: $('#t_datum').val().trim(),
        vrsta: $('#t_vrsta').val(),
        iznos: $('#t_iznos').val()
      });
      $('#modal-tx').modal('hide');
      $('#t_iznos').val('');
    }catch(err){
      $('#tx-error').removeClass('d-none').text(err.message || String(err));
    }
  });
}});
