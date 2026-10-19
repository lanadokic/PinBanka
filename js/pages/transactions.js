import { db, clientsRef, accountsRef, transactionsRef } from '../firebase-config.js';
import { requireAuth, liveSearch, fmtIznos, initDatepicker } from '../global.js';
import {
  doc, getDoc, getDocs, query, where, orderBy, limit, onSnapshot, runTransaction, Timestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

//Parsiranje datuma
function parseDatum(str){
  const m = /^([0-3]?[0-9])\.([01]?[0-9])\.([0-9]{4})$/.exec((str||'').trim());
  if(!m) return null;
  const d = new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
  if(isNaN(d.getTime())) return null;
  return d;
}

//abel za vrstu
function vrstaLabel(v){
  return v === 'isplata' ? 'Isplata' : 'Uplata';
}

//Učitavanje klijenata u dropdown
async function loadClientsIntoSelect(){
  const snap = await getDocs(clientsRef);
  const arr = [];
  snap.forEach(d=> arr.push(d.data()));
  arr.sort((a,b)=> (`${a.prezime||''} ${a.ime||''}`).localeCompare(`${b.prezime||''} ${b.ime||''}`));

  const sel = $('#sel-client');
  arr.forEach(c=> sel.append(`<option value="${c.oib}">${c.ime} ${c.prezime}</option>`));
}

//Učitavanje računa za odabranog klijenta
async function loadAccountsForClient(oib){
  const sel = $('#sel-account');
  sel.empty().append('<option value="">Odaberi račun...</option>');
  if(!oib){ sel.prop('disabled', true); return; }

  const qAcc = query(accountsRef, where('clientOib','==',oib));
  const snap = await getDocs(qAcc);
  const arr = [];
  snap.forEach(d=> arr.push({ id:d.id, ...d.data() }));
  arr.sort((a,b)=> (a.brojRacuna||'').localeCompare(b.brojRacuna||''));
  arr.forEach(a=> sel.append(`<option value="${a.id}">${a.brojRacuna}</option>`));
  sel.prop('disabled', false);
}

//Dodavanje transakcije (admin)
async function addTx(){
  const clientOib = $('#sel-client').val();
  const accountId = $('#sel-account').val();
  const datumStr = $('#t_datum').val().trim();
  const vrsta = $('#t_vrsta').val();
  const iznos = Number($('#t_iznos').val());

  if(!clientOib) throw new Error('Odaberi klijenta.');
  if(!accountId) throw new Error('Odaberi račun.');
  const dt = parseDatum(datumStr);
  if(!dt) throw new Error('Datum nije ispravan (dd.mm.gggg).');
  if(!(iznos > 0)) throw new Error('Iznos mora biti veći od 0.');

  const accRef = doc(db,'accounts',accountId);

  //Firestore transakcija
await runTransaction(db, async (tx) => {
  const accSnap = await tx.get(accRef);
  if (!accSnap.exists()) throw new Error('Račun ne postoji.');

  const acc = accSnap.data();

  const stanje = Number(acc.stanje || 0);
  const delta = (vrsta === 'isplata') ? -iznos : iznos;
  const novo = stanje + delta;

  const type = acc.type || 'tekuci';
  const limit = (acc.limit !== undefined && acc.limit !== null)
    ? Number(acc.limit)
    : (type === 'tekuci' ? -1000 : 0);

  if (novo < limit) {
    throw new Error(
      type === 'tekuci'
        ? 'Prekoračen dozvoljeni minus (-1000 €).'
        : 'Žiro račun ne smije ići u minus.'
    );
  }

  //Update stanja + upis transakcije
  tx.update(accRef, { stanje: novo });

  const newTxRef = doc(transactionsRef);
  tx.set(newTxRef, {
    datum: Timestamp.fromDate(dt),
    datumStr,
    vrsta,
    brojRacuna: acc.brojRacuna,
    clientOib: acc.clientOib,
    accountId,
    iznos
  });
});
}

//Start stranice (admin-only)
requireAuth({ allowRoles:['admin'], onReady: async ()=>{
  liveSearch('#search', '#tbl-tx');
  initDatepicker('#t_datum');

  await loadClientsIntoSelect();

  //kad admin promijeni klijenta → učitaj njegove račune
  $('#sel-client').on('change', async ()=>{
    await loadAccountsForClient($('#sel-client').val());
  });

  //Submit forme za novu transakciju
  $('#form-new').on('submit', async (e)=>{
    e.preventDefault();
    $('#tx-error').addClass('d-none').text('');
    try{
      await addTx();
      $('#t_iznos').val('');
      alert('Transakcija je dodana.');
    }catch(err){
      $('#tx-error').removeClass('d-none').text(err.message || String(err));
    }
  });

  //Zadnjih 50 transakcija 
  //upit: sve transakcije, sortirane po datumu, max 50
  const qTx = query(transactionsRef, orderBy('datum','desc'), limit(50));
  //realtime listener: osvježava tablicu čim se nešto promijeni
  onSnapshot(qTx, async (snap)=>{
    const rows = [];
    snap.forEach(d=> rows.push(d.data()));

    // cache klijenti za prikaz imena
    const clientCache = new Map();
    async function getClientName(oib){
      if(!oib) return '';
      if(clientCache.has(oib)) return clientCache.get(oib);
      const cSnap = await getDoc(doc(db,'clients',oib));
      const name = cSnap.exists() ? `${cSnap.data().ime||''} ${cSnap.data().prezime||''}`.trim() : oib;
      clientCache.set(oib, name);
      return name;
    }

    //Render tablice
    const tbody = $('#tbl-tx tbody');
    tbody.empty();
    for(const t of rows){
      const name = await getClientName(t.clientOib);
      tbody.append(`<tr><td>${t.datumStr||''}</td><td>${name}</td><td>${t.brojRacuna||''}</td><td>${vrstaLabel(t.vrsta)}</td><td>${fmtIznos(t.iznos)}</td></tr>`);
    
      //za svaku transakciju:
      //dohvati ime klijenta (cache)
      //dodaj <tr> u tablicu
    }
  });
}});
