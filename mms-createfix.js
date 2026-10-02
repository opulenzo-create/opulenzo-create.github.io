'use strict';
import {TE,B64,rand,sha256,aesEnc,deriveKEK,newId,fingerprintJwk,genKeys,signBundle} from './crypto-core.js?v=20261002-2045';

const DB='MMS_APP_V4',ITERS=600000,API='https://qpgiqpnkyxbajjyhrsyr.supabase.co/functions/v1/mms';
let dbp=null;
function db(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{const r=indexedDB.open(DB);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});return dbp}
async function put(store,val){const d=await db();return new Promise((res,rej)=>{const r=d.transaction(store,'readwrite').objectStore(store).put(val);r.onsuccess=()=>res(val);r.onerror=()=>rej(r.error)})}
async function api(path,opt={}){const r=await fetch(API+path,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.error||('HTTP '+r.status));return b}
async function createIdentity(label){
  label=(label||'').trim();if(label.length<2)throw new Error('Naam is te kort.');
  const secret=B64.url(rand(32)),id=newId(),keys=await genKeys(),mailboxAuth=B64.url(rand(32));
  const authHash=B64.url(await sha256(mailboxAuth)),bundleSig=await signBundle(keys,id);
  await api('/api/register',{method:'POST',body:JSON.stringify({id,authHash,signAlg:keys.signAlg,agreeAlg:keys.agreeAlg,signPub:keys.signPub,agreePub:keys.agreePub,bundleSig})});
  const master=rand(32),salt=rand(32),kek=await deriveKEK(secret,salt),wrapped=await aesEnc(kek,master,'MMS-V4-MASTER:'+id);
  const vault={v:4,phone:null,mailboxAuth,privateKeys:{signPriv:keys.signPriv,agreePriv:keys.agreePriv},public:{id,signAlg:keys.signAlg,agreeAlg:keys.agreeAlg,signPub:keys.signPub,agreePub:keys.agreePub,bundleSig},contacts:{},chats:{},ratchets:{},seen:{},security:{createdAt:Date.now(),lastPasswordChange:null}};
  const box=await aesEnc(master,JSON.stringify(vault),'MMS-V4-VAULT:'+id);
  await put('accounts',{id,label,createdAt:Date.now(),signFingerprint:await fingerprintJwk(keys.signPub)});
  await put('vaults',{id,wrap:{salt:B64.enc(salt),iters:ITERS,wrapped},box,updatedAt:Date.now()});
  localStorage.setItem('mms_access3_'+id,JSON.stringify({v:3,id,mode:'none',secret}));
  sessionStorage.setItem('mms_access3_autopen',id);
  location.reload();
}

function repair(){
  const c=document.querySelector('#gate .card');
  if(!c||(c.querySelector('h2')?.textContent||'').trim()!=='Nieuwe MMS-identiteit')return;
  if(c.querySelector('#mmsCreateName'))return;
  c.insertAdjacentHTML('beforeend','<div class="field"><label>Naam op dit apparaat</label><input id="mmsCreateName" type="text" autocomplete="name" placeholder="Querijn"></div><div id="mmsCreateError" class="error"></div><div class="row"><button id="mmsCreateBack" class="btn">Terug</button><button id="mmsCreateGo" class="btn primary">Maak identiteit</button></div>');
  const name=c.querySelector('#mmsCreateName'),err=c.querySelector('#mmsCreateError'),back=c.querySelector('#mmsCreateBack'),go=c.querySelector('#mmsCreateGo');
  back.onclick=()=>location.reload();
  go.onclick=async()=>{go.disabled=true;back.disabled=true;err.style.color='var(--muted)';err.textContent='Sleutels en lokale vault worden aangemaakt…';try{await createIdentity(name.value)}catch(e){err.style.color='';err.textContent=e.message||String(e);go.disabled=false;back.disabled=false}};
  name.onkeydown=e=>{if(e.key==='Enter')go.click()};
  setTimeout(()=>name.focus(),0);
}
const gate=document.getElementById('gate');
new MutationObserver(()=>queueMicrotask(repair)).observe(gate,{childList:true,subtree:true});
addEventListener('pageshow',repair);setTimeout(repair,0);
