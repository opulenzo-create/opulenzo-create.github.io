import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const index=read('index.html');
const app=read('app.js');
const crypto=read('crypto-core.js');
const stability=read('mms-stability.js');
const security2=read('mms-security2.js');
const calls=read('mms-calls3.js');
const access=read('mms-access3.js');
const createfix=read('mms-createfix.js');
const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));

assert(index.includes('mms-stability.js'),'stability runtime is not loaded');
assert(index.includes('mms-security2.js'),'Security 2 runtime is not loaded');
assert(index.includes('mms-calls3.js'),'hardened call runtime is not loaded');
assert(!index.includes('mms-calls2.js'),'superseded call runtime still loads');
assert(index.indexOf('mms-stability.js') < index.indexOf('mms-security2.js'),'stability must load before Security 2');
assert(index.indexOf('mms-security2.js') < index.indexOf('mms-calls3.js'),'Security 2 must wrap relay before calls');
assert(index.indexOf('mms-calls3.js') < index.indexOf('app.js'),'call runtime must capture authenticated relay requests before app.js');
assert(index.includes("frame-ancestors 'none'"),'clickjacking CSP protection missing');
assert(index.includes('mms-access3.js'),'optional session security layer missing');
assert(index.includes('mms-createfix.js'),'identity creation fail-safe missing');

assert(stability.includes('MMS_RUNTIME_V1'),'durable runtime database missing');
assert(stability.includes('MMS-RECOVERY-1'),'encrypted recovery format missing');
assert(stability.includes('/api/status/'),'delivery receipt polling missing');
assert(stability.includes('syntheticQueued'),'offline queue acceptance path missing');
assert(stability.includes("'MMS_APP_V4'"),'recovery is not tied to the current encrypted vault database');

assert(security2.includes('mms-keylog'),'identity continuity service missing');
assert(security2.includes('identity_history_hash_mismatch'),'hash-chain verification missing');
assert(security2.includes('identity_history_rollback'),'rollback detection missing');
assert(security2.includes('identity_history_fork'),'fork detection missing');
assert(security2.includes('SECURITY_KEY_CONTINUITY_BLOCKED'),'fail-closed continuity block missing');
assert(security2.includes('MMS_SECURITY2'),'call/security trust bridge missing');

assert(calls.includes('RTCPeerConnection'),'WebRTC call engine missing');
assert(calls.includes('getUserMedia'),'microphone acquisition missing');
assert(calls.includes('/incoming/'),'incoming call polling missing');
assert(calls.includes('/answer/'),'call answer flow missing');
assert(calls.includes('/hangup/'),'call hangup flow missing');
assert(calls.includes('stun:stun.l.google.com:19302'),'STUN configuration missing');
assert(calls.includes('MMS-CALL-SAS-V1'),'call safety-code derivation missing');
assert(calls.includes('untrusted_peer'),'unknown-call trust gate missing');
assert(calls.includes('mmsCallCode'),'call verification UI missing');
assert(calls.includes('MMS_CALL_KEYS_V1'),'persistent call-key store missing');
assert(calls.includes("namedCurve:'P-256'"),'call ECDH key agreement missing');
assert(calls.includes("'HKDF'"),'per-call HKDF derivation missing');
assert(calls.includes("{name:'AES-GCM'"),'AES-GCM call signaling protection missing');
assert(calls.includes('/key/register'),'authenticated call-key registration missing');
assert(calls.includes('verifyCallKeyHistory'),'call-key hash-chain verification missing');
assert(calls.includes('sealSignal'),'call signaling encryption missing');
assert(calls.includes('openSignal'),'call signaling authenticated decryption missing');
assert(!calls.includes('body:JSON.stringify({callerId:selfId,calleeId:peerId,callId:id,offer:'),'plaintext WebRTC offer regression');
assert(!calls.includes('body:JSON.stringify({calleeId:selfId,answer:'),'plaintext WebRTC answer regression');

assert(access.includes('mms_access3_'),'optional PIN/biometric access records missing');
assert(createfix.includes('Maak identiteit'),'identity creation fail-safe has no continue action');
assert(crypto.includes('canonicalBundlePayload'),'canonical identity-bundle signing regression');
assert(crypto.includes('verifyBundleLegacy'),'legacy identity-bundle verification regression');
assert(app.includes('verifyBundleLegacy'),'contact migration compatibility missing from app');
assert(app.includes('syncProfileRegistration'),'identity signature auto-migration missing');
assert(!app.toLowerCase().includes('serverprofiel heeft een ongeldige identity signature'),'obsolete server-profile signature error returned to current client');
assert(sw.includes('mms-stability.js'),'service worker does not cache stability runtime');
assert(sw.includes('mms-security2.js'),'service worker does not cache Security 2');
assert(sw.includes('mms-calls3.js'),'service worker does not cache hardened calls');
assert(manifest.name?.includes('Mattheüs Messaging Service'),'manifest identity changed unexpectedly');

console.log('MMS Security 2 smoke checks passed');