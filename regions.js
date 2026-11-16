(() => {
  'use strict';
  const data = window.REGION_DATA;
  const $ = id => document.getElementById(id);
  const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });
  const numberFormat = new Intl.NumberFormat('tr-TR');
  const PAGE = 150;

  const fold = text => String(text).toLocaleLowerCase('tr')
    .replace(/[çc]/g, 'c').replace(/[ğg]/g, 'g').replace(/[ıi]/g, 'i')
    .replace(/[öo]/g, 'o').replace(/[şs]/g, 's').replace(/[üu]/g, 'u').replace(/[_\s-]+/g, ' ');

  const countryName = tag => data.countryNames[tag] || tag;
  const buildingName = id => data.buildingNames[id] || id;
  const resourceName = id => data.resourceNames[id] || id;
  data.states.forEach((state, i) => { state.index = i + 1; });
  const stateById = new Map(data.states.map(s => [s.id, s]));
  const map = window.RegionMap;
  for (const state of data.states) {
    state.search = fold(`${state.name} ${state.id} ${state.owner} ${countryName(state.owner)}`);
    state.port = state.ports.length ? state.ports[0] : 0;
  }

  const view = { country: '', query: '', sort: 'name', dir: 1, limit: PAGE, selected: '', province: 0 };

  function readUrl() {
    const params = new URLSearchParams(location.search);
    const tag = (params.get('ulke') || '').toUpperCase();
    view.country = data.countries.some(c => c.tag === tag) ? tag : '';
    view.query = params.get('q') || '';
    const sort = params.get('sirala');
    if (['name', 'owner', 'population', 'capacity', 'port', 'rail'].includes(sort)) view.sort = sort;
    view.dir = params.get('yon') === 'azalan' ? -1 : 1;
    const selected = stateById.get(params.get('bolge') || '');
    view.selected = selected ? selected.id : '';
    if (selected && !view.country) view.country = selected.owner;
    view.province = selected ? Number(params.get('province')) || 0 : 0;
  }

  function writeUrl() {
    const params = new URLSearchParams();
    if (view.country) params.set('ulke', view.country);
    if (view.query) params.set('q', view.query);
    if (view.sort !== 'name') params.set('sirala', view.sort);
    if (view.dir < 0) params.set('yon', 'azalan');
    if (view.selected) params.set('bolge', view.selected);
    if (view.selected && view.province) params.set('province', view.province);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }

  function filtered() {
    const words = fold(view.query).split(' ').filter(Boolean);
    const rows = data.states.filter(s => (!view.country || s.owner === view.country) && words.every(w => s.search.includes(w)));
    const key = view.sort;
    rows.sort((a, b) => {
      let result;
      if (key === 'name') result = collator.compare(a.name, b.name);
      else if (key === 'owner') result = collator.compare(countryName(a.owner), countryName(b.owner)) || collator.compare(a.name, b.name);
      else result = (a[key] - b[key]) || collator.compare(a.name, b.name);
      return result * view.dir;
    });
    return rows;
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function list(items) {
    if (!items.length) return el('span', 'none', '—');
    const wrap = el('span', 'chips');
    for (const [label, value, title] of items) {
      const chip = el('span', 'chip');
      chip.append(el('span', '', label), el('b', '', value));
      if (title) chip.title = title;
      wrap.append(chip);
    }
    return wrap;
  }

  function row(state) {
    const tr = document.createElement('tr');
    tr.dataset.index = state.index;
    tr.id = `row-${state.id}`;
    if (state.id === view.selected) tr.className = 'selected';
    const name = el('td', 'col-name');
    const title = el('div', 'state-name', state.name);
    if (state.capital) title.append(el('span', 'capital-badge', 'Başkent'));
    const id = el('button', 'copy-id', state.id);
    id.type = 'button';
    id.title = 'Bölge kimliğini kopyala';
    id.dataset.copy = state.id;
    name.append(title, id);

    const owner = el('td', 'col-owner');
    const ownerButton = el('button', 'owner-link', countryName(state.owner));
    ownerButton.type = 'button';
    ownerButton.dataset.country = state.owner;
    ownerButton.title = `${state.owner} bölgelerini göster`;
    owner.append(ownerButton);

    const capacity = el('td', 'num');
    capacity.append(el('span', state.used >= state.capacity && state.capacity ? 'full' : '', `${state.used} / ${state.capacity}`));

    const buildings = el('td');
    buildings.append(list(Object.entries(state.buildings).map(([k, v]) => [buildingName(k), v, data.buildingCapacityUse[k] ? 'Kapasite kullanır' : 'Kapasite kullanmaz'])));
    const resources = el('td');
    resources.append(list(Object.entries(state.resources).map(([k, v]) => [resourceName(k), numberFormat.format(v), 'Günlük çıkarım sınırı'])));

    const port = el('td', 'num', state.ports.length ? String(state.port) : '—');
    if (state.ports.length > 1) port.append(el('small', '', ` (${state.ports.length} liman: ${state.ports.join(', ')})`));
    const rail = el('td', 'num', state.rail ? String(state.rail) : '—');

    const cores = el('td', 'col-cores');
    const coreLine = (label, tags) => {
      const line = el('div', 'core-line');
      line.append(el('span', 'core-label', label));
      if (!tags.length) line.append(el('span', 'none', '—'));
      for (const tag of tags) {
        const t = el('abbr', tag === state.owner ? 'tag own' : 'tag', tag);
        t.title = countryName(tag);
        line.append(t);
      }
      return line;
    };
    cores.append(coreLine('Ç', state.cores), coreLine('T', state.claims));
    cores.title = 'Ç: çekirdek (ana toprak) · T: talep';

    tr.append(name, owner, el('td', 'num', numberFormat.format(state.population)), capacity, buildings, resources, port, rail, cores);
    return tr;
  }

  function summary(rows) {
    const box = $('countrySummary');
    if (!view.country) { box.hidden = true; return; }
    const all = data.states.filter(s => s.owner === view.country);
    box.hidden = false;
    $('countryName').textContent = countryName(view.country);
    $('countryTag').textContent = view.country;
    const sum = key => all.reduce((total, s) => total + s[key], 0);
    const buildingTotals = {};
    for (const s of all) for (const [k, v] of Object.entries(s.buildings)) buildingTotals[k] = (buildingTotals[k] || 0) + v;
    const stats = [
      ['Bölge', String(all.length)],
      ['Nüfus', numberFormat.format(sum('population'))],
      ['Kapasite', `${sum('used')} / ${sum('capacity')}`],
      ['Bina', String(Object.values(buildingTotals).reduce((a, b) => a + b, 0))],
      ['Limanlı bölge', String(all.filter(s => s.ports.length).length)],
    ];
    const dl = $('summaryStats');
    dl.replaceChildren(...stats.map(([k, v]) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); return d; }));
    $('copyIds').textContent = rows.length === all.length ? 'Kimlikleri kopyala' : `Görünen ${rows.length} kimliği kopyala`;
  }

  function render() {
    const rows = filtered();
    document.body.classList.toggle('single-country', Boolean(view.country));
    $('resultCount').textContent = `${numberFormat.format(rows.length)} bölge`;
    const shown = rows.slice(0, view.limit);
    $('regionRows').replaceChildren(...shown.map(row));
    $('regionTable').hidden = !rows.length;
    $('emptyState').hidden = rows.length > 0;
    const more = rows.length - shown.length;
    $('moreRow').hidden = more <= 0;
    if (more > 0) $('showMore').textContent = `${numberFormat.format(Math.min(more, PAGE))} bölge daha göster (kalan ${numberFormat.format(more)})`;
    for (const button of document.querySelectorAll('[data-sort]')) {
      const active = button.dataset.sort === view.sort;
      button.closest('th').setAttribute('aria-sort', active ? (view.dir > 0 ? 'ascending' : 'descending') : 'none');
      button.dataset.dir = active ? (view.dir > 0 ? '↑' : '↓') : '';
    }
    summary(rows);
    writeUrl();
  }

  let toastTimer;
  function toast(text) {
    const node = $('toast');
    node.textContent = text;
    node.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('visible'), 1800);
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = Object.assign(document.createElement('textarea'), { value: text });
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* Nothing else to try. */ }
      area.remove();
    }
    toast(`${label} kopyalandı`);
  }

  const exportRows = () => filtered();
  const plainBuildings = s => Object.entries(s.buildings).map(([k, v]) => `${k}:${v}`).join(' ');
  const plainResources = s => Object.entries(s.resources).map(([k, v]) => `${k}:${v}`).join(' ');

  function exportJson(rows) {
    return JSON.stringify(rows.map(s => ({
      id: s.id, name: s.name, owner: s.owner, population: s.population,
      buildingCapacity: s.capacity, usedCapacity: s.used, buildings: s.buildings, resources: s.resources,
      ports: s.ports, railway: s.rail, cores: s.cores, claims: s.claims,
    })), null, 2);
  }

  function exportTable(rows) {
    const head = ['id', 'ad', 'sahip', 'nüfus', 'kapasite', 'dolu', 'binalar', 'kaynaklar', 'liman', 'demiryolu', 'çekirdek', 'talep'];
    const lines = rows.map(s => [s.id, s.name, s.owner, s.population, s.capacity, s.used, plainBuildings(s), plainResources(s), s.ports.join(' '), s.rail || '', s.cores.join(' '), s.claims.join(' ')].join('\t'));
    return [head.join('\t'), ...lines].join('\n');
  }

  function setCountry(tag, fit = true) {
    if (view.selected && stateById.get(view.selected).owner !== tag) selectState(null);
    view.country = tag;
    view.limit = PAGE;
    $('countrySelect').value = tag;
    map?.setCountry(tag, fit);
    render();
  }

  function selectState(state, fit = false) {
    if (!state || state.id !== view.selected) selectProvince(0);
    view.selected = state ? state.id : '';
    map?.select(state ? state.index : 0, fit);
    const card = $('mapCard');
    card.hidden = !state;
    if (!state) return;
    $('cardName').textContent = state.name;
    $('cardId').textContent = state.id;
    $('cardId').dataset.copy = state.id;
    const stats = [
      ['Sahip', `${countryName(state.owner)} · ${state.owner}`],
      ['Nüfus', numberFormat.format(state.population)],
      ['Kapasite', `${state.used} / ${state.capacity}`],
      ['Liman', state.ports.length ? String(state.port) : '—'],
      ['Demiryolu', state.rail ? String(state.rail) : '—'],
    ];
    $('cardStats').replaceChildren(...stats.map(([k, v]) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); return d; }));
  }

  // Province card: everything the generator knows about one province, by its stable id.
  function selectProvince(pid) {
    view.province = pid;
    map?.selectProvince(pid);
    const box = $('provinceBox');
    $('provinceHint').hidden = Boolean(pid);
    if (!$('provinceHint').classList.contains('province-error')) $('provinceHint').textContent = "Province'ler için bölgenin içine tıkla.";
    box.hidden = !pid;
    if (!pid) return;
    const row = map?.province(pid);
    if (!row) { box.hidden = true; return; }
    const extra = row[3] || {};
    $('provinceId').textContent = String(pid);
    $('provinceName').textContent = extra.s ? extra.s.join(', ') : `Province ${pid}`;
    const join = (obj, names, format = v => v) => Object.entries(obj || {}).map(([k, v]) => `${names[k] || k} ${format(v)}`).join(', ');
    const stats = [
      ['Arazi', map.terrain(row[1]) + (row[2] ? ' · kıyı' : '')],
      extra.c ? ['Başkent', 'Evet'] : null,
      extra.b ? ['Binalar', join(extra.b, data.buildingNames)] : null,
      extra.r ? ['Kaynaklar /gün', join(extra.r, data.resourceNames, v => numberFormat.format(v))] : null,
      extra.p ? ['Liman', String(extra.p)] : null,
      ['Demiryolu', extra.y ? String(extra.y) : '—'],
      extra.h ? ['İkmal merkezi', 'Var'] : null,
      extra.m ? ['Not', 'Haritada gösterilemeyecek kadar küçük'] : null,
    ].filter(Boolean);
    $('provinceStats').replaceChildren(...stats.map(([k, v]) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); return d; }));
  }

  // A failed province download stays visible instead of silently showing no provinces.
  function provinceError(error) {
    const hint = $('provinceHint');
    hint.hidden = false;
    hint.classList.add('province-error');
    hint.textContent = `Province verisi yüklenemedi (${error && error.message ? error.message : 'ağ hatası'}). Sayfayı Ctrl+F5 ile yenileyip bölgeyi yeniden seç.`;
  }

  function pickProvince(pid) {
    const row = map?.province(pid);
    if (!row) return;
    const state = data.states[row[0] - 1];
    if (state.id !== view.selected) pickFromMap(state);
    selectProvince(pid);
    writeUrl();
  }

  function pickFromMap(state) {
    if (state.owner !== view.country) setCountry(state.owner, false);
    selectState(state);
    render();
  }

  function showRow(state) {
    if (view.query && !filtered().includes(state)) { view.query = ''; $('searchInput').value = ''; }
    const rows = filtered();
    const at = rows.indexOf(state);
    if (at >= view.limit) view.limit = at + 1;
    render();
    const row = document.getElementById(`row-${state.id}`);
    if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 1400); }
  }

  function init() {
    if (!data) return;
    $('updated').textContent = data.updated;
    $('scenarioLabel').textContent = `${data.scenario} başlangıcı · ${data.scenarioLabel}`;
    $('totals').textContent = `${data.countries.length} ülke · ${numberFormat.format(data.states.length)} bölge`;
    $('edition').textContent = `${data.scenario} / ${data.updated.toLocaleUpperCase('tr')}`;
    $('footerNote').textContent = `${data.updated} · ${data.scenario} başlangıcı · ${data.countries.length} ülke, ${numberFormat.format(data.states.length)} bölge. Veriler oyunun harita, ekonomi, ikmal ve çekirdek dosyalarından üretilir. 1939 başlangıcının bölgeleri farklıdır; bu liste yalnız 1933 içindir.`;

    const select = $('countrySelect');
    const countries = [...data.countries].sort((a, b) => collator.compare(a.name, b.name));
    select.append(new Option(`Tüm ülkeler (${data.countries.length})`, ''));
    for (const c of countries) select.append(new Option(`${c.name} · ${c.tag} (${c.states})`, c.tag));

    readUrl();
    select.value = view.country;
    $('searchInput').value = view.query;

    select.addEventListener('change', () => setCountry(select.value));
    $('searchInput').addEventListener('input', event => { view.query = event.target.value; view.limit = PAGE; render(); });
    const reset = () => { view.query = ''; $('searchInput').value = ''; view.sort = 'name'; view.dir = 1; selectState(null); setCountry(''); };
    $('resetFilters').addEventListener('click', reset);
    $('emptyReset').addEventListener('click', reset);
    $('showMore').addEventListener('click', () => { view.limit += PAGE; render(); });
    document.querySelector('thead').addEventListener('click', event => {
      const button = event.target.closest('[data-sort]');
      if (!button) return;
      const key = button.dataset.sort;
      if (view.sort === key) view.dir = -view.dir;
      else { view.sort = key; view.dir = ['population', 'capacity', 'port', 'rail'].includes(key) ? -1 : 1; }
      render();
    });
    $('regionRows').addEventListener('click', event => {
      const target = event.target.closest('[data-copy],[data-country]');
      if (target) {
        if (target.dataset.copy) copy(target.dataset.copy, `“${target.dataset.copy}”`);
        else setCountry(target.dataset.country);
        return;
      }
      const row = event.target.closest('tr[data-index]');
      if (row) { selectState(data.states[row.dataset.index - 1], true); render(); }
    });
    $('regionRows').addEventListener('mouseover', event => {
      const row = event.target.closest('tr[data-index]');
      map?.setHover(row ? Number(row.dataset.index) : 0);
    });
    $('regionRows').addEventListener('mouseleave', () => map?.setHover(0));
    $('cardId').addEventListener('click', () => copy(view.selected, `“${view.selected}”`));
    $('cardClose').addEventListener('click', () => { selectState(null); render(); });
    $('cardRow').addEventListener('click', () => view.selected && showRow(stateById.get(view.selected)));
    $('provinceId').addEventListener('click', () => copy(String(view.province), `Province ${view.province}`));
    $('cardProvinces').addEventListener('click', async () => {
      const state = stateById.get(view.selected);
      if (!state || !map) return;
      try { await map.loadProvinces(); } catch { toast('Province verisi yüklenemedi'); return; }
      copy(JSON.stringify(map.stateProvinces(state.index)), `${state.name}: province kimlikleri`);
    });
    $('countryTag').addEventListener('click', () => copy(view.country, `“${view.country}”`));
    $('copyIds').addEventListener('click', () => copy(JSON.stringify(exportRows().map(s => s.id)), 'Bölge kimlikleri'));
    $('copyJson').addEventListener('click', () => copy(exportJson(exportRows()), 'JSON'));
    $('copyTable').addEventListener('click', () => copy(exportTable(exportRows()), 'Tablo'));
    document.addEventListener('keydown', event => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName);
      if (!typing && (event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'))) {
        event.preventDefault();
        $('searchInput').focus();
      }
    });
    render();
    map?.init(data, {
      src: 'regions-map.png?v=202611162200', provinceImage: 'regions-provinces.png?v=202611162200', provinceSrc: 'regions-provinces.json?v=202611162200',
      countryName, onSelect: pickFromMap, onProvince: pickProvince, onProvinceError: provinceError,
    });
    map?.setCountry(view.country, true);
    if (view.selected) {
      const wantedProvince = view.province;
      selectState(stateById.get(view.selected));
      if (wantedProvince) map?.loadProvinces().then(() => { selectProvince(wantedProvince); writeUrl(); }).catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
