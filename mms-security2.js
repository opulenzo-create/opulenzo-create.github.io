'use strict';

(()=>{
const CORE='https://qpgiqpnkyxbajjyhrsyr.supabase.co/functions/v1/mms';
const KEYLOG='https://qpgiqpnkyxbajjyhrsyr.supabase.co/functions/v1/mms-keylog';
const PREFIX='mms_security2_profile_';
const nativeFetch=window.fetch.bind(window);
let selfId='',mailboxToken='',keylogState='idle',lastError='';

function stable(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
}
async function shaBytes(s){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))}
async function shaHex(s){return [...await shaBytes(s)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function fpJwk(jwk){return shaHex(stable(jwk))}
async function summary(p){return{signFp:await fpJwk(p.signPub),agreeFp:await fpJwk(p.agreePub),bundleSigHash:await shaHex(String(p.bundleSig||''))}}
function load(id){try{return JSON.parse(localStorage.getItem(PREFIX+id)||'null')}catch{return null}}
function save(id,v){localStorage.setItem(PREFIX+id,JSON.stringify(v))}
function requestHeaders(input,init){const h=new Headers(input instanceof Request?input.headers:undefined);new Headers(init?.headers||{}).forEach((v,k)=>h.set(k,v));return h}
function requestUrl(input){return typeof input==='string'?input:(input?.url||'')}
function readBody(init){try{if(typeof init?.body==='string')return JSON.parse(init.body)}catch{}return null}
function captureContext(url,input,init){
  try{
    const h=requestHeaders(input,init),a=h.get('authorization')||'';
    if(a.startsWith('Bearer '))mailboxToken=a.slice(7);
    const m=url.match(/\/api\/inbox\/([^/?#]+)/);if(m)selfId=decodeURIComponent(m[1]);
    const b=readBody(init);if(b){for(const k of ['requesterId','ownerId','callerId','from','id'])if(typeof b[k]==='string'&&/^[A-Za-z0-9_-]{16,80}$/.test(b[k])){selfId=b[k];break}}
  }catch{}
}
function equalLatestPayload(profile,payload){
  return payload&&payload.id===profile.id&&payload.signAlg===profile.signAlg&&payload.agreeAlg===profile.agreeAlg&&payload.bundleSig===profile.bundleSig&&stable(payload.signPub)===stable(profile.signPub)&&stable(payload.agreePub)===stable(profile.agreePub);
}
async function fetchHistory(id){
  if(!selfId||!mailboxToken)return null;
  const u=KEYLOG+'/profile/'+encodeURIComponent(id)+'?requester='+encodeURIComponent(selfId);
  const r=await nativeFetch(u,{headers:{Authorization:'Bearer '+mailboxToken},cache:'no-store'});
  if(!r.ok)throw new Error('keylog_http_'+r.status);
  const b=await r.json();return b.history||[];
}
async function verifyHistory(profile,history,local){
  if(!Array.isArray(history)||!history.length)throw new Error('identity_history_missing');
  let prev='GENESIS',seq=0,seenLocal=!local?.entryHash;
  for(const row of history){
    if(row.profile_seq!==seq+1)throw new Error('identity_history_gap');
    if(row.prev_hash!==prev)throw new Error('identity_history_prev_mismatch');
    const calc=await shaHex(row.prev_hash+'\n'+row.canonical_payload);
    if(calc!==row.entry_hash)throw new Error('identity_history_hash_mismatch');
    if(local?.entryHash&&row.profile_seq===local.seq){if(row.entry_hash!==local.entryHash)throw new Error('identity_history_rewrite');seenLocal=true}
    prev=row.entry_hash;seq=row.profile_seq;
  }
  if(local?.seq>seq)throw new Error('identity_history_rollback');
  if(local?.entryHash&&!seenLocal)throw new Error('identity_history_fork');
  const last=history[history.length-1];let payload;try{payload=JSON.parse(last.canonical_payload)}catch{throw new Error('identity_history_payload_invalid')}
  if(!equalLatestPayload(profile,payload))throw new Error('identity_history_profile_mismatch');
  return{seq:last.profile_seq,entryHash:last.entry_hash};
}
async function guardProfile(profile){
  if(!profile?.id)return profile;
  const s=await summary(profile),local=load(profile.id);
  if(local){
    if(local.signFp!==s.signFp||local.agreeFp!==s.agreeFp||local.bundleSigHash!==s.bundleSigHash){
      // A key change is accepted only when the append-only history proves a forward extension.
      if(!selfId||!mailboxToken)throw new Error('SECURITY_IDENTITY_KEY_CHANGED');
    }
  }
  if(selfId&&mailboxToken){
    try{
      const history=await fetchHistory(profile.id),verified=await verifyHistory(profile,history,local);
      save(profile.id,{...s,...verified,verifiedAt:Date.now()});keylogState='verified';lastError='';
    }catch(e){keylogState='blocked';lastError=e?.message||String(e);throw new Error('SECURITY_KEY_CONTINUITY_BLOCKED:'+lastError)}
  }else if(!local){
    save(profile.id,{...s,seq:0,entryHash:null,verifiedAt:0});keylogState='local-only';
  }
  return profile;
}
function securityResponse(message){return new Response(JSON.stringify({error:message}),{status:409,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}

window.fetch=async function(input,init={}){
  const url=requestUrl(input);captureContext(url,input,init);
  const r=await nativeFetch(input,init);
  if(!url.startsWith(CORE)||!r.ok)return r;
  try{
    const path=new URL(url).pathname;
    if(path.includes('/api/profile/')||path.endsWith('/api/discover')){
      const b=await r.clone().json();if(b?.profile)await guardProfile(b.profile);
    }
  }catch(e){
    const m=e?.message||String(e);if(m.startsWith('SECURITY_')){console.error('MMS Security 2 blocked profile:',m);return securityResponse(m)}
  }
  return r;
};

function trusted(id){const r=load(id);return !!(r&&r.signFp&&r.agreeFp&&!lastError)}
function status(){return{selfId,keylogState,lastError,strictContinuity:true,globalWitnessing:false}}
window.MMS_SECURITY2=Object.freeze({isTrusted:trusted,status,guardProfile});

function installBadge(){
  if(document.getElementById('mmsSecurity2Badge'))return;
  const host=document.querySelector('.actions');if(!host)return;
  const b=document.createElement('button');b.id='mmsSecurity2Badge';b.className='btn';b.textContent='🛡 Security';b.onclick=()=>{
    const s=status();const text=s.keylogState==='verified'?'Identity continuity: geverifieerd':s.keylogState==='blocked'?'Identity continuity: GEBLOKKEERD':'Identity continuity: lokaal actief';
    alert('MMS Security 2\n\n'+text+'\nStille sleutelwissels: blokkeren\nHash-chain rollback/fork detectie: actief\nGlobale onafhankelijke witnesses: nog niet actief\nPost-quantum Triple Ratchet: nog niet actief'+(s.lastError?'\n\nLaatste blokkade: '+s.lastError:''));
  };host.insertBefore(b,host.firstChild);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installBadge);else installBadge();
})();
