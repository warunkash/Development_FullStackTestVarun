"use strict";

// Helpline numbers per region. Each has a national emergency number and highway/roadside lines.
const REGIONS = {
  IN: { name: "India", emergency: "112", lines: [
    ["Emergency (all services)", "112"], ["NHAI highway helpline", "1033"], ["Ambulance", "108"], ["Police", "100"]] },
  US: { name: "United States", emergency: "911", lines: [
    ["Emergency (all services)", "911"], ["AAA roadside assistance", "18002224357"]] },
  GB: { name: "United Kingdom", emergency: "999", lines: [
    ["Emergency (all services)", "999"], ["National Highways", "03001235000"], ["Non-emergency police", "101"]] },
  EU: { name: "Europe", emergency: "112", lines: [["Emergency (all services)", "112"]] },
  AU: { name: "Australia", emergency: "000", lines: [["Emergency (all services)", "000"], ["Police assistance", "131444"]] },
};

const SERVICES = [
  { id: "tow", icon: "🚛", label: "Towing", ask: "I need a tow truck." },
  { id: "tyre", icon: "🛞", label: "Flat tyre", ask: "I have a flat tyre and need help changing it." },
  { id: "battery", icon: "🔋", label: "Battery jump", ask: "My battery is dead and I need a jump-start." },
  { id: "fuel", icon: "⛽", label: "Out of fuel", ask: "I have run out of fuel and need a fuel delivery." },
  { id: "lockout", icon: "🔑", label: "Locked out", ask: "I am locked out of my car." },
  { id: "mechanic", icon: "🔧", label: "Breakdown", ask: "My car has broken down and I need a mechanic." },
  { id: "accident", icon: "🚑", label: "Accident", ask: "There has been an accident. Please send help.", emergency: true },
  { id: "medical", icon: "❤️‍🩹", label: "Medical", ask: "Someone needs medical help.", emergency: true },
];

const TIPS = [
  "Pull over as far left/right of the carriageway as you safely can and switch on hazard lights.",
  "Everyone exits on the side away from traffic and waits behind the barrier, well off the road.",
  "Leave the wheels turned away from the road and keep the bonnet down unless it is safe.",
  "Place a warning triangle 50–100 m behind the car only if it is safe to walk there. Never stand between the car and traffic.",
  "Keep your phone charged, your location shared, and do not accept help from strangers you cannot verify.",
];

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

let pos = null;          // {lat, lon, acc}
let region = store.get("region", guessRegion());
let current = null;      // service open in the sheet

function guessRegion() {
  const l = (navigator.language || "en-IN").toUpperCase();
  if (l.endsWith("-IN")) return "IN";
  if (l.endsWith("-US")) return "US";
  if (l.endsWith("-GB")) return "GB";
  if (l.endsWith("-AU")) return "AU";
  return "IN";
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function mapsUrl() {
  return pos ? `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lon.toFixed(6)}` : "";
}

function locationText() {
  const lm = $("landmark").value.trim();
  if (!pos) return `Location unavailable.${lm ? " Landmark: " + lm : ""}`;
  return `Location: ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)} (±${Math.round(pos.acc)} m)` +
    (lm ? `\nLandmark: ${lm}` : "") + `\nMap: ${mapsUrl()}`;
}

function locate() {
  $("loc-status").textContent = "Locating…";
  if (!navigator.geolocation) {
    $("loc-status").textContent = "Location not supported on this device.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (p) => {
      pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy };
      $("loc-status").textContent = `${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}`;
      $("loc-detail").textContent = `Accuracy about ${Math.round(pos.acc)} m. Updated ${new Date().toLocaleTimeString()}.`;
    },
    (err) => {
      pos = null;
      $("loc-status").textContent = "Couldn't get your location";
      $("loc-detail").textContent = err.code === 1
        ? "Location permission was denied. Enable it in browser settings, or describe your position in the landmark box."
        : "No GPS fix yet. Move to open sky, or describe your position in the landmark box.";
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }
  );
}

function profile() {
  const f = $("profile");
  return Object.fromEntries(new FormData(f).entries());
}

function buildMessage(svc, note) {
  const p = profile();
  const lines = [`🚨 ${svc.ask}`];
  if (note) lines.push(note);
  lines.push(locationText());
  if (p.vehicle || p.plate) lines.push(`Vehicle: ${[p.vehicle, p.plate].filter(Boolean).join(", ")}`);
  if (p.name) lines.push(`Name: ${p.name}`);
  return lines.join("\n");
}

function primaryNumber(svc) {
  const r = REGIONS[region];
  const p = profile();
  if (svc.emergency) return r.emergency;
  if (p.roadside) return p.roadside;
  return r.lines.find((l) => /highway|roadside|AAA/i.test(l[0]))?.[1] ?? r.emergency;
}

function refreshSheet() {
  if (!current) return;
  $("sheet-msg").value = buildMessage(current, $("sheet-note").value.trim());
  syncLinks();
}

function syncLinks() {
  const msg = $("sheet-msg").value;
  const num = primaryNumber(current);
  $("sheet-call").href = `tel:${num}`;
  $("sheet-call").textContent = `Call ${num}`;
  const contact = profile().contact || "";
  $("sheet-sms").href = `sms:${contact}?&body=${encodeURIComponent(msg)}`;
  $("sheet-wa").href = `https://wa.me/${contact.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
}

function openSheet(svc) {
  current = svc;
  $("sheet-title").textContent = `${svc.icon} ${svc.label}`;
  $("sheet-note").value = "";
  refreshSheet();
  $("sheet").showModal();
}

function renderRegion() {
  const r = REGIONS[region];
  $("sos").href = `tel:${r.emergency}`;
  $("sos-label").textContent = `Call emergency ${r.emergency}`;
  $("helplines").innerHTML = r.lines
    .map(([n, num]) => `<li><span>${n}</span><a href="tel:${num}">${num}</a></li>`).join("");
}

function init() {
  $("region").innerHTML = Object.entries(REGIONS)
    .map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("");
  $("region").value = region;
  $("region").onchange = (e) => { region = e.target.value; store.set("region", region); renderRegion(); };

  $("services").innerHTML = SERVICES
    .map((s) => `<button type="button" class="svc" data-id="${s.id}"><span>${s.icon}</span><span>${s.label}</span></button>`).join("");
  $("services").onclick = (e) => {
    const b = e.target.closest(".svc");
    if (b) openSheet(SERVICES.find((s) => s.id === b.dataset.id));
  };
  $("tips").innerHTML = TIPS.map((t) => `<li>${t}</li>`).join("");

  const saved = store.get("profile", {});
  for (const [k, v] of Object.entries(saved)) {
    const el = $("profile").elements[k];
    if (el) el.value = v;
  }
  $("profile").oninput = () => { store.set("profile", profile()); refreshSheet(); };
  $("landmark").oninput = refreshSheet;
  $("sheet-note").oninput = refreshSheet;
  $("sheet-msg").oninput = syncLinks;

  $("refresh").onclick = locate;
  $("open-map").onclick = () => (pos ? window.open(mapsUrl(), "_blank", "noopener") : toast("No location yet"));
  $("share-loc").onclick = async () => {
    const text = `My location:\n${locationText()}`;
    if (navigator.share) { try { await navigator.share({ title: "My location", text }); } catch { /* cancelled */ } }
    else copy(text);
  };
  $("sheet-copy").onclick = () => copy($("sheet-msg").value);

  renderRegion();
  locate();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Copy not available"); }
}

init();
