'use strict';
export const TE=new TextEncoder(),TD=new TextDecoder();
export const B64={
  enc:b=>{const u=b instanceof Uint8Array?b:new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode(...u.subarray(i,i+0x8000));return btoa(s)},
  dec:s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),
  url:b=>B64.enc(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  unurl:s=>B64.dec(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4))
};
export const rand=n=>crypto.getRandomValues(new Uint8Array(n));
export function concat(...arrs){const n=arrs.reduce((a,b)=>a+b.length,0),o=new Uint8Array(n);let p=0;for(const a of arrs){o.set(a,p);p+=a.length}return o}
export async function sha256(data){return new Uint8Array(await crypto.subtle.digest('SHA-256',data instanceof Uint8Array?data:TE.encode(data)))}
export async function hmac(keyBytes,data){const k=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,data instanceof Uint8Array?data:TE.encode(data)))}
export async function aesKey(raw){return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function aesEnc(raw,plain,aad=''){const iv=rand(12),k=await aesKey(raw);const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:TE.encode(aad),tagLength:128},k,plain instanceof Uint8Array?plain:TE.encode(plain));return{iv:B64.enc(iv),ct:B64.enc(ct)}}
export async function aesDec(raw,box,aad=''){const k=await aesKey(raw);const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:B64.dec(box.iv),additionalData:TE.encode(aad),tagLength:128},k,B64.dec(box.ct));return new Uint8Array(pt)}
export async function deriveKEK(password,salt,iters=600000){const km=await crypto.subtle.importKey('raw',TE.encode(password),'PBKDF2',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:iters,hash:'SHA-256'},km,256))}
export async function hkdf(ikm,salt,info){const km=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info:TE.encode(info)},km,256))}
export function normalizePhone(v){const s=v.trim().replace(/[\s()\-.]/g,'');if(!/^\+[1-9]\d{7,14}$/.test(s))throw new Error('Gebruik internationaal formaat, bijvoorbeeld +31612345678.');return s}
export function newId(bytes=24){return B64.url(rand(bytes))}
export function canonicalJwk(jwk){return JSON.stringify(Object.fromEntries(Object.entries(jwk).sort(([a],[b])=>a.localeCompare(b))))}
export async function fingerprintJwk(jwk){const d=await sha256(canonicalJwk(jwk));return[...d.slice(0,20)].map(x=>x.toString(16).padStart(2,'0')).join('').match(/.{1,4}/g).join(' ')}
export async function genKeys(){
  let sign,agree,signAlg,agreeAlg;
  try{sign=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);signAlg='Ed25519'}catch{sign=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);signAlg='ECDSA-P256'}
  try{agree=await crypto.subtle.generateKey({name:'X25519'},true,['deriveBits']);agreeAlg='X25519'}catch{agree=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);agreeAlg='ECDH-P256'}
  return{signAlg,agreeAlg,signPriv:await crypto.subtle.exportKey('jwk',sign.privateKey),signPub:await crypto.subtle.exportKey('jwk',sign.publicKey),agreePriv:await crypto.subtle.exportKey('jwk',agree.privateKey),agreePub:await crypto.subtle.exportKey('jwk',agree.publicKey)}
}
async function importSignPrivate(jwk,alg){return crypto.subtle.importKey('jwk',jwk,alg==='Ed25519'?{name:'Ed25519'}:{name:'ECDSA',namedCurve:'P-256'},false,['sign'])}
async function importSignPublic(jwk,alg){return crypto.subtle.importKey('jwk',jwk,alg==='Ed25519'?{name:'Ed25519'}:{name:'ECDSA',namedCurve:'P-256'},false,['verify'])}
export async function signBytes(jwk,alg,data){const k=await importSignPrivate(jwk,alg);return new Uint8Array(await crypto.subtle.sign(alg==='Ed25519'?{name:'Ed25519'}:{name:'ECDSA',hash:'SHA-256'},k,data))}
export async function verifyBytes(jwk,alg,sig,data){const k=await importSignPublic(jwk,alg);return crypto.subtle.verify(alg==='Ed25519'?{name:'Ed25519'}:{name:'ECDSA',hash:'SHA-256'},k,sig,data)}
export async function sharedSecret(ownPriv,ownAlg,otherPub){
  if(ownAlg==='X25519'){const priv=await crypto.subtle.importKey('jwk',ownPriv,{name:'X25519'},false,['deriveBits']);const pub=await crypto.subtle.importKey('jwk',otherPub,{name:'X25519'},false,[]);return new Uint8Array(await crypto.subtle.deriveBits({name:'X25519',public:pub},priv,256))}
  const priv=await crypto.subtle.importKey('jwk',ownPriv,{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);const pub=await crypto.subtle.importKey('jwk',otherPub,{name:'ECDH',namedCurve:'P-256'},false,[]);return new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:pub},priv,256))
}
export async function signBundle(keys,id){const payload=TE.encode(JSON.stringify({id,signPub:keys.signPub,agreePub:keys.agreePub,signAlg:keys.signAlg,agreeAlg:keys.agreeAlg}));return B64.enc(await signBytes(keys.signPriv,keys.signAlg,payload))}
export async function verifyBundle(p){const payload=TE.encode(JSON.stringify({id:p.id,signPub:p.signPub,agreePub:p.agreePub,signAlg:p.signAlg,agreeAlg:p.agreeAlg}));return verifyBytes(p.signPub,p.signAlg,B64.dec(p.bundleSig),payload)}
