(() => {
  'use strict';
  const data = window.ATLAS_RESOURCES;
  const find = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, character =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);
  const fold = value => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  const resources = [...data.resources].sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
  const resourceById = new Map(resources.map(resource => [resource.id, resource]));
  const searchText = new Map(resources.map(resource =>
    [resource.id, fold([resource.name, resource.id, ...resource.aliases].join(' '))]));
  const scenarios = Object.entries(data.scenarios);
  const search = find('#resourceSearch');
  const scenarioSelect = find('#resourceScenario');
  const list = find('#resourceList');
  const detail = find('#resourceDetail');
  const toast = find('#resourceToast');
  const params = new URLSearchParams(location.search);
  let selected = resourceById.get(params.get('kaynak')) ?? resourceById.get('coal') ?? resources[0];
  const requestedYear = params.get('senaryo');
  let year = scenarios.some(([id]) => id === requestedYear) ? requestedYear : scenarios[0][0];
  let toastTimer;

  search.value = params.get('q') ?? '';
  for (const [id] of scenarios) scenarioSelect.add(new Option(id, id));
  scenarioSelect.value = year;

  function updateUrl() {
    const url = new URL(location.href);
    const query = search.value.trim();
    if (query) url.searchParams.set('q', query);
    else url.searchParams.delete('q');
    url.searchParams.set('kaynak', selected.id);
    if (year !== scenarios[0][0]) url.searchParams.set('senaryo', year);
    else url.searchParams.delete('senaryo');
    history.replaceState(null, '', url);
  }

  function example(title, message, value, file = '') {
    return `<section class="resource-example">
      <h3>${title}</h3>
      ${file ? `<p class="resource-path"><code>${escape(file)}</code></p>` : ''}
      <p>${message}</p>
      <div class="code-label"><span class="small-cap">JSON</span>
        <button type="button" data-copy-example aria-label="${escape(title)} JSON örneğini kopyala">Kopyala</button>
      </div>
      <pre class="code-box"><code>${escape(JSON.stringify(value, null, 2))}</code></pre>
    </section>`;
  }

  function renderDetail() {
    const {id, name, uses, scenarios: coverage} = selected;
    const scenario = data.scenarios[year];
    const current = coverage[year];
    const province = current.exampleProvince ?? scenario.exampleProvince;
    const folder = `Data/Economy/${scenario.folder}`;
    const isFood = id === data.food;
    const modifier = isFood ? 'grain_resource_efficiency' : 'resource_efficiency';
    const modifierText = isFood
      ? 'Çiftlik çıktısı ve nüfusun geçimlik üretimi dahil ülkenin gıda üretimini artırır.'
      : 'Ülkenin gıda dışındaki bütün kaynaklarının çıkarımını artırır.';
    const resourceNotes = {
      steel: 'Demir-çelik madeni oyunda doğrudan çelik verir. Demir cevheri araştırmasını bu kaynak kimliğiyle eşleştir.',
      aluminium: 'Boksit madeni, oyunda alüminyum kaynağı üretir.',
      rubber: 'Başlangıç yatağı bulunmayan senaryoda da stok, ticaret veya yazarın eklediği yatak yoluyla kullanılabilir.',
    };
    const note = isFood ? 'Gıda, nüfus ve silah altındaki askerler tarafından tüketilir.'
      : id === data.fuel ? 'Petrol, yakıt kullanan kara birliklerinin yakıt kaynağıdır.' : resourceNotes[id];
    const extractors = current.extractors.map(building =>
      `${escape(building.name)} (<code>${escape(building.id)}</code>)`).join(', ');
    const coverageRows = scenarios.map(([id]) => {
      const row = coverage[id];
      return `<tr><th scope="row">${escape(id)}</th><td>${row.deposit ? 'Var' : 'Yok'}</td>
        <td>${row.startStock ? 'Var' : 'Yok'}</td></tr>`;
    }).join('');
    detail.innerHTML = `
      <div class="resource-title-row"><h2 id="resourceTitle">${escape(name)}</h2><code>${escape(id)}</code></div>
      ${note ? `<p>${escape(note)}</p>` : ''}
      ${uses.length ? `<p><strong>Teçhizat girdisi örnekleri</strong> · ${escape(uses.slice(0, 5).join(', '))}</p>` : ''}
      ${extractors ? `<p><strong>Çıkarım tesisi (${escape(year)})</strong> · ${extractors}</p>` : ''}
      <table class="resource-coverage" aria-label="Vanilla başlangıç verisi">
        <thead><tr><th scope="col">Senaryo</th><th scope="col">Haritada başlangıç yatağı</th>
          <th scope="col">En az bir ülkenin başlangıç stoku</th></tr></thead>
        <tbody>${coverageRows}</tbody>
      </table>
      <h3>${escape(year)} · Yazım örnekleri</h3>
      <p>Dosya yolları <code>Assets/StreamingAssets</code> altından başlar. Örnek miktarları ve province kimliğini kendi içeriğine göre değiştir.</p>
      <div class="resource-examples">
        ${example('Ülkeye başlangıç stoku', 'İlgili ülkenin <code>resourceStocks</code> listesine kaynağı ekle veya mevcut satırın miktarını güncelle. Örnek 25 stok birimi tanımlar.',
          {resourceStocks: [{resource: id, amount: 25}]}, `${folder}/countries.json`)}
        ${example('Haritaya başlangıç yatağı', '<code>deposits</code> listesinde kalıcı kara kimliği ve kaynak eşleşiyorsa miktarı düzenle, yoksa yeni satır ekle. <code>amount</code> günlük çıkarım tavanıdır. Tesisi ayrıca kur veya <code>factories.json</code> üzerinden başlangıca ekle.',
          {province, resource: id, amount: 5, placement: 'author_defined'}, `${folder}/deposits.json`)}
        ${example('Oyun sırasında stok ver', 'Komutu ödül ya da etki listesine ekle. Bu komutta <code>100</code> bir stok birimidir. Örnek, depoda yer varsa 25 birim ekler.',
          {add_resource: {resource: id, amount: 2500}})}
        ${example('Oyun sırasında yatak büyüt', 'Ülkenin sahip olduğu kara province’inin günlük çıkarım tavanına 5 birim ekler. Yalnız Bölge kimliğiyle yazmak için <code>add_deposit</code> kullanılır.',
          {add_province_deposit: {province, resource: id, amount: 5}})}
        ${example('Çıkarım modifierı · 1933', `${modifierText} <a href="./#${modifier}">Modifier kartını aç ↗</a>`,
          {dynamic: true, modifiers: [{key: modifier, bp: 500}]})}
      </div>
      <p><a href="bolgeler.html">1933 Bölge listesinde province kimliğini bul ↗</a></p>`;
  }

  function updateSelection() {
    for (const button of list.querySelectorAll('[data-resource]')) {
      button.setAttribute('aria-pressed', String(button.dataset.resource === selected.id));
    }
    renderDetail();
    updateUrl();
  }

  function renderList() {
    const words = fold(search.value.trim()).split(/\s+/).filter(Boolean);
    const matches = resources.filter(resource => words.every(word => searchText.get(resource.id).includes(word)));
    list.innerHTML = matches.map(resource =>
      `<button type="button" class="resource-option" data-resource="${escape(resource.id)}">
        <strong>${escape(resource.name)}</strong><code>${escape(resource.id)}</code>
      </button>`).join('');
    find('#resourceEmpty').hidden = matches.length > 0;
    detail.hidden = matches.length === 0;
    if (matches.length && !matches.includes(selected)) selected = matches[0];
    if (matches.length) updateSelection();
    else updateUrl();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-resource]');
    if (!button) return;
    selected = resourceById.get(button.dataset.resource);
    updateSelection();
  });
  search.addEventListener('input', renderList);
  scenarioSelect.addEventListener('change', () => {
    year = scenarioSelect.value;
    if (!detail.hidden) renderDetail();
    updateUrl();
  });
  detail.addEventListener('click', async event => {
    const button = event.target.closest('[data-copy-example]');
    if (!button) return;
    const code = button.closest('.resource-example').querySelector('.code-box code');
    try {
      await navigator.clipboard.writeText(code.textContent);
      showToast('JSON panoya kopyalandı.');
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(range);
      showToast('JSON seçildi. Kopyalama kısayolunu kullan.');
    }
  });
  renderList();
})();
