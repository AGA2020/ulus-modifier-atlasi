(() => {
  'use strict';
  const data = window.ATLAS_AREAS;
  const find = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, character =>
    ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);
  const fold = value => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
  const percent = share => `%${Math.round(share * 100)}`;
  const roleLabel = {lead: 'Bakıyor', occasional: 'Ara sıra', top: 'En çok dokunan'};
  const date = value => value.split('-').reverse().join('.');

  const search = find('#areaSearch');
  const list = find('#areaList');
  const empty = find('#areaEmpty');
  const viewButtons = [...document.querySelectorAll('[data-view]')];
  const params = new URLSearchParams(location.search);
  let view = params.get('gorunum') === 'kisi' ? 'kisi' : 'alan';
  search.value = params.get('q') ?? '';

  const lead = data.thresholds.lead;
  const occasional = data.thresholds.occasional;
  find('#areaRule').textContent =
    `Son ${data.windowDays} günün commit'leri sayılır, yeni değişiklik daha ağırdır (${data.halfLifeDays} günde yarıya iner). ` +
    `Pay, değişen satırların ve commit sayısının ortalamasıdır. Payı ${percent(lead.share)} ve üstü olan ve en az ${lead.commits} commit'i bulunan kişi "bakıyor", ` +
    `${percent(occasional.share)}–${percent(lead.share)} arası "ara sıra" yazılır. Ortak dosyalar az, birleştirmeler ve toplu commit'ler hiç sayılmaz.`;
  find('#areaGenerated').textContent = `Güncelleme ${date(data.generated)} · ${data.commits} commit`;

  const areaText = new Map(data.areas.map(area => [area.id, fold([area.name, area.description, ...area.docs,
    ...area.design, ...area.people.map(person => person.name)].join(' '))]));

  const byPerson = new Map();
  for (const area of data.areas) {
    for (const person of area.people) {
      if (!byPerson.has(person.name)) byPerson.set(person.name, []);
      byPerson.get(person.name).push({area, person});
    }
  }
  const rank = {lead: 0, top: 1, occasional: 2};
  const people = [...byPerson.entries()].map(([name, entries]) => ({
    name,
    entries: entries.sort((a, b) => rank[a.person.role] - rank[b.person.role] || b.person.share - a.person.share),
  })).sort((a, b) => b.entries.filter(e => e.person.role === 'lead').length - a.entries.filter(e => e.person.role === 'lead').length
    || a.name.localeCompare(b.name, 'tr-TR'));

  function chip(person) {
    return `<li class="person-chip ${person.role}" title="${escape(`${roleLabel[person.role]} · ${percent(person.share)} pay · ${person.commits} commit · son ${date(person.last)}`)}">` +
      `<strong>${escape(person.name)}</strong><span>${percent(person.share)}</span></li>`;
  }

  function shareBar(area) {
    const segments = area.people.map(person =>
      `<i class="${person.role}" style="width:${(person.share * 100).toFixed(1)}%" title="${escape(`${person.name} ${percent(person.share)}`)}"></i>`).join('');
    return `<div class="share-bar" aria-hidden="true">${segments}</div>`;
  }

  function areaCard(area) {
    const main = area.people.filter(person => person.role !== 'occasional');
    const side = area.people.filter(person => person.role === 'occasional');
    const design = area.design.length
      ? `<p class="area-design"><span class="small-cap">Tasarım</span> ${area.design.map(escape).join(', ')}</p>` : '';
    const agent = area.unattributedShare >= 0.05
      ? `<span title="Bulut agent kimliğiyle gelen ve kişiye bağlanamayan değişikliklerin payı">Agent ${percent(area.unattributedShare)}</span>` : '';
    return `<article class="area-card" id="alan-${escape(area.id)}">
      <header><h2>${escape(area.name)}</h2><a class="area-anchor" href="#alan-${escape(area.id)}" aria-label="${escape(area.name)} bağlantısı">#</a></header>
      <p class="area-description">${escape(area.description)}</p>
      ${shareBar(area)}
      ${main.length ? `<ul class="person-list" aria-label="Bakan">${main.map(chip).join('')}</ul>` : '<p class="area-none">Son dönemde değişiklik yok.</p>'}
      ${side.length ? `<ul class="person-list minor" aria-label="Ara sıra dokunan">${side.map(chip).join('')}</ul>` : ''}
      ${design}
      <p class="area-docs">${area.docs.map(doc => `<code>${escape(doc)}</code>`).join(' ')}</p>
      <footer class="area-meta"><span>${area.commits} commit</span><span>${area.files} dosya</span>${agent}</footer>
    </article>`;
  }

  function personCard(entry) {
    const rows = entry.entries.map(({area, person}) =>
      `<li class="person-area ${person.role}"><a href="?gorunum=alan#alan-${escape(area.id)}">${escape(area.name)}</a>` +
      `<span class="person-area-role">${roleLabel[person.role]}</span><span>${percent(person.share)}</span></li>`).join('');
    return `<article class="area-card person-card">
      <header><h2>${escape(entry.name)}</h2></header>
      <ul class="person-areas">${rows}</ul>
    </article>`;
  }

  function render() {
    const query = fold(search.value.trim());
    let html = '';
    let shown = 0;
    if (view === 'alan') {
      for (const area of data.areas) {
        if (query && !areaText.get(area.id).includes(query)) continue;
        html += areaCard(area);
        shown++;
      }
    } else {
      for (const entry of people) {
        const text = fold([entry.name, ...entry.entries.map(e => e.area.name)].join(' '));
        if (query && !text.includes(query)) continue;
        html += personCard(entry);
        shown++;
      }
    }
    list.innerHTML = html;
    list.classList.toggle('people-grid', view === 'kisi');
    empty.hidden = shown > 0;
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.view === view));
    const url = new URL(location.href);
    if (search.value.trim()) url.searchParams.set('q', search.value.trim());
    else url.searchParams.delete('q');
    if (view === 'kisi') url.searchParams.set('gorunum', 'kisi');
    else url.searchParams.delete('gorunum');
    history.replaceState(null, '', url);
  }

  search.addEventListener('input', render);
  for (const button of viewButtons) button.addEventListener('click', () => { view = button.dataset.view; render(); });
  document.addEventListener('keydown', event => {
    if ((event.key === '/' && document.activeElement !== search) || (event.key === 'k' && (event.ctrlKey || event.metaKey))) {
      event.preventDefault();
      search.focus();
    }
  });
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
})();
