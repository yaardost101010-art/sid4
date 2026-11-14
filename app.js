import { CONFIG } from "./config.js";
import { initPage, openTelegram } from "./join.js";

const has = (v) => typeof v === "string" && v.trim() !== "";
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

if (has(CONFIG.PAGE_TITLE)) document.title = CONFIG.PAGE_TITLE;
if (has(CONFIG.FAVICON_URL) || has(CONFIG.FAVICON_EMOJI)) {
  const link = document.createElement("link");
  link.rel = "icon";
  if (has(CONFIG.FAVICON_URL)) {
    link.href = CONFIG.FAVICON_URL;
  } else {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${CONFIG.FAVICON_EMOJI}</text></svg>`;
    link.href = "data:image/svg+xml," + encodeURIComponent(svg);
  }
  document.head.appendChild(link);
}

const ready = { current: null };
const timer = { current: null };
let started = false;
let btn = null;

const setWorking = (on) => {
  if (!btn) return;
  btn.disabled = on;
  btn.setAttribute("aria-busy", on ? "true" : "false");
  btn.querySelector("span").textContent = on && has(CONFIG.JOIN_BUTTON_WORKING_TEXT) ? CONFIG.JOIN_BUTTON_WORKING_TEXT : CONFIG.JOIN_BUTTON_TEXT;
};

const startJoin = async (auto) => {
  if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  setWorking(true);
  if (auto) await ready.current;
  const r = await openTelegram(CONFIG.BACKUP_LINK, auto ? true : undefined);
  if (!r || !r.redirected) setWorking(false);
};

const root = document.getElementById("root");
const card = el("section", "card");

if (has(CONFIG.AVATAR_IMAGE_URL)) {
  const wrap = el("div", "avatar");
  const img = document.createElement("img");
  img.src = CONFIG.AVATAR_IMAGE_URL;
  img.alt = CONFIG.CHANNEL_NAME || "";
  img.width = 132; img.height = 132;
  img.loading = "lazy"; img.decoding = "async";
  img.onerror = () => wrap.remove();
  wrap.appendChild(img);
  card.appendChild(wrap);
}
if (has(CONFIG.CHANNEL_NAME)) card.appendChild(el("h1", "", CONFIG.CHANNEL_NAME));
if (has(CONFIG.CHANNEL_TAGLINE)) card.appendChild(el("p", "tag", CONFIG.CHANNEL_TAGLINE));

btn = el("button", "btn");
btn.type = "button";
btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 3.4 2.7 10.8c-.9.3-.9 1.6 0 1.9l4.6 1.5 1.8 5.6c.2.6 1 .8 1.4.3l2.6-2.6 4.8 3.5c.6.4 1.3.1 1.5-.6L23 4.6c.2-.9-.5-1.5-1.1-1.2ZM9.2 13.6l8.6-5.4c.2-.1.4.1.2.3l-7 6.3c-.2.2-.4.5-.4.8l-.3 2.2c0 .2-.3.2-.3 0l-.8-4.2Z"/></svg><span></span>';
btn.querySelector("span").textContent = CONFIG.JOIN_BUTTON_TEXT;
btn.addEventListener("click", () => startJoin(false));
card.appendChild(btn);
root.appendChild(card);

if (has(CONFIG.FOOTER_TEXT) || has(CONFIG.FOOTER_LINK_TEXT)) {
  const foot = el("div", "foot");
  if (has(CONFIG.FOOTER_ICON_URL)) {
    const i = document.createElement("img");
    i.src = CONFIG.FOOTER_ICON_URL; i.alt = ""; i.loading = "lazy"; i.width = 22; i.height = 22;
    i.onerror = () => i.remove();
    foot.appendChild(i);
  }
  if (has(CONFIG.FOOTER_TEXT)) foot.appendChild(el("span", "", CONFIG.FOOTER_TEXT));
  if (has(CONFIG.FOOTER_LINK_TEXT)) {
    const a = el("a", "", CONFIG.FOOTER_LINK_TEXT);
    if (has(CONFIG.FOOTER_LINK_URL)) {
      a.href = CONFIG.FOOTER_LINK_URL;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    foot.appendChild(a);
  }
  root.appendChild(foot);
}

if (!started) {
  started = true;
  ready.current = initPage(CONFIG.CLIENT_ID, {
    serverUrl: CONFIG.HELPER_URL,
    pixelId: CONFIG.PIXEL_ID,
    trackTimeoutMs: CONFIG.REQUEST_TIMEOUT_MS,
    fbpWaitMs: CONFIG.FBP_WAIT_MS,
    joinWaitMs: CONFIG.CLICK_WAIT_MS,
  });
  if (CONFIG.AUTO_REDIRECT === true) {
    let d = CONFIG.AUTO_REDIRECT_DELAY_MS;
    if (typeof d !== "number" || d < 0 || d > 10000) d = 1000;
    timer.current = setTimeout(() => startJoin(true), d);
  }
}
