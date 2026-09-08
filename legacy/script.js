const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={risk:'medium'};
const templates={
 incident:{name:'Production incident triage',runs:45,minutes:55,people:2,hourly:95,automation:72,repeat:80,tools:85,observe:78,risk:'medium',review:true},
 onboarding:{name:'Enterprise client onboarding',runs:12,minutes:180,people:3,hourly:88,automation:58,repeat:70,tools:62,observe:68,risk:'high',review:true},
 recon:{name:'Daily data reconciliation',runs:90,minutes:35,people:1,hourly:72,automation:86,repeat:94,tools:92,observe:90,risk:'medium',review:true},
 sales:{name:'Inbound lead qualification',runs:160,minutes:18,people:1,hourly:62,automation:78,repeat:82,tools:76,observe:73,risk:'low',review:false}
};
function num(id){return Number($('#'+id).value||0)}
function money(v){return '$'+Math.round(v).toLocaleString()}
function update(){
 const runs=num('runs'),mins=num('minutes'),people=num('people'),hourly=num('hourly'),automation=num('automation'),repeat=num('repeat'),tools=num('tools'),observe=num('observe');
 const review=$('#humanReview').checked;
 $('#automationOut').textContent=automation+'%';$('#repeatOut').textContent=repeat+'%';$('#toolsOut').textContent=tools+'%';$('#observeOut').textContent=observe+'%';
 const riskPenalty={low:0,medium:15,high:32}[state.risk];
 const baseline=runs*52*mins/60*people;
 const saved=baseline*(automation/100)*(.7+.3*(observe/100));
 const value=saved*hourly;
 const economic=Math.max(0,Math.min(100,35+Math.log10(Math.max(10,value))*13));
 const riskFit=Math.max(5,100-riskPenalty+(review?8:0));
 const fit=Math.round(repeat*.22+tools*.2+observe*.16+riskFit*.18+economic*.24);
 const mode=fit>=82&&state.risk==='low'&&!review?'Autonomous agent':fit>=68?(review?'Human-approved agent':'Copilot → agent'):fit>=52?'Copilot first':'Workflow redesign first';
 const title=fit>=82&&state.risk==='low'&&!review?'Build a bounded autonomous agent':fit>=68?(review?'Build a human-approved agent':'Start with a copilot, then earn autonomy'):fit>=52?'Start as an assistive copilot':'Fix the workflow before adding an agent';
 const text=fit>=68?'High-value, repeatable workflow with enough system access to create leverage. Start with measurable recommendations, then graduate autonomy only after reliability is proven.':fit>=52?'There is useful automation potential, but one or more constraints make full agency premature. Instrument the workflow and begin with read-only assistance.':'The current workflow is too ambiguous, inaccessible, or risky for an agent to be the first solution. Standardize the process and improve instrumentation first.';
 $('#fitScore').textContent=fit;$('#heroScore').textContent=fit;$('#decisionTitle').textContent=title;$('#decisionText').textContent=text;
 $('#hoursSaved').textContent=Math.round(saved).toLocaleString();$('#heroHours').textContent=Math.round(saved).toLocaleString()+' h/yr';$('#hoursNote').textContent='from '+Math.round(baseline).toLocaleString()+' baseline hours';
 $('#annualValue').textContent=money(value);$('#heroValue').textContent=money(value)+'/yr';$('#minutesSaved').textContent=Math.round(mins*automation/100)+' min';$('#heroMode').textContent=mode;
 const autonomy=state.risk==='high'||review?2:(fit>82?3:fit>65?2:1);$('#autonomyLabel').textContent='Level '+autonomy;$('#autonomyNote').textContent=autonomy===3?'bounded actions with rollback':autonomy===2?'recommend + approve actions':'read-only assistance';
 const dims=[['dRepeat',repeat],['dTools',tools],['dObserve',observe],['dRisk',riskFit],['dValue',Math.round(economic)]];dims.forEach(([id,v])=>{$('#'+id).style.width=v+'%';$('#'+id+'Num').textContent=Math.round(v)});
 $('#riskChip').textContent=state.risk.toUpperCase()+' RISK';$('#archTitle').textContent=review?'Human-approved action agent':(state.risk==='low'?'Bounded autonomous agent':'Recommendation-first agent');
 $('#approvalNode').style.opacity=review?'1':'.28';$('#wire5').style.opacity=review?'1':'.35';$('#control2').textContent=review?'Human approval':'Confidence gate';$('#control2Text').textContent=review?'Require review before consequential writes until reliability clears a defined threshold.':'Allow action only when confidence, policy, and tool constraints all pass; otherwise escalate.';
 $('#briefTitle').textContent=$('#workflowName').value||'Workflow';$('#briefOpportunity').textContent=`Return ~${Math.round(saved).toLocaleString()} hours/year by automating repeatable work worth roughly ${money(value)} in annual capacity.`;$('#briefThesis').textContent=`A ${mode.toLowerCase()} can assemble live context, reason over policy, and use bounded tools to reduce manual effort while preserving control.`;$('#briefLaunch').textContent=review?'Read-only copilot → human-approved action agent.':'Read-only copilot → bounded autonomous actions.';
 $('#triggerText').textContent=($('#workflowName').value||'workflow').toLowerCase().slice(0,30);$('#actStageText').textContent=review?'Execute approved actions through typed tools, with full traceability and rollback.':'Execute bounded low-risk actions automatically; escalate anything outside policy or confidence thresholds.';
}
function setTemplate(key){const t=templates[key];if(!t)return;Object.entries(t).forEach(([k,v])=>{if(k==='risk'){state.risk=v;$$('#riskSeg button').forEach(b=>b.classList.toggle('active',b.dataset.risk===v));}else if(k==='review')$('#humanReview').checked=v;else if(k==='name') $('#workflowName').value=v; else $('#'+k).value=v;});update()}
$$('input').forEach(el=>el.addEventListener('input',update));$('#workflowName').addEventListener('input',update);$('#templateSelect').addEventListener('change',e=>setTemplate(e.target.value));$$('#riskSeg button').forEach(b=>b.addEventListener('click',()=>{state.risk=b.dataset.risk;$$('#riskSeg button').forEach(x=>x.classList.toggle('active',x===b));update()}));
$('#demoBtn').addEventListener('click',()=>{$('#templateSelect').value='recon';setTemplate('recon');location.hash='#assess'});
document.addEventListener('mousemove',e=>{const g=$('.cursor-glow');g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'});$$('.spotlight-card').forEach(c=>c.addEventListener('mousemove',e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')}));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible')}),{threshold:.12});$$('.reveal').forEach(x=>io.observe(x));
function snapshot(){return {name:$('#workflowName').value,runs:num('runs'),minutes:num('minutes'),people:num('people'),hourly:num('hourly'),automation:num('automation'),repeat:num('repeat'),tools:num('tools'),observe:num('observe'),risk:state.risk,review:$('#humanReview').checked,ts:Date.now()}}
function loadSnapshot(s){Object.entries(s).forEach(([k,v])=>{if(['ts'].includes(k))return;if(k==='risk'){state.risk=v;$$('#riskSeg button').forEach(b=>b.classList.toggle('active',b.dataset.risk===v));}else if(k==='review')$('#humanReview').checked=v;else if(k==='name') $('#workflowName').value=v; else if($('#'+k))$('#'+k).value=v});update();$('#savedDialog').close();location.hash='#assess'}
function renderSaved(){const arr=JSON.parse(localStorage.getItem('agentfit-scenarios')||'[]');$('#savedList').innerHTML=arr.length?arr.map((s,i)=>`<div class="saved-item"><span><b>${s.name}</b><small style="display:block;color:#667b89;margin-top:3px">${new Date(s.ts).toLocaleDateString()}</small></span><button data-load="${i}">Load</button></div>`).join(''):'<p style="color:#6f8391">No saved scenarios yet.</p>';$$('[data-load]').forEach(b=>b.onclick=()=>loadSnapshot(arr[+b.dataset.load]))}
$('#saveBtn').addEventListener('click',()=>{const arr=JSON.parse(localStorage.getItem('agentfit-scenarios')||'[]');arr.unshift(snapshot());localStorage.setItem('agentfit-scenarios',JSON.stringify(arr.slice(0,8)));renderSaved();$('#savedDialog').showModal()});$('#closeDialog').onclick=()=>$('#savedDialog').close();
$('#exportBtn').addEventListener('click',()=>{const s=snapshot();const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='agentfit-'+(s.name||'workflow').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';a.click();URL.revokeObjectURL(a.href)});
update();
