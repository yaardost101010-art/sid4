const API = "https://app.kapitrack.site";
const options = { serverUrl: API, trackTimeoutMs: 4000, fbpWaitMs: 3000, joinWaitMs: 0, pixelId: "" };
export function setOptions(o) {
  if (!o) return;
  const n = (v, lo, hi) => (typeof v === "number" && v >= lo && v <= hi ? v : null);
  if (typeof o.serverUrl === "string" && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o.serverUrl)) options.serverUrl = o.serverUrl;
  const a = n(o.trackTimeoutMs, 500, 30000); if (a !== null) options.trackTimeoutMs = a;
  const b = n(o.fbpWaitMs, 0, 10000); if (b !== null) options.fbpWaitMs = b;
  const c = n(o.joinWaitMs, 0, 30000); if (c !== null) options.joinWaitMs = c;
  if (typeof o.pixelId === "string" && /^\d{5,20}$/.test(o.pixelId.trim())) options.pixelId = o.pixelId.trim();
}
const AD_PARAMS = ["fbclid", "utm_source", "ad_id", "ad_name", "placement"];
const state = { slug: "", vid: null, timeoutMs: 5000, fbp: null, joining: false, pxStarted: false, pxLoaded: "", pxReported: false };

export function getSlug(defaultSlug) {
  const u = new URL(window.location.href);
  const ok = (x) => /^[a-z0-9_-]{1,32}$/.test(x);
  let s = (u.searchParams.get("c") || "").toLowerCase();
  if (!s && defaultSlug && ok(String(defaultSlug).toLowerCase())) return String(defaultSlug).toLowerCase();
  if (!s) {
    const seg = u.pathname.split("/").filter(Boolean);
    s = ((seg[0] === "j" ? seg[1] : seg[0]) || "").toLowerCase();
  }
  return /^[a-z0-9_-]{1,32}$/.test(s) ? s : "";
}

function readCookie(name) {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function adParams() {
  const q = new URLSearchParams(window.location.search);
  const o = {};
  for (const k of AD_PARAMS) { const v = q.get(k); if (v) o[k] = v.slice(0, 200); }
  return o;
}
function firstSeenAgoMs(slug, fbclid) {
  try {
    const key = "kt_seen_" + slug + "_" + fbclid, now = Date.now(), prev = Number(localStorage.getItem(key));
    if (prev > 0) return Math.max(0, now - prev);
    localStorage.setItem(key, String(now));
  } catch (e) {}
  return 0;
}
function pageUrl() { return window.location.href.split("#")[0]; }

function sendPixelBeacon() {
  if (!state.vid || !state.pxLoaded || state.pxReported) return;
  state.pxReported = true;
  try { navigator.sendBeacon(options.serverUrl + "/api/event", new Blob([JSON.stringify({ vid: state.vid, e: "px_ok", px: String(state.pxLoaded) })], { type: "text/plain" })); } catch (e) {}
}
function reportPixel(pixelId) { state.pxLoaded = String(pixelId); sendPixelBeacon(); }

function loadPixel(pixelId) {
  if (state.pxStarted) return;
  state.pxStarted = true;
  if (!window.fbq) {
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v; t.onload = () => reportPixel(pixelId);
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  }
  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
  let tries = 0;
  const t = setInterval(() => {
    const v = readCookie("_fbp");
    if (v) { state.fbp = v; clearInterval(t); } else if (++tries > Math.ceil(options.fbpWaitMs / 200)) clearInterval(t);
  }, 200);
}

async function post(path, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(options.serverUrl + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    return { ok: r.ok, json: await r.json().catch(() => null) };
  } catch (e) {
    return { ok: false, json: null };
  } finally { clearTimeout(timer); }
}

export async function initPage(defaultSlug, opts) {
  setOptions(opts);
  state.slug = getSlug(defaultSlug);
  if (!state.slug) return state;
  if (options.pixelId) loadPixel(options.pixelId);
  const p = adParams();
  const res = await post("/api/track", {
    slug: state.slug, ...p, px: options.pixelId || undefined, event_source_url: pageUrl(),
    seen_ago_ms: p.fbclid ? firstSeenAgoMs(state.slug, p.fbclid) : 0,
    fbp: readCookie("_fbp") || undefined,
  }, options.trackTimeoutMs);
  if (res.ok && res.json && res.json.ok) {
    state.vid = res.json.vid || null;
    state.timeoutMs = options.joinWaitMs || (res.json.join_timeout_s || 5) * 1000;
    if (!options.pixelId && res.json.pixel_id) loadPixel(res.json.pixel_id);
    sendPixelBeacon();
  }
  return state;
}

export async function openTelegram(backupLink, replace) {
  if (state.joining) return { redirected: false };
  state.joining = true;
  const p = adParams();
  const res = await post("/api/join", {
    slug: state.slug, vid: state.vid || undefined, ...p, event_source_url: pageUrl(),
    seen_ago_ms: p.fbclid ? firstSeenAgoMs(state.slug, p.fbclid) : 0,
    fbp: state.fbp || readCookie("_fbp") || undefined,
  }, state.timeoutMs);
  const link = res.ok && res.json && res.json.ok && res.json.link ? res.json.link : null;
  if (link && state.vid) {
    try { navigator.sendBeacon(options.serverUrl + "/api/event", new Blob([JSON.stringify({ vid: state.vid, e: "tg_open" })], { type: "text/plain" })); } catch (e) {}
  }
  const target = link || backupLink || "";
  if (target) { if (replace) window.location.replace(target); else window.location.assign(target); } else state.joining = false;
  return { tracked: !!(res.json && res.json.tracked), redirected: !!target };
}
export function getState() { return state; }
