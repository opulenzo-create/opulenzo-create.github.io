'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/../instagram-callback.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
function run(search) {
  const fields = {};
  for (const id of ['status', 'open-current', 'open-legacy']) {
    fields[id] = {
      textContent: '',
      attrs: { 'aria-disabled': 'true', tabindex: '-1' },
      removeAttribute(name) { delete this.attrs[name]; }
    };
  }
  const historyCalls = [];
  vm.runInNewContext(script, {
    URL, URLSearchParams,
    location: { search, pathname: '/postflow/instagram-callback.html' },
    history: { replaceState(...args) { historyCalls.push(args); } },
    document: { getElementById(id) { return fields[id]; } }
  });
  return { fields, historyCalls };
}
const ok = run('?code=abc123safe&state=abcdefghijklmnoP');
assert.match(ok.fields.status.textContent, /ontvangen/);
assert.equal(new URL(ok.fields['open-current'].href).port, '8765');
assert.equal(new URL(ok.fields['open-legacy'].href).port, '8877');
assert.equal(new URL(ok.fields['open-current'].href).searchParams.get('code'), 'abc123safe');
assert.equal(new URL(ok.fields['open-current'].href).searchParams.get('state'), 'abcdefghijklmnoP');
assert.equal(ok.fields['open-current'].rel, 'noopener noreferrer');
assert.equal(ok.fields['open-current'].target, '_blank');
assert.equal(ok.fields['open-current'].attrs['aria-disabled'], undefined);
assert.equal(ok.historyCalls[0][2], '/postflow/instagram-callback.html');
for (const q of [
  '', '?code=x&state=ab', '?error=access_denied',
  '?code=abc&code=def&state=abcdefghijklmnoP',
  '?code=abc&state=abcdefghijklmnoP&state=abcdefghijklmnoQ',
  '?code=abc&state=https://evil.example'
]) {
  const r = run(q);
  assert.equal(r.fields['open-current'].href, undefined);
  assert.ok(r.historyCalls.length);
}
console.log('Postflow Instagram callback checks passed');
