(() => {
  'use strict';
  const entries = window.ATLAS_DATA.entries;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fold = value => String(value).toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  const icons = {
    all:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    politics:'<path d="m3 8 9-5 9 5M4 10h16M4 20h16M6 10v7m6-7v7m6-7v7M3 22h18"/>',
    economy:'<path d="M3 21V11l6 3V9l6 3V5h5v16ZM7 18h1m3 0h1m3 0h1"/>',
    manpower:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m3 11v-3a6 6 0 0 0-2-4"/>',
    diplomacy:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/>',
    army:'<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6Zm-4 9 3 3 5-6"/>',
    research:'<path d="M9 3h6m-5 0v7L4 20v1h16v-1l-6-10V3M7 16h10m-6-3 2 2"/>',
    war:'<path d="m5 3 14 14m-2-14L3 17m2-4-4 4 6 6 4-4m8-6 4 4-6 6-4-4M3 3l4 1-3 3Zm18 0-1 4-3-3Z"/>',
    regional:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    doctrine:'<path d="M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3ZM12 6v16M6 8h3m-3 4h3m6-4h3m-3 4h3"/>',
  };
  const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.all}</svg>`;
  const categories = [
    {id:'all',name:'Bütün etkiler',color:'#687359'},
    {id:'politics',name:'Siyaset & iç yönetim',color:'#8c3033'},
    {id:'economy',name:'Ekonomi & inşaat',color:'#8d8054'},
    {id:'manpower',name:'İnsan gücü',color:'#768159'},
    {id:'diplomacy',name:'Diplomasi',color:'#557b88'},
    {id:'army',name:'Kuvvetler',color:'#687359'},
    {id:'doctrine',name:'Doktrin & uzmanlık',color:'#9c7b4f'},
    {id:'research',name:'Araştırma',color:'#7d6f91'},
    {id:'war',name:'Barış & kapitülasyon',color:'#a1875d'},
    {id:'regional',name:'Bölge değiştiricileri',color:'#8b7259'},
  ];
  const statusNames = {active:'Kullanılabilir',inactive:'Bağlantısız',system:'Sisteme özel'};
  const categoryDescriptions = {
    all:'Bütün benzersiz ülke ve Bölge değiştiricileri tek listede. Doktrinlerde de çalışan 43 anahtar kartta "Doktrin" etiketi taşır; detay penceresinde ülke, doktrin ve kurum okulu JSON formatları arasında geçiş yapılabilir.',
    politics:'Karar bedelleri, istikrar, otorite, ideoloji desteği ve iç yönetim.',
    economy:'Vergi, üretim, borçlanma ve inşaat hızlarını değiştiren etkiler.',
    manpower:'Askere alınabilir nüfus, seferberlik hızı ve silah altı yükü.',
    diplomacy:'Büyükelçilerin verimi ve diplomatik ilişki katkısı.',
    army:'Muharebe, planlama, deniz ve hava gücü; ikmal, teçhizat ve komuta.',
    doctrine:'Doktrinlerde ve kurum okullarında kabul edilen 43 anahtar. 43 anahtarın tamamı ülke tesiri, lider, danışman ve teknolojilerde de çalışır.',
    research:'Genel ve kategori araştırma hızları, bedeller ve araştırma yuvaları.',
    war:'Barış ve kapitülasyon için katalogda ayrılmış anahtarlar.',
    regional:'Ülke tesiri yerine hedef Bölgeye komutla uygulanan değiştiriciler.',
  };
  const groups = [{id:'all',name:'Tüm kuvvetler'},{id:'land',name:'Kara'},{id:'naval',name:'Deniz'},{id:'air',name:'Hava'},{id:'support',name:'İkmal & komuta'}];
  const params = new URLSearchParams(location.search);
  const state = {
    q:params.get('q') || '',
    category:categories.some(c=>c.id===params.get('kategori')) ? params.get('kategori') : 'all',
    status:['active','all','inactive','system'].includes(params.get('durum')) ? params.get('durum') : 'active',
    scenario:params.get('senaryo')==='1939' ? '1939' : 'all',
    group:groups.some(g=>g.id===params.get('alan')) ? params.get('alan') : 'all',
    unit:['ratio','points','count'].includes(params.get('olcek')) ? params.get('olcek') : 'all',
  };
  $('#searchIcon').innerHTML = svg('search');
  $('#searchInput').value = state.q;
  $('#scenarioSelect').value = state.scenario;
  $('#unitSelect').value = state.unit;
  let currentEntry = null;
  let currentFormat = 'dynamic';
  let currentSnippet = '';
  let bundleFormat = 'dynamic';
  const bundle = new Map();
  let toastTimer;

  const countryByKey = new Map(entries.filter(e=>e.scope==='country').map(e=>[e.id,e]));
  const idFor = entry => entry.scope==='state' ? `bolge-${entry.id}` : entry.scope==='doctrine' ? `doktrin-${entry.id}` : entry.id;
  const sourceLabel = entry => entry.scope==='doctrine'?'Doktrin':entry.scope==='state'?'Bölge':'Ülke';
  const categoryFor = entry => categories.find(c=>c.id===entry.category);
  const formatNumber = value => Number(value).toLocaleString('tr-TR',{maximumFractionDigits:2});
  const groupFor = entry => groups.find(g=>g.id===entry.group);
  const unitKind = entry => entry.unit==='Adet'?'count':entry.unit.startsWith('Puan')?'points':'ratio';
  const hasDoctrine = entry => entry.scope==='doctrine' || Boolean(entry.doctrineGroup);
  const searchIndex = new Map(entries.map(entry=>[idFor(entry),fold(`${entry.name} ${entry.id} ${entry.description} ${entry.doctrineDescription||''} ${sourceLabel(entry)} ${hasDoctrine(entry)?'doktrin':''} ${categoryFor(entry).name} ${groupFor(entry)?.name || ''} ${entry.unit} ${unitKind(entry)==='ratio'?'yüzde oran':''}`)]));
  let words=[];
  const categoryNav=$('#categoryNav');
  categoryNav.innerHTML=categories.map(c=>`${c.id==='regional'?'<div class="nav-divider"></div>':''}<button class="nav-category" data-category="${c.id}" aria-pressed="false"><span class="nav-icon">${svg(c.id)}</span><span class="nav-label">${c.name}</span><span class="nav-count"></span></button>`).join('');
  $('#armyFilters').innerHTML=groups.map(g=>`<button data-group="${g.id}" aria-pressed="false">${g.name}<b></b></button>`).join('');

  function matches(entry,{category=state.category,status=state.status,group=state.group}={}) {
    const scopeOk = category==='all' ? entry.scope!=='doctrine'
      : category==='regional' ? entry.scope==='state'
      : category==='doctrine' ? entry.scope==='doctrine'
      : entry.scope==='country' && entry.category===category;
    return scopeOk &&
      (status==='all'||entry.status===status) &&
      (state.scenario==='all'||entry.bookmark1939) &&
      (state.unit==='all'||entry.status!=='system'&&unitKind(entry)===state.unit) &&
      (!['army','doctrine'].includes(category)||group==='all'||entry.group===group) &&
      words.every(word=>searchIndex.get(idFor(entry)).includes(word));
  }

  function scaleHint(entry) {
    if(entry.scope==='state') return 'amount: 20 = +%20';
    if(entry.id==='night_attack') return '100 bp = cezada %1 azaltma';
    if(entry.unit==='Adet') return 'bp: 1 = +1 yuva';
    return entry.unit.startsWith('Puan')?'100 bp = +1 puan':'100 bp = +%1';
  }

  function defaultValue(entry) {
    if(entry.id==='night_attack') return 1000;
    if(entry.scope==='state') return entry.lowerIsBetter?-20:20;
    if(entry.unit==='Adet') return 1;
    if(entry.unit.startsWith('Puan/')) return entry.lowerIsBetter?-10:10;
    if(entry.id==='max_planning') return 1000;
    if(entry.unit==='Puan') return entry.lowerIsBetter?-100:100;
    return entry.lowerIsBetter?-500:500;
  }

  function valueLabel(entry,value) {
    const sign=value>0?'+':'−', amount=formatNumber(Math.abs(value)/(entry.scope==='state'||entry.unit==='Adet'?1:100));
    return entry.unit==='Adet'?`${sign}${amount} yuva`:entry.unit.startsWith('Puan')?`${sign}${amount} puan`:`${sign}%${amount}`;
  }

  function updateUrl() {
    const query = new URLSearchParams();
    if(state.q) query.set('q',state.q);
    if(state.category!=='all') query.set('kategori',state.category);
    if(state.status!=='active') query.set('durum',state.status);
    if(state.scenario!=='all') query.set('senaryo',state.scenario);
    if(state.unit!=='all') query.set('olcek',state.unit);
    if(['army','doctrine'].includes(state.category)&&state.group!=='all') query.set('alan',state.group);
    history.replaceState(null,'',location.pathname+(query.size?'?'+query:'')+location.hash);
  }

  function showToast(msg) {
    $('#toast').textContent=msg;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);
  }

  async function copy(text, customMessage='Panoya kopyalandı') {
    try {
      if(navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area=document.createElement('textarea');
        area.value=text; area.style.position='fixed'; area.style.opacity='0';
        const parent=$('#detailDialog').open?$('#detailDialog'):$('#bundleDialog').open?$('#bundleDialog'):document.body;
        parent.append(area); area.select();
        const success=document.execCommand('copy'); area.remove();
        if(!success) throw new Error('copy unavailable');
      }
      showToast(customMessage);
    } catch {
      showToast('Kopyalanamadı; kodu seçip elle kopyalayabilirsin.');
    }
  }

  function toggleBundleItem(key, customBp) {
    const ref = countryByKey.get(key) || entries.find(e=>e.id===key);
    if(!ref || ref.status!=='active' || ref.scope==='state') return;
    if(bundle.has(key) && customBp===undefined) {
      bundle.delete(key);
      showToast(`${key} paketten çıkarıldı`);
    } else {
      if(!bundle.has(key) && bundle.size>=16) {
        showToast('Bir kaynakta en fazla 16 farklı modifier bulunabilir.');
        return;
      }
      bundle.set(key, customBp!==undefined ? customBp : defaultValue(ref));
      if(customBp===undefined) showToast(`${key} pakete eklendi (${bundle.size}/16)`);
    }
    updateBundleUI();
    render();
    if(currentEntry && currentEntry.id===key && $('#toggleDetailBundle')) {
      const inB = bundle.has(key);
      $('#toggleDetailBundle').textContent = inB ? '✓ Paketten çıkar' : '+ Pakete ekle';
    }
  }

  function buildBundleJson() {
    const list = Array.from(bundle.entries()).map(([key,bp])=>({key,bp:Number(bp)}));
    if(bundleFormat==='bonuses') return JSON.stringify({bonuses:list},null,2);
    if(bundleFormat==='static') return JSON.stringify({modifiers:list},null,2);
    return JSON.stringify({dynamic:true,modifiers:list},null,2);
  }

  function updateBundleUI() {
    const count = bundle.size;
    $('#bundleBar').hidden = count===0;
    if(count===0) {
      if($('#bundleDialog').open) $('#bundleDialog').close();
      return;
    }
    $('#bundleCount').textContent = `${count} / 16`;
    const keys = Array.from(bundle.keys());
    const b1939 = keys.filter(k=>countryByKey.get(k)?.bookmark1939).length;
    const docCount = keys.filter(k=>countryByKey.get(k)?.doctrineGroup).length;
    $('#bundleSummary').textContent = `${keys.slice(0,3).join(', ')}${keys.length>3?` +${keys.length-3}`:''} · 1939: ${b1939}/${count}`;
    if($('#bundleDialog').open) renderBundleDialog();
  }

  function renderBundleDialog() {
    const keys = Array.from(bundle.keys());
    const b1939 = keys.filter(k=>countryByKey.get(k)?.bookmark1939).length;
    const docCount = keys.filter(k=>countryByKey.get(k)?.doctrineGroup).length;
    const rowsHtml = keys.map(key=>{
      const ref = countryByKey.get(key) || entries.find(e=>e.id===key);
      const bp = bundle.get(key);
      return `<div class="bundle-item" data-bundle-row="${esc(key)}"><div class="bundle-item-title"><strong>${esc(ref.name)}</strong><code>${esc(key)}${ref.bookmark1939?' · 1939':''}${ref.doctrineGroup?' · Doktrin':''}</code></div><input type="number" data-bundle-input="${esc(key)}" min="-10000" max="10000" step="${ref.step||1}" value="${bp}" aria-label="${esc(ref.name)} bp değeri"><span class="bundle-item-preview" data-bundle-preview="${esc(key)}">${valueLabel(ref,bp)}</span><button type="button" data-bundle-remove="${esc(key)}" aria-label="${esc(ref.name)} etkisini paketten çıkar" title="Çıkar">✕</button></div>`;
    }).join('');
    $('#bundleContent').innerHTML = `<h2 class="detail-title" id="bundleDialogTitle">Tesir & Doktrin Paketi (${bundle.size}/16)</h2><p class="detail-description">Seçtiğin modifierların değerlerini aşağıda düzenleyip tek bir JSON bloğu halinde kopyalayabilirsin.</p><div class="detail-facts"><div><span>1939 başlangıç tesiri uyumu</span><strong>${b1939} / ${bundle.size} anahtar destekleniyor</strong></div><div><span>Doktrin / kurum okulu uyumu</span><strong>${docCount} / ${bundle.size} anahtar doktrin uyumlu</strong></div></div><div class="bundle-list" id="bundleList">${rowsHtml}</div><div class="format-tabs" id="bundleFormatTabs" role="group" aria-label="Paket çıktı formatı"><button type="button" data-bformat="dynamic" class="${bundleFormat==='dynamic'?'active':''}">Ülke Tesiri (dynamic)</button><button type="button" data-bformat="static" class="${bundleFormat==='static'?'active':''}">Sabit Kaynak / Doktrin (modifiers)</button><button type="button" data-bformat="bonuses" class="${bundleFormat==='bonuses'?'active':''}">Kurum Okulu (bonuses)</button></div><div class="code-label"><span class="small-cap">BİRLEŞTİRİLMİŞ JSON ÇIKTISI</span><button type="button" id="copyBundleModal">Paketi kopyala</button></div><pre class="code-box" id="bundleCodeBox">${esc(buildBundleJson())}</pre><div class="dialog-actions"><button type="button" class="secondary-btn" id="clearBundleModal">Paketi boşalt</button><button type="button" id="doneBundleModal">Tamam</button></div>`;
    $('#bundleList').addEventListener('input',event=>{
      const input=event.target.closest('[data-bundle-input]');
      if(!input) return;
      const k=input.dataset.bundleInput;
      const ref=countryByKey.get(k);
      const val=Number(input.value);
      if(Number.isFinite(val)&&val!==0&&val>=-10000&&val<=10000) {
        bundle.set(k,val);
        const prev=$('#bundleList').querySelector(`[data-bundle-preview="${k}"]`);
        if(prev) prev.textContent=valueLabel(ref,val);
        $('#bundleCodeBox').textContent=buildBundleJson();
      }
    });
    $('#bundleList').addEventListener('click',event=>{
      const rm=event.target.closest('[data-bundle-remove]');
      if(rm) toggleBundleItem(rm.dataset.bundleRemove);
    });
    $('#bundleFormatTabs').addEventListener('click',event=>{
      const btn=event.target.closest('[data-bformat]');
      if(btn){bundleFormat=btn.dataset.bformat;renderBundleDialog();}
    });
    $('#copyBundleModal').addEventListener('click',()=>copy(buildBundleJson(),'Paket JSON olarak kopyalandı'));
    $('#clearBundleModal').addEventListener('click',()=>{bundle.clear();updateBundleUI();render();});
    $('#doneBundleModal').addEventListener('click',()=>$('#bundleDialog').close());
  }

  function render() {
    const category = categories.find(c=>c.id===state.category);
    words=fold(state.q).split(/\s+/).filter(Boolean);
    categoryNav.querySelectorAll('[data-category]').forEach(button=>{
      const selected=button.dataset.category===state.category;
      const amount=entries.filter(entry=>matches(entry,{category:button.dataset.category,group:'all'})).length;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
      button.querySelector('.nav-count').textContent=amount;
      button.classList.toggle('no-matches',amount===0);
    });
    const regional = state.category==='regional';
    document.querySelectorAll('button[data-status]').forEach(button=>{
      const status=button.dataset.status;
      const selected=state.status===status;
      button.classList.toggle('selected',selected);
      button.setAttribute('aria-pressed',selected);
      button.querySelector('b').textContent = entries.filter(entry=>matches(entry,{status})).length;
    });
    $('#armyFilters').hidden=!['army','doctrine'].includes(state.category);
    $('#armyFilters').querySelectorAll('[data-group]').forEach(button=>{
      const selected=button.dataset.group===state.group;
      button.hidden=state.category==='doctrine'&&button.dataset.group==='support';
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('selected',selected);
      button.querySelector('b').textContent=entries.filter(entry=>matches(entry,{category:state.category==='doctrine'?'doctrine':'army',group:button.dataset.group})).length;
    });
    const filtered=entries.filter(entry=>matches(entry));
    if(words.length) {
      const query=fold(state.q.trim());
      const rank=entry=>fold(entry.id)===query?4:fold(entry.name)===query?3:fold(entry.name).startsWith(query)?2:fold(entry.id).includes(query)?1:0;
      filtered.sort((a,b)=>rank(b)-rank(a));
    }
    $('#cards').innerHTML = filtered.map(entry=>{
      const c=categoryFor(entry);
      const inBundle = bundle.has(entry.id);
      const canBundle = entry.status==='active' && entry.scope!=='state';
      const showDoctrineBadge = entry.scope==='country' && entry.doctrineGroup;
      return `<article class="modifier-card ${inBundle?'in-bundle':''}" data-scope="${entry.scope}" data-status="${entry.status}" style="--category-color:${c.color}"><div class="card-top"><span class="card-category"><span class="card-icon">${svg(c.id)}</span>${sourceLabel(entry)} · ${esc(groupFor(entry)?.name || c.name)}</span><span class="badge ${entry.status==='active'?'':'badge-'+entry.status}">${entry.status==='active'?esc(entry.unit):statusNames[entry.status]}</span></div><button class="card-open" data-entry="${idFor(entry)}" aria-label="${esc(entry.name)} (${sourceLabel(entry)}) ayrıntısını aç"><h3>${esc(entry.name)}</h3><p class="card-description">${esc(entry.description)}</p></button><div class="card-key-row"><code class="card-key">${esc(entry.id)}</code>${canBundle?`<button type="button" class="key-bundle-button ${inBundle?'added':''}" data-bundle-key="${entry.id}" title="${inBundle?'Paketten çıkar':'Çoklu JSON paketine ekle'}">${inBundle?'✓ Pakette':'+ Paket'}</button>`:''}<button class="key-copy-button" data-copy-key="${entry.id}" aria-label="${entry.id} (${sourceLabel(entry)}) anahtarını kopyala" title="Anahtarı kopyala">${svg('copy')}</button></div><div class="card-bottom"><span class="scale-hint">${entry.status==='active'?scaleHint(entry):entry.status==='inactive'?'Mekanik bağlantısı yok':'Kıtlık gösterim anahtarı'}</span><button class="card-details" data-entry="${idFor(entry)}" aria-label="${esc(entry.name)} (${sourceLabel(entry)}) değer örneğini aç">${showDoctrineBadge?'<span class="bookmark-mark doctrine-mark">Doktrin</span>':''}${entry.bookmark1939?'<span class="bookmark-mark">1939 tesiri</span>':''}<span aria-hidden="true">↗</span></button></div></article>`;
    }).join('');
    $('#resultCount').textContent = `${filtered.length} tanım`;
    $('#emptyState').hidden = filtered.length>0;
    $('#currentCategory').textContent = category.name;
    $('#categoryDescription').textContent=categoryDescriptions[category.id];
    const otherStatuses=entries.filter(entry=>matches(entry,{status:'all'})).length;
    $('#emptyAllStatuses').hidden=filtered.length>0||otherStatuses===0||state.status==='all';
    $('#emptyHint').textContent=otherStatuses>0&&filtered.length===0?`Bu filtrelerde başka çalışma durumlarında ${otherStatuses} anahtar var.`:'Aramanı kısaltabilir, başka bir ölçek seçebilir veya filtreleri temizleyebilirsin.';
    let note='';
    if(state.scenario==='1939') note='1939 başlangıç tesirlerinde 55 anahtar desteklenir; bu liste seçili filtrelere göre daralır. Yalnız yazılı bp okunur; koşul, süre, yükseltme ve değişken hesabı uygulanmaz.';
    else if(regional) note='Bölge değiştiricileri add_state_modifier komutuyla uygulanır. Burada amount doğrudan yüzdedir: 20 = +%20. Ülke modifier listesindeki bp ölçeğiyle karıştırma.';
    else if(state.category==='doctrine') note='Bu 43 anahtar hem doktrin/kurum okullarında hem ülke modifier kaynaklarında (tesir, lider, danışman, teknoloji ve 1939 başlangıç tesiri) çalışır. İki kaynaktan gelen katkılar aynı mekanik kuralına göre toplanır.';
    else if(state.status==='inactive') note='Bu anahtarlar katalogda vardır; mevcut durumda yazılan bonusu oyunda uygulamaz. Çalışan bonus olarak kullanma.';
    else if(state.status==='system') note='Bu iki anahtar kıtlık sisteminin gösterim özetidir. Başka bir tesire yazmak nüfus veya istikrar etkisi uygulamaz.';
    $('#scopeNote').hidden = !note;
    $('#scopeNote').textContent = note;
    updateUrl();
  }

  function reset() {
    Object.assign(state,{q:'',category:'all',status:'active',scenario:'all',group:'all',unit:'all'});
    $('#searchInput').value=''; $('#scenarioSelect').value='all'; $('#unitSelect').value='all'; render();
  }

  function updateExample() {
    const entry=currentEntry;
    if(!entry||entry.status!=='active') return;
    const input=$('#bpInput');
    const value=Number(input.value);
    const step = (currentFormat==='doctrine'||entry.scope==='doctrine') ? (entry.step||1) : 1;
    const valid=input.value!==''&&Number.isFinite(value)&&value!==0&&value>=Number(input.min)&&value<=Number(input.max)&&(entry.scope==='state'||Number.isInteger(value)&&value%step===0);
    input.setAttribute('aria-invalid',String(!valid));
    $('#copySnippet').disabled=!valid;
    if(!valid) {
      $('#exampleResult').textContent='Geçerli bir değer gir';
      $('#exampleHint').textContent=entry.scope==='state'?'−90…1000; sıfırdan farklı':step===100?'−10000…10000; sıfırdan farklı, 100’ün katı':'−10000…10000; sıfırdan farklı tam sayı';
      $('#exampleCode').textContent=''; currentSnippet=''; return;
    }
    $('#exampleResult').textContent=valueLabel(entry,value);
    const period=entry.unit==='Puan/gün'?'Her oyun günü':entry.unit==='Puan/hafta'?'Her oyun haftası başında':entry.unit==='Puan/ay'?'Her ayın ilk gününde':entry.scope==='state'?'Bu Bölgedeki sonraki inşaatlar':entry.unit==='Adet'?'Kurallardaki yuva sınırları geçerli':entry.unit==='Puan'?'İlgili tavana / hedefe eklenir':'Mevcut değerin oran çarpanı';
    $('#exampleHint').textContent=entry.id==='night_attack'?'Gece cezasından kaldırılan pay':period;
    const example = entry.scope==='state'
      ? {add_state_modifier:{state:'erzurum',key:entry.id,amount:value}}
      : currentFormat==='bonuses'
      ? {bonuses:[{key:entry.id,bp:value}]}
      : currentFormat==='doctrine' || currentFormat==='static'
      ? {modifiers:[{key:entry.id,bp:value}]}
      : {dynamic:true,modifiers:[{key:entry.id,bp:value}]};
    currentSnippet=JSON.stringify(example,null,2);
    $('#exampleCode').textContent=currentSnippet;
  }

  function showDetail(entry,changeHash=true) {
    if(!entry) return;
    currentEntry=entry;
    currentFormat = entry.scope==='doctrine' ? 'doctrine' : 'dynamic';
    const c=categoryFor(entry);
    const docDomain = entry.doctrineGroup || (entry.scope==='doctrine'?entry.group:'');
    const docDomainLabel = docDomain ? groups.find(g=>g.id===docDomain)?.name : '';
    $('#detailEyebrow').textContent=`${sourceLabel(entry)} / ${groupFor(entry)?.name || c.name} / ${statusNames[entry.status]}`;
    const specialNote=entry.status==='inactive'?'Bu anahtarın mevcut oyunda mekanik bağlantısı yok. Bilgi kutusunda görünmesi, bonusu uyguladığı anlamına gelmez.':'Bu anahtar kıtlık sisteminin gösterim özetidir. Genel bir tesire eklemek istikrar veya nüfus etkisi uygulamaz.';
    const samplesHtml = entry.samples?.length
      ? `<div class="vanilla-samples"><span class="vanilla-samples-title">Oyundaki gerçek örnekler (Tıkla & uygula)</span><div class="vanilla-samples-list" id="vanillaSamplesList">${entry.samples.map(s=>`<button type="button" class="sample-chip" data-sample-bp="${s.bp}"><small>${esc(s.kind)}</small><span>${esc(s.label)}</span><b>${valueLabel(entry,s.bp)}</b></button>`).join('')}</div></div>`
      : '';
    const formatTabsHtml = entry.status==='active' && entry.scope!=='state'
      ? `<div class="format-tabs" id="detailFormatTabs" role="group" aria-label="JSON kaynak formatı"><button type="button" data-format="dynamic" class="${currentFormat==='dynamic'?'active':''}">Ülke Tesiri (dynamic)</button><button type="button" data-format="static" class="${currentFormat==='static'?'active':''}">Lider / Danışman / Teknoloji</button>${docDomain?`<button type="button" data-format="doctrine" class="${currentFormat==='doctrine'?'active':''}">Doktrin (${esc(docDomainLabel)})</button><button type="button" data-format="bonuses" class="${currentFormat==='bonuses'?'active':''}">Kurum Okulu (bonuses)</button>`:''}</div>`
      : '';
    const canBundle = entry.status==='active' && entry.scope!=='state';
    const inBundle = bundle.has(entry.id);
    $('#detailContent').innerHTML=`<h2 class="detail-title" id="detailTitle">${esc(entry.name)}</h2><div class="detail-key-row"><code>${esc(entry.id)}</code><button class="copy-key" id="copyKey">Anahtarı kopyala</button></div><p class="detail-description">${esc(entry.description)}</p>${entry.doctrineDescription && entry.scope==='country'?`<p class="detail-source"><strong>Doktrin (${esc(docDomainLabel)}) kullanımı:</strong> ${esc(entry.doctrineDescription)}</p>`:''}<div class="detail-facts"><div><span>Ölçek</span><strong>${esc(entry.unit)}</strong></div><div><span>Kullanım kapsamı</span><strong>${docDomain?`Ülke + ${esc(docDomainLabel)} doktrini`:'Ülke kaynakları'} · ${entry.bookmark1939?'1939 tesiri destekli':'1933 kampanyası'}</strong></div></div>${entry.status==='active'?`<div class="value-editor"><label for="bpInput">${entry.scope==='state'?'Yüzde değerini belirle':'bp değerini belirle'}<small>${scaleHint(entry)}</small></label><input id="bpInput" type="number" min="${entry.scope==='state'?-90:-10000}" max="${entry.scope==='state'?1000:10000}" step="${entry.scope==='state'?'any':entry.step||1}" value="${bundle.get(entry.id) ?? defaultValue(entry)}"></div>${samplesHtml}<div class="value-result"><span id="exampleHint"></span><strong id="exampleResult"></strong></div>${formatTabsHtml}<div class="code-label"><span class="small-cap">${entry.scope==='state'?'KOMUT ÖRNEĞİ':'KAYNAK TANIMINA EKLENECEK ALANLAR'}</span><button id="copySnippet">JSON'u kopyala</button></div><pre class="code-box" id="exampleCode"></pre><p class="detail-note" id="detailNote">${entry.scope==='state'?'erzurum yerine hedef Bölgenin kimliğini yaz. Değerler −%90…+%1000 aralığına sınırlanır; mevcut kuyruk yeniden hesaplanmaz.':'Kaynağı ayrıca ülkeye vermelisin. dynamic: true, komutla/değişkenle düzenlemeye izin verir. Aynı kaynakta en fazla 16 farklı modifier kullan.'}</p>`:`<p class="detail-alert">${specialNote}</p>`}<div class="dialog-actions">${canBundle?`<button type="button" class="secondary-btn" id="toggleDetailBundle">${inBundle?'✓ Paketten çıkar':'+ Pakete ekle'}</button>`:'<span></span>'}<button id="copyLink">Bu etkiye bağlantı kopyala ↗</button></div>`;
    $('#copyKey').addEventListener('click',()=>copy(entry.id));
    $('#copyLink').addEventListener('click',()=>copy(new URL('#'+idFor(entry),location.href).href));
    if(canBundle) {
      $('#toggleDetailBundle').addEventListener('click',()=>{
        const val = Number($('#bpInput')?.value) || defaultValue(entry);
        if(bundle.has(entry.id)) toggleBundleItem(entry.id);
        else toggleBundleItem(entry.id, val);
      });
    }
    if(entry.status==='active') {
      const presets=entry.scope==='state'?[-20,10,20]:entry.unit==='Adet'?[-1,1,2]:entry.step===100?[-100,100,500,1000]:entry.unit.startsWith('Puan')?[-10,10,100]:[-1000,-500,500,1000];
      $('.value-editor').insertAdjacentHTML('afterend',`<div class="value-presets" id="valuePresets" role="group" aria-label="Örnek değerler"><span>Hızlı örnek</span>${presets.map(value=>`<button type="button" data-value="${value}">${valueLabel(entry,value)}</button>`).join('')}</div>`);
      $('#valuePresets').addEventListener('click',event=>{
        const button=event.target.closest('[data-value]');
        if(button){$('#bpInput').value=button.dataset.value;updateExample();}
      });
      if($('#vanillaSamplesList')) {
        $('#vanillaSamplesList').addEventListener('click',event=>{
          const chip=event.target.closest('[data-sample-bp]');
          if(chip){$('#bpInput').value=chip.dataset.sampleBp;updateExample();}
        });
      }
      if($('#detailFormatTabs')) {
        $('#detailFormatTabs').addEventListener('click',event=>{
          const btn=event.target.closest('[data-format]');
          if(!btn) return;
          currentFormat=btn.dataset.format;
          $('#detailFormatTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===btn));
          if($('#detailNote')) {
            $('#detailNote').textContent = currentFormat==='doctrine'
              ? `Doktrin (${docDomainLabel}) tanımında kullanılır. Temel öğreti ve dal ödülü pozitif katkı ister; ülke ve doktrin katkıları toplanır.`
              : currentFormat==='bonuses'
              ? 'Kurum okulu (ministries/rules.json -> schools[].bonuses) tanımında kullanılır.'
              : 'Kaynağı ayrıca ülkeye vermelisin. dynamic: true, komutla/değişkenle düzenlemeye izin verir. Aynı kaynakta en fazla 16 farklı modifier kullan.';
          }
          updateExample();
        });
      }
      $('#bpInput').addEventListener('input',updateExample);
      $('#copySnippet').addEventListener('click',()=>currentSnippet&&copy(currentSnippet));
      updateExample();
    }
    if(changeHash) history.replaceState(null,'',location.pathname+location.search+'#'+idFor(entry));
    if(!$('#detailDialog').open) $('#detailDialog').showModal();
  }

  $('#categoryNav').addEventListener('click',event=>{
    const button=event.target.closest('[data-category]');
    if(!button) return;
    state.category=button.dataset.category;
    state.group='all';
    render();
  });
  $('#armyFilters').addEventListener('click',event=>{
    const button=event.target.closest('[data-group]');
    if(button){state.group=button.dataset.group;render();}
  });
  $('.status-tabs').addEventListener('click',event=>{
    const button=event.target.closest('button[data-status]');
    if(button){state.status=button.dataset.status;render();}
  });
  $('#searchInput').addEventListener('input',event=>{state.q=event.target.value;render();});
  $('#scenarioSelect').addEventListener('change',event=>{state.scenario=event.target.value;render();});
  $('#unitSelect').addEventListener('change',event=>{state.unit=event.target.value;render();});
  $('#resetFilters').addEventListener('click',reset);
  $('#emptyReset').addEventListener('click',reset);
  $('#emptyAllStatuses').addEventListener('click',()=>{state.status='all';render();});
  $('#cards').addEventListener('click',event=>{
    const bundleButton=event.target.closest('[data-bundle-key]');
    if(bundleButton){toggleBundleItem(bundleButton.dataset.bundleKey);return;}
    const keyButton=event.target.closest('[data-copy-key]');
    if(keyButton){copy(keyButton.dataset.copyKey);return;}
    const button=event.target.closest('[data-entry]');
    if(button) showDetail(entries.find(entry=>idFor(entry)===button.dataset.entry));
  });
  $('#openBundle').addEventListener('click',()=>{renderBundleDialog();$('#bundleDialog').showModal();});
  $('#copyBundleQuick').addEventListener('click',()=>copy(buildBundleJson(),'Paket JSON olarak kopyalandı'));
  $('#clearBundleQuick').addEventListener('click',()=>{bundle.clear();updateBundleUI();render();showToast('Paket temizlendi');});
  $('#closeDialog').addEventListener('click',()=>$('#detailDialog').close());
  $('#closeBundleDialog').addEventListener('click',()=>$('#bundleDialog').close());
  for(const dlg of [$('#detailDialog'),$('#bundleDialog')]) {
    dlg.addEventListener('click',event=>{if(event.target===dlg){const r=dlg.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dlg.close();}});
  }
  $('#detailDialog').addEventListener('close',()=>{history.replaceState(null,'',location.pathname+location.search);currentEntry=null;});
  document.addEventListener('keydown',event=>{const shortcut=(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k';if((shortcut||event.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))&&!$('#detailDialog').open&&!$('#bundleDialog').open){event.preventDefault();$('#searchInput').focus();}});
  window.addEventListener('hashchange',()=>{const entry=entries.find(e=>idFor(e)===location.hash.slice(1));if(entry)showDetail(entry,false);});
  render();
  const linked=entries.find(entry=>idFor(entry)===location.hash.slice(1));
  if(linked) showDetail(linked,false);
})();
