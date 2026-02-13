// Koine Cards PWA (Phase 1) — dumb viewer
// Loads cards/*.txt listed in cards/index.json, groups by DOMAIN: header.

const $ = (id) => document.getElementById(id);

const views = {
  domain: $("domainView"),
  list: $("cardListView"),
  card: $("cardView"),
};

const els = {
  backBtn: $("backBtn"),
  domainList: $("domainList"),
  cardList: $("cardList"),
  domainTitle: $("domainTitle"),
  cardTitle: $("cardTitle"),
  cardMeta: $("cardMeta"),
  cardBody: $("cardBody"),
};

let state = {
  domains: [],
  cardsByDomain: new Map(),
  currentDomain: null,
  currentCard: null,
};

function show(viewName) {
  views.domain.hidden = viewName !== "domain";
  views.list.hidden = viewName !== "list";
  views.card.hidden = viewName !== "card";
  els.backBtn.hidden = viewName === "domain";
}

function parseCard(raw, filename) {
  const norm = raw.replace(/\r\n/g, "\n");
  const lines = norm.split("\n");

  const firstNonEmpty = lines.find(l => l.trim().length > 0) || filename;
  const find = (prefix) => lines.find(l => l.startsWith(prefix));

  const domain = (find("DOMAIN:") || "DOMAIN: Ἄγνωστος").replace("DOMAIN:", "").trim();
  const cardLine = find("CARD:") ? find("CARD:").replace("CARD:", "").trim() : "";
  const statusLine = find("STATUS:") ? find("STATUS:").replace("STATUS:", "").trim() : "";
  const dateLine = find("DATE:") ? find("DATE:").replace("DATE:", "").trim() : "";

  const dividerIdx = lines.findIndex(l => l.trim() === "--- CARD TEXT BELOW ---");
  const body = dividerIdx >= 0 ? lines.slice(dividerIdx + 1).join("\n").trim() : norm.trim();

  return {
    id: filename,
    filename,
    title: firstNonEmpty,
    domain,
    meta: [cardLine, statusLine, dateLine].filter(Boolean).join("\n"),
    body
  };
}

async function loadIndex() {
  const resp = await fetch("./cards/index.json", { cache: "no-store" });
  if (!resp.ok) throw new Error("Missing cards/index.json");
  return await resp.json();
}

async function loadAllCards(fileList) {
  const cards = [];
  for (const f of fileList) {
    const resp = await fetch("./cards/" + f, { cache: "no-store" });
    if (!resp.ok) continue;
    const raw = await resp.text();
    cards.push(parseCard(raw, f));
  }
  return cards;
}

function renderDomains() {
  els.domainList.innerHTML = "";
  state.domains.forEach(domain => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="itemTop">
        <div class="itemTitle">${domain}</div>
        <div class="badge">${state.cardsByDomain.get(domain)?.length ?? 0}</div>
      </div>
      <div class="itemSub">ἐπίλεξον κάρταν</div>
    `;
    item.onclick = () => openDomain(domain);
    els.domainList.appendChild(item);
  });
}

function renderCardList(domain) {
  els.domainTitle.textContent = domain;
  els.cardList.innerHTML = "";

  const cards = state.cardsByDomain.get(domain) || [];
  cards.forEach(card => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="itemTop">
        <div class="itemTitle">${card.title}</div>
        <div class="badge">${card.filename.split("_").shift()}</div>
      </div>
      ${card.meta ? `<div class="itemSub">${card.meta.replace(/\n/g," • ")}</div>` : ""}
    `;
    item.onclick = () => openCard(domain, card);
    els.cardList.appendChild(item);
  });
}

function renderCard(card) {
  els.cardTitle.textContent = card.title;
  els.cardMeta.textContent = card.meta;
  els.cardBody.textContent = card.body;
}

function openDomain(domain) {
  state.currentDomain = domain;
  state.currentCard = null;
  renderCardList(domain);
  show("list");
}

function openCard(domain, card) {
  state.currentDomain = domain;
  state.currentCard = card;
  renderCard(card);
  show("card");
}

function goBack() {
  if (!views.card.hidden) return show("list");
  if (!views.list.hidden) return show("domain");
}

async function boot() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch (e) {}
  }

  const index = await loadIndex();
  const cards = await loadAllCards(index.files || []);

  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.domain)) map.set(c.domain, []);
    map.get(c.domain).push(c);
  }

  const domains = Array.from(map.keys()).sort((a,b) => a.localeCompare(b));
  domains.forEach(d => map.get(d).sort((a,b) => a.filename.localeCompare(b.filename)));

  state.domains = domains;
  state.cardsByDomain = map;

  renderDomains();
  show("domain");

  els.backBtn.onclick = goBack;
}

boot().catch(err => {
  els.domainList.innerHTML = `<div class="item"><div class="itemTitle">σφάλμα</div><div class="itemSub">${err.message}</div></div>`;
});
