/*
 * Векторные иллюстрации блюд. Временная замена фотографиям:
 * когда появятся фото, достаточно указать image в menu.js.
 */
(function () {
  const PAL = {
    salmon: { outer: '#ef8a5f', stripe: '#fbd3bd', fill: ['#f5f1e8', '#7fae5a', '#ef8a5f'] },
    tobiko: { outer: '#f27a24', dots: '#ffb36b', fill: ['#f6dcd0', '#9bc46a', '#e9524a'] },
    eel:    { outer: '#5a301a', glaze: '#8a4b25', seeds: '#f2e6c9', fill: ['#f5f1e8', '#7a3f20', '#9bc46a'] },
    tuna:   { outer: '#b8283b', stripe: '#de5a68', fill: ['#c42f43', '#7fae5a', '#e8572f'] },
    veg:    { outer: '#f5f0e6', seeds: '#d9c49b', fill: ['#8bbf5a', '#c9d96a', '#e84d3c'] },
    mix:    { outer: '#ef8a5f', stripe: '#fbd3bd', fill: ['#f5f1e8', '#7fae5a', '#b8283b'] },
    baked:  { outer: '#e5a64a', burn: '#a65d1f', fill: ['#f5f1e8', '#ef8a5f', '#7fae5a'] },
    miso:   { broth: '#c79a5b', bits: ['#f3ecdc', '#2f4f2a', '#7fae5a'] },
    tomyam: { broth: '#e0662d', bits: ['#f6b38a', '#f3ecdc', '#7fae5a'] },
    cream:  { broth: '#efe2c4', bits: ['#ef8a5f', '#7fae5a', '#e9d9a8'] },
    yuzu:   { drink: '#f2c94c', accent: '#fff3c4' },
    matcha: { drink: '#8db35a', accent: '#e8f0d6' }
  };
  const RICE = '#f4efe4';
  const NORI = '#18201b';
  let clipId = 0;

  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    return function () {
      h += 0x6d2b79f5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const f = (n) => n.toFixed(1);

  function grains(cx, cy, rIn, rOut, n, rand, color) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const d = rIn + rand() * (rOut - rIn);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rOut * 0.07)}" ry="${f(rOut * 0.035)}" transform="rotate(${f(rand() * 180)} ${f(x)} ${f(y)})" fill="${color}"/>`;
    }
    return s;
  }

  function core(cx, cy, r, colors, rand) {
    // начинка в центре ролла: три кусочка разных цветов
    let s = `<circle cx="${cx}" cy="${cy}" r="${f(r)}" fill="${NORI}"/>`;
    const rr = r * 0.82;
    const rot = rand() * 360;
    for (let i = 0; i < 3; i++) {
      const a0 = (rot + i * 120) * Math.PI / 180, a1 = (rot + i * 120 + 112) * Math.PI / 180;
      s += `<path d="M${cx} ${cy} L${f(cx + Math.cos(a0) * rr)} ${f(cy + Math.sin(a0) * rr)} A${f(rr)} ${f(rr)} 0 0 1 ${f(cx + Math.cos(a1) * rr)} ${f(cy + Math.sin(a1) * rr)} Z" fill="${colors[i % colors.length]}"/>`;
    }
    return s;
  }

  function shadow(cx, cy, r) {
    return `<ellipse cx="${cx}" cy="${f(cy + r * 0.28)}" rx="${f(r * 1.02)}" ry="${f(r * 0.98)}" fill="#000" opacity=".45" filter="url(#blur)"/>`;
  }

  function roll(cx, cy, r, p, rand, kind) {
    let s = shadow(cx, cy, r);
    if (kind === 'tempura') {
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#d9963c"/>`;
      for (let i = 0; i < 26; i++) {
        const a = rand() * Math.PI * 2, d = r * (0.86 + rand() * 0.12);
        s += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${f(r * (0.06 + rand() * 0.07))}" fill="${rand() > 0.5 ? '#f0bb5c' : '#b7742a'}"/>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.8)}" fill="${RICE}"/>`;
      s += grains(cx, cy, r * 0.5, r * 0.78, 18, rand, '#ddd5c4');
      s += core(cx, cy, r * 0.48, p.fill, rand);
      return s;
    }
    if (kind === 'baked') {
      s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${RICE}"/>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.92)}" fill="${p.outer}"/>`;
      s += `<circle cx="${f(cx - r * 0.15)}" cy="${f(cy - r * 0.2)}" r="${f(r * 0.6)}" fill="#f2c574" opacity=".55"/>`;
      for (let i = 0; i < 9; i++) {
        const a = rand() * Math.PI * 2, d = rand() * r * 0.75;
        s += `<ellipse cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" rx="${f(r * (0.08 + rand() * 0.1))}" ry="${f(r * (0.05 + rand() * 0.06))}" fill="${p.burn || '#a65d1f'}" opacity="${f(0.35 + rand() * 0.4)}"/>`;
      }
      if (p.seeds || p.glaze) s += `<path d="M${f(cx - r * 0.6)} ${f(cy + r * 0.1)} q${f(r * 0.3)} ${f(-r * 0.35)} ${f(r * 0.6)} 0 t${f(r * 0.6)} 0" stroke="#3b1d0d" stroke-width="${f(r * 0.1)}" fill="none" stroke-linecap="round" opacity=".8"/>`;
      return s;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.outer}"/>`;
    if (p.stripe) {
      const id = 'clip' + (clipId++);
      s += `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><g clip-path="url(#${id})">`;
      for (let i = 0; i < 4; i++) {
        const o = -r * 0.6 + i * r * 0.4;
        s += `<path d="M${f(cx - r)} ${f(cy + o)} q${f(r)} ${f(-r * 0.35)} ${f(r * 2)} ${f(r * 0.1)}" stroke="${p.stripe}" stroke-width="${f(r * 0.06)}" fill="none" opacity=".75"/>`;
      }
      s += '</g>';
    }
    if (p.dots) {
      for (let i = 0; i < 40; i++) {
        const a = rand() * Math.PI * 2, d = r * (0.84 + rand() * 0.14);
        s += `<circle cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="${f(r * 0.045)}" fill="${p.dots}"/>`;
      }
    }
    if (p.glaze) {
      s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.97)}" fill="none" stroke="${p.glaze}" stroke-width="${f(r * 0.08)}" opacity=".7"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.8)}" fill="${RICE}"/>`;
    s += grains(cx, cy, r * 0.52, r * 0.78, 22, rand, '#ddd5c4');
    if (p.seeds) s += grains(cx, cy, r * 0.82, r * 0.98, 14, rand, p.seeds);
    s += core(cx, cy, r * 0.48, p.fill, rand);
    return s;
  }

  function nigiri(cx, cy, w, p, rand) {
    const h = w * 0.42;
    let s = `<ellipse cx="${cx}" cy="${f(cy + h * 0.55)}" rx="${f(w * 0.55)}" ry="${f(h * 0.45)}" fill="#000" opacity=".45" filter="url(#blur)"/>`;
    s += `<rect x="${f(cx - w * 0.42)}" y="${f(cy - h * 0.1)}" width="${f(w * 0.84)}" height="${f(h * 0.7)}" rx="${f(h * 0.35)}" fill="${RICE}"/>`;
    s += grains(cx, cy + h * 0.2, 0, w * 0.35, 16, rand, '#ddd5c4');
    s += `<path d="M${f(cx - w * 0.5)} ${f(cy)} Q${f(cx - w * 0.2)} ${f(cy - h * 0.75)} ${f(cx + w * 0.5)} ${f(cy - h * 0.15)} Q${f(cx + w * 0.1)} ${f(cy + h * 0.35)} ${f(cx - w * 0.5)} ${f(cy)} Z" fill="${p.outer}"/>`;
    const st = p.stripe || p.glaze || '#ffffff';
    for (let i = 1; i <= 4; i++) {
      const x = cx - w * 0.4 + i * w * 0.17;
      s += `<path d="M${f(x)} ${f(cy - h * 0.35)} q${f(w * 0.05)} ${f(h * 0.25)} ${f(-w * 0.02)} ${f(h * 0.45)}" stroke="${st}" stroke-width="${f(w * 0.02)}" fill="none" opacity=".7"/>`;
    }
    if (p.seeds) s += grains(cx, cy - h * 0.15, 0, w * 0.25, 10, rand, p.seeds);
    return s;
  }

  function gunkan(cx, cy, r, p, rand) {
    let s = shadow(cx, cy, r);
    s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${NORI}"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.86)}" fill="#c4410f"/>`;
    for (let i = 0; i < 34; i++) {
      const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * r * 0.78;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.11)}" fill="#f0641e"/><circle cx="${f(x - r * 0.03)}" cy="${f(y - r * 0.03)}" r="${f(r * 0.03)}" fill="#ffd2a8"/>`;
    }
    return s;
  }

  function garnish(x, y, s, rand) {
    // имбирь и васаби
    let o = `<ellipse cx="${x}" cy="${f(y + s * 0.2)}" rx="${f(s * 0.7)}" ry="${f(s * 0.55)}" fill="#000" opacity=".35" filter="url(#blur)"/>`;
    for (let i = 0; i < 4; i++) {
      o += `<path d="M${f(x - s * 0.5 + i * s * 0.12)} ${f(y + s * 0.2)} q${f(s * 0.3)} ${f(-s * 0.8)} ${f(s * 0.6)} ${f(-s * 0.1)} z" fill="${i % 2 ? '#f3b7a6' : '#eea08c'}" opacity=".95"/>`;
    }
    o += `<path d="M${f(x + s * 0.55)} ${f(y + s * 0.25)} q${f(s * 0.2)} ${f(-s * 0.55)} ${f(s * 0.45)} 0 q${f(-s * 0.2)} ${f(s * 0.15)} ${f(-s * 0.45)} 0z" fill="#9cbf4f"/>`;
    return o;
  }

  function board(x, y, w, h, wood) {
    const fill = wood ? 'url(#wood)' : 'url(#slate)';
    return `<rect x="${f(x + 6)}" y="${f(y + 14)}" width="${f(w)}" height="${f(h)}" rx="10" fill="#000" opacity=".45" filter="url(#blur)"/>` +
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="10" fill="${fill}"/>` +
      `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="10" fill="none" stroke="#ffffff" stroke-opacity=".06"/>`;
  }

  function bowl(cx, cy, r, inner) {
    return `<ellipse cx="${cx}" cy="${f(cy + r * 0.12)}" rx="${f(r * 1.05)}" ry="${f(r * 1.0)}" fill="#000" opacity=".5" filter="url(#blur)"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1b1a19"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.97)}" fill="none" stroke="#c9a45c" stroke-opacity=".5" stroke-width="1.5"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f(r * 0.86)}" fill="${inner}"/>`;
  }

  const DEFS = `<defs>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <linearGradient id="slate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b2a28"/><stop offset="1" stop-color="#1a1918"/></linearGradient>
    <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2618"/><stop offset=".5" stop-color="#4a3120"/><stop offset="1" stop-color="#352215"/></linearGradient>
    <radialGradient id="shine" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`;

  const SCENES = {
    roll(p, rand) {
      return board(40, 70, 320, 170) +
        roll(118, 150, 52, p, rand) + roll(212, 168, 52, p, rand) + roll(296, 132, 44, p, rand) +
        garnish(320, 200, 26, rand);
    },
    baked(p, rand) {
      return board(40, 70, 320, 170) +
        roll(118, 150, 52, p, rand, 'baked') + roll(212, 168, 52, p, rand, 'baked') + roll(296, 132, 44, p, rand, 'baked') +
        garnish(320, 200, 26, rand);
    },
    tempura(p, rand) {
      return board(40, 70, 320, 170) +
        roll(118, 150, 52, p, rand, 'tempura') + roll(212, 168, 52, p, rand, 'tempura') + roll(296, 132, 44, p, rand, 'tempura') +
        garnish(320, 200, 26, rand);
    },
    set(p, rand, key) {
      const pals = key === 'baked' ? ['baked', 'eel', 'baked', 'salmon'] : key === 'mix' ? ['salmon', 'tuna', 'eel', 'tobiko'] : ['salmon', 'tobiko', 'eel', 'salmon'];
      const kinds = key === 'baked' ? ['baked', 'baked', 'baked', 'baked'] : ['', '', '', 'baked'];
      let s = board(24, 40, 352, 230, true);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 5; col++) {
          const i = (row + col) % 4;
          s += roll(70 + col * 65, 92 + row * 64, 27, PAL[pals[i]], rand, kinds[i]);
        }
      }
      return s;
    },
    nigiri(p, rand) {
      return board(40, 80, 320, 160) + nigiri(140, 160, 150, p, rand) + nigiri(270, 150, 130, p, rand) + garnish(320, 212, 22, rand);
    },
    gunkan(p, rand) {
      return board(40, 80, 320, 160) + gunkan(150, 160, 56, p, rand) + gunkan(260, 155, 50, p, rand) + garnish(320, 212, 22, rand);
    },
    wok(p, rand) {
      let s = bowl(200, 150, 112, '#6b3d1c');
      for (let i = 0; i < 22; i++) {
        const y = 80 + rand() * 140, x = 120 + rand() * 60;
        s += `<path d="M${f(x)} ${f(y)} c30 -20 60 20 ${f(70 + rand() * 40)} 0" stroke="${rand() > .3 ? '#e2b56a' : '#c98f42'}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".95"/>`;
      }
      for (let i = 0; i < 14; i++) {
        const a = rand() * Math.PI * 2, d = rand() * 75;
        const c = [p.outer || '#e5a64a', '#7fae5a', '#e84d3c', '#f3ecdc'][i % 4];
        s += `<rect x="${f(200 + Math.cos(a) * d)}" y="${f(150 + Math.sin(a) * d)}" width="16" height="9" rx="3" fill="${c}" transform="rotate(${f(rand() * 180)} ${f(200 + Math.cos(a) * d)} ${f(150 + Math.sin(a) * d)})"/>`;
      }
      s += grains(200, 150, 0, 80, 20, rand, '#f2e6c9');
      return s;
    },
    soup(p, rand) {
      let s = bowl(200, 150, 112, p.broth);
      s += `<circle cx="200" cy="150" r="96" fill="url(#shine)"/>`;
      for (let i = 0; i < 18; i++) {
        const a = rand() * Math.PI * 2, d = rand() * 78;
        const x = 200 + Math.cos(a) * d, y = 150 + Math.sin(a) * d;
        const c = p.bits[i % p.bits.length];
        s += i % 3 === 0
          ? `<rect x="${f(x)}" y="${f(y)}" width="14" height="14" rx="2" fill="${c}" transform="rotate(${f(rand() * 90)} ${f(x)} ${f(y)})"/>`
          : `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(5 + rand() * 7)}" ry="${f(3 + rand() * 4)}" fill="${c}"/>`;
      }
      return s;
    },
    drink(p) {
      return `<ellipse cx="200" cy="262" rx="70" ry="14" fill="#000" opacity=".5" filter="url(#blur)"/>` +
        `<path d="M145 50 L255 50 L240 260 L160 260 Z" fill="#ffffff" fill-opacity=".08" stroke="#ffffff" stroke-opacity=".25"/>` +
        `<path d="M151 95 L249 95 L240 255 L160 255 Z" fill="${p.drink}"/>` +
        `<path d="M151 95 L249 95 L246 120 L154 120 Z" fill="${p.accent}" opacity=".5"/>` +
        `<rect x="170" y="140" width="28" height="28" rx="5" fill="#fff" opacity=".35" transform="rotate(12 184 154)"/>` +
        `<rect x="205" y="175" width="26" height="26" rx="5" fill="#fff" opacity=".3" transform="rotate(-10 218 188)"/>` +
        `<rect x="225" y="20" width="6" height="140" rx="3" fill="#c9a45c" transform="rotate(14 228 90)"/>` +
        `<path d="M160 55 L168 250" stroke="#fff" stroke-opacity=".25" stroke-width="5" stroke-linecap="round"/>`;
    },
    mochi(p) {
      const one = (cx, cy, r) =>
        `<ellipse cx="${cx}" cy="${cy + r * 0.6}" rx="${r}" ry="${r * 0.35}" fill="#000" opacity=".5" filter="url(#blur)"/>` +
        `<path d="M${cx - r} ${cy + r * 0.5} Q${cx - r} ${cy - r} ${cx} ${cy - r} Q${cx + r} ${cy - r} ${cx + r} ${cy + r * 0.5} Q${cx} ${cy + r * 0.8} ${cx - r} ${cy + r * 0.5}Z" fill="${p.drink}"/>` +
        `<path d="M${cx - r} ${cy + r * 0.5} Q${cx - r} ${cy - r} ${cx} ${cy - r} Q${cx + r} ${cy - r} ${cx + r} ${cy + r * 0.5} Q${cx} ${cy + r * 0.8} ${cx - r} ${cy + r * 0.5}Z" fill="url(#shine)"/>` +
        `<circle cx="${cx - r * 0.3}" cy="${cy - r * 0.45}" r="${r * 0.12}" fill="#fff" opacity=".4"/>`;
      return board(40, 90, 320, 150) + one(150, 165, 62) + one(262, 175, 54);
    }
  };

  window.renderArt = function (item) {
    const rand = rng(item.id);
    const scene = SCENES[item.art] || SCENES.roll;
    const p = PAL[item.palette] || PAL.salmon;
    return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${item.name}">${DEFS}${scene(p, rand, item.palette)}</svg>`;
  };

  window.renderHeroArt = function () {
    const rand = rng('hero');
    let s = `<svg viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${DEFS}`;
    s += `<circle cx="260" cy="272" r="236" fill="#000" opacity=".55" filter="url(#blur)"/>`;
    s += `<circle cx="260" cy="260" r="236" fill="#171615"/>`;
    s += `<circle cx="260" cy="260" r="228" fill="none" stroke="#c9a45c" stroke-opacity=".55"/>`;
    s += `<circle cx="260" cy="260" r="200" fill="none" stroke="#c9a45c" stroke-opacity=".15"/>`;
    const ring = ['salmon', 'tobiko', 'eel', 'salmon', 'tuna', 'baked', 'salmon', 'eel'];
    ring.forEach((k, i) => {
      const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      s += roll(Math.round(260 + Math.cos(a) * 140), Math.round(260 + Math.sin(a) * 140), 46, PAL[k], rand, k === 'baked' ? 'baked' : '');
    });
    s += roll(260, 260, 62, PAL.salmon, rand);
    s += '</svg>';
    return s;
  };
})();
