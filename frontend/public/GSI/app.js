/*
 * GSI discovery frontend proof of concept.
 * DATA NOTE: Every record below is a fictional fixture for UX evaluation.
 * No API, DID, score engine, external search, or durable storage is connected.
 */
const FIXTURES = [
  { id:'DEMO-ART-001',type:'article',title:'Community-led water systems and resilience in rural settlements',description:'A sample research abstract exploring locally governed drinking-water systems, maintenance practices and long-term resilience.',people:'Amara Dube · Paul Mensa',organization:'Community Health Research Quarterly',year:2026,topic:'Water · Public health',source:'native',location:'Southern Africa',note:'Illustrative native onboarding record. No actual DID signature or archival transaction exists.' },
  { id:'DEMO-ART-002',type:'article',title:'Smallholder agriculture under changing rainfall patterns',description:'A fictional study comparing adaptation strategies, crop choices and household-level climate responses across agricultural communities.',people:'Nneka Obi · Samuel Adeyemi',organization:'Journal of Agricultural Futures',year:2025,topic:'Agriculture · Climate',source:'openalex',location:'West Africa',note:'Illustrative external import. In the MVP, unsigned externally sourced records would be labeled as such.' },
  { id:'DEMO-JRN-001',type:'journal',title:'Community Health Research Quarterly',description:'A sample open-access journal profile highlighting community health, primary care and equitable access to public services.',people:'Editorial team (sample)',organization:'Public health',year:2025,topic:'Public health · Society',source:'native',location:'Africa',note:'Fictional journal profile. Not a verified journal; no ISSN, editorial KYB or journal rating has been issued.' },
  { id:'DEMO-RES-001',type:'researcher',title:'Amara Dube',description:'A demonstration researcher profile featuring community-centered health research and collaborative water systems.',people:'Researcher profile (sample)',organization:'Public health and water',year:2026,topic:'Water · Public health',source:'native',location:'Southern Africa',note:'Fictional researcher. No real DID has been created; affiliation and publication claims are illustrative.' },
  { id:'DEMO-JRN-002',type:'journal',title:'Journal of Agricultural Futures',description:'A fictional journal directory entry focused on food systems, rural livelihoods, agricultural methods and climate responses.',people:'Editorial team (sample)',organization:'Agriculture and climate',year:2024,topic:'Agriculture · Climate',source:'openalex',location:'West Africa',note:'Illustrative externally sourced journal entry; GSI has not ingested or indexed a real matching journal.' },
  { id:'DEMO-ART-003',type:'article',title:'Urban heat and informal settlement design in coastal cities',description:'A made-up article abstract discussing neighborhood cooling, equitable urban planning and community-informed climate resilience.',people:'Lebo Ndlovu · Kofi Mensimah',organization:'African Systems and Policy Review',year:2024,topic:'Climate · Cities',source:'openalex',location:'Coastal Africa',note:'Illustrative external metadata. The prototype has not called OpenAlex, and citation counts are intentionally omitted.' },
  { id:'DEMO-RES-002',type:'researcher',title:'Nneka Obi',description:'A fictional researcher working on climate adaptation, sustainable farming and accessible knowledge sharing.',people:'Researcher profile (sample)',organization:'Agriculture and climate',year:2025,topic:'Agriculture · Climate',source:'openalex',location:'West Africa',note:'Fictional externally sourced researcher record; no verified identity or GSI score exists.' },
  { id:'DEMO-ART-004',type:'article',title:'Participatory education policy in multilingual classrooms',description:'A sample paper summary on local language instruction, learner inclusion and education policy implementation.',people:'Idris Bello · Asha Moyo',organization:'African Systems and Policy Review',year:2023,topic:'Education · Policy',source:'native',location:'East Africa',note:'Fictional demonstration. A real GSI article page should expose source attribution and eventually citation_* tags server-side.' }
];

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const types = {all:'All records',article:'Articles',journal:'Journals',researcher:'Researchers'};
const state = {q:'',type:'all',sources:new Set(['native','openalex']),sort:'relevance'};
let lastFocus = null;
const recordIcon = {article:'↗',journal:'▤',researcher:'◎'};
const recordLabel = {article:'Article',journal:'Journal',researcher:'Researcher'};

function getMatches({ignoreType=false}={}){
  const term=state.q.trim().toLocaleLowerCase();
  return FIXTURES.filter(r => (ignoreType||state.type==='all'||r.type===state.type) && state.sources.has(r.source) && (!term || [r.title,r.description,r.people,r.organization,r.topic,r.location,r.year].join(' ').toLocaleLowerCase().includes(term)));
}
function updateUrl(){
  try{
    const url=new URL(window.location.href);
    ['q','type','sort','source'].forEach(k=>url.searchParams.delete(k));
    if(state.q) url.searchParams.set('q',state.q);
    if(state.type!=='all') url.searchParams.set('type',state.type);
    if(state.sort!=='relevance') url.searchParams.set('sort',state.sort);
    if(state.sources.size!==2) url.searchParams.set('source',[...state.sources].sort().join(','));
    window.history.replaceState({},'',url);
  }catch(_e){/* File previews or privacy modes may disallow history manipulation. */}
}
function render(){
  const preType=getMatches({ignoreType:true});
  for(const type of Object.keys(types)) $('#count-'+type).textContent=type==='all'?preType.length:preType.filter(r=>r.type===type).length;
  const matches=getMatches();
  if(state.sort==='newest') matches.sort((a,b)=>b.year-a.year||a.title.localeCompare(b.title));
  if(state.sort==='az') matches.sort((a,b)=>a.title.localeCompare(b.title));
  $('#results-count').textContent=`${matches.length} ${matches.length===1?'result':'results'}`;
  $('#results-context').textContent=state.q?`Matching “${state.q}”`:'Browse the sample catalog';
  $('#result-list').innerHTML=matches.map(r=>`<article class="result-card" data-record="${r.id}">
    <div class="record-icon ${r.type}" aria-hidden="true">${recordIcon[r.type]}</div>
    <div class="record-body">
      <div class="record-tags"><span class="record-type ${r.type}">${recordLabel[r.type]}</span><span class="record-tag">${r.source==='native'?'Native onboarding · Demo':'External source · Demo'}</span></div>
      <h3 style="margin:0"><button class="record-title" type="button" data-open="${r.id}">${escapeHtml(r.title)}</button></h3>
      <p class="record-summary">${escapeHtml(r.description)}</p>
      <div class="record-meta"><span>${escapeHtml(r.people)}</span><span>${r.year}</span><span>${escapeHtml(r.topic)}</span></div>
    </div><button class="record-open" type="button" aria-label="View details for ${escapeHtml(r.title)}" data-open="${r.id}">↗</button>
  </article>`).join('');
  $('#empty-state').hidden=matches.length>0;
  updateUrl();
}
function syncInputs(){
  $('#search-input').value=state.q;
  for(const node of document.querySelectorAll('input[name=type]'))node.checked=node.value===state.type;
  for(const node of document.querySelectorAll('input[name=source]'))node.checked=state.sources.has(node.value);
  $('#sort-select').value=state.sort;
}
function reset(){state.q='';state.type='all';state.sort='relevance';state.sources=new Set(['native','openalex']);syncInputs();render()}
function loadFromUrl(){
  const url=new URL(window.location.href);const p=url.searchParams;
  state.q=(p.get('q')||'').slice(0,150);
  state.type=types[p.get('type')]?p.get('type'):'all';
  state.sort=['relevance','newest','az'].includes(p.get('sort'))?p.get('sort'):'relevance';
  if(p.has('source')) state.sources=new Set((p.get('source')||'').split(',').filter(s=>['native','openalex'].includes(s)));
  syncInputs();render();
}
function openRecord(id){
  const r=FIXTURES.find(x=>x.id===id);if(!r)return;
  lastFocus=document.activeElement;
  $('#detail-content').innerHTML=`<div class="detail-subhead">${recordLabel[r.type]} · ${r.source==='native'?'Native onboarding':'External source'} · Illustration</div>
    <h2 id="detail-title">${escapeHtml(r.title)}</h2>
    <p class="detail-description">${escapeHtml(r.description)}</p>
    <dl class="detail-info">
      <dt>Sample record</dt><dd>${escapeHtml(r.id)}</dd>
      <dt>Attribution</dt><dd>${escapeHtml(r.people)}</dd>
      <dt>Context</dt><dd>${escapeHtml(r.organization)}</dd>
      <dt>Year</dt><dd>${r.year}</dd>
      <dt>Topic</dt><dd>${escapeHtml(r.topic)}</dd>
      <dt>Geographic focus</dt><dd>${escapeHtml(r.location)}</dd>
      <dt>Source origin</dt><dd>${r.source==='native'?'Native onboarding (simulated)':'External bootstrap (simulated)'}</dd>
      <dt>GSI Score</dt><dd>Not calculated · MVP score engine pending</dd>
      <dt>DID / CID</dt><dd>Not issued · backend integration pending</dd>
    </dl>
    <p class="detail-warning"><strong>Prototype provenance note</strong><br/>${escapeHtml(r.note)} No publication, person, identifier or score shown here should be presented as a verified GSI record.</p>
    <div class="detail-actions"><button class="detail-action" id="detail-done" type="button">Back to results</button><button class="detail-copy" id="detail-copy" type="button">Copy sample ID</button></div>`;
  $('#detail-overlay').hidden=false;document.body.style.overflow='hidden';$('.detail-drawer').focus();
  $('#detail-done').addEventListener('click',closeRecord);
  $('#detail-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(r.id);toast('Sample record ID copied')}catch(e){toast(`Sample ID: ${r.id}`)}});
}
function closeRecord(){
  $('#detail-overlay').hidden=true;document.body.style.overflow='';
  if(lastFocus?.isConnected)lastFocus.focus();
}
let toastTimeout;
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.hidden=true,2600)}

$('#search-form').addEventListener('submit',e=>{e.preventDefault();state.q=$('#search-input').value.trim().slice(0,150);render();});
for(const b of document.querySelectorAll('.query-example'))b.addEventListener('click',()=>{state.q=b.dataset.query;syncInputs();render()});
for(const radio of document.querySelectorAll('input[name=type]'))radio.addEventListener('change',e=>{state.type=e.target.value;render()});
for(const checkbox of document.querySelectorAll('input[name=source]'))checkbox.addEventListener('change',e=>{if(e.target.checked)state.sources.add(e.target.value);else state.sources.delete(e.target.value);render()});
$('#sort-select').addEventListener('change',e=>{state.sort=e.target.value;render()});
$('#clear-all').addEventListener('click',reset);
$('#empty-reset').addEventListener('click',reset);
$('#result-list').addEventListener('click',e=>{const btn=e.target.closest('[data-open]');if(btn)openRecord(btn.dataset.open)});
$('#detail-close').addEventListener('click',closeRecord);
$('#detail-overlay').addEventListener('click',e=>{if(e.target.dataset.close)closeRecord()});
document.addEventListener('keydown',e=>{
  if($('#detail-overlay').hidden)return;
  if(e.key==='Escape'){closeRecord();return}
  if(e.key==='Tab'){
    const focusables=[...$('.detail-drawer').querySelectorAll('button,a[href],input,select,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled);
    if(!focusables.length)return;
    const first=focusables[0],last=focusables.at(-1);
    if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault()}
    else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault()}
    else if(document.activeElement===$('.detail-drawer')){first.focus();e.preventDefault()}
  }
});
window.addEventListener('popstate',loadFromUrl);
loadFromUrl();
