// ---------- CONFIG (ضع هنا معلومات Supabase لاحقًا) --------------
const SUPABASE_URL = "REPLACE_WITH_SUPABASE_URL";
const SUPABASE_KEY = "REPLACE_WITH_SUPABASE_ANON_KEY";
// -------------------------------------------------------------------

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');

const quoteTableBody = document.querySelector('#quoteTable tbody');
const addLineBtn = document.getElementById('addLine');
const totalsDiv = document.getElementById('totals');

let quoteLines = [];

function renderResults(rows){
  resultsDiv.innerHTML = '';
  if(!rows || rows.length===0){ resultsDiv.innerHTML = '<div class="card">No results</div>'; return; }
  rows.forEach(r=>{
    const el = document.createElement('div');
    el.className='card';
    el.innerHTML = `
      <div><strong>${r.code || ''} — ${r.name}</strong></div>
      <div>Manufacturer: ${r.manufacturer || '-'}</div>
      <div>Price: ${r.base_price || '-'} ${r.unit||''}</div>
      ${r.datasheet_url? `<div><a href="${r.datasheet_url}" target="_blank">Open datasheet</a></div>` : ''}
      <div style="margin-top:6px"><button data-id="${r.id}" class="addToQuote">Add to quotation</button></div>
    `;
    resultsDiv.appendChild(el);
  });
  resultsDiv.querySelectorAll('.addToQuote').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const id = e.target.dataset.id;
      const model = rows.find(x=>String(x.id)===String(id));
      addQuoteLineFromModel(model);
    });
  });
}

async function supabaseGet(table, q=''){
  const url = `${SUPABASE_URL}/rest/v1/${table}${q}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json'
    }
  });
  return res.json();
}

searchBtn.addEventListener('click', async ()=>{
  const q = searchInput.value.trim();
  const query = q ? `?or=(code.ilike.*${encodeURIComponent(q)}*,name.ilike.*${encodeURIComponent(q)}*)` : '';
  const data = await supabaseGet('equipment_models', query);
  renderResults(data);
});

function addQuoteLineFromModel(model){
  const line = {
    id: Date.now(),
    description: `${model.code || ''} - ${model.name}`,
    qty: 1,
    unit_price: model.base_price || 0,
    discount: 0,
    tax: 0
  };
  quoteLines.push(line);
  renderQuoteLines();
}

function renderQuoteLines(){
  quoteTableBody.innerHTML = '';
  quoteLines.forEach((l, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="desc" value="${escapeHtml(l.description)}" /></td>
      <td><input class="qty" type="number" value="${l.qty}" style="width:80px" /></td>
      <td><input class="price" type="number" value="${l.unit_price}" step="0.01" style="width:120px" /></td>
      <td><input class="discount" type="number" value="${l.discount}" step="0.01" style="width:80px" /></td>
      <td><input class="tax" type="number" value="${l.tax}" step="0.01" style="width:80px" /></td>
      <td class="lineTotal">0</td>
      <td><button class="remove">Remove</button></td>
    `;
    quoteTableBody.appendChild(tr);

    tr.querySelector('.qty').addEventListener('input', ()=>{ l.qty = Number(tr.querySelector('.qty').value || 0); updateTotals(); });
    tr.querySelector('.price').addEventListener('input', ()=>{ l.unit_price = Number(tr.querySelector('.price').value || 0); updateTotals(); });
    tr.querySelector('.discount').addEventListener('input', ()=>{ l.discount = Number(tr.querySelector('.discount').value || 0); updateTotals(); });
    tr.querySelector('.tax').addEventListener('input', ()=>{ l.tax = Number(tr.querySelector('.tax').value || 0); updateTotals(); });
    tr.querySelector('.remove').addEventListener('click', ()=>{ quoteLines = quoteLines.filter(x=>x.id!==l.id); renderQuoteLines(); });
  });
  updateTotals();
}

function updateTotals(){
  let subtotal = 0, totalTax = 0, totalDiscount = 0;
  quoteLines.forEach(l=>{
    const lineBase = l.qty * l.unit_price;
    const discountValue = lineBase * (l.discount/100);
    const afterDiscount = lineBase - discountValue;
    const taxValue = afterDiscount * (l.tax/100);
    const lineTotal = Math.round((afterDiscount + taxValue) * 100) / 100;
    subtotal += lineBase;
    totalDiscount += discountValue;
    totalTax += taxValue;
  });
  const grand = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;
  totalsDiv.textContent = `Subtotal: ${subtotal.toFixed(2)} | Discount: ${totalDiscount.toFixed(2)} | Tax: ${totalTax.toFixed(2)} | Grand Total: ${grand.toFixed(2)}`;
  // update table totals
  document.querySelectorAll('#quoteTable tbody tr').forEach((tr,i)=>{
    const l = quoteLines[i];
    const lineBase = l.qty * l.unit_price;
    const discountValue = lineBase * (l.discount/100);
    const afterDiscount = lineBase - discountValue;
    const taxValue = afterDiscount * (l.tax/100);
    const lineTotal = Math.round((afterDiscount + taxValue) * 100) / 100;
    tr.querySelector('.lineTotal').textContent = lineTotal.toFixed(2);
  });
}

addLineBtn.addEventListener('click', ()=>{
  quoteLines.push({ id:Date.now(), description:'Custom item', qty:1, unit_price:0, discount:0, tax:0 });
  renderQuoteLines();
});

function escapeHtml(text){ return (text||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// Export as Word (simple HTML -> .doc)
document.getElementById('exportDoc').addEventListener('click', ()=>{
  const client = document.getElementById('clientName').value || 'Client';
  const html = buildQuotationHtml(client);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${client}_quotation.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

function buildQuotationHtml(client){
  let rows = '';
  quoteLines.forEach(l=>{
    const base = (l.qty * l.unit_price).toFixed(2);
    const total = ( (l.qty * l.unit_price) - (l.qty*l.unit_price*(l.discount/100)) + (((l.qty*l.unit_price)-(l.qty*l.unit_price*(l.discount/100)))*(l.tax/100)) ).toFixed(2);
    rows += `<tr><td>${escapeHtml(l.description)}</td><td>${l.qty}</td><td>${l.unit_price}</td><td>${l.discount}%</td><td>${l.tax}%</td><td>${total}</td></tr>`;
  });
  const html = `
  <html><head><meta charset="utf-8"><title>Quotation</title></head>
  <body><h2>Quotation - ${escapeHtml(client)}</h2>
  <table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  return html;
}
