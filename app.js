(function(){var tabs=document.querySelectorAll('.toggle button');
tabs.forEach(function(t){t.addEventListener('click',function(){
tabs.forEach(function(x){x.setAttribute('aria-selected',x===t?'true':'false')});
document.querySelectorAll('.ppanel').forEach(function(p){p.hidden=p.id!==t.getAttribute('aria-controls')});
})})})();
(function(){var m=document.getElementById('login-msg'),p=document.getElementById('lg-pass'),s=document.getElementById('lg-show');
s.addEventListener('click',function(){var show=p.type==='password';p.type=show?'text':'password';s.textContent=show?'Hide':'Show';s.setAttribute('aria-label',show?'Hide password':'Show password')});
document.getElementById('login-form').addEventListener('submit',function(e){e.preventDefault();var mode=document.getElementById('login').dataset.mode,mob=document.getElementById('lg-user').value.replace(/\D/g,'').slice(-10),btn=document.getElementById('lg-submit');
if(mob.length<10){m.textContent='Enter your 10 digit mobile number.';return}
if(mode!=='admin'&&!/^\d{4,6}$/.test(document.getElementById('lg-pin').value.trim())){m.textContent='Enter your 4 to 6 digit PIN (numbers only).';return}
m.textContent='';btn.disabled=true;
var rem=document.getElementById('lg-remember').checked,req=mode==='admin'?{url:'/api/admin/login',body:{mobile:mob,password:p.value,remember:rem}}:{url:'/api/member/login',body:{mobile:mob,pin:document.getElementById('lg-pin').value,remember:rem}};
fetch(req.url,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(req.body)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw new Error(j.error||'Login failed.');return j})}).then(function(j){try{if(rem)localStorage.setItem('lbRemember',mode);else localStorage.removeItem('lbRemember')}catch(e){}document.getElementById('lg-pin').value='';p.value='';if(mode==='admin')return window.loadAdmin().then(function(){location.hash='#admin'});window.showMember(j);location.hash='#member'}).catch(function(err){m.textContent=err.message}).then(function(){btn.disabled=false})});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&location.hash==='#login')location.hash='#home'});
})();
(function(){var L=document.getElementById('login'),M={member:{t:'Member login',s:'Enter your mobile number and the PIN given by the gym.',u:'Mobile number',b:'Log in',a:'Welcome back.',as:'Your next session starts here.'},admin:{t:'Admin sign in',s:'For LB FITNESS staff only.',u:'Admin mobile number',b:'Sign in as admin',a:'Admin access.',as:'Manage plans, coaches and members.'}};
function set(mode){var c=M[mode];L.dataset.mode=mode;document.getElementById('lg-pass').required=mode==='admin';
['member','admin'].forEach(function(k){document.getElementById('seg-'+k).setAttribute('aria-selected',k===mode?'true':'false')});
document.getElementById('lg-title').textContent=c.t;document.getElementById('lg-sub').textContent=c.s;document.getElementById('lg-ulabel').textContent=c.u;document.getElementById('lg-submit').textContent=c.b;document.getElementById('lg-art').textContent=c.a;document.getElementById('lg-art-sub').textContent=c.as;document.getElementById('login-msg').textContent=''}
document.getElementById('seg-member').addEventListener('click',function(){set('member')});
document.getElementById('seg-admin').addEventListener('click',function(){set('admin')});
document.querySelectorAll('a.login,a[data-mode="admin"]').forEach(function(a){a.addEventListener('click',function(){set(a.dataset.mode==='admin'?'admin':'member')})});
})();
(function(){var $=function(i){return document.getElementById(i)};
var fmt=function(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})},DAY=864e5;
function pdate(s){var p=s.slice(0,10).split('-');return new Date(+p[0],p[1]-1,+p[2])}
window.showMember=function(d){window.__mem=d;var now=new Date();now.setHours(0,0,0,0);var j=pdate(d.joined),s=pdate(d.start),e=pdate(d.exp),total=Math.max(1,(e-s)/DAY),left=Math.max(0,Math.ceil((e-now)/DAY)),used=Math.max(0,Math.min(100,Math.round((total-left)/total*100)));
$('mp-first').textContent=d.name.split(' ')[0];$('mp-name').textContent=d.name;$('mp-mobile').textContent='+91 '+d.mobile.slice(0,5)+' '+d.mobile.slice(5);
$('mp-av').textContent=d.name.split(' ').map(function(w){return w[0]}).join('').slice(0,2).toUpperCase();
$('mp-pkg').textContent=d.plan+' \u00b7 '+d.months+(d.months===1?' month':' months');
var lapsed=left<=0;
$('mp-days').textContent=lapsed?'Expired':left;$('mp-dlabel').textContent=lapsed?'on '+fmt(e):(left===1?'day left':'days left');
$('mp-explbl').textContent=lapsed?'Expired':'Expires';$('mp-plan').classList.toggle('lapsed',lapsed);
$('mp-note').textContent=lapsed?'Your membership has ended. Visit the front desk to renew.':'To renew or pay, visit the front desk.';
$('mp-join').textContent=fmt(j);$('mp-exp').textContent=fmt(e);
$('mp-bar').style.width=used+'%';$('mp-barwrap').setAttribute('aria-valuenow',used)};
if(location.hash==='#member')location.hash='#login';
function calc(){var a=+$('c-age').value,h=+$('c-h').value,w=+$('c-w').value,g=$('c-gender').value,f=+$('c-act').value,goal=$('c-goal').value;
var ok=a>=14&&a<=90&&h>=120&&h<=230&&w>=30&&w<=250;
if(!ok){['r-cal','r-pro','r-carb','r-fat'].forEach(function(i){$(i).textContent='-'});return}
var bmr=10*w+6.25*h-5*a+(g==='m'?5:-161),adj={lose:-500,maintain:0,gain:300}[goal],pk={lose:2,maintain:1.6,gain:1.8}[goal];
var cal=Math.max(g==='m'?1500:1200,bmr*f+adj),pro=w*pk,fat=cal*.25/9,carb=Math.max(0,(cal-pro*4-fat*9)/4);
$('r-cal').textContent=Math.round(cal).toLocaleString('en-IN');$('r-pro').textContent=Math.round(pro);$('r-carb').textContent=Math.round(carb);$('r-fat').textContent=Math.round(fat)}
['c-gender','c-age','c-h','c-w','c-act','c-goal'].forEach(function(i){$(i).addEventListener('input',calc);$(i).addEventListener('change',calc)});
calc();
})();
(function(){var $=function(i){return document.getElementById(i)},DAY=864e5;
var fmt=function(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})},rs=function(n){return '\u20b9'+n.toLocaleString('en-IN')};
var price={Open:{1:3000,3:5000,6:8000,12:12000},Coached:{1:12000,3:24000,6:36000,12:48000}};
var today=new Date();today.setHours(0,0,0,0);
var M=[];var esc=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
// add months like PostgreSQL does: Jan 31 + 1 month = Feb 28 (stops at the end of the month)
function addM(d,n){var x=new Date(d.getFullYear(),d.getMonth()+n,1),last=new Date(x.getFullYear(),x.getMonth()+1,0).getDate();x.setDate(Math.min(d.getDate(),last));return x}
function toD(s){var p=s.slice(0,10).split('-');return new Date(+p[0],p[1]-1,+p[2])}
function build(a){var terms=a.terms.map(function(t){return{id:t.id,plan:t.plan,months:+t.months,start:toD(t.start),at:toD(t.at||t.start),total:+t.total}}).sort(function(x,y){return x.start-y.start}),pays=a.pays.map(function(p){return{id:p.id,d:toD(p.d),a:+p.a,m:p.m}}),c=terms[terms.length-1],exp=addM(c.start,c.months);
var fee=terms.reduce(function(s,t){return s+t.total},0),paid=pays.reduce(function(s,p){return s+p.a},0);
return{id:a.id,name:a.name,mobile:'+91 '+a.mobile.slice(0,5)+' '+a.mobile.slice(5),plan:c.plan,months:c.months,left:Math.ceil((exp-today)/DAY),join:terms[0].start,cstart:terms.length>1?c.start:undefined,exp:exp,fee:fee,pays:pays,paid:paid,pend:fee-paid,photo:a.photo,version:a.version,hasPin:a.hasPin,pinStored:a.pinStored,terms:terms}}
function api(url,o){o=o||{};o.credentials='same-origin';if(o.body&&!(o.body instanceof FormData)){o.headers={'Content-Type':'application/json'};o.body=JSON.stringify(o.body)}
return fetch(url,o).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok){if(r.status===401&&url.indexOf('login')<0)location.hash='#login';throw new Error(j.error||'Something went wrong.')}return j})})}
function loadMembers(){return api('/api/admin/members').then(function(r){M=r.map(build);drawChips();drawList();drawStats()})}
var adminOn=false;window.loadAdmin=function(){return loadMembers().then(function(){adminOn=true})};
function uploadPhoto(id,f){var fd=new FormData();fd.append('photo',f);return api('/api/admin/members/'+id+'/photo',{method:'POST',body:fd})}
function toBody(m){
  var toIso=function(v,what){var d=v instanceof Date?v:(/^\d{4}-\d{2}-\d{2}/.test(String(v))?toD(String(v)):null);if(!d||isNaN(d.getTime()))throw new Error('Missing or invalid '+what);return iso(d)};
  return{name:m.name,mobile:m.mobile.replace(/\D/g,'').slice(-10),version:m.version,pin:m.newPin||'',
    terms:m.terms.map(function(t){return{id:t.id||null,plan:t.plan,months:+t.months,start:toIso(t.start,'package start date'),at:toIso(t.at||t.start,'package date'),total:+t.total}}),
    pays:m.pays.map(function(p){return{id:p.id||null,d:toIso(p.d,'payment date'),a:+p.a,m:p.m}})}}
var saving=false;
function busy(){if(saving){toast('Still saving the last change. Try again in a moment.');return true}return false}
function reloadAfterSave(){return loadMembers().then(function(){refreshCur()}).catch(function(){})}
function persist(m,okMsg){var b;try{b=toBody(m)}catch(e){toast('Not saved: '+e.message);return reloadAfterSave()}
saving=true;toast('Saving...');
return api('/api/admin/members/'+m.id,{method:'PUT',body:b}).then(function(){m.newPin='';toast(okMsg);return true},function(e){toast('Not saved: '+e.message);return false})
.then(reloadAfterSave).then(function(){saving=false})}
function refreshCur(quiet){if(!cur)return;var n=M.find(function(x){return x.id===cur.id});if(n){cur=n;if(!quiet&&mod.classList.contains('open'))openM(M.indexOf(n))}}
var st=function(m){return m.left<=0?'expired':m.left<=7?'soon':'active'},lab={active:'Active',soon:'Expiring soon',expired:'Expired'};
var ini=function(n){return n.split(' ').map(function(w){return w[0]}).join('').slice(0,2).toUpperCase()};
var av=function(m){return m.photo?'<img alt="" loading="lazy" decoding="async" src="'+esc(m.photo)+'">':esc(ini(m.name))};
var filter='all',q='';
function drawStats(){
var cnt={all:M.length,expired:M.filter(function(m){return st(m)==='expired'}).length,soon:M.filter(function(m){return st(m)==='soon'}).length,pending:M.filter(function(m){return m.pend>0}).length};
var pendTotal=M.reduce(function(s,m){return s+m.pend},0);
var cards=[['all','Total members',cnt.all,'View all members'],['expired','Expired',cnt.expired,'Membership ended'],['soon','Expiring in 7 days or less',cnt.soon,'Renewal due soon'],['pending','Payment left',rs(pendTotal),cnt.pending+' members have dues']];
$('ad-stats').innerHTML=cards.map(function(c){return '<button type="button" class="stat" data-k="'+c[0]+'"><span>'+c[1]+'</span><b>'+c[2]+'</b><small>'+c[3]+'</small></button>'}).join('');
drawIncome();
}drawStats();
function drawIncome(){var y=today.getFullYear(),mo=today.getMonth(),all=0,mth=0,yr=0,nT=0,nM=0,nY=0,ren=[],combo={};
M.forEach(function(m){m.terms.forEach(function(t,k){all+=t.total;nT++;if(t.at.getFullYear()===y){yr+=t.total;nY++;if(t.at.getMonth()===mo){mth+=t.total;nM++}}if(k>0)ren.push({m:m,t:t})});
if(st(m)!=='expired'){var key=m.plan+' \u00b7 '+m.months+(m.months===1?' month':' months');combo[key]=(combo[key]||0)+1}});
var pk=function(n){return n+(n===1?' package':' packages')};
$('in-cards').innerHTML=[['Total income',rs(all),pk(nT)+' in total'],['Income this month',rs(mth),pk(nM)+' \u00b7 '+today.toLocaleDateString('en-GB',{month:'long',year:'numeric'})],['Income this year',rs(yr),pk(nY)+' \u00b7 '+y]].map(function(c){return '<div class="stat static"><span>'+c[0]+'</span><b>'+c[1]+'</b><small>'+c[2]+'</small></div>'}).join('');
var cs=Object.keys(combo).sort(function(a,b){return combo[b]-combo[a]});
$('in-top').innerHTML=cs.length?'<div class="top">'+cs[0]+'</div><p class="topsub">'+combo[cs[0]]+(combo[cs[0]]===1?' active member':' active members')+'</p>'+cs.map(function(k){return '<div class="brow"><span>'+k+'</span><div class="bt"><i style="width:'+Math.round(combo[k]/combo[cs[0]]*100)+'%"></i></div><b>'+combo[k]+'</b></div>'}).join(''):'<p class="empty">No active members yet.</p>';
ren.sort(function(a,b){return b.t.at-a.t.at});
$('in-ren').innerHTML=ren.length?'<p class="topsub">'+ren.length+(ren.length===1?' renewal':' renewals')+' recorded</p><div class="rwrap"><table class="ptab rtab"><thead><tr><th>Member</th><th>Package</th><th>Date</th><th class="r">Amount</th></tr></thead><tbody>'+ren.map(function(x){return '<tr><td>'+esc(x.m.name)+'<small>'+esc(x.m.mobile)+'</small></td><td>'+x.t.plan+' \u00b7 '+x.t.months+'m</td><td>'+fmt(x.t.at)+'</td><td class="r">'+rs(x.t.total)+'</td></tr>'}).join('')+'</tbody></table></div>':'<p class="empty">No renewals yet.</p>'}

var chips=[['all','All'],['expired','Expired'],['soon','Expiring soon'],['pending','Payment pending']];
function drawChips(){$('ad-chips').innerHTML=chips.map(function(c){return '<button type="button" data-f="'+c[0]+'" aria-pressed="'+(filter===c[0])+'">'+c[1]+'</button>'}).join('')}
function drawList(){var rows=M.map(function(m,i){return[m,i]}).filter(function(x){var m=x[0];
if(filter==='expired'&&st(m)!=='expired')return false;if(filter==='soon'&&st(m)!=='soon')return false;if(filter==='pending'&&m.pend<=0)return false;
return !q||(m.name+' '+m.mobile).toLowerCase().indexOf(q)>-1});
$('ad-list').innerHTML=rows.length?rows.map(function(x){var m=x[0],s=st(m);return '<button type="button" class="mrow mgrid" data-i="'+x[1]+'"><span class="av3">'+av(m)+'</span><span><span class="n">'+esc(m.name)+'</span><small>'+esc(m.mobile)+'</small></span><span class="hm">'+m.plan+' \u00b7 '+m.months+'m</span><span class="hm">'+fmt(m.exp)+'<small>'+(m.left>0?m.left+' days left':'ended')+'</small></span><span><span class="badge b-'+s+'">'+lab[s]+'</span></span><span class="hm">'+(m.pend>0?rs(m.pend):'-')+'</span></button>'}).join(''):'<p class="empty">No members found.</p>'}
function view(v){$('v-dash').hidden=v!=='dash';$('v-members').hidden=v!=='members';$('v-stats').hidden=v!=='stats';document.querySelectorAll('.ad-nav button').forEach(function(b){if(b.dataset.view===v)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});$('admin').querySelector('.ad-main').scrollTop=0}
document.querySelectorAll('.ad-nav button').forEach(function(b){b.addEventListener('click',function(){view(b.dataset.view)})});
$('ad-stats').addEventListener('click',function(e){var b=e.target.closest('.stat');if(!b)return;filter=b.dataset.k;drawChips();drawList();view('members')});
$('ad-chips').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;filter=b.dataset.f;drawChips();drawList()});
$('ad-q').addEventListener('input',function(){q=this.value.trim().toLowerCase();drawList()});
var cur=null,opener=null,mod=$('ad-modal');
function openM(i){cur=M[i];var m=cur,tot=(m.exp-(m.cstart||m.join))/DAY,used=Math.max(0,Math.min(100,Math.round((tot-m.left)/tot*100)));
$('m-photo').innerHTML=av(m);$('m-delphoto').style.display=m.photo?'':'none';$('m-name').textContent=m.name;$('m-mobile').textContent=m.mobile;
$('m-pkg').textContent=m.plan+' \u00b7 '+m.months+(m.months===1?' month':' months');$('m-join').textContent=fmt(m.join);$('m-exp').textContent=fmt(m.exp);
$('m-left').textContent=m.left>0?m.left+' days':'Expired '+Math.abs(m.left)+' days ago';$('m-bar').style.width=used+'%';
$('m-pay').innerHTML=m.pays.length?m.pays.map(function(p){return '<tr><td>'+fmt(p.d)+'</td><td>'+esc(p.m)+'</td><td class="r">'+rs(p.a)+'</td></tr>'}).join(''):'<tr><td colspan="3">No payments yet</td></tr>';
$('m-fee').textContent=rs(m.fee);$('m-paybtn').disabled=m.pend<=0;$('m-paybtn').title=m.pend<=0?'No payment pending':'';$('m-paid').textContent=rs(m.paid);var pe=$('m-pend');pe.textContent=m.pend>0?rs(m.pend):'Cleared';pe.className=m.pend>0?'due':'ok';
drawPin();mod.classList.add('open');$('m-close').focus()}
var pinTimer;
function maskPin(){clearTimeout(pinTimer);var t=$('m-pin'),b=$('m-pinbtn'),m=cur;t.className='';b.disabled=false;
if(!m||!m.hasPin){t.className='note';t.textContent='No PIN set. Add one in Edit.';b.style.display='none'}
else if(!m.pinStored){t.className='note';t.textContent='Not saved (set before PINs were stored). Set a new PIN in Edit.';b.style.display='none'}
else{t.textContent='\u2022\u2022\u2022\u2022';b.textContent='Show';b.style.display=''}}
function drawPin(){maskPin()}
$('m-pinbtn').addEventListener('click',function(){var m=cur,b=this;if(!m)return;if(b.textContent==='Hide'){maskPin();return}b.disabled=true;
api('/api/admin/members/'+m.id+'/pin').then(function(r){if(!cur||cur.id!==m.id)return;
if(!r.pin){$('m-pin').className='note';$('m-pin').textContent='Cannot be read. Set a new PIN in Edit.';b.style.display='none';return}
$('m-pin').textContent=r.pin;b.textContent='Hide';b.disabled=false;pinTimer=setTimeout(maskPin,30000)}).catch(function(e){b.disabled=false;toast(e.message)})});
function closeM(){clearTimeout(pinTimer);$('m-pin').className='';$('m-pin').textContent='\u2022\u2022\u2022\u2022';mod.classList.remove('open');if(opener)opener.focus();drawList()}
$('ad-list').addEventListener('click',function(e){var b=e.target.closest('.mrow');if(!b)return;opener=b;openM(+b.dataset.i)});
$('m-close').addEventListener('click',closeM);
mod.addEventListener('click',function(e){if(e.target===mod)closeM()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&mod.classList.contains('open')&&!$('rn-modal').classList.contains('open')&&!$('pp-modal').classList.contains('open')&&!$('ed-modal').classList.contains('open')&&!$('ph-modal').classList.contains('open')&&!$('up-modal').classList.contains('open'))closeM()});
var upm=$('up-modal'),phm=$('ph-modal');
function openUP(){if(!cur)return;upm.classList.add('open');$('up-gal').focus()}
function closeUP(){upm.classList.remove('open');$('m-up').focus()}
$('m-up').addEventListener('click',openUP);$('up-close').addEventListener('click',closeUP);upm.addEventListener('click',function(e){if(e.target===upm)closeUP()});
$('up-gal').addEventListener('click',function(){$('m-file').click();upm.classList.remove('open')});
$('up-cam').addEventListener('click',function(){$('m-cam').click();upm.classList.remove('open')});
function openPH(){if(!cur)return;if(!cur.photo){openUP();return}$('ph-img').src=cur.photo;$('ph-cap').textContent=cur.name;phm.classList.add('open');$('ph-close').focus()}
function closePH(){phm.classList.remove('open');$('ph-img').removeAttribute('src');$('m-photo').focus()}
$('m-photo').addEventListener('click',openPH);$('m-photo').addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();openPH()}});
$('ph-close').addEventListener('click',closePH);phm.addEventListener('click',function(e){if(e.target===phm)closePH()});
document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;if(phm.classList.contains('open'))closePH();else if(upm.classList.contains('open'))closeUP()});
function onPhoto(){var f=this.files[0],m=cur;this.value='';if(!f||!m)return;toast('Uploading photo...');uploadPhoto(m.id,f).then(function(r){m.photo=r.photo;$('m-photo').innerHTML=av(m);$('m-delphoto').style.display='';drawList();toast('Photo saved')}).catch(function(e){toast(e.message)})}
$('m-file').addEventListener('change',onPhoto);$('m-cam').addEventListener('change',onPhoto);
var tt;function toast(s,ms){var t=$('ad-toast');t.textContent=s;t.classList.add('show');clearTimeout(tt);tt=setTimeout(function(){t.classList.remove('show')},ms||6000)}
var am=$('am-modal'),amPhoto=null,amFile=null,txTouched=false;
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function startDate(){var v=$('am-start').value;if(!v)return null;var p=v.split('-');return new Date(+p[0],p[1]-1,+p[2])}
function txDate(){var v=$('am-date').value;if(!v)return null;var p=v.split('-');return new Date(+p[0],p[1]-1,+p[2])}
function endDate(){return addM(startDate()||today,+$('am-months').value)}
function stdPrice(){return price[$('am-plan').value][$('am-months').value]}
function amCalc(){$('am-end').value=fmt(endDate());var t=+$('am-total').value||0,p=+$('am-paid').value||0,l=t-p;$('am-left').value=l<0?'Check the amounts':l===0?'Cleared':rs(l);$('am-hint').textContent='Standard price: '+rs(stdPrice())+'. Change the total if you negotiated.'}
function amPkg(){$('am-total').value=stdPrice();amCalc()}
function openAM(){$('am-form').reset();if(amPhoto)URL.revokeObjectURL(amPhoto);amPhoto=null;amFile=null;$('am-photo').innerHTML='<span style="font-size:16px;color:var(--mute);font-family:var(--body);font-weight:400">No photo</span>';$('am-start').value=iso(today);$('am-date').value=iso(today);$('am-err').textContent='';$('am-pin').value=String(1000+crypto.getRandomValues(new Uint32Array(1))[0]%9000);txTouched=false;amPkg();am.classList.add('open');$('am-name').focus()}
function closeAM(){am.classList.remove('open');$('ad-add').focus()}
$('ad-add').addEventListener('click',openAM);
['am-plan','am-months'].forEach(function(i){$(i).addEventListener('change',amPkg)});
['am-total','am-paid','am-start'].forEach(function(i){$(i).addEventListener('input',amCalc)});
$('am-start').addEventListener('input',function(){if(!txTouched)$('am-date').value=$('am-start').value});
$('am-date').addEventListener('input',function(){txTouched=true});
$('am-up').addEventListener('click',function(){$('am-file').click()});
$('am-file').addEventListener('change',function(){var f=this.files[0];if(!f)return;if(amPhoto)URL.revokeObjectURL(amPhoto);amPhoto=URL.createObjectURL(f);amFile=f;$('am-photo').innerHTML='<img alt="" src="'+amPhoto+'">';this.value=''});
$('am-close').addEventListener('click',closeAM);$('am-cancel').addEventListener('click',closeAM);
am.addEventListener('click',function(e){if(e.target===am)closeAM()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&am.classList.contains('open'))closeAM()});
$('am-form').addEventListener('submit',function(e){e.preventDefault();
var name=$('am-name').value.trim(),mob=$('am-mobile').value.replace(/\D/g,'').slice(-10),t=+$('am-total').value,p=+$('am-paid').value||0,err='';
if(!name)err='Enter the member name.';else if(mob.length<10)err='Enter a valid 10 digit mobile number.';
else if(!/^\d{4,6}$/.test($('am-pin').value))err='Set a 4 to 6 digit PIN for the member.';
else if(M.some(function(m){return m.mobile.replace(/\D/g,'').slice(-10)===mob}))err='This mobile number is already registered.';
else if(!startDate())err='Choose the start date.';else if(!(t>0))err='Enter the total amount.';else if(p<0||p>t)err='Amount paid cannot be more than the total.';else if(p>0&&!txDate())err='Choose the date of transaction.';
if(err){$('am-err').textContent=err;return}
var mo=+$('am-months').value;
var body={name:name,mobile:mob,pin:$('am-pin').value,terms:[{plan:$('am-plan').value,months:mo,start:iso(startDate()),at:iso(txDate()||startDate()),total:t}],pays:p>0?[{d:iso(txDate()),a:p,m:$('am-mode').value}]:[]};
var file=amFile,photoFailed=false,btn=$('am-form').querySelector('button[type=submit]');btn.disabled=true;
api('/api/admin/members',{method:'POST',body:body}).then(function(r){return file?uploadPhoto(r.id,file).catch(function(){photoFailed=true}):null}).then(function(){filter='all';q='';$('ad-q').value='';return loadMembers()}).then(function(){closeAM();view('members');toast('Member added: '+name+'. PIN: '+body.pin+(photoFailed?'. The photo could not be uploaded: open the member and upload it again.':''),photoFailed?15000:0)}).catch(function(e){$('am-err').textContent=e.message}).then(function(){btn.disabled=false})});
var rn=$('rn-modal');
function pd(id){var v=$(id).value;if(!v)return null;var p=v.split('-');return new Date(+p[0],p[1]-1,+p[2])}
function rnEnd(){return addM(pd('rn-start')||today,+$('rn-months').value)}
function rnStd(){return price[$('rn-plan').value][$('rn-months').value]}
function rnCalc(){$('rn-end').value=fmt(rnEnd());var t=+$('rn-total').value||0,p=+$('rn-paid').value||0,l=t-p;$('rn-left').value=l<0?'Check the amounts':l===0?'Cleared':rs(l);$('rn-hint').textContent='Standard price: '+rs(rnStd())+'. Change the total if you negotiated.'}
function rnPkg(){$('rn-total').value=rnStd();rnCalc()}
function openRN(){if(!cur||busy())return;var m=cur;$('rn-form').reset();$('rn-who').textContent=m.name+' \u00b7 current package ends '+fmt(m.exp);
$('rn-plan').value=m.plan;$('rn-months').value=String(m.months);$('rn-start').value=iso(m.exp>today?m.exp:today);$('rn-date').value=iso(today);$('rn-err').textContent='';rnPkg();rn.classList.add('open');$('rn-paid').focus()}
function closeRN(){rn.classList.remove('open');$('m-renew').focus()}
$('m-renew').addEventListener('click',openRN);
['rn-plan','rn-months'].forEach(function(i){$(i).addEventListener('change',rnPkg)});
['rn-total','rn-paid','rn-start'].forEach(function(i){$(i).addEventListener('input',rnCalc)});
$('rn-close').addEventListener('click',closeRN);$('rn-cancel').addEventListener('click',closeRN);
rn.addEventListener('click',function(e){if(e.target===rn)closeRN()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&rn.classList.contains('open'))closeRN()});
$('rn-form').addEventListener('submit',function(e){e.preventDefault();if(busy())return;var m=cur,t=+$('rn-total').value,p=+$('rn-paid').value||0,err='';
if(!pd('rn-start'))err='Choose the start date.';else if(!(t>0))err='Enter the total amount.';else if(p<0||p>t)err='Amount paid cannot be more than the total.';else if(p>0&&!pd('rn-date'))err='Choose the date of transaction.';
if(err){$('rn-err').textContent=err;return}
var ex=rnEnd();m.plan=$('rn-plan').value;m.months=+$('rn-months').value;m.cstart=pd('rn-start');m.exp=ex;m.left=Math.ceil((ex-today)/DAY);
m.terms.push({plan:$('rn-plan').value,months:+$('rn-months').value,start:pd('rn-start'),at:pd('rn-date')||pd('rn-start'),total:t});m.fee+=t;m.paid+=p;m.pend=m.fee-m.paid;if(p>0){m.pays.push({d:pd('rn-date'),a:p,m:$('rn-mode').value});m.pays.sort(function(a,b){return a.d-b.d})}
persist(m,'Membership renewed');rn.classList.remove('open');openM(M.indexOf(m));drawStats();drawList()});
var pp=$('pp-modal');
function ppCalc(){var p=+$('pp-paid').value||0,l=cur.pend-p;$('pp-left').value=l<0?'Check the amount':l===0?'Cleared':rs(l)}
function openPP(){if(!cur||cur.pend<=0||busy())return;var m=cur;$('pp-form').reset();$('pp-who').textContent=m.name+' \u00b7 pending '+rs(m.pend);
$('pp-total').value=rs(m.fee);$('pp-before').value=rs(m.paid);
$('pp-hist').innerHTML=m.pays.length?m.pays.map(function(p){return '<tr><td>'+fmt(p.d)+'</td><td>'+esc(p.m)+'</td><td class="r">'+rs(p.a)+'</td></tr>'}).join(''):'<tr><td colspan="3">No payments yet</td></tr>';
$('pp-date').value=iso(today);$('pp-err').textContent='';ppCalc();pp.classList.add('open');$('pp-paid').focus()}
function closePP(){pp.classList.remove('open');$('m-paybtn').focus()}
$('m-paybtn').addEventListener('click',openPP);
$('pp-paid').addEventListener('input',ppCalc);
$('pp-close').addEventListener('click',closePP);$('pp-cancel').addEventListener('click',closePP);
pp.addEventListener('click',function(e){if(e.target===pp)closePP()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&pp.classList.contains('open'))closePP()});
$('pp-form').addEventListener('submit',function(e){e.preventDefault();if(busy())return;var m=cur,p=+$('pp-paid').value,err='';
if(!(p>0))err='Enter the amount paid.';else if(p>m.pend)err='Amount paid cannot be more than the amount left ('+rs(m.pend)+').';else if(!pd('pp-date'))err='Choose the date of transaction.';
if(err){$('pp-err').textContent=err;return}
m.paid+=p;m.pend=m.fee-m.paid;m.pays.push({d:pd('pp-date'),a:p,m:$('pp-mode').value});m.pays.sort(function(a,b){return a.d-b.d});
persist(m,'Payment added');pp.classList.remove('open');openM(M.indexOf(m));drawStats();drawList()});
var ed=$('ed-modal'),ep=[],et=[],MODES=['Cash','UPI','Card'];
function edCalc(){var fee=et.reduce(function(x,t){return x+(+t.total||0)},0),paid=ep.reduce(function(x,p){return x+(+p.a||0)},0),l=fee-paid;
$('ed-fee').value=rs(fee);$('ed-paid').value=rs(paid);$('ed-left').value=l<0?'Check the amounts':l===0?'Cleared':rs(l)}
function edEnds(t){var s=t.start?toD(t.start):null;return 'Ends '+(s&&!isNaN(s)?fmt(addM(s,+t.months)):'-')}
function edTerms(){$('ed-terms').innerHTML=et.map(function(t,i){
return '<div class="prow trow" data-t="'+i+'"><select data-k="plan" aria-label="Package type">'+['Open','Coached'].map(function(x){return '<option'+(x===t.plan?' selected':'')+'>'+x+'</option>'}).join('')+'</select><select data-k="months" aria-label="Duration">'+[1,3,6,12].map(function(x){return '<option value="'+x+'"'+(x===+t.months?' selected':'')+'>'+x+' mo</option>'}).join('')+'</select><input type="date" data-k="start" value="'+esc(t.start)+'" aria-label="Start date"><input type="number" min="0" step="1" data-k="total" value="'+esc(t.total)+'" aria-label="Total fee"><button type="button" data-delt="'+i+'" aria-label="Remove package"'+(et.length<2?' disabled':'')+'>&times;</button><small>'+edEnds(t)+'</small></div>'}).join('')}
function edRows(){$('ed-pays').innerHTML=ep.length?ep.map(function(p,i){var ms=MODES.slice();if(ms.indexOf(p.m)<0)ms.push(p.m);
return '<div class="prow"><input type="date" data-i="'+i+'" data-k="d" value="'+esc(p.d)+'" aria-label="Payment date"><select data-i="'+i+'" data-k="m" aria-label="Payment mode">'+ms.map(function(x){return '<option'+(x===p.m?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select><input type="number" min="0" step="1" data-i="'+i+'" data-k="a" value="'+esc(p.a)+'" aria-label="Amount paid"><button type="button" data-del="'+i+'" aria-label="Remove payment">&times;</button></div>'}).join(''):'<p class="fhint" style="margin:0 0 8px">No payments recorded.</p>'}
function openED(){if(!cur||busy())return;var m=cur;ep=m.pays.map(function(p){return{id:p.id,d:iso(p.d),a:p.a,m:p.m}});
et=m.terms.map(function(t){return{id:t.id,plan:t.plan,months:+t.months,start:iso(t.start),at:iso(t.at||t.start),total:t.total}});
$('ed-name').value=m.name;$('ed-mobile').value=m.mobile.replace(/\D/g,'').slice(-10);$('ed-pin').value='';
document.querySelector('label[for=ed-pin]').textContent=m.hasPin?'New PIN (leave empty to keep)':'No PIN set yet: enter a PIN so the member can log in';$('ed-err').textContent='';
edTerms();edRows();edCalc();ed.classList.add('open');$('ed-name').focus()}
function closeED(){ed.classList.remove('open');$('m-edit').focus()}
$('m-edit').addEventListener('click',openED);
function edTerm(e){var r=e.target.closest('[data-t]');if(!r||!e.target.dataset.k)return;var t=et[+r.dataset.t];t[e.target.dataset.k]=e.target.dataset.k==='plan'?e.target.value:e.target.value;r.querySelector('small').textContent=edEnds(t);edCalc()}
$('ed-terms').addEventListener('input',edTerm);$('ed-terms').addEventListener('change',edTerm);
$('ed-terms').addEventListener('click',function(e){var b=e.target.closest('[data-delt]');if(!b||et.length<2)return;et.splice(+b.dataset.delt,1);edTerms();edCalc()});
function edPay(e){var t=e.target,i=t.dataset.i;if(i===undefined)return;ep[+i][t.dataset.k]=t.value;edCalc()}
$('ed-pays').addEventListener('input',edPay);$('ed-pays').addEventListener('change',edPay);
$('ed-pays').addEventListener('click',function(e){var b=e.target.closest('[data-del]');if(!b)return;ep.splice(+b.dataset.del,1);edRows();edCalc()});
$('ed-close').addEventListener('click',closeED);$('ed-cancel').addEventListener('click',closeED);
ed.addEventListener('click',function(e){if(e.target===ed)closeED()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ed.classList.contains('open'))closeED()});
$('ed-delm').addEventListener('click',function(){var m=cur;if(!m||!confirm('Delete '+m.name+' and all their packages and payments? This cannot be undone.'))return;
api('/api/admin/members/'+m.id,{method:'DELETE'}).then(function(){ed.classList.remove('open');mod.classList.remove('open');cur=null;return loadMembers()}).then(function(){toast('Member deleted')}).catch(function(e){toast(e.message)})});
$('m-delphoto').addEventListener('click',function(){var m=cur;if(!m||!m.photo)return;api('/api/admin/members/'+m.id+'/photo',{method:'DELETE'}).then(function(){m.photo=null;$('m-photo').innerHTML=av(m);$('m-delphoto').style.display='none';drawList();toast('Photo removed')}).catch(function(e){toast(e.message)})});
$('ed-form').addEventListener('submit',function(e){e.preventDefault();if(busy())return;var m=cur,name=$('ed-name').value.trim(),mob=$('ed-mobile').value.replace(/\D/g,'').slice(-10),err='';
var fee=et.reduce(function(x,t){return x+(+t.total||0)},0),paid=ep.reduce(function(x,p){return x+(+p.a||0)},0);
if(!name)err='Enter the member name.';else if(mob.length<10)err='Enter a valid 10 digit mobile number.';
else if($('ed-pin').value&&!/^\d{4,6}$/.test($('ed-pin').value))err='PIN must be 4 to 6 digits.';
else if(M.some(function(o){return o!==m&&o.mobile.replace(/\D/g,'').slice(-10)===mob}))err='This mobile number is already registered.';
else if(!et.length)err='At least one package is required.';
else if(et.some(function(t){return !t.start||!(+t.total>0)}))err='Each package needs a start date and a fee above 0.';
else if(ep.some(function(p){return !(+p.a>0)||!p.d}))err='Each payment needs an amount and a date.';
else if(paid>fee)err='Total paid cannot be more than the total fee.';
if(err){$('ed-err').textContent=err;return}
m.name=name;m.newPin=$('ed-pin').value;if(m.newPin){m.hasPin=true;m.pinStored=true}m.mobile='+91 '+mob.slice(0,5)+' '+mob.slice(5);
m.terms=et.map(function(t){return{id:t.id,plan:t.plan,months:+t.months,start:toD(t.start),at:toD(t.at||t.start),total:+t.total}}).sort(function(a,b){return a.start-b.start});
var c=m.terms[m.terms.length-1];m.plan=c.plan;m.months=c.months;m.exp=addM(c.start,c.months);m.left=Math.ceil((m.exp-today)/DAY);m.join=m.terms[0].start;m.cstart=m.terms.length>1?c.start:undefined;m.fee=fee;
m.pays=ep.map(function(p){var q=p.d.split('-');return{id:p.id,d:new Date(+q[0],q[1]-1,+q[2]),a:+p.a,m:p.m}}).sort(function(a,b){return a.d-b.d});
m.paid=paid;m.pend=fee-paid;persist(m,'Member updated');ed.classList.remove('open');openM(M.indexOf(m));drawStats();drawList()});
var lo=document.querySelector('.ad-out');if(lo)lo.addEventListener('click',function(){fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});M=[];drawChips();drawList();drawStats()});
if(location.hash==='#admin')window.loadAdmin().catch(function(){location.hash='#login'});
drawChips();drawList();
window.addEventListener('hashchange',function(){var h=location.hash;
if(h!=='#member'&&window.__mem){window.__mem=null;['mp-first','mp-name','mp-mobile','mp-av','mp-pkg','mp-join','mp-exp'].forEach(function(i){$(i).textContent=''});$('mp-days').textContent='0';$('mp-dlabel').textContent='days left';$('mp-explbl').textContent='Expires';$('mp-plan').classList.remove('lapsed');$('mp-note').textContent='To renew or pay, visit the front desk.'}
if(h==='#member'&&!window.__mem)location.replace('#login');
if(h!=='#admin'&&adminOn){adminOn=false;var keep=false;try{keep=localStorage.getItem('lbRemember')==='admin'}catch(e){}if(!keep)fetch('/api/admin/logout',{method:'POST',credentials:'same-origin'});M=[];cur=null;drawChips();drawList();drawStats()}
if(h==='#admin'&&!adminOn)window.loadAdmin().catch(function(){location.replace('#login')})});
document.addEventListener('keydown',function(e){if(e.key!=='Tab')return;var top=['ph-modal','up-modal','ed-modal','pp-modal','rn-modal','am-modal','ad-modal'].map($).find(function(x){return x.classList.contains('open')});if(!top)return;
var f=[].filter.call(top.querySelectorAll('button,input,select,textarea,a[href]'),function(x){return !x.disabled&&!x.readOnly&&!x.hidden&&x.type!=='hidden'&&x.style.display!=='none'&&x.type!=='file'});if(!f.length)return;
var first=f[0],last=f[f.length-1];if(!top.contains(document.activeElement)){e.preventDefault();first.focus()}else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
document.querySelectorAll('[role=tablist]').forEach(function(l){l.addEventListener('keydown',function(e){var t=[].slice.call(l.querySelectorAll('[role=tab]')),i=t.indexOf(document.activeElement);if(i<0)return;var n={ArrowRight:(i+1)%t.length,ArrowLeft:(i+t.length-1)%t.length,Home:0,End:t.length-1}[e.key];if(n===undefined)return;e.preventDefault();t[n].focus();t[n].click()})});
setInterval(function(){var n=new Date();n.setHours(0,0,0,0);if(+n===+today)return;today=n;
if(window.__mem)window.showMember(window.__mem);
if(adminOn&&!saving)loadMembers().then(function(){refreshCur(['rn-modal','pp-modal','ed-modal','am-modal'].some(function(i){return $(i).classList.contains('open')}))}).catch(function(){})},60000);
})();
(function(){var cm=document.getElementById('coach-modal');if(!cm)return;var $=function(i){return document.getElementById(i)},opener=null,cards=document.querySelectorAll('.pcard');
// real photos are optional: drop rohan.jpg, aisha.jpg, dev.jpg, nisha.jpg into public/img/coaches/
cards.forEach(function(c){if(!c.dataset.photo)return;var im=new Image();im.alt='';im.onload=function(){c.querySelector('.ph').appendChild(im)};im.src=c.dataset.photo});
function open(c){var ph=c.querySelector('.ph'),big=$('cm-ph'),old=big.querySelector('img'),img=ph.querySelector('img');if(old)old.remove();
big.style.setProperty('--g',ph.style.getPropertyValue('--g'));big.querySelector('span').textContent=ph.querySelector('span').textContent;
if(img){var n=new Image();n.alt='';n.src=img.src;big.appendChild(n)}
var first=c.querySelector('h3').textContent;$('cm-name').textContent=first;$('cm-role').textContent=c.querySelector('.role').textContent;$('cm-bio').textContent=c.dataset.bio||'';
var tg=$('cm-tags');tg.textContent='';(c.dataset.tags||'').split(',').forEach(function(x){if(!x)return;var s=document.createElement('span');s.textContent=x;tg.appendChild(s)});$('cm-note').textContent='Want to train with '+first.split(' ')[0]+'? Ask at the front desk.';
opener=c;cm.classList.add('open');document.body.classList.add('cm-open');$('cm-x').focus()}
function close(){if(!cm.classList.contains('open'))return;cm.classList.remove('open');document.body.classList.remove('cm-open');if(opener)opener.focus()}
cards.forEach(function(c){c.addEventListener('click',function(){open(c)});c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(c)}})});
$('cm-x').addEventListener('click',close);cm.addEventListener('click',function(e){if(e.target===cm)close()});
document.addEventListener('keydown',function(e){if(!cm.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();$('cm-x').focus()}});
})();

(function(){var gm=document.getElementById('gl-modal'),tiles=document.querySelectorAll('.gal div[data-src]');if(!gm||!tiles.length)return;
var img=document.getElementById('gl-img'),cap=document.getElementById('gl-cap'),x=document.getElementById('gl-x'),opener=null;
function open(t){img.src=t.dataset.src;img.alt=t.textContent.trim();cap.textContent=t.textContent.trim();opener=t;gm.classList.add('open');document.body.classList.add('cm-open');x.focus()}
function close(){if(!gm.classList.contains('open'))return;gm.classList.remove('open');document.body.classList.remove('cm-open');img.removeAttribute('src');if(opener)opener.focus()}
tiles.forEach(function(t){t.addEventListener('click',function(){open(t)});t.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(t)}})});
x.addEventListener('click',close);gm.addEventListener('click',function(e){if(e.target!==img)close()});
document.addEventListener('keydown',function(e){if(!gm.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='Tab'){e.preventDefault();x.focus()}});
})();

(function(){var KEY='lbRemember',busy=false;
function flag(){try{return localStorage.getItem(KEY)}catch(e){return null}}
function clear(){try{localStorage.removeItem(KEY)}catch(e){}}
// Remembered visitors go straight in when they open the login page.
function restore(){var f=flag();if(!f||busy||location.hash!=='#login')return;busy=true;
var p=f==='admin'?window.loadAdmin().then(function(){location.hash='#admin'}):fetch('/api/member/me',{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('no');return r.json()}).then(function(j){window.showMember(j);location.hash='#member'});
p.catch(function(){clear()}).then(function(){busy=false})}
var mo=document.querySelector('.mp-out'),ao=document.querySelector('.ad-out');
if(mo)mo.addEventListener('click',function(){clear();fetch('/api/member/logout',{method:'POST',credentials:'same-origin'})});
if(ao)ao.addEventListener('click',clear);
window.addEventListener('hashchange',restore);restore();
})();
