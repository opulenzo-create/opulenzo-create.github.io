'use strict';

const CORE='https://qpgiqpnkyxbajjyhrsyr.supabase.co/functions/v1/mms';
const CALL='https://qpgiqpnkyxbajjyhrsyr.supabase.co/functions/v1/mms-call';
const BUILD='0.12.0-audio-call';
let selfId='',mailboxToken='',incomingPoll=null,signalPoll=null,active=null,keepAlive=null,lastIncoming='';

const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init={}){
  const url=typeof input==='string'?input:(input?.url||'');
  try{
    const hs=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(init.headers||{}).forEach((v,k)=>hs.set(k,v));
    const auth=hs.get('authorization')||'';
    const m=url.match(/\/api\/inbox\/([^/?#]+)/);
    if(url.startsWith(CORE)&&auth.startsWith('Bearer ')&&m){
      selfId=decodeURIComponent(m[1]);mailboxToken=auth.slice(7);ready();
    }
  }catch{}
  return originalFetch(input,init);
};

function el(tag,attrs={},text=''){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else if(k==='id')n.id=v;else n.setAttribute(k,v)}if(text)n.textContent=text;return n}
function auth(){return{'Authorization':'Bearer '+mailboxToken,'Content-Type':'application/json'}}
async function req(base,path,opt={}){const r=await originalFetch(base+path,{...opt,headers:{...(opt.headers||{}),...(mailboxToken?auth():{'Content-Type':'application/json'})}});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.error||('HTTP '+r.status));return b}
function short(id){return id?('MMS '+id.slice(0,8)+'…'):'MMS-contact'}
function supportsCalls(){return !!(window.RTCPeerConnection&&navigator.mediaDevices?.getUserMedia)}
function waitIce(pc,timeout=9000){if(pc.iceGatheringState==='complete')return Promise.resolve();return new Promise(res=>{let done=false;const f=()=>{if(done)return;if(pc.iceGatheringState==='complete'){done=true;pc.removeEventListener('icegatheringstatechange',f);res()}};pc.addEventListener('icegatheringstatechange',f);setTimeout(()=>{if(!done){done=true;pc.removeEventListener('icegatheringstatechange',f);res()}},timeout)})}

function installStyle(){if(document.getElementById('mmsCallStyle'))return;const s=el('style',{id:'mmsCallStyle'});s.textContent=`
#mmsCallLayer{position:fixed;inset:0;z-index:120;background:rgba(2,8,6,.88);backdrop-filter:blur(22px);display:grid;place-items:center;padding:18px}#mmsCallLayer.hidden{display:none!important}.mmsCallCard{width:min(430px,100%);background:linear-gradient(180deg,#10221b,#07120e);border:1px solid #315747;border-radius:28px;padding:28px;box-shadow:0 30px 100px rgba(0,0,0,.6);text-align:center}.mmsCallAvatar{width:92px;height:92px;margin:0 auto 18px;border-radius:32px;background:linear-gradient(145deg,#62e6ae,#18835c);display:grid;place-items:center;color:#042117;font-size:36px;font-weight:1000}.mmsCallName{font-size:24px;font-weight:900}.mmsCallStatus{color:#86a399;margin:8px 0 24px;min-height:24px}.mmsCallActions{display:flex;justify-content:center;gap:14px;flex-wrap:wrap}.mmsCallRound{width:62px;height:62px;border-radius:50%;border:1px solid #315747;background:#102019;color:#eef9f5;font-size:24px;display:grid;place-items:center;cursor:pointer}.mmsCallRound.primary{background:#62e6ae;color:#042117;border:0}.mmsCallRound.danger{background:#d95050;color:white;border:0}.mmsCallRound:disabled{opacity:.35}.mmsCallLabel{font-size:10px;color:#86a399;margin-top:6px}.mmsCallField{margin:16px 0;text-align:left}.mmsCallField label{display:block;font-size:11px;color:#b9cec6;margin-bottom:6px}.mmsCallField input{width:100%;border:1px solid #203b31;background:#08140f;color:#eef9f5;border-radius:12px;padding:12px}.mmsCallError{min-height:18px;color:#ffabab;font-size:11px;margin:6px 0}.mmsCallBtnRow{display:flex;gap:8px}.mmsCallBtnRow button{flex:1}.mmsCallTiny{font-size:10px;color:#86a399;line-height:1.5;margin-top:14px}@media(max-width:820px){#mmsCallLayer{padding:12px}.mmsCallCard{border-radius:26px;padding:24px 18px}.mmsCallAvatar{width:82px;height:82px}.mmsCallName{font-size:22px}}
`;document.head.append(s)}
function layer(){let l=document.getElementById('mmsCallLayer');if(!l){l=el('div',{id:'mmsCallLayer',class:'hidden'});document.body.append(l)}return l}
function hideLayer(){layer().classList.add('hidden');layer().innerHTML=''}
function showLayer(){layer().classList.remove('hidden')}

function installButtons(){installStyle();if(!document.getElementById('mmsCallBtn')){const b=el('button',{id:'mmsCallBtn',class:'btn'},'☎ Bellen');b.disabled=!mailboxToken;b.onclick=showDialer;document.querySelector('.actions')?.insertBefore(b,document.getElementById('guestBtn')||null)}if(!document.getElementById('mmsMobileCallBtn')){const b=el('button',{id:'mmsMobileCallBtn',class:'iconBtn','aria-label':'Bellen'},'☎');b.disabled=!mailboxToken;b.onclick=showDialer;document.querySelector('.mobileTopActions')?.insertBefore(b,document.getElementById('mobileLockBtn')||null)}const a=document.getElementById('mmsCallBtn'),m=document.getElementById('mmsMobileCallBtn');if(a)a.disabled=!mailboxToken;if(m)m.disabled=!mailboxToken}
function ready(){installButtons();if(!incomingPoll)incomingPoll=setInterval(checkIncoming,1800);checkIncoming()}

function showDialer(){
  if(!mailboxToken||!selfId)return alert('Ontgrendel eerst je MMS-identiteit.');
  const l=layer();l.innerHTML='';const c=el('div',{class:'mmsCallCard'});c.append(el('div',{class:'mmsCallAvatar'},'☎'),el('div',{class:'mmsCallName'},'MMS bellen'),el('div',{class:'mmsCallStatus'},'Bel een MMS-ID of een telefoonnummer dat aan MMS is gekoppeld.'));
  const f=el('div',{class:'mmsCallField'}),lab=el('label',{},'MMS-ID of telefoonnummer'),i=el('input',{type:'text',placeholder:'+31612345678 of MMS-ID',autocomplete:'off'}),e=el('div',{class:'mmsCallError'}),row=el('div',{class:'mmsCallBtnRow'}),cancel=el('button',{class:'btn'},'Annuleren'),go=el('button',{class:'btn primary'},'Bel');
  cancel.onclick=hideLayer;go.onclick=async()=>{go.disabled=true;e.textContent='';try{let peer=i.value.trim();if(peer.startsWith('+')){const r=await req(CORE,'/api/discover',{method:'POST',body:JSON.stringify({requesterId:selfId,phone:peer})});peer=r.profile?.id||''}if(!/^[A-Za-z0-9_-]{16,80}$/.test(peer))throw new Error('Geen geldig MMS-contact gevonden.');if(peer===selfId)throw new Error('Je kunt jezelf niet bellen.');await startOutgoing(peer)}catch(err){e.textContent=human(err);go.disabled=false}};i.onkeydown=ev=>{if(ev.key==='Enter')go.click()};f.append(lab,i);row.append(cancel,go);c.append(f,e,row,el('div',{class:'mmsCallTiny'},'Audio gebruikt WebRTC. MMS/Supabase bewaart geen audio. Voor deze eerste versie kan de signaling-service wel WebRTC-verbindingsmetadata (SDP/ICE) verwerken.'));l.append(c);showLayer();setTimeout(()=>i.focus(),0)
}
function human(e){const m=e?.message||String(e);if(m==='NotAllowedError'||e?.name==='NotAllowedError')return'Microfoontoegang is geweigerd. Geef MMS toegang tot de microfoon in je browser/telefooninstellingen.';if(m==='call_rate_limited')return'Te veel belpogingen. Probeer later opnieuw.';if(m==='recipient_not_found'||m==='not_found')return'Dit MMS-contact is niet bereikbaar.';if(m==='call_expired')return'De oproep is verlopen.';return m}
async function mic(){try{return await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})}catch(e){throw e}}
function pcFor(stream){const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}],iceCandidatePoolSize:2});for(const t of stream.getTracks())pc.addTrack(t,stream);pc.ontrack=ev=>{const a=document.getElementById('mmsRemoteAudio')||el('audio',{id:'mmsRemoteAudio',autoplay:'',playsinline:''});if(!a.parentNode)document.body.append(a);a.srcObject=ev.streams[0];a.play?.().catch(()=>setCallStatus('Verbonden — tik op het scherm als je geen geluid hoort.'))};pc.onconnectionstatechange=()=>{if(!active||active.pc!==pc)return;const s=pc.connectionState;if(s==='connected')setCallStatus('Verbonden');else if(s==='connecting')setCallStatus('Verbinden…');else if(['failed','disconnected'].includes(s))setCallStatus('Verbinding onderbroken');else if(s==='closed')setCallStatus('Gesprek beëindigd')};return pc}
async function startOutgoing(peer){
  if(!supportsCalls())throw new Error('Bellen wordt door deze browser niet ondersteund.');if(active)throw new Error('Er is al een oproep actief.');
  const stream=await mic(),pc=pcFor(stream),id=crypto.randomUUID().replace(/-/g,'')+Math.random().toString(36).slice(2,8);active={id,peer,pc,stream,direction:'out',muted:false};showCall(peer,'Bellen…',false);const offer=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription(offer);await waitIce(pc);await req(CALL,'/start',{method:'POST',body:JSON.stringify({callerId:selfId,calleeId:peer,callId:id,offer:pc.localDescription})});startSignalPoll();keepCallAwake()
}
async function checkIncoming(){
  if(!mailboxToken||!selfId||active||document.hidden)return;try{const r=await req(CALL,'/incoming/'+encodeURIComponent(selfId));const c=r.calls?.[0];if(!c||c.id===lastIncoming)return;lastIncoming=c.id;showIncoming(c)}catch{}
}
function showIncoming(c){const l=layer();l.innerHTML='';const card=el('div',{class:'mmsCallCard'});card.append(el('div',{class:'mmsCallAvatar'},'☎'),el('div',{class:'mmsCallName'},short(c.caller_id)),el('div',{class:'mmsCallStatus'},'Inkomende MMS-oproep'));const acts=el('div',{class:'mmsCallActions'});const noWrap=el('div'),no=el('button',{class:'mmsCallRound danger'},'✕'),yesWrap=el('div'),yes=el('button',{class:'mmsCallRound primary'},'☎');no.onclick=()=>declineIncoming(c);yes.onclick=()=>answerIncoming(c);noWrap.append(no,el('div',{class:'mmsCallLabel'},'Weiger'));yesWrap.append(yes,el('div',{class:'mmsCallLabel'},'Neem op'));acts.append(noWrap,yesWrap);card.append(acts);l.append(card);showLayer();navigator.vibrate?.([180,100,180])}
async function answerIncoming(c){
  try{if(!supportsCalls())throw new Error('Bellen wordt door deze browser niet ondersteund.');const sig=await req(CALL,'/signals/'+encodeURIComponent(c.id)+'?id='+encodeURIComponent(selfId));const offer=sig.signals?.find(x=>x.kind==='offer')?.payload;if(!offer)throw new Error('De oproepdata is niet meer beschikbaar.');const stream=await mic(),pc=pcFor(stream);active={id:c.id,peer:c.caller_id,pc,stream,direction:'in',muted:false};showCall(c.caller_id,'Verbinden…',true);await pc.setRemoteDescription(offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await waitIce(pc);await req(CALL,'/answer/'+encodeURIComponent(c.id),{method:'POST',body:JSON.stringify({calleeId:selfId,answer:pc.localDescription})});startSignalPoll();keepCallAwake()}catch(e){alert(human(e));await declineIncoming(c,true)}
}
async function declineIncoming(c,silent=false){try{await req(CALL,'/decline/'+encodeURIComponent(c.id),{method:'POST',body:JSON.stringify({calleeId:selfId})})}catch{}lastIncoming=c.id;hideLayer();if(!silent)navigator.vibrate?.(30)}
function showCall(peer,status){const l=layer();l.innerHTML='';const c=el('div',{class:'mmsCallCard'});c.append(el('div',{class:'mmsCallAvatar'},'M'),el('div',{class:'mmsCallName'},short(peer)),el('div',{id:'mmsCallStatus',class:'mmsCallStatus'},status));const acts=el('div',{class:'mmsCallActions'}),mw=el('div'),mute=el('button',{class:'mmsCallRound'},'🎙'),hw=el('div'),hang=el('button',{class:'mmsCallRound danger'},'✕');mute.onclick=()=>toggleMute(mute);hang.onclick=()=>endCall(true);mw.append(mute,el('div',{class:'mmsCallLabel'},'Mute'));hw.append(hang,el('div',{class:'mmsCallLabel'},'Ophangen'));acts.append(mw,hw);c.append(acts);l.append(c);showLayer()}
function setCallStatus(s){const e=document.getElementById('mmsCallStatus');if(e)e.textContent=s}
function toggleMute(btn){if(!active)return;active.muted=!active.muted;for(const t of active.stream?.getAudioTracks?.()||[])t.enabled=!active.muted;btn.textContent=active.muted?'🔇':'🎙';setCallStatus(active.muted?'Microfoon gedempt':'Verbonden')}
function startSignalPoll(){stopSignalPoll();signalPoll=setInterval(pollSignals,900);pollSignals()}
function stopSignalPoll(){if(signalPoll){clearInterval(signalPoll);signalPoll=null}}
async function pollSignals(){if(!active||!mailboxToken)return;try{const r=await req(CALL,'/signals/'+encodeURIComponent(active.id)+'?id='+encodeURIComponent(selfId));for(const s of r.signals||[]){if(s.kind==='answer'&&active.direction==='out'&&s.payload){await active.pc.setRemoteDescription(s.payload);setCallStatus('Verbinden…')}else if(s.kind==='decline'){setCallStatus('Oproep geweigerd');setTimeout(()=>endCall(false),900)}else if(s.kind==='hangup'){setCallStatus('Gesprek beëindigd');setTimeout(()=>endCall(false),400)}}if(r.state==='missed'){setCallStatus('Geen antwoord');setTimeout(()=>endCall(false),900)}else if(r.state==='declined'){setCallStatus('Oproep geweigerd');setTimeout(()=>endCall(false),700)}}catch(e){console.warn('MMS call signal:',e.message)}}
async function endCall(notify){const a=active;if(!a){hideLayer();return}active=null;stopSignalPoll();stopKeepAwake();try{for(const t of a.stream?.getTracks?.()||[])t.stop();a.pc?.close()}catch{}const ra=document.getElementById('mmsRemoteAudio');if(ra){ra.srcObject=null;ra.remove()}hideLayer();if(notify&&mailboxToken){try{await req(CALL,'/hangup/'+encodeURIComponent(a.id),{method:'POST',body:JSON.stringify({id:selfId})})}catch{}}}
function keepCallAwake(){stopKeepAwake();keepAlive=setInterval(()=>{if(active)window.dispatchEvent(new Event('mousemove'))},25000)}
function stopKeepAwake(){if(keepAlive){clearInterval(keepAlive);keepAlive=null}}

addEventListener('pagehide',()=>{if(active)endCall(true);if(incomingPoll)clearInterval(incomingPoll);stopSignalPoll();stopKeepAwake()});
addEventListener('online',()=>{if(mailboxToken)checkIncoming()});
installButtons();
console.info('MMS Calls',BUILD);
