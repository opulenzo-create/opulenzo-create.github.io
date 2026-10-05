import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8')}
function assert(ok,msg){if(!ok)throw new Error(msg)}

const index=read('index.html');
const app=read('app.js');
const crypto=read('crypto-core.js');
const stability=read('mms-stability.js');
const access=read('mms-access3.js');
const createfix=read('mms-createfix.js');
const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));

assert(index.includes('mms-stability.js'),'0.11 stability runtime is not loaded');
assert(index.indexOf('mms-stability.js') < index.indexOf('app.js'),'stability runtime must load before app.js so fetch durability can wrap the core');
assert(index.includes('mms-access3.js'),'optional session security layer missing');
assert(index.includes('mms-createfix.js'),'identity creation fail-safe missing');
assert(stability.includes('MMS_RUNTIME_V1'),'durable runtime database missing');
assert(stability.includes('MMS-RECOVERY-1'),'encrypted recovery format missing');
assert(stability.includes('/api/status/'),'delivery receipt polling missing');
assert(stability.includes('syntheticQueued'),'offline queue acceptance path missing');
assert(stability.includes("'MMS_APP_V4'"),'recovery is not tied to the current encrypted vault database');
assert(access.includes('mms_access3_'),'optional PIN/biometric access records missing');
assert(createfix.includes('Maak identiteit'),'identity creation fail-safe has no continue action');
assert(crypto.includes('canonicalBundlePayload'),'canonical identity-bundle signing regression');
assert(crypto.includes('verifyBundleLegacy'),'legacy identity-bundle verification regression');
assert(app.includes('verifyBundleLegacy'),'contact migration compatibility missing from app');
assert(app.includes('syncProfileRegistration'),'identity signature auto-migration missing');
assert(!app.toLowerCase().includes('serverprofiel heeft een ongeldige identity signature'),'obsolete server-profile signature error returned to current client');
assert(sw.includes('mms-stability.js'),'service worker does not cache the stability runtime');
assert(manifest.name?.includes('Mattheüs Messaging Service'),'manifest identity changed unexpectedly');

console.log('MMS smoke checks passed');
