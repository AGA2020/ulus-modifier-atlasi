// Region map for bolgeler.html: one state-id raster (regions-map.png, R = low byte, G = high byte of state index + 1)
// is coloured in the browser by owner, so theme and country changes need no extra image. Opening a region loads the
// province-id raster (regions-provinces.png, stable definition.csv ids) and its details once. Presentation only.
window.RegionMap = (() => {
  'use strict';
  let canvas, ctx, tip, data, options;
  let ids, width = 0, height = 0, base, baseCtx;
  let ownerOf, colorOf;
  const view = { scale: 1, x: 0, y: 0 };
  let focusCountry = '', hoverIndex = 0, selectedIndex = 0, hoverProvince = 0, selectedProvince = 0;
  let provIds = null, provinceInfo = null, provincePromise = null;
  const highlightCache = new Map();
  let frame = 0;

  const hex = value => {
    const v = String(value).trim().replace('#', '');
    const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mix = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] * (1 - t) + b[i] * t));
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name);

  function paintBase() {
    if (!ids) return;
    const sea = hex(css('--map-sea') || '#1f2a2b');
    const border = hex(css('--map-border') || '#111');
    const coast = hex(css('--map-coast') || '#000');
    const faded = css('--map-fade') ? parseFloat(css('--map-fade')) : 0.72;
    const countryCount = colorOf.length;
    // Palette per country: normal, faded (another country is in focus), state border, country border.
    const fill = new Array(countryCount), line = new Array(countryCount);
    for (let c = 0; c < countryCount; c++) {
      const own = colorOf[c];
      const shown = focusCountry && data.countries[c].tag !== focusCountry ? mix(own, sea, faded) : own;
      fill[c] = shown;
      line[c] = mix(shown, border, 0.45);
    }
    const image = baseCtx.createImageData(width, height);
    const out = image.data;
    for (let y = 0, p = 0; y < height; y++) {
      for (let x = 0; x < width; x++, p++) {
        const id = ids[p];
        let color;
        if (!id) color = sea;
        else {
          const owner = ownerOf[id];
          const right = x + 1 < width ? ids[p + 1] : id, down = y + 1 < height ? ids[p + width] : id;
          if (right === id && down === id) color = fill[owner];
          else if (!right || !down) color = coast;
          else if (ownerOf[right] !== owner || ownerOf[down] !== owner) color = border;
          else color = line[owner];
        }
        const o = p * 4;
        out[o] = color[0]; out[o + 1] = color[1]; out[o + 2] = color[2]; out[o + 3] = 255;
      }
    }
    baseCtx.putImageData(image, 0, 0);
    highlightCache.clear();
    draw();
  }

  // A small canvas covering one state's box, filled where the raster holds that state.
  function highlight(index, kind) {
    const key = index + kind;
    if (highlightCache.has(key)) return highlightCache.get(key);
    const box = data.states[index - 1].box;
    if (!box) return null;
    const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
    const layer = document.createElement('canvas');
    layer.width = w; layer.height = h;
    const layerCtx = layer.getContext('2d');
    const image = layerCtx.createImageData(w, h);
    const color = hex(css(kind === 'select' ? '--map-select' : '--map-hover') || '#fff');
    const edge = hex(css('--map-province') || '#000');
    const provinces = kind === 'select' && provIds;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (y0 + y) * width + x0 + x;
        if (ids[p] !== index) continue;
        const o = (y * w + x) * 4;
        const border = provinces && ((x + 1 < w && ids[p + 1] === index && provIds[p + 1] !== provIds[p]) ||
          (y + 1 < h && ids[p + width] === index && provIds[p + width] !== provIds[p]));
        const c = border ? edge : color;
        image.data[o] = c[0]; image.data[o + 1] = c[1]; image.data[o + 2] = c[2];
        image.data[o + 3] = border ? 230 : kind === 'select' ? (provinces ? 120 : 200) : 130;
      }
    layerCtx.putImageData(image, 0, 0);
    const entry = { layer, x0, y0 };
    if (highlightCache.size > 64) highlightCache.clear();
    highlightCache.set(key, entry);
    return entry;
  }

  function provinceLayer(pid, kind) {
    const key = 'p' + pid + kind;
    if (highlightCache.has(key)) return highlightCache.get(key);
    const state = selectedIndex ? data.states[selectedIndex - 1] : null;
    if (!state || !state.box || !provIds) return null;
    const [sx0, sy0, sx1, sy1] = state.box;
    let x0 = sx1, y0 = sy1, x1 = sx0, y1 = sy0;
    for (let y = sy0; y < sy1; y++)
      for (let x = sx0; x < sx1; x++)
        if (provIds[y * width + x] === pid) { if (x < x0) x0 = x; if (x >= x1) x1 = x + 1; if (y < y0) y0 = y; if (y >= y1) y1 = y + 1; }
    if (x1 <= x0) return null;
    const w = x1 - x0, h = y1 - y0, layer = document.createElement('canvas');
    layer.width = w; layer.height = h;
    const layerCtx = layer.getContext('2d'), image = layerCtx.createImageData(w, h);
    const color = hex(css(kind === 'select' ? '--map-province-select' : '--map-hover') || '#fff');
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (provIds[(y0 + y) * width + x0 + x] === pid) {
          const o = (y * w + x) * 4;
          image.data[o] = color[0]; image.data[o + 1] = color[1]; image.data[o + 2] = color[2]; image.data[o + 3] = kind === 'select' ? 235 : 150;
        }
    layerCtx.putImageData(image, 0, 0);
    const entry = { layer, x0, y0 };
    highlightCache.set(key, entry);
    return entry;
  }

  function loadProvinces() {
    if (!provincePromise)
      provincePromise = Promise.all([
        fetch(options.provinceSrc).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
        new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = options.provinceImage; }),
      ]).then(([info, img]) => {
        const reader = document.createElement('canvas');
        reader.width = img.naturalWidth; reader.height = img.naturalHeight;
        const readerCtx = reader.getContext('2d', { willReadFrequently: true });
        readerCtx.drawImage(img, 0, 0);
        const raw = readerCtx.getImageData(0, 0, reader.width, reader.height).data;
        const grid = new Uint16Array(reader.width * reader.height);
        for (let p = 0, o = 0; p < grid.length; p++, o += 4) grid[p] = raw[o] | (raw[o + 1] << 8);
        provIds = grid; provinceInfo = info;
        highlightCache.clear(); draw();
        return info;
      }).catch(error => { provincePromise = null; throw error; });
    return provincePromise;
  }

  function draw() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
        canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = css('--map-sea') || '#1f2a2b';
      ctx.fillRect(0, 0, cw, ch);
      if (!ids) return;
      ctx.imageSmoothingEnabled = view.scale < 1;
      ctx.drawImage(base, -view.x * view.scale, -view.y * view.scale, width * view.scale, height * view.scale);
      ctx.imageSmoothingEnabled = false;
      const put = h => { if (h) ctx.drawImage(h.layer, (h.x0 - view.x) * view.scale, (h.y0 - view.y) * view.scale, h.layer.width * view.scale, h.layer.height * view.scale); };
      for (const [index, kind] of [[selectedIndex, 'select'], [hoverIndex !== selectedIndex ? hoverIndex : 0, 'hover']])
        if (index) put(highlight(index, kind));
      if (selectedProvince) put(provinceLayer(selectedProvince, 'select'));
      if (hoverProvince && hoverProvince !== selectedProvince) put(provinceLayer(hoverProvince, 'hover'));
    });
  }

  function minScale() { return Math.min(canvas.clientWidth / width, canvas.clientHeight / height); }
  function clampView() {
    const cw = canvas.clientWidth / view.scale, ch = canvas.clientHeight / view.scale;
    view.x = cw >= width ? (width - cw) / 2 : Math.max(0, Math.min(width - cw, view.x));
    view.y = ch >= height ? (height - ch) / 2 : Math.max(0, Math.min(height - ch, view.y));
  }
  function zoomAt(factor, sx, sy) {
    const mx = view.x + sx / view.scale, my = view.y + sy / view.scale;
    view.scale = Math.max(minScale(), Math.min(12, view.scale * factor));
    view.x = mx - sx / view.scale; view.y = my - sy / view.scale;
    clampView(); draw();
  }
  function fitBox(box, pad = 1.25) {
    if (!ids || !box || !canvas.clientWidth) return;
    const [x0, y0, x1, y1] = box;
    const bw = Math.max(40, x1 - x0), bh = Math.max(30, y1 - y0);
    view.scale = Math.max(minScale(), Math.min(8, canvas.clientWidth / (bw * pad), canvas.clientHeight / (bh * pad)));
    view.x = (x0 + x1) / 2 - canvas.clientWidth / view.scale / 2;
    view.y = (y0 + y1) / 2 - canvas.clientHeight / view.scale / 2;
    clampView(); draw();
  }
  // The country's home block: states chained to the capital by boxes closer than a small gap. Colonies and other
  // far-off possessions stay out, so selecting Britain or France zooms to Europe, not to the whole world.
  function countryBox(tag) {
    const owned = data.states.filter(s => s.owner === tag && s.box);
    if (!owned.length) return null;
    const start = owned.find(s => s.capital) || owned.reduce((a, b) => (b.population > a.population ? b : a));
    const gap = width * 0.015, near = (a, b) => a[0] - gap < b[2] && b[0] - gap < a[2] && a[1] - gap < b[3] && b[1] - gap < a[3];
    const taken = new Set([start]), queue = [start];
    while (queue.length) {
      const s = queue.pop();
      for (const other of owned) if (!taken.has(other) && near(s.box, other.box)) { taken.add(other); queue.push(other); }
    }
    let box = null;
    for (const s of taken) box = box ? [Math.min(box[0], s.box[0]), Math.min(box[1], s.box[1]), Math.max(box[2], s.box[2]), Math.max(box[3], s.box[3])] : s.box.slice();
    return box;
  }
  function fitDefault() {
    if (focusCountry) fitBox(countryBox(focusCountry));
    // Europe and the Near East, where most writing happens.
    else fitBox([Math.round(width * 0.43), Math.round(height * 0.12), Math.round(width * 0.62), Math.round(height * 0.36)]);
  }

  function pixelAt(clientX, clientY) {
    if (!ids) return -1;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(view.x + (clientX - r.left) / view.scale), y = Math.floor(view.y + (clientY - r.top) / view.scale);
    return x >= 0 && y >= 0 && x < width && y < height ? y * width + x : -1;
  }
  function stateAt(clientX, clientY) { const p = pixelAt(clientX, clientY); return p < 0 ? 0 : ids[p]; }
  function provinceAt(clientX, clientY) {
    const p = pixelAt(clientX, clientY);
    return p < 0 || !provIds || !selectedIndex || ids[p] !== selectedIndex ? 0 : provIds[p];
  }

  function showTip(index, clientX, clientY, pid = 0) {
    if (!index) { tip.hidden = true; return; }
    const s = data.states[index - 1];
    tip.replaceChildren();
    const line = (tag, text) => { const node = document.createElement(tag); node.textContent = text; tip.append(node); };
    if (pid && provinceInfo) {
      const row = provinceInfo.provinces[pid] || [];
      const extra = row[3] || {};
      line('strong', extra.s ? extra.s.join(', ') : `Province ${pid}`);
      line('code', `province ${pid}`);
      line('span', [provinceInfo.terrains[row[1]], row[2] ? 'Kıyı' : '', s.name].filter(Boolean).join(' · '));
    } else {
      line('strong', s.name);
      line('code', s.id);
      line('span', `${options.countryName(s.owner)} · ${s.owner}`);
    }
    tip.hidden = false;
    const r = canvas.parentElement.getBoundingClientRect();
    const x = clientX - r.left + 14, y = clientY - r.top + 14;
    tip.style.left = `${Math.min(x, r.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${Math.min(y, r.height - tip.offsetHeight - 8)}px`;
  }

  function setHover(index, pid = 0) {
    if (index === hoverIndex && pid === hoverProvince) return;
    hoverIndex = index; hoverProvince = pid;
    canvas.style.cursor = index ? 'pointer' : 'grab';
    draw();
  }

  function bindPointer() {
    const pointers = new Map();
    let moved = 0, pinch = 0;
    canvas.addEventListener('pointerdown', event => {
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic or already released pointer: dragging still works inside the map. */ }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      moved = 0;
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    canvas.addEventListener('pointermove', event => {
      const last = pointers.get(event.pointerId);
      if (!last) {
        if (event.pointerType === 'mouse') {
          const index = stateAt(event.clientX, event.clientY), pid = provinceAt(event.clientX, event.clientY);
          setHover(index, pid); showTip(index, event.clientX, event.clientY, pid);
        }
        return;
      }
      const dx = event.clientX - last.x, dy = event.clientY - last.y;
      last.x = event.clientX; last.y = event.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y), r = canvas.getBoundingClientRect();
        if (pinch) zoomAt(distance / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch = distance;
        return;
      }
      view.x -= dx / view.scale; view.y -= dy / view.scale;
      clampView(); draw();
      tip.hidden = true;
    });
    const end = event => {
      const wasTap = pointers.size === 1 && moved < 6;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (wasTap && event.type === 'pointerup') {
        const index = stateAt(event.clientX, event.clientY), pid = provinceAt(event.clientX, event.clientY);
        if (pid) options.onProvince(pid);
        else if (index) options.onSelect(data.states[index - 1]);
        if (event.pointerType !== 'mouse') showTip(index, event.clientX, event.clientY, pid);
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { setHover(0); tip.hidden = true; } });
    // Double click opens the region: select it and zoom to its provinces.
    canvas.addEventListener('dblclick', event => {
      const index = stateAt(event.clientX, event.clientY);
      if (!index) return;
      const state = data.states[index - 1];
      if (index !== selectedIndex) options.onSelect(state);
      fitBox(state.box, 1.15);
    });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const r = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - r.left, event.clientY - r.top);
    }, { passive: false });
  }

  function init(regionData, opts) {
    data = regionData; options = opts;
    canvas = document.getElementById('mapCanvas'); ctx = canvas.getContext('2d');
    tip = document.getElementById('mapTip');
    const tagIndex = new Map(data.countries.map((c, i) => [c.tag, i]));
    colorOf = data.countries.map(c => hex(data.countryColors[c.tag] || '#888888'));
    ownerOf = new Uint16Array(data.states.length + 1);
    data.states.forEach((s, i) => { ownerOf[i + 1] = tagIndex.get(s.owner) ?? 0; });
    bindPointer();
    document.getElementById('zoomIn').addEventListener('click', () => zoomAt(1.6, canvas.clientWidth / 2, canvas.clientHeight / 2));
    document.getElementById('zoomOut').addEventListener('click', () => zoomAt(1 / 1.6, canvas.clientWidth / 2, canvas.clientHeight / 2));
    document.getElementById('zoomFit').addEventListener('click', fitDefault);
    document.getElementById('zoomWorld').addEventListener('click', () => { view.scale = minScale(); clampView(); draw(); });
    new ResizeObserver(() => { clampView(); draw(); }).observe(canvas);
    new MutationObserver(paintBase).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      width = image.naturalWidth; height = image.naturalHeight;
      const reader = document.createElement('canvas');
      reader.width = width; reader.height = height;
      const readerCtx = reader.getContext('2d', { willReadFrequently: true });
      readerCtx.drawImage(image, 0, 0);
      const raw = readerCtx.getImageData(0, 0, width, height).data;
      ids = new Uint16Array(width * height);
      for (let p = 0, o = 0; p < ids.length; p++, o += 4) ids[p] = raw[o] | (raw[o + 1] << 8);
      base = reader; baseCtx = readerCtx;
      document.getElementById('mapLoading').hidden = true;
      paintBase();
      fitDefault();
      // A link that names a region (?bolge=) opens on that region, not on the whole country.
      if (selectedIndex && data.states[selectedIndex - 1].box) fitBox(data.states[selectedIndex - 1].box, 1.8);
    };
    image.onerror = () => { document.getElementById('mapLoading').textContent = 'Harita yüklenemedi; liste yine kullanılabilir.'; };
    image.src = opts.src;
  }

  return {
    init,
    loadProvinces,
    province(pid) { return provinceInfo && provinceInfo.provinces[pid]; },
    stateProvinces(index) { return provinceInfo ? provinceInfo.states[index - 1] : null; },
    terrain(i) { return provinceInfo ? provinceInfo.terrains[i] : ''; },
    selectProvince(pid) { selectedProvince = pid; draw(); },
    setCountry(tag, fit) { focusCountry = tag; paintBase(); if (fit) fitDefault(); },
    setHover(index) { setHover(index); },
    select(index, fit) {
      if (index !== selectedIndex) selectedProvince = 0;
      selectedIndex = index; draw();
      if (index) loadProvinces().catch(() => {});
      const s = index ? data.states[index - 1] : null;
      if (fit && s && s.box) {
        const r = canvas.getBoundingClientRect(), [x0, y0, x1, y1] = s.box;
        const visible = x0 >= view.x && y0 >= view.y && x1 <= view.x + r.width / view.scale && y1 <= view.y + r.height / view.scale;
        if (!visible) fitBox(s.box);
      }
    },
  };
})();
