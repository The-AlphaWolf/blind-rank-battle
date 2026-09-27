/* ═══════════════════════════════════════════════════════════════
   BLIND RANK BATTLE — Game Engine
   Complete game logic, battle simulation, audio, and UI
   ═══════════════════════════════════════════════════════════════ */

// ─── TIER SYSTEM ──────────────────────────────────────────────
const TIER_CONFIG = {
  'S+': { label: 'S+', baseStats: { p:95, s:90, d:92, i:85, h:90, v:88 }, color: 'tier-splus', min: 88, max: 100 },
  'S':  { label: 'S',  baseStats: { p:82, s:80, d:80, i:75, h:72, v:78 }, color: 'tier-s', min: 75, max: 92 },
  'A':  { label: 'A',  baseStats: { p:70, s:68, d:68, i:65, h:55, v:66 }, color: 'tier-a', min: 60, max: 80 },
  'B':  { label: 'B',  baseStats: { p:55, s:54, d:55, i:55, h:35, v:52 }, color: 'tier-b', min: 42, max: 68 },
  'C':  { label: 'C',  baseStats: { p:40, s:40, d:40, i:50, h:18, v:40 }, color: 'tier-c', min: 28, max: 55 },
  'D':  { label: 'D',  baseStats: { p:25, s:25, d:28, i:40, h:8,  v:28 }, color: 'tier-d', min: 15, max: 40 },
  'E':  { label: 'E',  baseStats: { p:14, s:14, d:16, i:30, h:2,  v:18 }, color: 'tier-e', min: 5, max: 25 }
};

const STAT_PROFILES = {
  balanced:  { p:0,  s:0,  d:0,  i:0,  h:0,  v:0 },
  power:     { p:12, s:-3, d:8,  i:-8, h:-4, v:-5 },
  speed:     { p:-4, s:14, d:-4, i:3,  h:-4, v:-5 },
  tank:      { p:4,  s:-8, d:14, i:-4, h:-4, v:-2 },
  genius:    { p:-8, s:-4, d:-4, i:16, h:4,  v:8 },
  hax:       { p:-4, s:-2, d:-4, i:4,  h:18, v:-4 },
  glass:     { p:14, s:10, d:-14,i:0,  h:3,  v:-5 },
  allround:  { p:4,  s:4,  d:4,  i:4,  h:4,  v:4 },
  bruiser:   { p:10, s:-2, d:10, i:-6, h:-6, v:-2 },
  assassin:  { p:6,  s:12, d:-6, i:4,  h:2,  v:-6 },
  support:   { p:-6, s:-2, d:-2, i:8,  h:6,  v:12 },
  mystic:    { p:-4, s:-2, d:-2, i:10, h:14, v:2 },
  titan:     { p:14, s:-6, d:14, i:-6, h:-2, v:-6 },
  cosmic:    { p:6,  s:6,  d:6,  i:6,  h:10, v:6 }
};

const CAT_COLORS = {
  marvel: 'cat-bg-marvel', mcu: 'cat-bg-mcu', dc: 'cat-bg-dc',
  movies: 'cat-bg-movies', mythology: 'cat-bg-mythology', historical: 'cat-bg-historical',
  modern: 'cat-bg-modern', scifi: 'cat-bg-scifi', cosmic: 'cat-bg-cosmic', military: 'cat-bg-military'
};

const CAT_LABELS = {
  marvel: 'Marvel Comics', mcu: 'MCU', dc: 'DC Universe',
  movies: 'Movies/TV', mythology: 'Mythology', historical: 'Historical',
  modern: 'Real Modern', scifi: 'Sci-Fi', cosmic: 'Cosmic Entities', military: 'Modern Military'
};

// ─── HASH FUNCTION FOR DETERMINISTIC STATS ────────────────────
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

function seededRand(seed, index) {
  const x = Math.sin(seed + index * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function generateStats(name, tier, profile) {
  const tc = TIER_CONFIG[tier];
  const prof = STAT_PROFILES[profile] || STAT_PROFILES.balanced;
  const seed = hashStr(name);
  const stats = {};
  const keys = ['p','s','d','i','h','v'];
  keys.forEach((k, idx) => {
    const base = tc.baseStats[k] + prof[k];
    const variance = (seededRand(seed, idx) - 0.5) * 10;
    stats[k] = Math.round(Math.max(tc.min, Math.min(tc.max, base + variance)));
  });
  return stats;
}

function getTotalPower(stats) {
  return Math.round(stats.p * 0.25 + stats.s * 0.15 + stats.d * 0.2 + stats.i * 0.15 + stats.h * 0.15 + stats.v * 0.1);
}

// ─── X-FACTORS ────────────────────────────────────────────────
const X_FACTORS = [
  { id: 'bloodlust', name: '🔥 BLOODLUSTED', desc: '{char} fights without holding back!', effect: (char) => { char._boosted = true; char._stats.p += 15; char._stats.s += 10; } },
  { id: 'prep', name: '🧠 PREP TIME', desc: '{char} had a week to prepare!', effect: (char) => { if (char._stats.i >= 60) { char._stats.i += 20; char._stats.h += 15; } else { char._stats.i += 8; } } },
  { id: 'terrain_space', name: '🌌 TERRAIN: SPACE', desc: 'The battle moves to outer space!', effect: (char) => { if (char._stats.d < 50 && char.t !== 'S+' && char.t !== 'S') { char._stats.d -= 20; char._stats.p -= 10; } } },
  { id: 'terrain_water', name: '🌊 TERRAIN: DEEP OCEAN', desc: 'The battlefield is underwater!', effect: (char) => { if (char._stats.v < 50) { char._stats.s -= 15; char._stats.p -= 10; } } },
  { id: 'power_surge', name: '⚡ POWER SURGE', desc: '{char} unlocks hidden potential!', effect: (char) => { char._stats.p += 12; char._stats.h += 8; } },
  { id: 'nerf', name: '🔨 NERF HAMMER', desc: '{char} is weakened by an unknown force!', effect: (char) => { char._stats.p = Math.round(char._stats.p * 0.6); char._stats.h = Math.round(char._stats.h * 0.6); } },
  { id: 'plot_armor', name: '📖 PLOT ARMOR', desc: '{char} activates protagonist energy!', effect: (char) => { char._stats.d += 20; char._stats.p += 10; char._stats.v += 10; } },
  { id: 'rage', name: '😤 BERSERKER RAGE', desc: '{char} enters an uncontrollable rage!', effect: (char) => { char._stats.p += 20; char._stats.d += 5; char._stats.i -= 15; } },
  { id: 'intel', name: '🕵️ INTELLIGENCE REPORT', desc: '{char} knows their opponent\'s weakness!', effect: (char) => { char._stats.i += 15; char._stats.v += 10; } },
  { id: 'exhaustion', name: '😩 EXHAUSTED', desc: '{char} is fighting on empty!', effect: (char) => { char._stats.s -= 12; char._stats.d -= 10; char._stats.p -= 8; } },
  { id: 'amp', name: '🔮 MYSTIC AMPLIFICATION', desc: '{char} is enhanced by ancient magic!', effect: (char) => { char._stats.h += 18; char._stats.p += 8; } },
  { id: 'home', name: '🏠 HOME ADVANTAGE', desc: '{char} is fighting on their home turf!', effect: (char) => { char._stats.p += 8; char._stats.d += 8; char._stats.s += 8; char._stats.v += 8; } }
];

// ─── PLOT TWISTS ──────────────────────────────────────────────
const PLOT_TWISTS = [
  { id: 'betrayal', name: '🗡️ BETRAYAL!', desc: 'A defender switches sides!', type: 'betrayal' },
  { id: 'sacrifice', name: '💀 SACRIFICE', desc: 'A defender sacrifices themselves to eliminate the strongest attacker!', type: 'sacrifice' },
  { id: 'fusion', name: '🔗 FUSION', desc: 'Two team members fuse into one ultra-powerful being!', type: 'fusion' },
  { id: 'resurrection', name: '✨ RESURRECTION', desc: 'A fallen fighter returns from the dead!', type: 'resurrection' },
  { id: 'power_steal', name: '🫳 POWER STEAL', desc: 'One fighter absorbs another\'s abilities!', type: 'power_steal' },
  { id: 'time_stop', name: '⏸️ TIME STOP', desc: 'Time freezes — only the fastest survive!', type: 'time_stop' },
  { id: 'curse', name: '☠️ ANCIENT CURSE', desc: 'A dark curse weakens the leading team!', type: 'curse' },
  { id: 'rally', name: '📢 RALLY CRY', desc: 'An inspiring speech boosts the losing team!', type: 'rally' },
  { id: 'sneak', name: '🥷 SNEAK ATTACK', desc: 'An unseen fighter lands a devastating blow!', type: 'sneak' },
  { id: 'mercy', name: '🕊️ SHOW OF MERCY', desc: 'The strongest fighter holds back, believing they\'ve already won!', type: 'mercy' }
];

// ─── BATTLE NARRATIVES ───────────────────────────────────────
const CLASH_TEMPLATES = [
  '{d} and {a} collide in a devastating clash!',
  '{d} stands firm as {a} launches a ferocious assault!',
  '{a} charges at {d} with killing intent!',
  'The ground shakes as {d} and {a} trade blows!',
  '{d} braces for impact as {a} unleashes their full power!',
  'Lightning crackles as {d} faces off against {a}!',
  '{a} warps reality itself to strike at {d}!',
  '{d} calculates every move as {a} attacks relentlessly!',
  'The sky darkens as {d} and {a} begin their duel!',
  '{a} smirks, underestimating {d}... or do they?'
];

const WIN_TEMPLATES = {
  stomp: [
    '{w} annihilates {l} without breaking a sweat. Not even close.',
    '{w} ends {l} in a single devastating strike. Total domination.',
    '{l} never stood a chance. {w} wins in the blink of an eye.',
    '{w} doesn\'t even need to try. {l} is completely outclassed.'
  ],
  decisive: [
    '{w} overpowers {l} after a brief but intense clash!',
    '{w} proves too strong for {l}, taking the win convincingly.',
    '{l} puts up a fight but {w} is simply on another level.',
    '{w} dominates the matchup, leaving {l} defeated.'
  ],
  close: [
    '{w} barely edges out {l} in an incredibly close fight!',
    'After an exhausting battle, {w} just barely defeats {l}!',
    'It could have gone either way, but {w} clutches the win over {l}!',
    '{l} nearly wins, but {w} pulls through at the last moment!'
  ],
  upset: [
    'UPSET! {w} defies all odds to defeat {l}!',
    'Nobody saw this coming! {w} takes down the favored {l}!',
    'Against all probability, {w} finds {l}\'s weakness and exploits it!',
    'The impossible happens — {w} defeats {l} in a stunning upset!'
  ]
};


// ─── BATTLEFIELD ARENAS ────────────────────────────────────────
const ARENAS_CONFIG = {
  earth: { name: 'Metropolis Ruins', icon: '🏙️', desc: 'Neutral ground. Standard urban battlefield.' },
  space: { name: 'The Cosmic Void', icon: '🌌', desc: 'Outer space. Mortals without cosmic durability (DUR < 60) lose 20% stats.' },
  asgard: { name: 'Asgardian Realm', icon: '⚡', desc: 'Realm of the Gods. Mystic and Mythological characters gain +30% power/hax.' },
  cyber: { name: 'Cyber Megacity', icon: '🦾', desc: 'High-tech grid. Sci-fi, Military, and Genius characters gain +30% power/speed.' },
  colosseum: { name: 'Gladiator Grand Arena', icon: '🏛️', desc: 'Sacred dueling pit. All reality warping / hax clamped to 15 (pure brawl).' }
};

// ─── IMAGE RESOLVER & WIKIPEDIA CACHE ─────────────────────────
class ImageResolver {
  constructor() {
    this.cache = {};
    this.loadCache();
    // Curated high quality web images for major icons
    this.curated = {
      'Spider-Man': 'https://upload.wikimedia.org/wikipedia/en/2/21/Web_of_Spider-Man_Vol_1_129-1.png',
      'Iron Man': 'https://upload.wikimedia.org/wikipedia/en/4/47/Iron_Man_%28circa_2018%29.png',
      'Captain America': 'https://upload.wikimedia.org/wikipedia/en/d/dc/Captain_America_%281968%29_100.jpg',
      'Thor': 'https://upload.wikimedia.org/wikipedia/en/1/1a/Thor_%28Marvel_Comics%29.png',
      'Thor (Marvel Comics)': 'https://upload.wikimedia.org/wikipedia/en/1/1a/Thor_%28Marvel_Comics%29.png',
      'Hulk': 'https://upload.wikimedia.org/wikipedia/en/a/aa/Hulk_%28circa_2019%29.png',
      'Wolverine': 'https://upload.wikimedia.org/wikipedia/en/d/d3/Wolverine_%28circa_2024%29.jpg',
      'Thanos': 'https://upload.wikimedia.org/wikipedia/en/b/b7/Thanos_%28Infobox_image%29.png',
      'Galactus': 'https://upload.wikimedia.org/wikipedia/en/a/a7/Galactus_%282018%29.jpg',
      'Doctor Doom': 'https://upload.wikimedia.org/wikipedia/en/6/66/Doctor_Doom_%28Marvel_Comics_character%29.png',
      'Magneto': 'https://upload.wikimedia.org/wikipedia/en/e/e9/Magneto_%28Marvel_Comics_character%29.jpg',
      'Silver Surfer': 'https://upload.wikimedia.org/wikipedia/en/3/34/Silver_Surfer.png',
      'Loki': 'https://upload.wikimedia.org/wikipedia/en/e/ee/Various_incarnations_of_Loki_%282014%29.webp',
      'Doctor Strange': 'https://upload.wikimedia.org/wikipedia/en/4/4f/Doctor_Strange_Vol_4_2.jpg',
      'Scarlet Witch': 'https://upload.wikimedia.org/wikipedia/en/9/9d/Scarlet_Witch_%28circa_2023%29.png',
      'Batman': 'https://upload.wikimedia.org/wikipedia/en/c/c7/Batman_Infobox.jpg',
      'Superman': 'https://upload.wikimedia.org/wikipedia/en/3/35/Supermanflying.png',
      'Wonder Woman': 'https://upload.wikimedia.org/wikipedia/en/6/6b/Wonder_Woman_750.jpg',
      'The Flash': 'https://upload.wikimedia.org/wikipedia/en/e/ed/The_Flash_Family.jpg',
      'Joker': 'https://upload.wikimedia.org/wikipedia/en/5/5f/Batman_Three_Jokers.jpg',
      'Darkseid': 'https://upload.wikimedia.org/wikipedia/en/1/14/Darkseid_in_Justice_League_Vol_2_47.jpg',
      'Aquaman': 'https://upload.wikimedia.org/wikipedia/en/9/9d/Aquaman_Rebirth_1.png',
      'Green Lantern': 'https://upload.wikimedia.org/wikipedia/en/8/80/Green_Lantern_Rebirth_6.jpg',
      'Darth Vader': 'https://upload.wikimedia.org/wikipedia/en/0/0b/Darth_Vader_in_The_Empire_Strikes_Back.jpg',
      'Master Chief': 'https://upload.wikimedia.org/wikipedia/en/4/42/Master_chief_halo_infinite.png',
      'Doom Slayer': 'https://upload.wikimedia.org/wikipedia/en/8/87/Doomguy_DOOM_Eternal.png',
      'Godzilla': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Godzilla_%281954%29_%28cropped%29.jpg/330px-Godzilla_%281954%29_%28cropped%29.jpg',
      'King Kong': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/King_Kong_1933_Promotional_Image.png/330px-King_Kong_1933_Promotional_Image.png',
      'John Wick': 'https://upload.wikimedia.org/wikipedia/en/8/8b/John_Wick_Keanu_Reeves.jpg',
      'Sauron': 'https://upload.wikimedia.org/wikipedia/en/f/f8/Sauron_Tolkien_illustration.jpg',
      'Zeus': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Zeus_Otricoli_Pio-Clementino_Inv257.jpg/330px-Zeus_Otricoli_Pio-Clementino_Inv257.jpg',
      'Odin': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Georg_von_Rosen_-_Oden_som_vandringsman%2C_1886_%28Odin%2C_the_Wanderer%29.jpg/330px-Georg_von_Rosen_-_Oden_som_vandringsman%2C_1886_%28Odin%2C_the_Wanderer%29.jpg',
      'Sun Wukong': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/75/Xiyou.PNG/330px-Xiyou.PNG',
      'Alexander the Great': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/49/Alexander_Mosaic_detail_of_Alexander_the_Great_%283x4_cropped%29.jpg/330px-Alexander_Mosaic_detail_of_Alexander_the_Great_%283x4_cropped%29.jpg',
      'Julius Caesar': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Retrato_de_Julio_C%C3%A9sar_%2826724093101%29_%28cropped%29.jpg/330px-Retrato_de_Julio_C%C3%A9sar_%2826724093101%29_%28cropped%29.jpg',
      'Genghis Khan': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/35/YuanEmperorAlbumGenghisPortrait.jpg/330px-YuanEmperorAlbumGenghisPortrait.jpg',
      'Napoleon': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg/330px-Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg',
      'Mike Tyson': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Mike_Tyson_Photo_Op_GalaxyCon_Austin_2023.jpg/330px-Mike_Tyson_Photo_Op_GalaxyCon_Austin_2023.jpg',
      'Muhammad Ali': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Muhammad_Ali_NYWTS.jpg/330px-Muhammad_Ali_NYWTS.jpg',
      'Bruce Lee': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Bruce_Lee_as_Chen_Zhen_%284x5_cropped%29.jpg/330px-Bruce_Lee_as_Chen_Zhen_%284x5_cropped%29.jpg',
      'F-22 Raptor': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/F-22_Raptor_edit1_%28cropped%29.jpg/330px-F-22_Raptor_edit1_%28cropped%29.jpg',
      'M1A2 Abrams': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/M1A2_SEP_v3.jpg/330px-M1A2_SEP_v3.jpg',
      'B-2 Spirit': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/B-2_Spirits_on_Deployment_to_Indo-Pacific_crop.jpg/330px-B-2_Spirits_on_Deployment_to_Indo-Pacific_crop.jpg',
      'Aircraft Carrier': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/USS_Gerald_R._Ford_%28CVN-78%29_underway_in_the_Atlantic_Ocean_on_8_April_2017_%28170408-N-WZ792-198%29.jpg/330px-USS_Gerald_R._Ford_%28CVN-78%29_underway_in_the_Atlantic_Ocean_on_8_April_2017_%28170408-N-WZ792-198%29.jpg',
      'Tsar Bomba': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b3/Tsar_Bomba_Mushroom_Cloud.jpg/330px-Tsar_Bomba_Mushroom_Cloud.jpg',
      'Navy SEAL': 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/US_Navy_SEALs.jpg/330px-US_Navy_SEALs.jpg',
      'Living Tribunal': 'https://upload.wikimedia.org/wikipedia/en/d/de/TLT2.png'
    };
  }

  loadCache() {
    try {
      const saved = localStorage.getItem('brb_image_cache');
      if (saved) this.cache = JSON.parse(saved);
    } catch(e) {}
  }

  saveCache() {
    try {
      localStorage.setItem('brb_image_cache', JSON.stringify(this.cache));
    } catch(e) {}
  }

  cleanName(name) {
    return name
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/^\d+[\s,]+/, '')
      .trim();
  }

  resolveKeywordMatch(name) {
    const lower = name.toLowerCase();
    if (lower.includes('f-22') || lower.includes('fighter jet') || lower.includes('falcon') || lower.includes('typhoon') || lower.includes('gripen') || lower.includes('su-35') || lower.includes('warplane')) {
      return this.curated['F-22 Raptor'];
    }
    if (lower.includes('abrams') || lower.includes('tank') || lower.includes('panzer') || lower.includes('leopard') || lower.includes('t-90')) {
      return this.curated['M1A2 Abrams'];
    }
    if (lower.includes('carrier') || lower.includes('battleship') || lower.includes('destroyer') || lower.includes('warship') || lower.includes('dreadnought') || lower.includes('fleet') || lower.includes('armada')) {
      return this.curated['Aircraft Carrier'];
    }
    if (lower.includes('b-2') || lower.includes('bomber') || lower.includes('b-52') || lower.includes('stratofortress')) {
      return this.curated['B-2 Spirit'];
    }
    if (lower.includes('tsar bomba') || lower.includes('nuclear') || lower.includes('nuke') || lower.includes('atomic') || lower.includes('icbm')) {
      return this.curated['Tsar Bomba'];
    }
    if (lower.includes('seal') || lower.includes('paratrooper') || lower.includes('infantry') || lower.includes('soldier') || lower.includes('commando') || lower.includes('sniper') || lower.includes('ranger') || lower.includes('marine')) {
      return this.curated['Navy SEAL'];
    }
    return null;
  }

  getWikiQueries(char) {
    const raw = char.n;
    const clean = this.cleanName(raw);
    const queries = [];
    queries.push(clean);
    if (char.category === 'marvel' || char.category === 'mcu') {
      queries.push(`${clean} (Marvel Comics)`);
      queries.push(`${clean} (comics)`);
    } else if (char.category === 'dc') {
      queries.push(`${clean} (DC Comics)`);
    } else if (char.category === 'mythology') {
      queries.push(`${clean} (mythology)`);
    } else if (char.category === 'scifi' && char.u) {
      queries.push(`${clean} (${char.u})`);
    }
    return queries;
  }

  async fetchWikiThumbnail(query) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      // Browser will send its own standard User-Agent. Do not specify unsafe headers.
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.thumbnail && data.thumbnail.source) {
          return data.thumbnail.source;
        }
      }
    } catch(e) {}
    return null;
  }

  async resolve(char) {
    if (char.img) return char.img;
    const clean = this.cleanName(char.n);
    if (this.curated[clean]) return this.curated[clean];
    if (this.curated[char.n]) return this.curated[char.n];
    if (this.cache[char.n]) return this.cache[char.n];
    if (this.cache[clean]) return this.cache[clean];

    const kw = this.resolveKeywordMatch(char.n);
    if (kw) return kw;

    const queries = this.getWikiQueries(char);
    for (const q of queries) {
      const thumb = await this.fetchWikiThumbnail(q);
      if (thumb) {
        this.cache[char.n] = thumb;
        this.cache[clean] = thumb;
        this.saveCache();
        return thumb;
      }
    }
    return null;
  }

  applyImage(container, char, fallbackInitial) {
    if (!container) return;
    const initial = fallbackInitial || char.n.charAt(0);
    const clean = this.cleanName(char.n);
    const kw = this.resolveKeywordMatch(char.n);
    const syncUrl = char.img || this.curated[clean] || this.curated[char.n] || this.cache[char.n] || this.cache[clean] || kw;

    if (syncUrl) {
      this._insertImg(container, syncUrl, char.n, initial);
      return;
    }

    container.textContent = initial;
    this.resolve(char).then(url => {
      if (url && container.isConnected) {
        this._insertImg(container, url, char.n, initial);
      }
    });
  }

  _insertImg(container, src, alt, fallback) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt;
    img.referrerPolicy = 'no-referrer';
    img.loading = 'lazy';
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.35s ease';
    img.onload = () => {
      container.innerHTML = '';
      container.appendChild(img);
      img.style.opacity = '1';
    };
    img.onerror = () => {
      container.textContent = fallback;
    };
  }
}

// ─── AUDIO ENGINE (Web Audio API) ─────────────────────────────
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
  }
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  play(type) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      switch(type) {
        case 'click': this._beep(800, 0.05, 'sine'); break;
        case 'whoosh': this._sweep(200, 800, 0.15); break;
        case 'reveal': this._chord([440, 554, 659], 0.4); break;
        case 'flip': this._beep(600, 0.08, 'triangle'); break;
        case 'impact': this._noise(0.15); break;
        case 'victory': this._fanfare([523, 659, 784, 1047], 0.8); break;
        case 'defeat': this._descend([400, 350, 300, 200], 0.8); break;
        case 'xfactor': this._sweep(300, 1200, 0.3); break;
        case 'twist': this._chord([220, 277, 330], 0.5); break;
        case 'battle': this._noise(0.1); this._beep(150, 0.2, 'sawtooth'); break;
      }
    } catch(e) {}
  }
  _beep(freq, dur, type='sine') {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(this.volume * 0.3, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  _sweep(f1, f2, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f1, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, this.ctx.currentTime + dur);
    g.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  _chord(freqs, dur) {
    freqs.forEach((f, i) => {
      setTimeout(() => this._beep(f, dur - i*0.1, 'sine'), i * 80);
    });
  }
  _fanfare(freqs, dur) {
    freqs.forEach((f, i) => {
      setTimeout(() => this._beep(f, dur - i*0.15, 'triangle'), i * 150);
    });
  }
  _descend(freqs, dur) {
    freqs.forEach((f, i) => {
      setTimeout(() => this._beep(f, dur - i*0.15, 'sawtooth'), i * 180);
    });
  }
  _noise(dur) {
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(this.volume * 0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  }
}

// ─── PARTICLE SYSTEM ──────────────────────────────────────────
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.init();
    this.animate();
  }
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  init() {
    const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        o: Math.random() * 0.5 + 0.1
      });
    }
  }
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(0, 240, 255, ${p.o})`;
      this.ctx.fill();
    });
    // Draw connections
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.strokeStyle = `rgba(0, 240, 255, ${0.08 * (1 - dist/120)})`;
          this.ctx.stroke();
        }
      }
    }
    requestAnimationFrame(() => this.animate());
  }
}

// ─── CONFETTI ─────────────────────────────────────────────────
function spawnConfetti() {
  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);
  const colors = ['#00f0ff','#ff00aa','#ffd700','#00ff88','#aa44ff','#ff8800'];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (Math.random() * 2 + 2) + 's';
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    piece.style.width = (Math.random() * 8 + 4) + 'px';
    piece.style.height = (Math.random() * 8 + 4) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    container.appendChild(piece);
  }
  setTimeout(() => container.remove(), 5000);
}

// ─── GAME STATE ───────────────────────────────────────────────
const GameState = {
  settings: {
    gameMode: 'classic',
    rankingFormat: 'blind',
    fightStyle: 'duel',
    arena: 'random',
    allowedTiers: ['S+', 'S', 'A', 'B', 'C', 'D', 'E'],
    categories: ['marvel','mcu','dc','movies','mythology','historical','modern','scifi','cosmic','military'],
    charCount: 10,
    tierBalance: 'chaotic',
    splitRatio: '50-50',
    detailLevel: 'standard',
    xFactors: true,
    xFactorIntensity: 2,
    plotTwists: true,
    plotTwistFreq: 2,
    timer: 0,
    hideUniverse: false,
    hideCategory: false,
    hideImage: false,
    sound: true,
    volume: 50,
    animations: 'full',
    theme: 'dark'
  },
  activeArena: null,
  currentChars: [],
  defenders: [],
  attackers: [],
  battleLog: [],
  matchResults: [],
  xFactorsApplied: [],
  twistsApplied: [],
  defScore: 0,
  atkScore: 0,
  winProb: 50,
  mvp: null,
  history: { wins: 0, losses: 0, streak: 0, played: 0 },
  lastChars: null,
  timerInterval: null,
  battleTimeout: null
};

// ─── MAIN GAME CLASS ──────────────────────────────────────────
class BlindRankBattle {
  constructor() {
    this.audio = new AudioEngine();
    this.imageResolver = new ImageResolver();
    this.particles = null;
    this.dragSrcIndex = null;
    this.customSquad = [];
    this.drawnPool = [];
    this.rankingSlots = [];
    this.currentDrawIndex = 0;
    this.battleView = 'duel';
    this.currentStoryChapter = 0;
    this.storyChapters = [];
    this.currentTheme = 'dark';

    this.loadHistory();
    this.initUI();
    this.initParticles();
    this.initRosterModal();
  }

  // ── INITIALIZATION ──────────────────────────────────────────
  initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (canvas) this.particles = new ParticleSystem(canvas);
  }

  loadHistory() {
    try {
      const saved = localStorage.getItem('brb_history');
      if (saved) Object.assign(GameState.history, JSON.parse(saved));
    } catch(e) {}
  }

  saveHistory() {
    try { localStorage.setItem('brb_history', JSON.stringify(GameState.history)); } catch(e) {}
  }

  setTheme(theme) {
    this.currentTheme = theme;
    GameState.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    try { localStorage.setItem('brb_theme', theme); } catch(e) {}

    // Sync global pills
    document.querySelectorAll('#global-theme-switcher .theme-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    // Sync settings pills
    document.querySelectorAll('#settings-theme-pills .pill').forEach(pill => {
      const input = pill.querySelector('input');
      const isTheme = input.value === theme;
      pill.classList.toggle('active', isTheme);
      input.checked = isTheme;
    });
  }

  initUI() {
    // Theme initialization
    const savedTheme = localStorage.getItem('brb_theme') || 'dark';
    this.setTheme(savedTheme);

    // Global theme buttons
    document.querySelectorAll('#global-theme-switcher .theme-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setTheme(btn.dataset.theme);
        this.audio.init();
        this.audio.play('click');
      });
    });

    // Settings theme radio pills
    document.querySelectorAll('#settings-theme-pills .pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const val = pill.querySelector('input').value;
        this.setTheme(val);
        this.audio.init();
        this.audio.play('click');
      });
    });

    // Category toggles (native checkbox change to avoid double toggling)
    document.querySelectorAll('.category-toggle').forEach(el => {
      const cb = el.querySelector('input');
      cb.addEventListener('change', () => {
        el.classList.toggle('active', cb.checked);
        this.updateCategorySettings();
        this.audio.init();
        this.audio.play('click');
      });
    });

    // Select All / Clear Categories
    const btnAllCats = document.getElementById('btn-select-all-cats');
    if (btnAllCats) {
      btnAllCats.addEventListener('click', () => {
        document.querySelectorAll('.category-toggle').forEach(el => {
          el.querySelector('input').checked = true;
          el.classList.add('active');
        });
        this.updateCategorySettings();
        this.audio.init();
        this.audio.play('click');
      });
    }

    const btnClearCats = document.getElementById('btn-deselect-all-cats');
    if (btnClearCats) {
      btnClearCats.addEventListener('click', () => {
        document.querySelectorAll('.category-toggle').forEach(el => {
          el.querySelector('input').checked = false;
          el.classList.remove('active');
        });
        this.updateCategorySettings();
        this.audio.init();
        this.audio.play('click');
      });
    }

    // Category Presets
    document.querySelectorAll('.cat-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        const presetMap = {
          comics: ['marvel', 'mcu', 'dc'],
          real: ['historical', 'modern', 'military'],
          myth: ['mythology', 'scifi', 'cosmic', 'movies']
        };
        const selected = presetMap[preset] || [];
        document.querySelectorAll('.category-toggle').forEach(el => {
          const cat = el.dataset.category;
          const match = selected.includes(cat);
          el.querySelector('input').checked = match;
          el.classList.toggle('active', match);
        });
        this.updateCategorySettings();
        this.audio.init();
        this.audio.play('click');
      });
    });

    // Character count slider
    const charSlider = document.getElementById('char-count');
    const charDisplay = document.getElementById('char-count-display');
    charSlider.addEventListener('input', () => {
      charDisplay.textContent = charSlider.value;
      GameState.settings.charCount = parseInt(charSlider.value);
    });

    // Option cards (radio groups)
    this.initOptionCards('game-mode-options', 'gameMode');
    this.initOptionCards('ranking-format-options', 'rankingFormat');
    this.initOptionCards('arena-options', 'arena');
    this.initOptionCards('fight-style-options', 'fightStyle');
    this.initOptionCards('tier-balance-options', 'tierBalance');
    this.initOptionCards('split-ratio-options', 'splitRatio');
    this.initOptionCards('detail-level-options', 'detailLevel');

    // Option pills
    this.initPills('xfactor-intensity', 'xFactorIntensity', true);
    this.initPills('plottwist-freq', 'plotTwistFreq', true);
    this.initPills('timer-options', 'timer', true);

    // Toggles
    document.getElementById('xfactor-toggle').addEventListener('change', (e) => {
      GameState.settings.xFactors = e.target.checked;
      document.getElementById('xfactor-settings').style.opacity = e.target.checked ? '1' : '0.3';
    });
    document.getElementById('plottwist-toggle').addEventListener('change', (e) => {
      GameState.settings.plotTwists = e.target.checked;
      document.getElementById('plottwist-settings').style.opacity = e.target.checked ? '1' : '0.3';
    });

    // Blind mode checkboxes
    document.getElementById('hide-universe').addEventListener('change', (e) => { GameState.settings.hideUniverse = e.target.checked; });
    document.getElementById('hide-category').addEventListener('change', (e) => { GameState.settings.hideCategory = e.target.checked; });
    document.getElementById('hide-image').addEventListener('change', (e) => { GameState.settings.hideImage = e.target.checked; });

    // Sound
    document.getElementById('sound-toggle').addEventListener('change', (e) => {
      GameState.settings.sound = e.target.checked;
      this.audio.enabled = e.target.checked;
      this.updateSoundButton();
    });
    document.getElementById('volume-slider').addEventListener('input', (e) => {
      GameState.settings.volume = parseInt(e.target.value);
      this.audio.volume = parseInt(e.target.value) / 100;
    });

    // Animation pills
    document.querySelectorAll('input[name="anim"]').forEach(r => {
      r.closest('.pill').addEventListener('click', () => {
        document.querySelectorAll('input[name="anim"]').forEach(x => x.closest('.pill').classList.remove('active'));
        r.closest('.pill').classList.add('active');
        r.checked = true;
        GameState.settings.animations = r.value;
      });
    });

    // Global sound toggle
    document.getElementById('global-sound-toggle').addEventListener('click', () => {
      this.audio.init();
      this.audio.enabled = !this.audio.enabled;
      GameState.settings.sound = this.audio.enabled;
      document.getElementById('sound-toggle').checked = this.audio.enabled;
      this.updateSoundButton();
      this.audio.play('click');
    });

    // Tier filter toggles
    document.querySelectorAll('#tier-filter-toggles .tier-toggle').forEach(el => {
      el.addEventListener('click', (e) => {
        const cb = el.querySelector('input');
        if (e.target !== cb) cb.checked = !cb.checked;
        el.classList.toggle('active', cb.checked);
        this.updateTierFilterSettings();
        this.audio.play('click');
      });
    });

    document.getElementById('btn-select-all-tiers').addEventListener('click', () => {
      document.querySelectorAll('#tier-filter-toggles .tier-toggle').forEach(el => {
        el.querySelector('input').checked = true;
        el.classList.add('active');
      });
      this.updateTierFilterSettings();
    });

    // Randomize button
    document.getElementById('btn-randomize-settings').addEventListener('click', () => {
      this.randomizeSettings();
      this.audio.init(); this.audio.play('whoosh');
    });

    // Start button
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init(); this.audio.play('whoosh');
      this.startGame();
    });

    // Draft screen buttons
    const restartDraftBtn = document.getElementById('btn-restart-draft');
    if (restartDraftBtn) {
      restartDraftBtn.addEventListener('click', () => {
        this.audio.play('whoosh');
        this.startGame();
      });
    }
    const lockInBtn = document.getElementById('btn-lock-in');
    if (lockInBtn) {
      lockInBtn.addEventListener('click', () => {
        this.audio.play('reveal');
        this.lockInRanking();
      });
    }

    // Battle screen buttons & tabs
    document.getElementById('btn-begin-battle').addEventListener('click', () => {
      this.audio.play('battle');
      this.startBattle();
    });
    document.getElementById('btn-skip-battle').addEventListener('click', () => {
      this.skipBattle();
    });

    const tabDuelBtn = document.getElementById('btn-tab-duel');
    if (tabDuelBtn) {
      tabDuelBtn.addEventListener('click', () => this.setBattleView('duel'));
    }
    const tabStoryBtn = document.getElementById('btn-tab-story');
    if (tabStoryBtn) {
      tabStoryBtn.addEventListener('click', () => this.setBattleView('story'));
    }

    // Story Chronicle navigation
    const prevStoryBtn = document.getElementById('btn-story-prev');
    if (prevStoryBtn) {
      prevStoryBtn.addEventListener('click', () => {
        if (this.currentStoryChapter > 0) {
          this.currentStoryChapter--;
          this.renderStoryChapter();
          this.audio.play('click');
        }
      });
    }
    const nextStoryBtn = document.getElementById('btn-story-next');
    if (nextStoryBtn) {
      nextStoryBtn.addEventListener('click', () => {
        if (this.storyChapters && this.currentStoryChapter < this.storyChapters.length - 1) {
          this.currentStoryChapter++;
          this.renderStoryChapter();
          this.audio.play('click');
        }
      });
    }
    const fullStoryBtn = document.getElementById('btn-story-full');
    if (fullStoryBtn) {
      fullStoryBtn.addEventListener('click', () => {
        this.renderStoryFull();
        this.audio.play('click');
      });
    }

    // Result buttons
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.audio.play('click');
      this.startGame();
    });
    document.getElementById('btn-rematch').addEventListener('click', () => {
      this.audio.play('click');
      this.rematch();
    });
    document.getElementById('btn-back-settings').addEventListener('click', () => {
      this.audio.play('click');
      this.showScreen('screen-settings');
    });

    this.updateStatsDisplay();
  }

  updateSoundButton() {
    const btn = document.getElementById('global-sound-toggle');
    btn.querySelector('.sound-on').style.display = this.audio.enabled ? '' : 'none';
    btn.querySelector('.sound-off').style.display = this.audio.enabled ? 'none' : '';
  }

  initOptionCards(containerId, settingKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', () => {
        container.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        card.querySelector('input').checked = true;
        GameState.settings[settingKey] = card.dataset.value;
        this.audio.init(); this.audio.play('click');
      });
    });
  }

  initPills(containerId, settingKey, isNumber) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.pill').forEach(pill => {
      pill.addEventListener('click', () => {
        container.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        pill.querySelector('input').checked = true;
        const val = pill.querySelector('input').value;
        GameState.settings[settingKey] = isNumber ? parseInt(val) : val;
        this.audio.init(); this.audio.play('click');
      });
    });
  }

  
  updateTierFilterSettings() {
    const active = [];
    document.querySelectorAll('#tier-filter-toggles .tier-toggle').forEach(el => {
      if (el.querySelector('input').checked) {
        active.push(el.dataset.tier);
      }
    });
    GameState.settings.allowedTiers = active.length > 0 ? active : ['S+', 'S', 'A', 'B', 'C', 'D', 'E'];
  }

  updateCategorySettings() {
    GameState.settings.categories = [];
    document.querySelectorAll('.category-toggle').forEach(el => {
      if (el.querySelector('input').checked) {
        GameState.settings.categories.push(el.dataset.category);
      }
    });
  }

  randomizeSettings() {
    // Random categories (at least 2)
    const allCats = ['marvel','mcu','dc','movies','mythology','historical','modern','scifi','cosmic','military'];
    const numCats = Math.floor(Math.random() * 8) + 2;
    const shuffled = [...allCats].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, numCats);
    document.querySelectorAll('.category-toggle').forEach(el => {
      const isSelected = selected.includes(el.dataset.category);
      el.querySelector('input').checked = isSelected;
      el.classList.toggle('active', isSelected);
    });
    this.updateCategorySettings();

    // Random char count
    const counts = [6,8,10,12,14,16,18,20];
    const count = counts[Math.floor(Math.random() * counts.length)];
    document.getElementById('char-count').value = count;
    document.getElementById('char-count-display').textContent = count;
    GameState.settings.charCount = count;

    // Random tier balance
    const balances = ['chaotic','balanced','highpower','street','extremes'];
    const bal = balances[Math.floor(Math.random() * balances.length)];
    document.querySelectorAll('#tier-balance-options .option-card').forEach(c => {
      c.classList.toggle('active', c.dataset.value === bal);
      c.querySelector('input').checked = c.dataset.value === bal;
    });
    GameState.settings.tierBalance = bal;
  }

  updateStatsDisplay() {
    document.getElementById('stat-wins').textContent = GameState.history.wins;
    document.getElementById('stat-losses').textContent = GameState.history.losses;
    document.getElementById('stat-streak').textContent = GameState.history.streak;
    document.getElementById('stat-played').textContent = GameState.history.played;
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── GAME START ──────────────────────────────────────────────
  startGame() {
    const cats = GameState.settings.categories;
    if (cats.length === 0) {
      alert('Please select at least one category!');
      return;
    }

    // Show loading
    document.getElementById('loading-overlay').style.display = 'flex';

    setTimeout(() => {
      // Gather characters from selected categories
      let pool = [];
      cats.forEach(cat => {
        if (window.CHARACTER_DB && window.CHARACTER_DB[cat]) {
          window.CHARACTER_DB[cat].forEach(ch => {
            pool.push({ ...ch, category: cat });
          });
        }
      });

      if (pool.length < GameState.settings.charCount) {
        alert(`Not enough characters! Pool has ${pool.length}, need ${GameState.settings.charCount}. Select more categories.`);
        document.getElementById('loading-overlay').style.display = 'none';
        return;
      }

      // Apply tier filter
      pool = this.filterByTier(pool);
      if (pool.length < GameState.settings.charCount) {
        alert(`Not enough characters with selected tier filter! Available: ${pool.length}. Try a different tier balance.`);
        document.getElementById('loading-overlay').style.display = 'none';
        return;
      }

      // Random selection
      const selected = this.selectCharacters(pool, GameState.settings.charCount);

      // Generate stats for each
      selected.forEach(ch => {
        ch._stats = generateStats(ch.n, ch.t, ch.p || 'balanced');
        ch._totalPower = getTotalPower(ch._stats);
      });

      GameState.currentChars = selected;
      GameState.lastChars = selected.map(c => ({...c}));

      // Initialize 1-by-1 drawing pool and ranking slots
      this.drawnPool = [...selected].sort(() => Math.random() - 0.5);
      this.rankingSlots = new Array(GameState.settings.charCount).fill(null);
      this.currentDrawIndex = 0;

      document.getElementById('loading-overlay').style.display = 'none';
      this.showDraftScreen();
    }, 600);
  }

  getDefenderCount(total) {
    const splitRatio = GameState.settings.splitRatio;
    if (splitRatio === '40-60') return Math.max(1, Math.floor(total * 0.4));
    if (splitRatio === '60-40') return Math.min(total - 1, Math.ceil(total * 0.6));
    if (splitRatio === '30-70') return Math.max(1, Math.round(total * 0.3));
    if (splitRatio === '70-30') return Math.min(total - 1, Math.round(total * 0.7));
    if (splitRatio === '1-vs-all') return 1;
    return Math.floor(total / 2);
  }

  filterByTier(pool) {
    // Apply allowed tiers filter first
    if (GameState.settings.allowedTiers && GameState.settings.allowedTiers.length > 0) {
      pool = pool.filter(c => GameState.settings.allowedTiers.includes(c.t));
    }
    const balance = GameState.settings.tierBalance;
    switch(balance) {
      case 'highpower': return pool.filter(c => ['S+','S','A'].includes(c.t));
      case 'street': return pool.filter(c => ['C','D','E'].includes(c.t));
      case 'extremes': return pool.filter(c => ['S+','E'].includes(c.t));
      case 'balanced':
      case 'chaotic':
      default: return pool;
    }
  }

  selectCharacters(pool, count) {
    const mode = GameState.settings.gameMode;
    if (mode === 'boss') {
      const bosses = pool.filter(c => c.t === 'S+' || c.t === 'S');
      const boss = bosses.length > 0 ? bosses[Math.floor(Math.random() * bosses.length)] : pool[0];
      const others = pool.filter(c => c !== boss);
      const rest = [...others].sort(() => Math.random() - 0.5).slice(0, count - 1);
      return [boss, ...rest].sort(() => Math.random() - 0.5);
    }
    if (mode === 'underdog') {
      const half = Math.floor(count / 2);
      const mortals = pool.filter(c => ['C','D','E'].includes(c.t));
      const gods = pool.filter(c => ['S+','S','A'].includes(c.t));
      const chosenMortals = (mortals.length >= half ? mortals : pool).sort(() => Math.random() - 0.5).slice(0, half);
      const chosenGods = (gods.length >= (count - half) ? gods : pool).sort(() => Math.random() - 0.5).slice(0, count - half);
      return [...chosenMortals, ...chosenGods];
    }

    const balance = GameState.settings.tierBalance;
    if (balance === 'balanced') {
      const tiers = ['S+','S','A','B','C','D','E'];
      const byTier = {};
      tiers.forEach(t => { byTier[t] = pool.filter(c => c.t === t); });
      const availTiers = tiers.filter(t => byTier[t].length > 0);
      const perTier = Math.ceil(count / availTiers.length);
      let result = [];
      availTiers.forEach(t => {
        const shuffled = byTier[t].sort(() => Math.random() - 0.5);
        result.push(...shuffled.slice(0, perTier));
      });
      return result.sort(() => Math.random() - 0.5).slice(0, count);
    }
    return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
  }

  // ── DRAFT SCREEN (1-BY-1 RANKING) ───────────────────────────
  showDraftScreen() {
    this.showScreen('screen-draft');
    const isBlind = GameState.settings.rankingFormat === 'blind';
    const pill = document.getElementById('draft-mode-pill');
    if (pill) {
      pill.textContent = isBlind ? '🙈 BLIND PERMALOCK' : '✏️ NORMAL MODE';
    }
    const subtitle = document.getElementById('draft-screen-subtitle');
    if (subtitle) {
      subtitle.textContent = isBlind
        ? 'Characters drawn 1 by 1. Once placed into a slot, rank CANNOT be changed!'
        : 'Characters drawn 1 by 1. Place each into a slot; you can edit/swap ranks with the dropdown anytime!';
    }

    const lockInBtn = document.getElementById('btn-lock-in');
    if (lockInBtn) lockInBtn.disabled = true;

    this.renderDrawnCard();
    this.renderRankingSlots();
    this.startTimer();
  }

  renderDrawnCard() {
    const inner = document.getElementById('drawn-card-inner');
    const completeBox = document.getElementById('drawn-complete-box');
    const counter = document.getElementById('draft-counter');
    const lockInBtn = document.getElementById('btn-lock-in');

    const total = this.drawnPool.length;
    const allFilled = this.rankingSlots.length > 0 && this.rankingSlots.every(s => s !== null);

    if (counter) {
      counter.textContent = allFilled
        ? `${total} / ${total} (Ready)`
        : `${Math.min(this.currentDrawIndex + 1, total)} / ${total}`;
    }

    if (this.currentDrawIndex < total) {
      if (inner) inner.style.display = 'flex';
      if (completeBox) completeBox.style.display = 'none';

      const ch = this.drawnPool[this.currentDrawIndex];
      const badge = document.getElementById('drawn-card-badge');
      const nameEl = document.getElementById('drawn-card-name');
      const uniEl = document.getElementById('drawn-card-universe');
      const catEl = document.getElementById('drawn-card-cat');
      const imgBox = document.getElementById('drawn-card-image');
      const promptEl = document.getElementById('drawn-card-prompt');

      if (badge) badge.textContent = `DRAW #${this.currentDrawIndex + 1} OF ${total}`;
      if (nameEl) nameEl.textContent = ch.n;
      if (uniEl) {
        uniEl.textContent = GameState.settings.hideUniverse ? '???' : (ch.u || CAT_LABELS[ch.category] || ch.category);
      }
      if (catEl) {
        catEl.textContent = GameState.settings.hideCategory ? '???' : (CAT_LABELS[ch.category] || ch.category);
      }
      if (imgBox) {
        imgBox.className = `drawn-card-image-box ${CAT_COLORS[ch.category] || ''}`;
        imgBox.innerHTML = '';
        if (!GameState.settings.hideImage) {
          this.imageResolver.applyImage(imgBox, ch);
        } else {
          imgBox.textContent = '?';
        }
      }
      if (promptEl) {
        const isBlind = GameState.settings.rankingFormat === 'blind';
        promptEl.innerHTML = isBlind
          ? `👇 <strong>Click an empty slot below</strong> to permanently lock in <strong>${ch.n}</strong>!`
          : `👇 <strong>Click an empty slot below</strong> to place <strong>${ch.n}</strong> (editable later)`;
      }
    } else {
      if (inner) inner.style.display = 'none';
      if (completeBox) completeBox.style.display = 'flex';
      if (lockInBtn) lockInBtn.disabled = !allFilled;
    }
  }

  renderRankingSlots() {
    const list = document.getElementById('ranking-slots-list');
    if (!list) return;
    list.innerHTML = '';

    const total = this.rankingSlots.length;
    const defCount = this.getDefenderCount(total);
    const isBlind = GameState.settings.rankingFormat === 'blind';
    const hasDrawnWaiting = this.currentDrawIndex < this.drawnPool.length;
    const waitingChar = hasDrawnWaiting ? this.drawnPool[this.currentDrawIndex] : null;

    for (let i = 0; i < total; i++) {
      const slot = this.rankingSlots[i];
      const isDefender = i < defCount;
      const roleLabel = isDefender ? '🛡️ DEFENDER' : '⚔️ ATTACKER';
      const roleClass = isDefender ? 'role-defender' : 'role-attacker';

      const row = document.createElement('div');
      row.className = `ranking-slot-row ${slot ? 'slot-filled' : 'slot-empty'}`;
      if (!slot && hasDrawnWaiting) {
        row.classList.add('slot-highlight');
      }

      const rankNum = document.createElement('span');
      rankNum.className = 'ranking-slot-num';
      rankNum.textContent = `#${i + 1}`;

      const roleBadge = document.createElement('span');
      roleBadge.className = `ranking-slot-role-badge ${roleClass}`;
      roleBadge.textContent = roleLabel;

      row.appendChild(rankNum);
      row.appendChild(roleBadge);

      if (!slot) {
        // Empty slot button
        const btn = document.createElement('button');
        btn.className = `slot-empty-btn ${hasDrawnWaiting ? 'pulsing' : ''}`;
        btn.textContent = hasDrawnWaiting
          ? `+ Place #${i + 1}: ${waitingChar.n}`
          : `Empty Slot #${i + 1}`;

        if (hasDrawnWaiting) {
          btn.addEventListener('click', () => {
            this.assignCurrentToSlot(i);
          });
        } else {
          btn.disabled = true;
        }
        row.appendChild(btn);
      } else {
        // Filled character card
        const card = document.createElement('div');
        card.className = 'slot-filled-card';
        const catColor = CAT_COLORS[slot.category] || '';
        const tierCfg = TIER_CONFIG[slot.t] || TIER_CONFIG['C'];

        card.innerHTML = `
          <div class="slot-filled-avatar ${catColor}"></div>
          <div class="slot-filled-info">
            <div class="slot-filled-name">${slot.n}</div>
            <div class="slot-filled-sub">
              <span class="tier-badge ${tierCfg.color}">${slot.t}</span>
              <span>${slot.u || CAT_LABELS[slot.category] || ''}</span>
              <span style="color:var(--cyan);font-weight:700">PWR ${slot._totalPower}</span>
            </div>
          </div>
        `;

        if (!GameState.settings.hideImage) {
          const avatar = card.querySelector('.slot-filled-avatar');
          this.imageResolver.applyImage(avatar, slot);
        } else {
          card.querySelector('.slot-filled-avatar').textContent = '?';
        }

        row.appendChild(card);

        if (isBlind) {
          // Blind mode: Fixed Permalock
          const lock = document.createElement('span');
          lock.className = 'slot-locked-badge';
          lock.innerHTML = `🔒 Locked #${i + 1}`;
          row.appendChild(lock);
        } else {
          // Normal mode: Dropdown to change rank
          const wrap = document.createElement('div');
          wrap.className = 'slot-dropdown-wrap';
          wrap.innerHTML = `<label style="font-size:0.75rem;color:var(--text-dim);font-weight:600">Rank:</label>`;

          const select = document.createElement('select');
          select.className = 'slot-rank-dropdown';
          select.title = `Change rank of ${slot.n}`;
          for (let r = 1; r <= total; r++) {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = `#${r}`;
            if (r === i + 1) opt.selected = true;
            select.appendChild(opt);
          }

          select.addEventListener('change', (e) => {
            const targetSlotIdx = parseInt(e.target.value) - 1;
            this.swapSlots(i, targetSlotIdx);
          });

          wrap.appendChild(select);
          row.appendChild(wrap);
        }
      }

      list.appendChild(row);
    }

    const lockInBtn = document.getElementById('btn-lock-in');
    if (lockInBtn) {
      const allFilled = this.rankingSlots.every(s => s !== null);
      lockInBtn.disabled = !allFilled;
    }
  }

  assignCurrentToSlot(slotIdx) {
    if (this.currentDrawIndex >= this.drawnPool.length) return;
    const ch = this.drawnPool[this.currentDrawIndex];
    this.rankingSlots[slotIdx] = ch;
    this.currentDrawIndex++;
    this.audio.play('flip');

    this.renderDrawnCard();
    this.renderRankingSlots();
  }

  swapSlots(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const temp = this.rankingSlots[fromIdx];
    this.rankingSlots[fromIdx] = this.rankingSlots[toIdx];
    this.rankingSlots[toIdx] = temp;
    this.audio.play('click');
    this.renderRankingSlots();
  }

  startTimer() {
    if (GameState.timerInterval) clearInterval(GameState.timerInterval);
    const timerSec = GameState.settings.timer;
    if (timerSec === 0) {
      document.getElementById('draft-timer').style.display = 'none';
      return;
    }
    document.getElementById('draft-timer').style.display = '';
    let remaining = timerSec;
    document.getElementById('timer-value').textContent = remaining;
    GameState.timerInterval = setInterval(() => {
      remaining--;
      document.getElementById('timer-value').textContent = remaining;
      if (remaining <= 10) {
        document.getElementById('draft-timer').classList.add('warning');
      }
      if (remaining <= 0) {
        clearInterval(GameState.timerInterval);
        this.lockInRanking();
      }
    }, 1000);
  }

  // ── LOCK IN & REVEAL ───────────────────────────────────────
  lockInRanking() {
    if (GameState.timerInterval) clearInterval(GameState.timerInterval);

    // Auto-fill any remaining null slots if timer ran out
    if (!this.rankingSlots.every(s => s !== null)) {
      const emptyIndices = [];
      this.rankingSlots.forEach((s, idx) => { if (s === null) emptyIndices.push(idx); });
      while (this.currentDrawIndex < this.drawnPool.length && emptyIndices.length > 0) {
        const slotIdx = emptyIndices.shift();
        this.rankingSlots[slotIdx] = this.drawnPool[this.currentDrawIndex++];
      }
    }

    if (!this.rankingSlots.every(s => s !== null)) {
      alert('Please fill all ranking slots before locking in!');
      return;
    }

    GameState.currentChars = [...this.rankingSlots];

    // Split teams
    const total = GameState.currentChars.length;
    const defCount = this.getDefenderCount(total);

    GameState.defenders = GameState.currentChars.slice(0, defCount);
    GameState.attackers = GameState.currentChars.slice(defCount);

    // Chaos Mode Check: Defection
    if (GameState.settings.gameMode === 'chaos' && GameState.defenders.length > 0 && GameState.attackers.length > 0) {
      const dIdx = Math.floor(Math.random() * GameState.defenders.length);
      const aIdx = Math.floor(Math.random() * GameState.attackers.length);
      const defHero = GameState.defenders[dIdx];
      const atkHero = GameState.attackers[aIdx];
      GameState.defenders[dIdx] = atkHero;
      GameState.attackers[aIdx] = defHero;
      GameState._chaosSwap = { fromDef: defHero.n, fromAtk: atkHero.n };
    } else {
      GameState._chaosSwap = null;
    }

    this.showRevealScreen();
  }

  showRevealScreen() {
    this.showScreen('screen-reveal');
    this.audio.play('reveal');

    const defCards = document.getElementById('defender-cards');
    const atkCards = document.getElementById('attacker-cards');
    defCards.innerHTML = '';
    atkCards.innerHTML = '';

    let defTotal = 0, atkTotal = 0;

    // Render defenders with staggered animation
    GameState.defenders.forEach((ch, i) => {
      defTotal += ch._totalPower;
      const card = this.createCharCard(ch, 'defender', i);
      defCards.appendChild(card);
    });

    // Render attackers
    GameState.attackers.forEach((ch, i) => {
      atkTotal += ch._totalPower;
      const card = this.createCharCard(ch, 'attacker', i);
      atkCards.appendChild(card);
    });

    // Team power
    document.getElementById('defender-power').textContent = defTotal;
    document.getElementById('attacker-power').textContent = atkTotal;

    // Comparison bar
    const totalPower = defTotal + atkTotal;
    const defPct = totalPower > 0 ? Math.round((defTotal / totalPower) * 100) : 50;
    const atkPct = 100 - defPct;
    setTimeout(() => {
      document.getElementById('comp-defenders').style.width = defPct + '%';
      document.getElementById('comp-attackers').style.width = atkPct + '%';
      document.getElementById('comp-def-pct').textContent = defPct + '%';
      document.getElementById('comp-atk-pct').textContent = atkPct + '%';
    }, 300);
  }

  createCharCard(ch, team, index) {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.style.animationDelay = (index * 0.1) + 's';

    const tierCfg = TIER_CONFIG[ch.t] || TIER_CONFIG['C'];
    const catColor = CAT_COLORS[ch.category] || 'cat-bg-marvel';

    card.innerHTML = `
      <div class="char-card-img ${catColor}">
        ${ch.n.charAt(0)}
      </div>
      <div class="char-card-info">
        <div class="char-card-name">${ch.n}</div>
        <div class="char-card-universe">${ch.u || CAT_LABELS[ch.category] || ''}</div>
        <div class="stat-bars">
          ${this.renderStatBars(ch._stats, team)}
        </div>
      </div>
      <span class="char-card-tier ${tierCfg.color}">${tierCfg.label}</span>
      <span class="char-card-power">${ch._totalPower}</span>
    `;
    const imgBox = card.querySelector('.char-card-img');
    this.imageResolver.applyImage(imgBox, ch);
    return card;
  }

  renderStatBars(stats, team) {
    const labels = { p: 'PWR', s: 'SPD', d: 'DUR', i: 'INT', h: 'HAX', v: 'VER' };
    const color = team === 'defender' ? '#00ff88' : '#ff3344';
    return Object.keys(labels).map(k => `
      <div class="stat-bar-row">
        <span class="stat-bar-label">${labels[k]}</span>
        <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${stats[k]}%;background:${color}"></div></div>
        <span class="stat-bar-val">${stats[k]}</span>
      </div>
    `).join('');
  }

  // ── BATTLE SIMULATION ──────────────────────────────────────
  startBattle() {
    this.showScreen('screen-battle');
    GameState.battleLog = [];
    GameState.matchResults = [];
    GameState.xFactorsApplied = [];
    GameState.twistsApplied = [];
    GameState.defScore = 0;
    GameState.atkScore = 0;

    document.getElementById('battle-log').innerHTML = '';
    document.getElementById('def-score').textContent = '0';
    document.getElementById('atk-score').textContent = '0';
    document.getElementById('battle-progress-fill').style.width = '0%';

    // Determine active arena
    let arenaKey = GameState.settings.arena;
    if (arenaKey === 'random') {
      const keys = ['earth', 'space', 'asgard', 'cyber', 'colosseum'];
      arenaKey = keys[Math.floor(Math.random() * keys.length)];
    }
    GameState.activeArena = ARENAS_CONFIG[arenaKey] || ARENAS_CONFIG.earth;

    const banner = document.getElementById('battle-arena-banner');
    if (banner) {
      document.getElementById('arena-banner-icon').textContent = GameState.activeArena.icon;
      document.getElementById('arena-banner-name').textContent = GameState.activeArena.name;
      document.getElementById('arena-banner-mod').textContent = GameState.activeArena.desc;
    }

    // Deep copy chars for battle (so X-factors can modify stats)
    const defTeam = GameState.defenders.map(c => ({ ...c, _stats: {...c._stats}, _side: 'defender' }));
    const atkTeam = GameState.attackers.map(c => ({ ...c, _stats: {...c._stats}, _side: 'attacker' }));

    // Army HP meters
    this.maxDefArmyPower = Math.max(1, defTeam.reduce((s, c) => s + getTotalPower(c._stats), 0));
    this.maxAtkArmyPower = Math.max(1, atkTeam.reduce((s, c) => s + getTotalPower(c._stats), 0));
    this.currentDefArmyHp = this.maxDefArmyPower;
    this.currentAtkArmyHp = this.maxAtkArmyPower;
    this.updateTeamWarHpBars();

    // Default presentation view
    const defaultView = GameState.settings.fightStyle === 'story' ? 'story' : 'duel';
    this.setBattleView(defaultView);

    // Initialize whole team squad battle arena
    this.initSquadArena(defTeam, atkTeam);

    this.runBattleSequence(defTeam, atkTeam);
  }

  // ── SQUAD WARFARE UTILITIES & HELPERS ──────────────────────
  getFighterRole(char) {
    const p = char.p || 'balanced';
    const s = char._stats;
    if (p === 'tank' || p === 'bruiser' || p === 'titan' || s.d >= 68) {
      return { id: 'vanguard', name: 'Vanguard', icon: '🛡️', title: 'Frontline Shield' };
    }
    if (p === 'speed' || p === 'power' || p === 'assassin' || p === 'glass' || s.p >= 72 || s.s >= 72) {
      return { id: 'striker', name: 'Striker', icon: '⚔️', title: 'Heavy DPS' };
    }
    if (p === 'genius' || s.i >= 68) {
      return { id: 'tactician', name: 'Tactician', icon: '🧠', title: 'Squad Strategist' };
    }
    if (p === 'hax' || p === 'mystic' || p === 'cosmic' || s.h >= 62) {
      return { id: 'mystic', name: 'Disruptor', icon: '✨', title: 'Arcane Hax' };
    }
    return { id: 'support', name: 'Specialist', icon: '🎯', title: 'Versatile Support' };
  }

  getTeamAggregate(team) {
    const count = Math.max(1, team.length);
    const sum = { p: 0, s: 0, d: 0, i: 0, h: 0, v: 0, power: 0 };
    team.forEach(c => {
      sum.p += c._stats.p;
      sum.s += c._stats.s;
      sum.d += c._stats.d;
      sum.i += c._stats.i;
      sum.h += c._stats.h;
      sum.v += c._stats.v;
      sum.power += getTotalPower(c._stats);
    });
    return {
      power: sum.power,
      avgP: Math.round(sum.p / count),
      avgS: Math.round(sum.s / count),
      avgD: Math.round(sum.d / count),
      avgI: Math.round(sum.i / count),
      avgH: Math.round(sum.h / count),
      avgV: Math.round(sum.v / count)
    };
  }

  selectSquadCombo(team) {
    if (!team || team.length === 0) return null;
    if (team.length === 1) {
      const c = team[0];
      const a = (c.a && c.a[0]) ? c.a[0] : 'Solo Assault';
      return {
        name: `${c.n}'s Heroic Stand`,
        desc: `${c.n} unleashes ${a} with supreme determination!`,
        partners: [c]
      };
    }
    const c1 = team[Math.floor(Math.random() * team.length)];
    let c2 = team[Math.floor(Math.random() * team.length)];
    let attempts = 0;
    while (c2 === c1 && attempts < 10) {
      c2 = team[Math.floor(Math.random() * team.length)];
      attempts++;
    }
    const r1 = this.getFighterRole(c1);
    const r2 = this.getFighterRole(c2);
    const a1 = (c1.a && c1.a[0]) ? c1.a[0] : 'Relentless Might';
    const a2 = (c2.a && c2.a[0]) ? c2.a[0] : 'Devastating Strike';

    let comboTitle = 'Synchronized Faction Strike';
    if (c1.category === c2.category) {
      if (c1.category === 'marvel') comboTitle = 'Avengers Assemble Overdrive';
      else if (c1.category === 'dc') comboTitle = 'Justice League Convergence';
      else if (c1.category === 'mythology') comboTitle = 'Pantheon Divine Wrath';
      else if (c1.category === 'scifi') comboTitle = 'Quantum Particle Saturation';
      else if (c1.category === 'military') comboTitle = 'Tactical Combined-Arms Volley';
      else if (c1.category === 'historical') comboTitle = 'Conquerors\' Phalanx Charge';
    } else if ((r1.id === 'vanguard' && r2.id === 'striker') || (r2.id === 'vanguard' && r1.id === 'striker')) {
      comboTitle = 'Aegis Cannon Ball';
    } else if (r1.id === 'tactician' || r2.id === 'tactician') {
      comboTitle = 'Calculated Flank Ambush';
    } else if (r1.id === 'mystic' || r2.id === 'mystic') {
      comboTitle = 'Astral Dimension Shatter';
    } else if (r1.id === 'striker' && r2.id === 'striker') {
      comboTitle = 'Dual Supersonic Blitz';
    }

    return {
      name: comboTitle,
      desc: `${c1.n} unleashes ${a1} while ${c2.n} channels ${a2}!`,
      partners: [c1, c2]
    };
  }

  initSquadArena(defTeam, atkTeam) {
    this.renderSquadRoster('def-squad-roster', defTeam, 'def');
    this.renderSquadRoster('atk-squad-roster', atkTeam, 'atk');

    const defCountEl = document.getElementById('def-standing-count');
    const atkCountEl = document.getElementById('atk-standing-count');
    if (defCountEl) defCountEl.textContent = `Standing: ${defTeam.length}`;
    if (atkCountEl) atkCountEl.textContent = `Standing: ${atkTeam.length}`;

    // Initialize center hub with leaders
    const defLead = defTeam.slice(0, 2);
    const atkLead = atkTeam.slice(0, 2);
    this.updateClashStage(defLead, atkLead, 'Both full squadrons take formation on the battlefield!', 'WAR PHASE 1: VANGUARD CLASH', null, null);
  }

  renderSquadRoster(containerId, team, side) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    team.forEach((char, idx) => {
      const role = this.getFighterRole(char);
      const catColor = CAT_COLORS[char.category] || '';
      const tierColor = TIER_CONFIG[char.t]?.color || '';
      const pwr = getTotalPower(char._stats);

      const card = document.createElement('div');
      card.className = `squad-member-card side-${side}`;
      card.id = `smc-${side}-${idx}`;
      card.dataset.charName = char.n;
      card.dataset.side = side;

      card.innerHTML = `
        <div class="smc-avatar ${catColor}">
          ${char.n.charAt(0)}
        </div>
        <div class="smc-info">
          <div class="smc-name" title="${char.n}">${char.n}</div>
          <div class="smc-meta">
            <span class="smc-tier ${tierColor}">${char.t}</span>
            <span class="smc-role" title="${role.title}">${role.icon} ${role.name}</span>
            <span style="color:var(--cyan);font-weight:700">PWR ${pwr}</span>
          </div>
        </div>
        <span class="smc-status-dot dot-ready" id="dot-${side}-${idx}"></span>
      `;

      const avatarBox = card.querySelector('.smc-avatar');
      this.imageResolver.applyImage(avatarBox, char);
      container.appendChild(card);
    });
  }

  setSquadFighterStatus(side, charNames, status) {
    const team = side === 'def' ? GameState.defenders : GameState.attackers;
    team.forEach((c, idx) => {
      const card = document.getElementById(`smc-${side}-${idx}`);
      const dot = document.getElementById(`dot-${side}-${idx}`);
      if (!card || !dot) return;

      if (charNames.includes(c.n)) {
        card.classList.remove('card-acting', 'card-staggered', 'card-down');
        dot.classList.remove('dot-acting', 'dot-staggered', 'dot-down');

        if (status === 'acting') {
          card.classList.add('card-acting');
          dot.classList.add('dot-acting');
        } else if (status === 'staggered') {
          card.classList.add('card-staggered');
          dot.classList.add('dot-staggered');
        } else if (status === 'down') {
          card.classList.add('card-down');
          dot.classList.add('dot-down');
        }
      }
    });
  }

  clearSquadActing() {
    document.querySelectorAll('.squad-member-card').forEach(c => c.classList.remove('card-acting'));
    document.querySelectorAll('.smc-status-dot').forEach(d => d.classList.remove('dot-acting'));
  }

  updateClashStage(defFighters, atkFighters, headlineText, phaseBadgeText, comboData, damageText) {
    const phaseBadge = document.getElementById('clash-phase-badge');
    const headline = document.getElementById('clash-headline');
    const comboCard = document.getElementById('team-combo-card');
    const comboDesc = document.getElementById('team-combo-desc');
    const damageCallout = document.getElementById('clash-damage-callout');

    if (phaseBadge) phaseBadge.textContent = phaseBadgeText;
    if (headline) headline.innerHTML = headlineText;

    // Def Pod
    const defAvatars = document.getElementById('pod-def-avatars');
    const defName = document.getElementById('pod-def-name');
    const defRole = document.getElementById('pod-def-role');
    if (defAvatars && defFighters && defFighters.length > 0) {
      defAvatars.innerHTML = '';
      defFighters.forEach(f => {
        const item = document.createElement('div');
        item.className = `pod-avatar-item ${CAT_COLORS[f.category] || ''}`;
        item.textContent = f.n.charAt(0);
        this.imageResolver.applyImage(item, f);
        defAvatars.appendChild(item);
      });
      defName.textContent = defFighters.map(f => f.n).join(' & ');
      const roles = defFighters.map(f => this.getFighterRole(f).name).join(' + ');
      defRole.textContent = `🛡️ ${roles}`;
    }

    // Atk Pod
    const atkAvatars = document.getElementById('pod-atk-avatars');
    const atkName = document.getElementById('pod-atk-name');
    const atkRole = document.getElementById('pod-atk-role');
    if (atkAvatars && atkFighters && atkFighters.length > 0) {
      atkAvatars.innerHTML = '';
      atkFighters.forEach(f => {
        const item = document.createElement('div');
        item.className = `pod-avatar-item ${CAT_COLORS[f.category] || ''}`;
        item.textContent = f.n.charAt(0);
        this.imageResolver.applyImage(item, f);
        atkAvatars.appendChild(item);
      });
      atkName.textContent = atkFighters.map(f => f.n).join(' & ');
      const roles = atkFighters.map(f => this.getFighterRole(f).name).join(' + ');
      atkRole.textContent = `⚔️ ${roles}`;
    }

    // Combo Card
    if (comboCard) {
      if (comboData) {
        comboCard.style.display = 'block';
        if (comboDesc) comboDesc.textContent = `${comboData.name} — ${comboData.desc}`;
      } else {
        comboCard.style.display = 'none';
      }
    }

    // Damage callout
    if (damageCallout && damageText) {
      damageCallout.textContent = damageText;
      damageCallout.style.display = 'block';
      setTimeout(() => {
        if (damageCallout) damageCallout.style.display = 'none';
      }, 1500);
    }
  }

  updateTeamWarHpBars() {
    const defPct = Math.max(0, Math.min(100, Math.round((this.currentDefArmyHp / this.maxDefArmyPower) * 100)));
    const atkPct = Math.max(0, Math.min(100, Math.round((this.currentAtkArmyHp / this.maxAtkArmyPower) * 100)));

    const defFill = document.getElementById('defender-army-fill');
    const atkFill = document.getElementById('attacker-army-fill');
    const defVal = document.getElementById('defender-army-hp');
    const atkVal = document.getElementById('attacker-army-hp');

    if (defFill) defFill.style.width = `${defPct}%`;
    if (atkFill) atkFill.style.width = `${atkPct}%`;
    if (defVal) defVal.textContent = `${defPct}%`;
    if (atkVal) atkVal.textContent = `${atkPct}%`;
  }

  setBattleView(view) {
    this.battleView = view;
    const duelBtn = document.getElementById('btn-tab-duel');
    const storyBtn = document.getElementById('btn-tab-story');
    const duelView = document.getElementById('duel-view-container');
    const storyView = document.getElementById('story-narration-view');

    if (duelBtn) duelBtn.classList.toggle('active', view === 'duel');
    if (storyBtn) storyBtn.classList.toggle('active', view === 'story');

    if (duelView) duelView.style.display = (view === 'duel') ? 'block' : 'none';
    if (storyView) {
      storyView.style.display = (view === 'story') ? 'block' : 'none';
      if (view === 'story') {
        this.renderStoryChapter();
      }
    }
  }

  async runBattleSequence(defTeam, atkTeam) {
    const detail = GameState.settings.detailLevel;
    const log = document.getElementById('battle-log');
    let defScore = 0, atkScore = 0;
    let results = [];
    let allXFactors = [];
    let allTwists = [];
    let cancelled = false;

    // Store cancel function
    this._cancelBattle = () => { cancelled = true; };

    // Arena Environmental Modifiers
    const arena = GameState.activeArena;
    if (arena && detail !== 'quick') {
      await this.addLogEntry(log, `${arena.icon} BATTLEFIELD ARENA: ${arena.name}`, 'phase-header', cancelled);
      await this.addLogEntry(log, arena.desc, 'xfactor', cancelled);
      await sleep(400);

      const allFighters = [...defTeam, ...atkTeam];
      allFighters.forEach(c => {
        if (arena.name.includes('Void') || arena.name.includes('Space')) {
          if (c._stats.d < 60 && c.t !== 'S+' && c.t !== 'S' && c.category !== 'cosmic') {
            c._stats.d = Math.round(c._stats.d * 0.8);
            c._stats.p = Math.round(c._stats.p * 0.8);
            c._totalPower = getTotalPower(c._stats);
          }
        } else if (arena.name.includes('Asgard')) {
          if (c.category === 'mythology' || c.p === 'mystic') {
            c._stats.p = Math.round(c._stats.p * 1.3);
            c._stats.h = Math.round(c._stats.h * 1.3);
            c._totalPower = getTotalPower(c._stats);
          }
        } else if (arena.name.includes('Cyber')) {
          if (c.category === 'military' || c.p === 'genius' || c.category === 'scifi') {
            c._stats.p = Math.round(c._stats.p * 1.3);
            c._stats.s = Math.round(c._stats.s * 1.25);
            c._totalPower = getTotalPower(c._stats);
          }
        } else if (arena.name.includes('Arena') || arena.name.includes('Colosseum')) {
          if (c._stats.h > 15) {
            c._stats.h = 15;
            c._totalPower = getTotalPower(c._stats);
          }
        }
      });
    }

    if (GameState._chaosSwap && detail !== 'quick') {
      await this.addLogEntry(log, `🌀 CHAOS DEFECTION: ${GameState._chaosSwap.fromDef} defected to Attackers! ${GameState._chaosSwap.fromAtk} swapped to Defenders!`, 'plottwist', cancelled);
      this.audio.play('twist');
      await sleep(600);
    }

    // Phase 0: X-Factors
    if (GameState.settings.xFactors) {
      const intensity = GameState.settings.xFactorIntensity;
      const numXF = intensity === 1 ? randInt(1,2) : intensity === 2 ? randInt(3,4) : intensity === 3 ? randInt(5,7) : randInt(8,12);
      const allChars = [...defTeam, ...atkTeam];
      const shuffledXF = [...X_FACTORS].sort(() => Math.random() - 0.5);

      for (let i = 0; i < Math.min(numXF, shuffledXF.length); i++) {
        if (cancelled) break;
        const xf = shuffledXF[i];
        const target = allChars[Math.floor(Math.random() * allChars.length)];
        xf.effect(target);
        target._totalPower = getTotalPower(target._stats);
        const desc = xf.desc.replace('{char}', target.n);
        allXFactors.push({ ...xf, target: target.n, desc, side: target._side });

        if (detail !== 'quick') {
          const xfBanner = document.getElementById('xfactor-banner');
          if (xfBanner) {
            xfBanner.style.display = 'block';
            xfBanner.innerHTML = `<strong>🎲 ${xf.name}</strong> — ${desc}`;
          }
          await this.addLogEntry(log, `🎲 X-FACTOR: ${xf.name}`, 'xfactor', cancelled);
          await this.addLogEntry(log, desc, 'xfactor', cancelled);
          this.audio.play('xfactor');
          await sleep(detail === 'legendary' ? 700 : 350);
          if (xfBanner) xfBanner.style.display = 'none';
        }
      }
    }

    // Define the 5 Warfare Phases of the Whole Team War
    const warPhases = [
      {
        id: 'vanguard',
        name: 'Vanguard Collision & Frontline Charge',
        badge: 'WAR PHASE 1: VANGUARD CLASH',
        desc: 'Frontline tanks and vanguards collide in full formation, trading seismic blows at the center of the battlefield.',
        statFocus: (agg) => agg.avgD * 0.6 + agg.avgP * 0.4,
        selectFighters: (team) => {
          const sorted = [...team].sort((a,b) => (b._stats.d + b._stats.p) - (a._stats.d + a._stats.p));
          return sorted.slice(0, 2);
        }
      },
      {
        id: 'tactics',
        name: 'Tactical Maneuvers & Flanking Assault',
        badge: 'WAR PHASE 2: TACTICAL MANEUVERS',
        desc: 'Squad strategists and agile skirmishers coordinate high-speed pincer maneuvers to breach the enemy flank.',
        statFocus: (agg) => agg.avgI * 0.5 + agg.avgS * 0.3 + agg.avgV * 0.2,
        selectFighters: (team) => {
          const sorted = [...team].sort((a,b) => (b._stats.i + b._stats.s) - (a._stats.i + a._stats.s));
          return sorted.slice(0, 2);
        }
      },
      {
        id: 'synergy',
        name: 'Squad Synergy Combos & Heavy Barrage',
        badge: 'WAR PHASE 3: SQUAD SYNERGY COMBOS',
        desc: 'Teammates synchronize their powers for devastating multi-hero combo ultimates and energy barrages!',
        statFocus: (agg) => agg.avgH * 0.45 + agg.avgP * 0.35 + agg.avgV * 0.2,
        selectFighters: (team) => {
          const combo = this.selectSquadCombo(team);
          return combo ? combo.partners : team.slice(0, 2);
        }
      },
      {
        id: 'turning_point',
        name: 'Battlefield Chaos & Turning Point Crisis',
        badge: 'WAR PHASE 4: TURNING POINT',
        desc: 'The tides of battle rock violently as combat fatigue sets in and unexpected tactical shifts rock both squads.',
        statFocus: (agg) => agg.avgD * 0.35 + agg.avgV * 0.35 + agg.avgP * 0.3,
        selectFighters: (team) => {
          const sorted = [...team].sort((a,b) => (b._stats.v + b._stats.d) - (a._stats.v + a._stats.d));
          return sorted.slice(0, 2);
        }
      },
      {
        id: 'final_stand',
        name: 'The Final Faction Stand & Decisive Convergence',
        badge: 'WAR PHASE 5: THE FINAL STAND',
        desc: 'Both entire factions muster every remaining reserve of strength in a monumental all-out collision!',
        statFocus: (agg) => agg.power,
        selectFighters: (team) => {
          const sorted = [...team].sort((a,b) => b._totalPower - a._totalPower);
          return sorted.slice(0, 2);
        }
      }
    ];

    const totalPhases = warPhases.length;

    for (let i = 0; i < totalPhases; i++) {
      if (cancelled) break;
      const phase = warPhases[i];
      const progress = ((i + 1) / totalPhases) * 100;
      document.getElementById('battle-progress-fill').style.width = progress + '%';
      document.getElementById('battle-progress-text').textContent = `Phase ${i+1} of ${totalPhases}: ${phase.name}`;

      const defAgg = this.getTeamAggregate(defTeam);
      const atkAgg = this.getTeamAggregate(atkTeam);

      const defScoreVal = phase.statFocus(defAgg);
      const atkScoreVal = phase.statFocus(atkAgg);
      const totalScoreVal = defScoreVal + atkScoreVal;
      const ratio = totalScoreVal > 0 ? (defScoreVal / totalScoreVal) : 0.5;
      const winProb = Math.max(5, Math.min(95, Math.round(ratio * 100)));

      const roll = Math.random() * 100;
      const defWins = roll < winProb;

      const defFighters = phase.selectFighters(defTeam);
      const atkFighters = phase.selectFighters(atkTeam);

      // Synergy combo for phase 3 or turning point
      let phaseCombo = null;
      if (phase.id === 'synergy' || phase.id === 'turning_point') {
        phaseCombo = this.selectSquadCombo(defWins ? defTeam : atkTeam);
      }

      // Highlight active combatants in squad rosters
      this.clearSquadActing();
      this.setSquadFighterStatus('def', defFighters.map(f => f.n), 'acting');
      this.setSquadFighterStatus('atk', atkFighters.map(f => f.n), 'acting');

      // Calculate whole-team HP impact
      const isClimax = (i === totalPhases - 1);
      const baseDamagePct = isClimax ? 0.35 : 0.20;
      let dmgDef = 0, dmgAtk = 0;

      if (defWins) {
        defScore++;
        dmgAtk = Math.round(this.maxAtkArmyPower * (baseDamagePct + Math.random() * 0.08));
        this.currentAtkArmyHp = Math.max(isClimax ? 0 : Math.round(this.maxAtkArmyPower * 0.08), this.currentAtkArmyHp - dmgAtk);
        dmgDef = Math.round(this.maxDefArmyPower * 0.06);
        this.currentDefArmyHp = Math.max(Math.round(this.maxDefArmyPower * 0.15), this.currentDefArmyHp - dmgDef);
      } else {
        atkScore++;
        dmgDef = Math.round(this.maxDefArmyPower * (baseDamagePct + Math.random() * 0.08));
        this.currentDefArmyHp = Math.max(isClimax ? 0 : Math.round(this.maxDefArmyPower * 0.08), this.currentDefArmyHp - dmgDef);
        dmgAtk = Math.round(this.maxAtkArmyPower * 0.06);
        this.currentAtkArmyHp = Math.max(Math.round(this.maxAtkArmyPower * 0.15), this.currentAtkArmyHp - dmgAtk);
      }
      this.updateTeamWarHpBars();

      // UI Stage Update
      const actionText = defWins
        ? `🛡️ <strong>Defenders Squad</strong> controls the phase! Vanguard: <strong>${defFighters.map(f => f.n).join(' & ')}</strong>`
        : `⚔️ <strong>Attackers Squad</strong> breaches the line! Vanguard: <strong>${atkFighters.map(f => f.n).join(' & ')}</strong>`;
      const damageText = defWins
        ? `💥 -${Math.round((dmgAtk / this.maxAtkArmyPower)*100)}% ATK ARMY HP`
        : `💥 -${Math.round((dmgDef / this.maxDefArmyPower)*100)}% DEF ARMY HP`;

      this.updateClashStage(defFighters, atkFighters, actionText, phase.badge, phaseCombo, damageText);

      // Log phase details
      if (detail !== 'quick') {
        await this.addLogEntry(log, `⚡ ${phase.badge}: ${phase.name}`, 'phase-header', cancelled);
        await this.addLogEntry(log, phase.desc, 'matchup', cancelled);
        await sleep(250);

        if (phaseCombo) {
          await this.addLogEntry(log, `✨ SQUAD SYNERGY: ${phaseCombo.name} — ${phaseCombo.desc}`, 'xfactor', cancelled);
          this.audio.play('xfactor');
          await sleep(350);
        }

        const winClass = defWins ? 'defender-win' : 'attacker-win';
        const winTag = defWins ? '🛡️ DEFENDERS' : '⚔️ ATTACKERS';
        const leadFighters = defWins ? defFighters.map(f => f.n).join(' & ') : atkFighters.map(f => f.n).join(' & ');
        await this.addLogEntry(log, `${winTag} DOMINATE PHASE ${i+1}! (${winProb}% odds). Spearhead: ${leadFighters}. ${damageText}`, winClass, cancelled);
        this.audio.play('impact');
        await sleep(detail === 'legendary' ? 1000 : detail === 'epic' ? 750 : 500);
      }

      // Record result object
      const phaseResult = {
        phaseIndex: i + 1,
        phaseName: phase.name,
        phaseBadge: phase.badge,
        defWins,
        winProb,
        defPower: defScoreVal,
        atkPower: atkScoreVal,
        winner: defWins ? defFighters[0] : atkFighters[0],
        loser: defWins ? atkFighters[0] : defFighters[0],
        defender: defFighters[0] || defTeam[0],
        attacker: atkFighters[0] || atkTeam[0],
        keyFighters: { def: defFighters, atk: atkFighters },
        combo: phaseCombo,
        damageText
      };
      results.push(phaseResult);

      // Score update
      document.getElementById('def-score').textContent = defScore;
      document.getElementById('atk-score').textContent = atkScore;

      // Plot twist check (between phases)
      if (GameState.settings.plotTwists && !cancelled && i < totalPhases - 1 && i >= 1) {
        const freq = GameState.settings.plotTwistFreq;
        const twistChance = freq === 1 ? 0.25 : freq === 2 ? 0.45 : 0.7;
        if (Math.random() < twistChance) {
          const twist = PLOT_TWISTS[Math.floor(Math.random() * PLOT_TWISTS.length)];
          allTwists.push(twist);
          this.applyPlotTwist(twist, defTeam, atkTeam);

          if (detail !== 'quick') {
            const twistBanner = document.getElementById('xfactor-banner');
            if (twistBanner) {
              twistBanner.style.display = 'block';
              twistBanner.style.borderColor = 'var(--magenta)';
              twistBanner.innerHTML = `<strong>🔄 BATTLEFIELD TWIST: ${twist.name}</strong> — ${twist.desc}`;
            }
            await this.addLogEntry(log, `🔄 PLOT TWIST: ${twist.name}`, 'twist', cancelled);
            await this.addLogEntry(log, twist.desc, 'twist', cancelled);
            this.audio.play('twist');
            await sleep(detail === 'legendary' ? 850 : 450);
            if (twistBanner) {
              twistBanner.style.display = 'none';
              twistBanner.style.borderColor = 'var(--gold)';
            }
          }
        }
      }
    }

    // Determine final victory based on total power & phases won
    const defWon = defScore > atkScore || (defScore === atkScore && this.currentDefArmyHp >= this.currentAtkArmyHp);
    if (defWon) {
      this.currentAtkArmyHp = 0;
      this.currentDefArmyHp = Math.max(15, this.currentDefArmyHp);
    } else {
      this.currentDefArmyHp = 0;
      this.currentAtkArmyHp = Math.max(15, this.currentAtkArmyHp);
    }
    this.updateTeamWarHpBars();

    this.clearSquadActing();
    document.getElementById('def-score').textContent = defScore;
    document.getElementById('atk-score').textContent = atkScore;
    document.getElementById('battle-progress-fill').style.width = '100%';
    document.getElementById('battle-progress-text').textContent = 'Faction War Concluded';

    GameState.defScore = defScore;
    GameState.atkScore = atkScore;
    GameState.matchResults = results;
    GameState.xFactorsApplied = allXFactors;
    GameState.twistsApplied = allTwists;

    const totalDefPower = defTeam.reduce((s, c) => s + getTotalPower(c._stats), 0);
    const totalAtkPower = atkTeam.reduce((s, c) => s + getTotalPower(c._stats), 0);
    GameState.winProb = Math.round((totalDefPower / (totalDefPower + totalAtkPower)) * 100);

    GameState.mvp = this.determineMVP(results, defTeam, atkTeam, defWon);

    this.storyChapters = this.generateBattleStory(defTeam, atkTeam, results, arena, allXFactors, allTwists, defWon, GameState.mvp);
    this.currentStoryChapter = 0;
    this.renderStoryChapter();

    if (detail !== 'quick') {
      await sleep(1000);
    }

    this.showResults(defWon);
  }

  generateBattleStory(defTeam, atkTeam, results, arena, xFactors, twists, defWon, mvp) {
    const arenaName = arena ? arena.name : 'the Grand Arena';
    const arenaDesc = arena ? arena.desc : 'a neutral cosmic battlefield';
    const defLeader = defTeam[0] ? defTeam[0].n : 'the Defending Commander';
    const atkLeader = atkTeam[0] ? atkTeam[0].n : 'the Vanguard Invader';
    const mvpName = mvp ? mvp.n : (defWon ? defLeader : atkLeader);

    const chapters = [
      {
        title: 'PROLOGUE: FACTION MOBILIZATION',
        subtitle: `Two mighty squads deploy across ${arenaName}`,
        paragraphs: [
          `The sky fractured open above ${arenaName}, casting an eerie, charged luminance across ${arenaDesc}. Two full combat factions assembled on opposing fronts, marshaling superhuman champions, mythic deities, sci-fi armaments, and tactical legends.`,
          `Anchoring the line of protection stood <strong>${defLeader}</strong> alongside their entire squadron of defenders, holding defensive formations to guard the citadel. On the opposing perimeter, <strong>${atkLeader}</strong> marshaled the attacking armada into an aggressive assault formation.`,
          `With a collective battle roar, both armies surged forward into full-scale warfare. This was not a sequence of isolated duels—this was all-out team warfare.`
        ]
      },
      {
        title: 'CHAPTER 1: THE VANGUARD COLLISION',
        subtitle: 'Frontline tanks and artillery salvos clash',
        paragraphs: [
          results[0]
            ? `The opening engagement erupted as frontline vanguards slammed into one another with seismic force. ${results[0].defWins ? `The defenders held the perimeter with unrelenting grit, repelling the charge and inflicting crushing counter-damage!` : `The attackers surged through the initial barricades with brutal momentum, gaining the early offensive advantage!`}`
            : `Frontline heavyweights met in the center of the arena, trading earth-shattering strikes while ranged artillery blanketed the battlefield.`
        ]
      },
      {
        title: 'CHAPTER 2: TACTICAL FLANKS & SYNERGY STRIKES',
        subtitle: 'Strategists maneuver and team combos ignite',
        paragraphs: [
          results[1]
            ? `As the engagement broadened, strategists identified vulnerabilities in the battle lines. ${results[1].defWins ? `The defenders executed a brilliant tactical pincer maneuver, encircling advancing squads.` : `The attackers executed a lightning flank, cutting through defensive positions.`}`
            : `Agile skirmishers and tactical minds orchestrated maneuvers across the terrain.`,
          results[2] && results[2].combo
            ? `The arena shook as team synergy reached critical mass! <strong>${results[2].combo.name}</strong> ignited: ${results[2].combo.desc}`
            : `Heroes on both sides pooled their powers, unleashing devastating synchronized volleys.`
        ]
      },
      {
        title: 'CHAPTER 3: BATTLEFIELD CHAOS & THE TURNING POINT',
        subtitle: 'Unforeseen catalysts twist the tides of war',
        paragraphs: [
          xFactors && xFactors.length > 0
            ? `Battlefield anomalies surged through the ranks! Most notably, ${xFactors.slice(0, 3).map(xf => `<strong>${xf.name}</strong> empowered <em>${xf.target}</em> (${xf.desc})`).join('; while ')}.`
            : `The harsh atmosphere of ${arenaName} tested the endurance and adaptability of every fighter.`,
          twists && twists.length > 0
            ? `At the height of the clash, a dramatic turning point altered the balance: <strong>${twists[0].name}</strong>! ${twists[0].desc}`
            : `Both squads pushed through exhaustion, trading fierce team salvos across the cratered arena.`
        ]
      },
      {
        title: 'CHAPTER 4: THE FINAL DECISIVE STAND',
        subtitle: defWon ? 'The Defenders Stand Victorious!' : 'The Attacker Armada Triumphs!',
        paragraphs: [
          defWon
            ? `In the climactic finale, the entire defending squad converged in one unstoppable counter-offensive. Led by the heroic valor of <strong>${mvpName}</strong>, the defenders shattered the enemy line, scattering the attackers and securing an epochal victory!`
            : `Despite heroic defensive resistance, the relentless momentum of the attacker army proved overwhelming! <strong>${mvpName}</strong> led the final decisive breakthrough, shattering the last bastion of defense and seizing total domination!`,
          `As silence settled across ${arenaName}, the legend of this epic squad war was etched into the annals of history.`
        ]
      }
    ];

    return chapters;
  }

  renderStoryChapter() {
    const body = document.getElementById('story-body');
    const titleEl = document.getElementById('story-chapter-title');
    const countEl = document.getElementById('story-chapter-count');
    if (!body || !this.storyChapters || this.storyChapters.length === 0) {
      if (body) body.innerHTML = '<p class="story-paragraph" style="font-style:italic;color:var(--text-dim)">Story chronicle will generate as the war unfolds...</p>';
      return;
    }

    const ch = this.storyChapters[this.currentStoryChapter];
    if (titleEl) titleEl.textContent = ch.title;
    if (countEl) countEl.textContent = `Chapter ${this.currentStoryChapter + 1} of ${this.storyChapters.length}`;

    body.innerHTML = `
      <div class="story-chapter-block">
        <div class="story-chapter-header">
          <span style="font-size:1.3rem">⚡</span>
          <div class="story-chapter-title">${ch.subtitle}</div>
        </div>
        ${ch.paragraphs.map(p => `<p class="story-paragraph">${p}</p>`).join('')}
      </div>
    `;
  }

  renderStoryFull() {
    const body = document.getElementById('story-body');
    const titleEl = document.getElementById('story-chapter-title');
    const countEl = document.getElementById('story-chapter-count');
    if (!body || !this.storyChapters) return;

    if (titleEl) titleEl.textContent = 'COMPLETE WAR CHRONICLE';
    if (countEl) countEl.textContent = `Full Epic Story (${this.storyChapters.length} Chapters)`;

    body.innerHTML = this.storyChapters.map(ch => `
      <div class="story-chapter-block" style="margin-bottom:28px;border-bottom:1px solid var(--glass-border);padding-bottom:20px">
        <div class="story-chapter-header">
          <span style="font-size:1.2rem">📜</span>
          <h4 style="font-family:var(--font-display);color:var(--gold);font-size:1.15rem">${ch.title}</h4>
        </div>
        <div class="story-chapter-title" style="font-size:0.95rem;color:var(--cyan);margin-bottom:12px">${ch.subtitle}</div>
        ${ch.paragraphs.map(p => `<p class="story-paragraph">${p}</p>`).join('')}
      </div>
    `).join('');
  }

  applyPlotTwist(twist, defTeam, atkTeam) {
    switch(twist.type) {
      case 'rally': {
        const losingTeam = GameState.defScore <= GameState.atkScore ? defTeam : atkTeam;
        losingTeam.forEach(c => { c._stats.p += 5; c._stats.d += 5; c._totalPower = getTotalPower(c._stats); });
        break;
      }
      case 'curse': {
        const leadingTeam = GameState.defScore >= GameState.atkScore ? defTeam : atkTeam;
        leadingTeam.forEach(c => { c._stats.p -= 3; c._stats.h -= 3; c._totalPower = getTotalPower(c._stats); });
        break;
      }
      case 'power_steal': {
        if (defTeam.length > 0 && atkTeam.length > 0) {
          const src = atkTeam[Math.floor(Math.random() * atkTeam.length)];
          const tgt = defTeam[Math.floor(Math.random() * defTeam.length)];
          tgt._stats.h += Math.round(src._stats.h * 0.3);
          src._stats.h = Math.round(src._stats.h * 0.7);
          tgt._totalPower = getTotalPower(tgt._stats);
          src._totalPower = getTotalPower(src._stats);
        }
        break;
      }
      default: break;
    }
  }

  determineMVP(results, defTeam, atkTeam, defWon) {
    const scores = new Map();
    const winningTeam = defWon ? defTeam : atkTeam;

    results.forEach((r, idx) => {
      const isFinal = idx === results.length - 1;
      const fighters = r.defWins ? r.keyFighters?.def : r.keyFighters?.atk;
      if (fighters) {
        fighters.forEach(f => {
          const cur = scores.get(f.n) || { char: f, score: 0 };
          cur.score += isFinal ? 15 : 10;
          cur.score += getTotalPower(f._stats) / 10;
          scores.set(f.n, cur);
        });
      }
      if (r.combo && r.combo.partners) {
        r.combo.partners.forEach(p => {
          const cur = scores.get(p.n) || { char: p, score: 0 };
          cur.score += 8;
          scores.set(p.n, cur);
        });
      }
    });

    winningTeam.forEach(c => {
      const cur = scores.get(c.n) || { char: c, score: 0 };
      cur.score += 10 + (getTotalPower(c._stats) / 15);
      scores.set(c.n, cur);
    });

    let bestChar = null;
    let bestScore = -1;
    for (const [, data] of scores.entries()) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestChar = data.char;
      }
    }

    if (!bestChar) {
      bestChar = winningTeam[0] || defTeam[0];
    }
    return bestChar;
  }

  async addLogEntry(log, text, className, cancelled) {
    if (cancelled || !log) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${className}`;
    entry.textContent = text;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
    await sleep(40);
  }

  skipBattle() {
    if (this._cancelBattle) this._cancelBattle();

    if (GameState.matchResults.length === 0) {
      const defTeam = GameState.defenders.map(c => ({ ...c, _stats: {...c._stats}, _side: 'defender' }));
      const atkTeam = GameState.attackers.map(c => ({ ...c, _stats: {...c._stats}, _side: 'attacker' }));
      let defScore = 0, atkScore = 0;
      const results = [];

      const warPhases = [
        { name: 'Vanguard Collision & Frontline Charge', badge: 'WAR PHASE 1: VANGUARD CLASH', statFocus: (agg) => agg.avgD * 0.6 + agg.avgP * 0.4 },
        { name: 'Tactical Maneuvers & Flanking Assault', badge: 'WAR PHASE 2: TACTICAL MANEUVERS', statFocus: (agg) => agg.avgI * 0.5 + agg.avgS * 0.3 + agg.avgV * 0.2 },
        { name: 'Squad Synergy Combos & Heavy Barrage', badge: 'WAR PHASE 3: SQUAD SYNERGY COMBOS', statFocus: (agg) => agg.avgH * 0.45 + agg.avgP * 0.35 + agg.avgV * 0.2 },
        { name: 'Battlefield Chaos & Turning Point Crisis', badge: 'WAR PHASE 4: TURNING POINT', statFocus: (agg) => agg.avgD * 0.35 + agg.avgV * 0.35 + agg.avgP * 0.3 },
        { name: 'The Final Faction Stand & Decisive Convergence', badge: 'WAR PHASE 5: THE FINAL STAND', statFocus: (agg) => agg.power }
      ];

      for (let i = 0; i < warPhases.length; i++) {
        const phase = warPhases[i];
        const defAgg = this.getTeamAggregate(defTeam);
        const atkAgg = this.getTeamAggregate(atkTeam);
        const ds = phase.statFocus(defAgg);
        const as = phase.statFocus(atkAgg);
        const wp = Math.max(5, Math.min(95, Math.round((ds / (ds + as)) * 100)));
        const dw = Math.random() * 100 < wp;
        if (dw) defScore++; else atkScore++;

        const defFighters = defTeam.slice(0, 2);
        const atkFighters = atkTeam.slice(0, 2);
        const combo = (i === 2 || i === 3) ? this.selectSquadCombo(dw ? defTeam : atkTeam) : null;
        const dmgText = dw ? `-25% ATK ARMY HP` : `-25% DEF ARMY HP`;

        results.push({
          phaseIndex: i + 1,
          phaseName: phase.name,
          phaseBadge: phase.badge,
          defWins: dw,
          winProb: wp,
          defPower: ds,
          atkPower: as,
          winner: dw ? defFighters[0] : atkFighters[0],
          loser: dw ? atkFighters[0] : defFighters[0],
          defender: defFighters[0] || defTeam[0],
          attacker: atkFighters[0] || atkTeam[0],
          keyFighters: { def: defFighters, atk: atkFighters },
          combo,
          damageText: dmgText
        });
      }

      const defWon = defScore > atkScore || (defScore === atkScore && Math.random() > 0.5);
      if (defWon) {
        this.currentAtkArmyHp = 0;
        this.currentDefArmyHp = Math.max(25, Math.round(this.maxDefArmyPower * 0.45));
      } else {
        this.currentDefArmyHp = 0;
        this.currentAtkArmyHp = Math.max(25, Math.round(this.maxAtkArmyPower * 0.45));
      }
      this.updateTeamWarHpBars();

      GameState.defScore = defScore;
      GameState.atkScore = atkScore;
      GameState.matchResults = results;

      const tdp = defTeam.reduce((s, c) => s + getTotalPower(c._stats), 0);
      const tap = atkTeam.reduce((s, c) => s + getTotalPower(c._stats), 0);
      GameState.winProb = Math.round((tdp / (tdp + tap)) * 100);
      GameState.mvp = this.determineMVP(results, defTeam, atkTeam, defWon);

      this.storyChapters = this.generateBattleStory(defTeam, atkTeam, results, GameState.activeArena, GameState.xFactorsApplied, GameState.twistsApplied, defWon, GameState.mvp);
      this.currentStoryChapter = 0;
      this.renderStoryChapter();
    }

    const finalDefWon = GameState.defScore > GameState.atkScore || (GameState.defScore === GameState.atkScore && this.currentDefArmyHp >= this.currentAtkArmyHp);
    this.showResults(finalDefWon);
  }

  // ── RESULTS ─────────────────────────────────────────────────
  showResults(defWon) {
    this.showScreen('screen-results');
    const md = document.getElementById('matchup-display');
    if (md) md.style.display = 'none';

    // Update history
    GameState.history.played++;
    if (defWon) {
      GameState.history.wins++;
      GameState.history.streak++;
      this.audio.play('victory');
      spawnConfetti();
    } else {
      GameState.history.losses++;
      GameState.history.streak = 0;
      this.audio.play('defeat');
    }
    this.saveHistory();
    this.updateStatsDisplay();

    // Banner
    const banner = document.getElementById('result-banner');
    banner.className = 'result-banner ' + (defWon ? 'victory' : 'defeat');
    document.getElementById('result-text').textContent = defWon ? 'VICTORY' : 'DEFEAT';
    document.getElementById('result-subtitle').textContent = defWon
      ? 'Your squad united and shattered the enemy armada!'
      : 'The attacker faction overwhelmed your defensive line!';

    // Win probability
    document.getElementById('result-winprob').textContent = GameState.winProb + '%';

    // Final score (phases won)
    document.getElementById('final-def-score').textContent = GameState.defScore;
    document.getElementById('final-atk-score').textContent = GameState.atkScore;

    // MVP & Honors
    const mvpContent = document.getElementById('mvp-content');
    if (GameState.mvp) {
      const ch = GameState.mvp;
      const catColor = CAT_COLORS[ch.category] || 'cat-bg-marvel';
      const side = ch._side === 'defender' ? '🛡️ Defender' : '⚔️ Attacker';
      const role = this.getFighterRole(ch);

      mvpContent.innerHTML = `
        <div class="char-card-img ${catColor}">
          ${ch.n.charAt(0)}
        </div>
        <div>
          <div class="mvp-name">${ch.n}</div>
          <div class="mvp-reason">${side} • ${role.icon} ${role.title} • Total Power: ${ch._totalPower}</div>
          <div style="font-size:0.75rem;color:var(--text-dim);margin-top:4px">Led decisive phase assaults and spearheaded squad warfare!</div>
        </div>
      `;
      const mvpImg = mvpContent.querySelector('.char-card-img');
      this.imageResolver.applyImage(mvpImg, ch);
    }

    // Team War Phases Report
    const matchupsList = document.getElementById('matchups-list');
    matchupsList.innerHTML = '';
    GameState.matchResults.forEach(r => {
      const row = document.createElement('div');
      row.className = 'war-phase-row';
      const badgeClass = r.defWins ? 'phase-def-win' : 'phase-atk-win';
      const badgeText = r.defWins ? '🛡️ DEFENDERS' : '⚔️ ATTACKERS';
      const defKey = r.keyFighters?.def?.map(f => f.n).join(' & ') || r.defender?.n || 'Vanguard';
      const atkKey = r.keyFighters?.atk?.map(f => f.n).join(' & ') || r.attacker?.n || 'Vanguard';

      let comboDetail = '';
      if (r.combo) {
        comboDetail = `<div style="color:var(--gold);font-size:0.75rem;margin-top:3px">✨ <strong>${r.combo.name}</strong>: ${r.combo.desc}</div>`;
      }

      row.innerHTML = `
        <span class="war-phase-badge ${badgeClass}">${badgeText}</span>
        <div class="war-phase-details">
          <div class="war-phase-title">Phase ${r.phaseIndex}: ${r.phaseName}</div>
          <div class="war-phase-summary">
            <span>🛡️ ${defKey}</span> <span style="color:var(--text-dim)">vs</span> <span>⚔️ ${atkKey}</span>
          </div>
          ${comboDetail}
        </div>
        <div style="text-align:right">
          <span class="war-phase-impact">${r.damageText || (r.defWins ? '-25% ATK HP' : '-25% DEF HP')}</span>
          <div style="font-size:0.68rem;color:var(--text-dim)">${r.winProb}% predicted</div>
        </div>
      `;
      matchupsList.appendChild(row);
    });

    // X-Factors
    const xfList = document.getElementById('xfactors-list');
    if (GameState.xFactorsApplied.length > 0) {
      document.getElementById('xfactors-summary').style.display = '';
      xfList.innerHTML = GameState.xFactorsApplied.map(xf =>
        `<div class="matchup-row"><span style="color:var(--gold)">${xf.name}</span> <span>${xf.desc}</span></div>`
      ).join('');
    } else {
      document.getElementById('xfactors-summary').style.display = 'none';
    }

    // What-if analysis
    const whatifText = document.getElementById('whatif-text');
    const whatifOptimal = document.getElementById('whatif-optimal');

    const allChars = [...GameState.currentChars].sort((a, b) => b._totalPower - a._totalPower);
    const optimalDef = allChars.slice(0, GameState.defenders.length);
    const optimalDefPower = optimalDef.reduce((s, c) => s + c._totalPower, 0);
    const actualDefPower = GameState.defenders.reduce((s, c) => s + c._totalPower, 0);
    const diff = optimalDefPower - actualDefPower;

    if (diff === 0) {
      whatifText.textContent = '🎯 Perfect! You ranked optimally — the strongest characters formed your defensive squad!';
      whatifOptimal.textContent = '';
    } else {
      whatifText.textContent = `Your squad's total combat power: ${actualDefPower}. Optimal squad drafting would have yielded: ${optimalDefPower} (+${diff} power).`;
      whatifOptimal.textContent = `Optimal defense squad: ${optimalDef.map(c => c.n).join(', ')}`;
    }
  }

  rematch() {
    if (GameState.lastChars) {
      GameState.currentChars = GameState.lastChars.map(c => {
        const copy = {...c};
        copy._stats = generateStats(copy.n, copy.t, copy.p || 'balanced');
        copy._totalPower = getTotalPower(copy._stats);
        return copy;
      });
      this.drawnPool = [...GameState.currentChars].sort(() => Math.random() - 0.5);
      this.rankingSlots = new Array(this.drawnPool.length).fill(null);
      this.currentDrawIndex = 0;
      this.showDraftScreen();
    } else {
      this.startGame();
    }
  }

  initRosterModal() {
    const modal = document.getElementById('roster-modal');
    const openBtn = document.getElementById('btn-open-roster');
    const closeBtn = document.getElementById('roster-close-btn');
    const searchInput = document.getElementById('roster-search-input');
    const catFilter = document.getElementById('roster-cat-filter');
    const tierFilter = document.getElementById('roster-tier-filter');

    const fillBtn = document.getElementById('btn-squad-random-fill');
    const clearBtn = document.getElementById('btn-squad-clear');
    const playBtn = document.getElementById('btn-squad-play');

    if (!modal || !openBtn) return;

    openBtn.addEventListener('click', () => {
      modal.style.display = 'flex';
      this.updateCustomSquadDock();
      this.renderRosterGrid();
      this.audio.play('click');
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        this.audio.play('click');
      });
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    const updateFilter = () => this.renderRosterGrid();
    if (searchInput) searchInput.addEventListener('input', updateFilter);
    if (catFilter) catFilter.addEventListener('change', updateFilter);
    if (tierFilter) tierFilter.addEventListener('change', updateFilter);

    if (fillBtn) fillBtn.addEventListener('click', () => this.fillRestCustomSquad());
    if (clearBtn) clearBtn.addEventListener('click', () => this.clearCustomSquad());
    if (playBtn) playBtn.addEventListener('click', () => this.startWithCustomSquad());
  }

  toggleSquadMember(ch) {
    const targetCount = GameState.settings.charCount || 10;
    const idx = this.customSquad.findIndex(s => s.n === ch.n);
    if (idx >= 0) {
      this.customSquad.splice(idx, 1);
    } else {
      if (this.customSquad.length >= targetCount) {
        this.customSquad.shift(); // rotate oldest out if already full
      }
      this.customSquad.push(ch);
    }
    this.audio.play('click');
    this.updateCustomSquadDock();
    this.renderRosterGrid();
  }

  updateCustomSquadDock() {
    const targetCount = GameState.settings.charCount || 10;
    const countEl = document.getElementById('custom-squad-count');
    const tray = document.getElementById('dock-roster-tray');
    const playBtn = document.getElementById('btn-squad-play');

    if (countEl) countEl.textContent = `${this.customSquad.length} / ${targetCount}`;
    if (playBtn) {
      playBtn.disabled = this.customSquad.length === 0;
      playBtn.innerHTML = `⚔️ DRAFT THIS SQUAD (${this.customSquad.length}/${targetCount})`;
    }

    if (tray) {
      if (this.customSquad.length === 0) {
        tray.innerHTML = `<span class="dock-empty-hint">Click characters below to draft your dream custom team (or fill randomly)</span>`;
      } else {
        tray.innerHTML = '';
        this.customSquad.forEach((ch, i) => {
          const chip = document.createElement('div');
          chip.className = 'dock-chip';
          const catColor = CAT_COLORS[ch.category] || 'cat-bg-marvel';
          chip.innerHTML = `
            <span class="dock-chip-avatar ${catColor}"></span>
            <span>${ch.n}</span>
            <button class="dock-chip-remove" title="Remove">✕</button>
          `;
          this.imageResolver.applyImage(chip.querySelector('.dock-chip-avatar'), ch);
          chip.querySelector('.dock-chip-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            this.customSquad.splice(i, 1);
            this.audio.play('click');
            this.updateCustomSquadDock();
            this.renderRosterGrid();
          });
          tray.appendChild(chip);
        });
      }
    }
  }

  fillRestCustomSquad() {
    const targetCount = GameState.settings.charCount || 10;
    const needed = targetCount - this.customSquad.length;
    if (needed <= 0) return;

    let pool = [];
    const cats = GameState.settings.categories && GameState.settings.categories.length > 0
      ? GameState.settings.categories
      : Object.keys(window.CHARACTER_DB);

    cats.forEach(cat => {
      if (window.CHARACTER_DB[cat]) {
        pool.push(...window.CHARACTER_DB[cat].map(c => ({ ...c, category: cat })));
      }
    });

    const selectedNames = new Set(this.customSquad.map(c => c.n));
    pool = pool.filter(c => !selectedNames.has(c.n));
    pool.sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(needed, pool.length); i++) {
      this.customSquad.push(pool[i]);
    }
    this.audio.play('whoosh');
    this.updateCustomSquadDock();
    this.renderRosterGrid();
  }

  clearCustomSquad() {
    this.customSquad = [];
    this.audio.play('click');
    this.updateCustomSquadDock();
    this.renderRosterGrid();
  }

  startWithCustomSquad() {
    if (this.customSquad.length === 0) return;
    const targetCount = GameState.settings.charCount || 10;
    if (this.customSquad.length < targetCount) {
      this.fillRestCustomSquad();
    }

    GameState.currentChars = this.customSquad.map(c => {
      const copy = { ...c };
      copy._stats = generateStats(copy.n, copy.t, copy.p || 'balanced');
      copy._totalPower = getTotalPower(copy._stats);
      return copy;
    });

    const modal = document.getElementById('roster-modal');
    if (modal) modal.style.display = 'none';

    GameState.currentChars.sort(() => Math.random() - 0.5);
    GameState.lastChars = [...GameState.currentChars];

    this.drawnPool = [...GameState.currentChars];
    this.rankingSlots = new Array(this.drawnPool.length).fill(null);
    this.currentDrawIndex = 0;

    this.audio.play('battle');
    this.showDraftScreen();
  }

  renderRosterGrid() {
    const grid = document.getElementById('roster-grid');
    const summary = document.getElementById('roster-count-summary');
    if (!grid) return;

    const search = (document.getElementById('roster-search-input')?.value || '').toLowerCase().trim();
    const cat = document.getElementById('roster-cat-filter')?.value || 'all';
    const tier = document.getElementById('roster-tier-filter')?.value || 'all';

    let all = [];
    for (let k in window.CHARACTER_DB) {
      if (cat === 'all' || cat === k) {
        all.push(...window.CHARACTER_DB[k].map(c => ({ ...c, category: k })));
      }
    }

    if (tier !== 'all') {
      all = all.filter(c => c.t === tier);
    }

    if (search) {
      all = all.filter(c => 
        c.n.toLowerCase().includes(search) || 
        (c.u && c.u.toLowerCase().includes(search)) ||
        (c.a && c.a.some(ab => ab.toLowerCase().includes(search)))
      );
    }

    if (summary) summary.textContent = `Showing ${all.length.toLocaleString()} characters of 1,585`;
    grid.innerHTML = '';

    const limit = Math.min(all.length, 120);
    for (let i = 0; i < limit; i++) {
      const ch = all[i];
      const tierCfg = TIER_CONFIG[ch.t] || TIER_CONFIG['C'];
      const catColor = CAT_COLORS[ch.category] || 'cat-bg-marvel';
      const inSquad = this.customSquad.some(s => s.n === ch.n);
      const card = document.createElement('div');
      card.className = 'roster-card' + (inSquad ? ' in-squad' : '');
      card.innerHTML = `
        <div class="roster-card-avatar ${catColor}">
          ${ch.n.charAt(0)}
        </div>
        <div class="roster-card-body">
          <div class="roster-card-name" title="${ch.n}">${ch.n}</div>
          <div class="roster-card-sub">
            <span class="roster-card-tier ${tierCfg.color}">${ch.t}</span>
            <span>${ch.u || CAT_LABELS[ch.category] || ''}</span>
          </div>
        </div>
        <div class="roster-card-action">
          <button class="roster-card-btn">${inSquad ? '✓ In Squad' : '+ Draft'}</button>
        </div>
      `;
      const avatar = card.querySelector('.roster-card-avatar');
      this.imageResolver.applyImage(avatar, ch);

      card.addEventListener('click', () => this.toggleSquadMember(ch));
      grid.appendChild(card);
    }
  }
}

// ─── UTILITIES ────────────────────────────────────────────────
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.game = new BlindRankBattle();
});