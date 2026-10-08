// Design spec cards: a structured note attached to a section (or root frame) that developers
// and their AI agents (Claude via Figma MCP) read before implementing the design.
//
// The spec lives in two places:
//  - as JSON in shared plugin data on the target node (source of truth, read by this plugin)
//  - as a normal frame of plain text layers (the "card"), so Figma MCP / Dev Mode can read it
// The card sits inside the section it documents. For a root frame (a screen) it sits next to
// the frame, because putting it inside the screen would make it look like part of the UI.
const NS = 'pydespec'; // namespace may only contain letters and digits
const KEY = 'spec';
const CARD_KEY = 'card';
const IDX_PREFIX = 'idx:'; // per-target index entries on the document root, used by the overview

figma.showUI(__html__, { width: 360, height: 640, themeColors: true });

// `color` is the status pill on the card.
// `emoji` goes into the target's layer name (see syncName).
const STATUSES = {
  wip: { label: 'Work in progress', emoji: '🚧', color: '#D97706' },
  review: { label: 'In review', emoji: '👀', color: '#7C5CFF' },
  ready: { label: 'Ready for development', emoji: '✅', color: '#14A367' }
};

// ---------- Helpers ----------

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
function solid(h, opacity) {
  return { type: 'SOLID', color: hex(h), opacity: opacity === undefined ? 1 : opacity };
}
function userName() {
  return figma.currentUser && figma.currentUser.name ? figma.currentUser.name : 'Unknown';
}
function pageOf(node) {
  let n = node;
  while (n && n.type !== 'PAGE') n = n.parent;
  return n;
}
function pad(n) { return (n < 10 ? '0' : '') + n; }
function fmtDate(ts) {
  const d = new Date(ts);
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ---------- Targets & cards ----------

function isCard(node) {
  return node.type === 'FRAME' && node.getSharedPluginData(NS, CARD_KEY) !== '';
}
function cardInfo(card) {
  try { return JSON.parse(card.getSharedPluginData(NS, CARD_KEY)); } catch (e) { return {}; }
}

// A spec attaches to a section, or to a root frame (directly on the page or directly in a section).
function isValidTarget(node) {
  if (node.type === 'SECTION') return true;
  return node.type === 'FRAME' && !isCard(node) && !!node.parent &&
    (node.parent.type === 'PAGE' || node.parent.type === 'SECTION');
}

// Resolves a selected node to its spec target. Selecting the card (or anything inside it)
// resolves to the node the card documents, so the relaunch button works from the card too.
async function resolveTarget(node) {
  for (let n = node; n && n.type !== 'PAGE' && n.type !== 'DOCUMENT'; n = n.parent) {
    if (isCard(n)) {
      const info = cardInfo(n);
      // Section cards always document the section they sit in. This also keeps copied
      // sections correct, where the copied card still holds the original section's id.
      if (info.kind === 'section') return n.parent && n.parent.type === 'SECTION' ? n.parent : null;
      const t = info.targetId ? await figma.getNodeByIdAsync(info.targetId) : null;
      return t && isValidTarget(t) ? t : null;
    }
  }
  return isValidTarget(node) ? node : null;
}

async function findCard(target, data) {
  if (target.type === 'SECTION') {
    const card = target.children.find(isCard);
    if (card && cardInfo(card).targetId !== target.id) {
      card.setSharedPluginData(NS, CARD_KEY, JSON.stringify({ kind: 'section', targetId: target.id }));
    }
    return card || null;
  }
  if (data && data.cardId) {
    const card = await figma.getNodeByIdAsync(data.cardId);
    if (card && !card.removed && isCard(card) && cardInfo(card).targetId === target.id) return card;
  }
  return null;
}

function readSpec(node) {
  try {
    const raw = node.getSharedPluginData(NS, KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const o = d.owners || {};
    return {
      v: 1,
      status: STATUSES[d.status] ? d.status : 'wip',
      owners: {
        design: Array.isArray(o.design) ? o.design : [],
        dev: Array.isArray(o.dev) ? o.dev : [],
        product: Array.isArray(o.product) ? o.product : []
      },
      jira: Array.isArray(d.jira) ? d.jira : [],
      slack: Array.isArray(d.slack) ? d.slack : [],
      notes: typeof d.notes === 'string' ? d.notes : '',
      by: d.by || null,
      at: d.at || null,
      cardId: d.cardId || null,
      ready: d.ready ? { at: d.ready.at, by: d.ready.by } : null // when, and by whom, it was marked Ready
    };
  } catch (e) {
    return null;
  }
}
function writeSpec(node, data) {
  node.setSharedPluginData(NS, KEY, JSON.stringify(data));
}

// ---------- Card rendering ----------

// Ink colors are translucent black over the sticky note's paper color.
const STICKY = '#FFEFA6';
const C = { link: '#2B49D6' };
const INK = { text: 1, secondary: 0.62, tertiary: 0.4 };
const FONTS = {
  regular: { family: 'Inter', style: 'Regular' },
  medium: { family: 'Inter', style: 'Medium' },
  semibold: { family: 'Inter', style: 'Semi Bold' },
  bold: { family: 'Inter', style: 'Bold' }
};
function ensureFonts() {
  return Promise.all(Object.keys(FONTS).map((k) => figma.loadFontAsync(FONTS[k])));
}

// `color` is a hex, or one of the INK levels ('text' | 'secondary' | 'tertiary').
function text(chars, font, size, color, name) {
  const t = figma.createText();
  t.fontName = FONTS[font];
  t.fontSize = size;
  t.characters = chars;
  t.fills = [INK[color] !== undefined ? solid('#1E1E1E', INK[color]) : solid(color)];
  t.lineHeight = { unit: 'PERCENT', value: 145 };
  if (name) t.name = name;
  return t;
}
function stack(name, dir, gap) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.itemSpacing = gap;
  f.fills = [];
  f.clipsContent = false;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  return f;
}
// Appends a child; `fill` stretches it to the parent's width (text then wraps).
function put(parent, child, fill) {
  parent.appendChild(child);
  if (fill) {
    child.layoutSizingHorizontal = 'FILL';
    if (child.type === 'TEXT') child.textAutoResize = 'HEIGHT';
  }
  return child;
}

function heading(parent, label) {
  const t = put(parent, text(label.toUpperCase(), 'bold', 11, 'secondary', label), true);
  t.letterSpacing = { unit: 'PERCENT', value: 6 };
}

function row(parent, label, value, empty) {
  const r = put(parent, stack(label, 'HORIZONTAL', 12), true);
  const l = put(r, text(label, 'medium', 13, 'secondary', 'Label'));
  l.resize(104, l.height);
  l.textAutoResize = 'HEIGHT';
  put(r, text(value || empty, 'regular', 13, value ? 'text' : 'tertiary', 'Value'), true);
}

function links(parent, label, urls) {
  const r = put(parent, stack(label, 'HORIZONTAL', 12), true);
  const l = put(r, text(label, 'medium', 13, 'secondary', 'Label'));
  l.resize(104, l.height);
  l.textAutoResize = 'HEIGHT';
  const col = put(r, stack('Links', 'VERTICAL', 4), true);
  if (!urls.length) {
    put(col, text('None', 'regular', 13, 'tertiary', 'Value'), true);
    return;
  }
  for (const url of urls) {
    const t = put(col, text(url, 'regular', 13, C.link, 'Link'), true);
    try {
      t.setRangeHyperlink(0, url.length, { type: 'URL', value: url });
      t.textDecoration = 'UNDERLINE';
    } catch (e) {}
  }
}

function renderCard(card, target, data) {
  const st = STATUSES[data.status];
  for (const c of card.children.slice()) c.remove();

  card.name = '📋 Design Spec — ' + baseName(target);
  card.layoutMode = 'VERTICAL';
  card.primaryAxisSizingMode = 'AUTO';
  card.counterAxisSizingMode = 'FIXED';
  card.resize(440, card.height);
  card.itemSpacing = 20;
  card.paddingTop = card.paddingBottom = card.paddingLeft = card.paddingRight = 28;
  // Sticky note look: flat paper color, nearly square corners, soft lifted shadow.
  card.cornerRadius = 4;
  card.fills = [solid(STICKY)];
  card.strokes = [];
  card.effects = [
    { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 1 },
      radius: 3, spread: 0, visible: true, blendMode: 'NORMAL' },
    { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.12 }, offset: { x: 0, y: 10 },
      radius: 24, spread: -4, visible: true, blendMode: 'NORMAL' }
  ];

  // Header: eyebrow + status pill, then the target name and a one-line instruction for readers.
  const top = put(card, stack('Header', 'HORIZONTAL', 12), true);
  top.primaryAxisAlignItems = 'SPACE_BETWEEN';
  top.counterAxisAlignItems = 'CENTER';
  put(top, text('📋 DESIGN SPEC', 'bold', 12, 'secondary', 'Eyebrow'));
  const pill = put(top, stack('Status', 'HORIZONTAL', 0));
  pill.paddingTop = pill.paddingBottom = 5;
  pill.paddingLeft = pill.paddingRight = 12;
  pill.cornerRadius = 999;
  pill.fills = [solid(st.color)];
  put(pill, text(st.label, 'bold', 12, '#FFFFFF', 'Status label'));

  const titles = put(card, stack('Title', 'VERTICAL', 6), true);
  put(titles, text(baseName(target), 'bold', 22, 'text', 'Name'), true);
  put(titles, text(
    'Documents the ' + (target.type === 'SECTION' ? 'section this card sits in' : 'screen next to this card') +
    '. Developers and AI agents (e.g. Claude): read this card before implementing the design.',
    'regular', 12, 'secondary', 'About'), true);

  const status = put(card, stack('Status details', 'VERTICAL', 8), true);
  heading(status, 'Status');
  row(status, 'Status', st.label, '');
  if (data.status === 'ready' && data.ready) {
    row(status, 'Ready since', fmtDate(data.ready.at) + ' · ' + data.ready.by, '');
  }

  const owners = put(card, stack('Owners', 'VERTICAL', 8), true);
  heading(owners, 'Owners');
  row(owners, 'Design', data.owners.design.join(', '), 'Not assigned');
  row(owners, 'Development', data.owners.dev.join(', '), 'Not assigned');
  row(owners, 'Product', data.owners.product.join(', '), 'Not assigned');

  const ls = put(card, stack('Links', 'VERTICAL', 8), true);
  heading(ls, 'Links');
  links(ls, 'Jira', data.jira);
  links(ls, 'Slack', data.slack);

  const notes = put(card, stack('Notes', 'VERTICAL', 8), true);
  heading(notes, 'Notes');
  put(notes, text(data.notes.trim() || 'No notes.', 'regular', 14, data.notes.trim() ? 'text' : 'tertiary', 'Notes'), true);

  const line = figma.createRectangle();
  line.name = 'Divider';
  line.resize(10, 1);
  line.fills = [solid('#1E1E1E', 0.12)];
  put(card, line, true);
  put(card, text('Last updated by ' + data.by + ' · ' + fmtDate(data.at), 'regular', 11, 'tertiary', 'Last updated'), true);
}

// Grows a section so the card fits inside it, with breathing room.
function fitSection(section, card) {
  const w = Math.max(section.width, card.x + card.width + 80);
  const h = Math.max(section.height, card.y + card.height + 80);
  if (w !== section.width || h !== section.height) section.resizeWithoutConstraints(w, h);
}

function placeNewCard(card, target) {
  if (target.type === 'SECTION') {
    // Right of the existing content, top-aligned with it. Nothing else in the section moves.
    const others = target.children.filter((c) => c.id !== card.id);
    if (others.length) {
      card.x = Math.max.apply(null, others.map((c) => c.x + c.width)) + 80;
      card.y = Math.min.apply(null, others.map((c) => c.y));
    } else {
      card.x = 80; card.y = 80;
    }
  } else {
    card.x = target.x + target.width + 80;
    card.y = target.y;
  }
}

async function upsertCard(target, data) {
  let card = await findCard(target, data);
  const isNew = !card;
  if (isNew) {
    card = figma.createFrame();
    const parent = target.type === 'SECTION' ? target : target.parent;
    parent.appendChild(card);
  }
  card.setSharedPluginData(NS, CARD_KEY, JSON.stringify({
    kind: target.type === 'SECTION' ? 'section' : 'frame', targetId: target.id
  }));
  renderCard(card, target, data);
  if (isNew) placeNewCard(card, target);
  if (card.parent && card.parent.type === 'SECTION') fitSection(card.parent, card);
  return card;
}

function setRelaunch(target, card, data) {
  const d = { edit: 'Design spec · ' + STATUSES[data.status].label };
  target.setRelaunchData(d);
  if (card) card.setRelaunchData(d);
}

// The target's layer name shows its status after an em dash, e.g. "Checkout Flow — ✅ Ready for development",
// so the status is visible on the canvas, in the layers panel and to anyone reading the file via Figma MCP.
const NAME_SEP = ' — ';
const LEGACY_READY_PREFIX = '✅ Ready · '; // used by v1.3.0

function statusSuffix(status) {
  return NAME_SEP + STATUSES[status].emoji + ' ' + STATUSES[status].label;
}
function baseName(node) {
  let name = node.name;
  if (name.indexOf(LEGACY_READY_PREFIX) === 0) name = name.slice(LEGACY_READY_PREFIX.length);
  for (const k of Object.keys(STATUSES)) {
    const suffix = statusSuffix(k);
    if (name.length > suffix.length && name.slice(-suffix.length) === suffix) return name.slice(0, -suffix.length);
  }
  return name;
}
// `status` null removes the suffix (spec removed).
function syncName(target, status) {
  const name = baseName(target) + (status ? statusSuffix(status) : '');
  if (target.name !== name) target.name = name;
}

// ---------- Overview index ----------
// One key per target on the document root, so two people saving at once never overwrite each other.

function writeIndex(target, data) {
  const p = pageOf(target);
  figma.root.setSharedPluginData(NS, IDX_PREFIX + target.id, JSON.stringify({
    id: target.id, name: baseName(target), kind: target.type === 'SECTION' ? 'Section' : 'Frame',
    pageId: p ? p.id : null, pageName: p ? p.name : '',
    status: data.status, by: data.by, at: data.at
  }));
}
function removeIndex(id) {
  figma.root.setSharedPluginData(NS, IDX_PREFIX + id, '');
}
function readIndex() {
  const out = [];
  for (const k of figma.root.getSharedPluginDataKeys(NS)) {
    if (k.indexOf(IDX_PREFIX) !== 0) continue;
    try {
      const raw = figma.root.getSharedPluginData(NS, k);
      if (raw) out.push(JSON.parse(raw));
    } catch (e) {}
  }
  return out;
}

// Indexed lookup (no full tree walk), so this stays fast on large pages.
async function rescanPage(page) {
  await page.loadAsync();
  const nodes = page.findAllWithCriteria({
    types: ['SECTION', 'FRAME'],
    sharedPluginData: { namespace: NS, keys: [KEY] }
  });
  const found = new Set();
  for (const n of nodes) {
    if (!isValidTarget(n)) continue;
    const data = readSpec(n);
    if (!data) continue;
    found.add(n.id);
    writeIndex(n, data);
  }
  for (const e of readIndex()) {
    if (e.pageId === page.id && !found.has(e.id)) removeIndex(e.id);
  }
}

async function sendOverview() {
  await rescanPage(figma.currentPage);
  figma.ui.postMessage({ type: 'overview', entries: readIndex(), currentPageId: figma.currentPage.id });
}

// ---------- State ----------

let pushSeq = 0;

async function pushState() {
  const seq = ++pushSeq;
  const seen = new Set();
  const targets = [];
  for (const n of figma.currentPage.selection) {
    const t = await resolveTarget(n);
    if (t && !seen.has(t.id)) { seen.add(t.id); targets.push(t); }
  }
  if (seq !== pushSeq) return;

  if (targets.length !== 1) {
    figma.ui.postMessage({ type: 'state', status: targets.length ? 'multiple' : 'none', count: targets.length });
    return;
  }

  const t = targets[0];
  const data = readSpec(t);

  const p = pageOf(t);
  figma.ui.postMessage({
    type: 'state',
    status: 'ok',
    target: {
      id: t.id,
      name: baseName(t),
      kind: t.type === 'SECTION' ? 'Section' : 'Frame',
      section: t.parent && t.parent.type === 'SECTION' ? t.parent.name : null,
      page: p ? p.name : ''
    },
    spec: data,
    me: userName()
  });
}

figma.on('selectionchange', () => pushState());
figma.on('currentpagechange', () => pushState());

// ---------- People suggestions ----------

const PEOPLE_KEY = 'pyde-spec-people';
const LANG_KEY = 'pyde-spec-lang';
let lang = 'en';

// Figma only exposes the people who have this file open right now (activeUsers), so suggestions
// are built from several sources. The UI adds the team roster from team.json on GitHub.
//  - every owner ever saved in a spec in this file (shared, so the whole team sees them)
//  - names this user typed before, in any file (local)
//  - people currently in the file, and the current user
const PERSON_PREFIX = 'person:';

// One key per name on the document root, storing which roles the person was assigned to.
function registerPeople(data) {
  const roles = ['design', 'dev', 'product'];
  for (const role of roles) {
    for (const name of data.owners[role]) {
      const key = PERSON_PREFIX + name;
      let known = [];
      try { known = JSON.parse(figma.root.getSharedPluginData(NS, key) || '[]'); } catch (e) {}
      if (known.indexOf(role) === -1) {
        known.push(role);
        figma.root.setSharedPluginData(NS, key, JSON.stringify(known));
      }
    }
  }
}

async function people() {
  const map = {}; // name -> roles
  const add = (name, roles) => {
    if (!name) return;
    map[name] = map[name] || [];
    (roles || []).forEach((r) => { if (map[name].indexOf(r) === -1) map[name].push(r); });
  };
  for (const k of figma.root.getSharedPluginDataKeys(NS)) {
    if (k.indexOf(PERSON_PREFIX) !== 0) continue;
    let roles = [];
    try { roles = JSON.parse(figma.root.getSharedPluginData(NS, k) || '[]'); } catch (e) {}
    add(k.slice(PERSON_PREFIX.length), roles);
  }
  const saved = await figma.clientStorage.getAsync(PEOPLE_KEY);
  if (Array.isArray(saved)) saved.forEach((p) => typeof p === 'string' ? add(p) : add(p.name, p.roles));
  // Stored names can be removed from the suggestions; people who are here right now can't
  // (they would come straight back).
  const present = new Set();
  try { figma.activeUsers.forEach((u) => u.name && present.add(u.name)); } catch (e) {}
  if (figma.currentUser) present.add(figma.currentUser.name);
  present.forEach((n) => add(n));
  return Object.keys(map).sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, roles: map[name], removable: !present.has(name) }));
}

// Removes a name from the suggestions (file list and this user's local list).
// Specs that already list the person are left untouched.
async function forgetPerson(name) {
  figma.root.setSharedPluginData(NS, PERSON_PREFIX + name, '');
  const saved = (await figma.clientStorage.getAsync(PEOPLE_KEY)) || [];
  await figma.clientStorage.setAsync(PEOPLE_KEY, saved.filter((p) => (typeof p === 'string' ? p : p.name) !== name));
}

async function rememberPeople(data) {
  const saved = (await figma.clientStorage.getAsync(PEOPLE_KEY)) || [];
  const list = saved.map((p) => (typeof p === 'string' ? { name: p, roles: [] } : p));
  for (const role of ['design', 'dev', 'product']) {
    for (const name of data.owners[role]) {
      let p = list.find((x) => x.name === name);
      if (!p) { p = { name, roles: [] }; list.unshift(p); }
      if (p.roles.indexOf(role) === -1) p.roles.push(role);
    }
  }
  await figma.clientStorage.setAsync(PEOPLE_KEY, list.slice(0, 150));
}

async function sendPeople() {
  figma.ui.postMessage({ type: 'people', people: await people() });
}

// ---------- Messages ----------

function cleanList(a) {
  return Array.isArray(a) ? a.map((s) => String(s).trim()).filter(Boolean) : [];
}
function cleanUrls(a) {
  return cleanList(a).map((u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u));
}
function t(en, tr) { return lang === 'tr' ? tr : en; }

async function getTarget(id) {
  const node = id ? await figma.getNodeByIdAsync(id) : null;
  if (!node || node.removed || !isValidTarget(node)) {
    figma.notify(t('The section or frame no longer exists.', 'Section veya frame artık yok.'), { error: true });
    return null;
  }
  return node;
}

async function save(msg) {
  const node = await getTarget(msg.id);
  if (!node) return;
  const old = readSpec(node);
  const s = msg.spec || {};
  const now = Date.now();
  const data = {
    v: 1,
    status: STATUSES[s.status] ? s.status : 'wip',
    owners: {
      design: cleanList(s.owners && s.owners.design),
      dev: cleanList(s.owners && s.owners.dev),
      product: cleanList(s.owners && s.owners.product)
    },
    jira: cleanUrls(s.jira),
    slack: cleanUrls(s.slack),
    notes: typeof s.notes === 'string' ? s.notes : '',
    by: userName(),
    at: now,
    cardId: old ? old.cardId : null,
    ready: null
  };
  // "Ready since" keeps its original date while the status stays Ready.
  if (data.status === 'ready') {
    data.ready = old && old.status === 'ready' && old.ready ? old.ready : { at: now, by: data.by };
  }
  await ensureFonts();
  const card = await upsertCard(node, data);
  data.cardId = card.id;
  writeSpec(node, data);
  setRelaunch(node, card, data);
  syncName(node, data.status);
  writeIndex(node, data);
  registerPeople(data);
  await rememberPeople(data);
  await sendPeople();
  figma.notify(t('Design spec saved', 'Design spec kaydedildi'));
}

async function remove(msg) {
  const node = await getTarget(msg.id);
  if (!node) return;
  const data = readSpec(node);
  const card = await findCard(node, data);
  if (card) card.remove();
  node.setSharedPluginData(NS, KEY, '');
  node.setRelaunchData({});
  syncName(node, null);
  removeIndex(node.id);
  figma.notify(t('Design spec removed', 'Design spec kaldırıldı'));
}

async function goTo(id) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node || node.removed) {
    removeIndex(id);
    figma.notify(t('That section no longer exists, removed from the list.', 'Bu section artık yok, listeden kaldırıldı.'));
    return sendOverview();
  }
  const page = pageOf(node);
  if (page && page.id !== figma.currentPage.id) await figma.setCurrentPageAsync(page);
  figma.currentPage.selection = [node];
  figma.viewport.scrollAndZoomIntoView([node]);
}

figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'ready') {
      const saved = await figma.clientStorage.getAsync(LANG_KEY);
      if (saved === 'en' || saved === 'tr') lang = saved;
      figma.ui.postMessage({ type: 'prefs', lang });
      await sendPeople();
      return pushState();
    }
    if (msg.type === 'setLang') {
      if (msg.lang === 'en' || msg.lang === 'tr') {
        lang = msg.lang;
        await figma.clientStorage.setAsync(LANG_KEY, lang);
      }
      return;
    }
    if (msg.type === 'refresh') return pushState();
    if (msg.type === 'save') {
      await save(msg);
      figma.ui.postMessage({ type: 'saved' });
      return pushState();
    }
    if (msg.type === 'remove') { await remove(msg); return pushState(); }
    if (msg.type === 'overview') return sendOverview();
    if (msg.type === 'scanAll') {
      await figma.loadAllPagesAsync();
      for (const page of figma.root.children) await rescanPage(page);
      figma.notify(t('All pages scanned', 'Tüm sayfalar tarandı'));
      return sendOverview();
    }
    if (msg.type === 'goto') return goTo(msg.id);
    if (msg.type === 'forgetPerson') { await forgetPerson(String(msg.name)); return sendPeople(); }
  } catch (e) {
    figma.notify(t('Something went wrong: ', 'Bir hata oluştu: ') + (e && e.message ? e.message : e), { error: true });
    figma.ui.postMessage({ type: 'error' });
  }
};
