// ========= Konfigurasi =========
const TIMEZONE = "Asia/Jakarta";

// Audio
const AUDIO_IMSAK = "imsak.mp3";     // imsak + pengingat sahur
const AUDIO_ADZAN = "adzan.mp3";     // dzuhur, ashar, maghrib, isya
const AUDIO_SUBUH = "subuh.mp3";     // subuh khusus

const V3 = {
  citySearch: (q) => `https://api.myquran.com/v3/sholat/kota/cari/${encodeURIComponent(q)}`,
  today: (id) => `https://api.myquran.com/v3/sholat/jadwal/${encodeURIComponent(id)}/today`,
  byISO: (id, iso) => `https://api.myquran.com/v3/sholat/jadwal/${encodeURIComponent(id)}/${encodeURIComponent(iso)}`,
  byYMD: (id, y, m, d) => `https://api.myquran.com/v3/sholat/jadwal/${encodeURIComponent(id)}/${y}/${m}/${d}`
};

// Urutan tampilan
const DISPLAY = [
  ["imsak", "Imsak"],
  ["subuh", "Subuh"],
  ["dzuhur", "Dzuhur"],
  ["ashar", "Ashar"],
  ["maghrib", "Maghrib"],
  ["isya", "Isya"],
];

// ========= Helpers =========
const el = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");

function fmtTodayLong() {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit"
  }).format(new Date());
}

function partsInTZ(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).formatToParts(date);

  const get = (t) => parts.find(p => p.type === t)?.value;
  return { y: get("year"), m: get("month"), d: get("day"), hh: get("hour"), mm: get("minute"), ss: get("second") };
}

function ymdInTZ(date = new Date()) {
  const p = partsInTZ(date);
  return `${p.y}-${p.m}-${p.d}`;
}

function nowInTZ() {
  const p = partsInTZ(new Date());
  return new Date(`${p.y}-${p.m}-${p.d}T${p.hh}:${p.mm}:${p.ss}`);
}

function addDaysISO(iso, add) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + add);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function buildDates(startISO, days) {
  const arr = [];
  for (let i = 0; i < days; i++) arr.push(addDaysISO(startISO, i));
  return arr;
}

function niceRange(startISO, days) {
  const endISO = addDaysISO(startISO, days - 1);
  const fmt = (iso) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };
  return `${fmt(startISO)} s.d. ${fmt(endISO)} (${days} hari)`;
}

function dayNumberInRamadan(startISO, todayISO) {
  if (todayISO < startISO) return null;
  const [sy, sm, sd] = startISO.split("-").map(Number);
  const [ty, tm, td] = todayISO.split("-").map(Number);
  const a = Date.UTC(sy, sm - 1, sd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.floor((b - a) / (24 * 3600 * 1000)) + 1;
}

function setStatus(html) {
  const sb = el("statusBox");
  if (sb) sb.innerHTML = html;
}

function diffToHMS(ms) {
  if (ms == null || ms < 0) return "--:--:--";
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

// ========= Toast + Notif =========
function toast(title, msg) {
  const mode = el("notifMode")?.value || "toast";
  if (mode === "off") return;

  if (mode === "toast" || mode === "both") {
    el("toastTitle").textContent = title;
    el("toastMsg").textContent = msg;
    el("toast").style.display = "block";
  }

  if ((mode === "system" || mode === "both") && "Notification" in window) {
    if (Notification.permission === "granted") {
      try { new Notification(title, { body: msg }); } catch (e) {}
    }
  }
}

function closeToast() {
  const t = el("toast");
  if (t) t.style.display = "none";
}

// ========= API =========
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function normalizeJadwal(obj) {
  const out = {};
  for (const [k] of DISPLAY) {
    out[k] = obj?.[k] ?? obj?.[k.toUpperCase()] ?? null;
  }
  return out;
}

function cacheKey(cityId, iso) {
  return `ramadan_v3_${cityId}_${iso}`;
}

async function getJadwalV3(cityId, iso) {
  const ck = cacheKey(cityId, iso);
  const cached = localStorage.getItem(ck);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }

  const isToday = (iso === ymdInTZ());
  const [y, m, d] = iso.split("-");

  const candidates = isToday
    ? [V3.today(cityId), V3.byISO(cityId, iso), V3.byYMD(cityId, y, m, d)]
    : [V3.byISO(cityId, iso), V3.byYMD(cityId, y, m, d)];

  let lastErr = null;
  for (const url of candidates) {
    try {
      const data = await fetchJSON(url);
      if (!data?.status) throw new Error("status=false");

      const jadwalMap = data?.data?.jadwal;
      const dayObj = jadwalMap?.[iso] || jadwalMap?.[Object.keys(jadwalMap || {})[0]];
      if (!dayObj) throw new Error("jadwal kosong");

      const payload = {
        iso,
        tanggal: dayObj.tanggal || iso,
        kabko: data?.data?.kabko || "",
        prov: data?.data?.prov || "",
        times: normalizeJadwal(dayObj),
      };

      localStorage.setItem(ck, JSON.stringify(payload));
      return payload;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr || new Error("Gagal ambil jadwal");
}

async function searchCityV3(q) {
  const r = await fetchJSON(V3.citySearch(q));
  const list = r?.data;
  return Array.isArray(list) ? list : [];
}

// ========= Render Tabel =========
function renderTable(dates) {
  const tbody = el("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  for (const iso of dates) {
    const payload = loadedData.get(iso);
    const t = payload?.times || {};
    const tanggal = payload?.tanggal || iso;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${tanggal}</b><div class="mono" style="color:rgba(255,255,255,.55); margin-top:4px;">${iso}</div></td>
      <td class="colmono">${t.imsak || "Memuat…"}</td>
      <td class="colmono">${t.subuh || "Memuat…"}</td>
      <td class="colmono">${t.dzuhur || "Memuat…"}</td>
      <td class="colmono">${t.ashar || "Memuat…"}</td>
      <td class="colmono">${t.maghrib || "Memuat…"}</td>
      <td class="colmono">${t.isya || "Memuat…"}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ========= Paralel runner + Retry sampai lengkap =========
async function runPool(tasks, limit) {
  const results = [];
  let i = 0;
  const workers = new Array(limit).fill(0).map(async () => {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchAllWithRetry(dates, cityId, conc) {
  const pending = new Set(dates);
  const results = new Map();

  const startedAt = Date.now();
  const MAX_MS = 10 * 60 * 1000;

  while (pending.size > 0) {
    const list = Array.from(pending);

    setStatus(
      `Mengambil jadwal… <b>${results.size}/${dates.length}</b> hari sudah siap. ` +
      `Sisa <b>${pending.size}</b> hari.`
    );

    const batch = await runPool(
      list.map(iso => async () => {
        try {
          const payload = await getJadwalV3(cityId, iso);
          return { iso, ok: true, payload };
        } catch (e) {
          return { iso, ok: false };
        }
      }),
      conc
    );

    for (const r of batch) {
      if (r.ok) {
        results.set(r.iso, r.payload);
        pending.delete(r.iso);
      }
    }

    if (pending.size > 0) {
      if (Date.now() - startedAt > MAX_MS) {
        setStatus(`Masih memuat… koneksi/API sedang tidak stabil. Silakan klik <b>Muat Kalender 30 Hari</b> lagi.`);
        break;
      }
      await new Promise(r => setTimeout(r, 900));
    }
  }

  return results;
}

// ========= Suggestions =========
function renderSuggestions(list) {
  const box = el("suggestBox");
  box.innerHTML = "";

  if (!list.length) {
    box.style.display = "none";
    return;
  }

  for (const item of list) {
    const id = item.id || item.id_lokasi || item.kode || item.value;
    const name = item.lokasi || item.kabko || item.nama || item.label || "Lokasi";
    const prov = item.prov || item.provinsi || item.propinsi || "";

    const div = document.createElement("div");
    div.className = "sitem";
    div.innerHTML = `<b>${name}${prov ? ` <span style="opacity:.65; font-weight:700;">(${prov})</span>` : ""}</b>`;

    div.onclick = () => {
      el("cityQuery").value = name;
      el("cityId").value = id || "";
      el("cityLabel").textContent = name;
      box.style.display = "none";
      toast("Kota dipilih", prov ? `${name} (${prov})` : name);
    };

    box.appendChild(div);
  }

  box.style.display = "block";
}

// ========= GPS Auto Lokasi =========
async function gpsAutoLokasi({ autoLoad = true } = {}) {
  if (!navigator.geolocation) {
    toast("GPS tidak tersedia", "Browser tidak mendukung geolocation.");
    return;
  }

  setStatus("Mendeteksi lokasi GPS…");

  navigator.geolocation.getCurrentPosition(async (pos) => {
    try {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      // Reverse geocode via Nominatim (best-effort)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const geo = await fetchJSON(url);

      const addr = geo?.address || {};
      const guess = (addr.city || addr.town || addr.county || addr.municipality || addr.state_district || addr.region || "").trim();

      if (!guess) {
        setStatus("GPS terdeteksi, tapi tidak bisa menemukan nama kota. Silakan cari kota manual.");
        return;
      }

      el("cityQuery").value = guess;
      setStatus(`GPS: ditemukan <b>${guess}</b>. Mencari di…`);

      const list = await searchCityV3(guess);
      if (!list.length) {
        setStatus(`Tidak ada hasil untuk <b>${guess}</b>. Silakan cari manual.`);
        return;
      }

      // Pilih hasil pertama
      const item = list[0];
      const id = item.id || item.id_lokasi || item.kode || item.value;
      const name = item.lokasi || item.kabko || item.nama || item.label || guess;

      el("cityId").value = id || "";
      el("cityQuery").value = name;
      el("cityLabel").textContent = name;

      setStatus(`✅ GPS auto: <b>${name}</b>.`);
      if (autoLoad) loadCalendar();
    } catch (e) {
      setStatus("GPS gagal diproses. Silakan cari kota manual.");
    }
  },
  () => {
    setStatus("GPS ditolak / tidak tersedia. Silakan cari kota manual.");
  },
  { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

// ========= Next event (untuk panel "Menuju") =========
function markCurrentLine() {
  const todayISO = ymdInTZ();
  const payload = loadedData.get(todayISO);
  if (!payload) return;

  const now = nowInTZ().getTime();
  const events = DISPLAY.map(([k, label]) => {
    const t = payload.times[k];
    if (!t) return null;
    return { k, label, at: new Date(`${todayISO}T${t}:00`).getTime() };
  }).filter(Boolean).sort((a, b) => a.at - b.at);

  const next = events.find(e => e.at > now) || null;

  const nextName = el("nextName");
  const countdown = el("countdown");

  if (next) {
    if (nextName) nextName.textContent = next.label;
    if (countdown) countdown.textContent = diffToHMS(next.at - now);
  } else {
    if (nextName) nextName.textContent = "(selesai hari ini)";
    if (countdown) countdown.textContent = "--:--:--";
  }
}

// ========= Progress bar (berbuka -> imsak besok) =========
function updateProgressBar() {
  const pctEl = el("progressPct");
  const fillEl = el("progressFill");
  const textEl = el("progressText");
  const subEl = el("progressSub");
  const remEl = el("progressRemain");
  if (!pctEl || !fillEl || !textEl || !remEl) return;

  const todayISO = ymdInTZ();
  const payload = loadedData.get(todayISO);

  if (!payload) {
    pctEl.textContent = "0%";
    fillEl.style.width = "0%";
    textEl.textContent = "Memuat jadwal…";
    if (subEl) subEl.textContent = "-";
    remEl.textContent = "--:--:--";
    return;
  }

  const now = nowInTZ().getTime();
  const imsakToday = payload.times.imsak || payload.times.subuh;
  const maghribToday = payload.times.maghrib;

  if (!imsakToday || !maghribToday) {
    pctEl.textContent = "0%";
    fillEl.style.width = "0%";
    textEl.textContent = "Jadwal belum lengkap";
    if (subEl) subEl.textContent = "-";
    remEl.textContent = "--:--:--";
    return;
  }

  const tImsakToday = new Date(`${todayISO}T${imsakToday}:00`).getTime();
  const tMaghribToday = new Date(`${todayISO}T${maghribToday}:00`).getTime();

  // sebelum imsak
  if (now < tImsakToday) {
    pctEl.textContent = "0%";
    fillEl.style.width = "0%";
    textEl.textContent = "Menuju imsak";
    if (subEl) subEl.textContent = `Imsak ${imsakToday} WIB`;
    remEl.textContent = diffToHMS(tImsakToday - now);
    return;
  }

  // puasa berlangsung (imsak -> maghrib)
  if (now >= tImsakToday && now < tMaghribToday) {
    const pct = Math.max(0, Math.min(1, (now - tImsakToday) / (tMaghribToday - tImsakToday)));
    const pctInt = Math.round(pct * 100);
    pctEl.textContent = `${pctInt}%`;
    fillEl.style.width = `${pctInt}%`;
    textEl.textContent = "Menuju berbuka";
    if (subEl) subEl.textContent = `Maghrib ${maghribToday} WIB`;
    remEl.textContent = diffToHMS(tMaghribToday - now);
    return;
  }

  // setelah maghrib -> menuju imsak besok
  const tomorrowISO = addDaysISO(todayISO, 1);
  const payloadTomorrow = loadedData.get(tomorrowISO);
  const imsakTomorrow = payloadTomorrow?.times?.imsak || payloadTomorrow?.times?.subuh;

  if (!imsakTomorrow) {
    pctEl.textContent = "0%";
    fillEl.style.width = "0%";
    textEl.textContent = "Menuju imsak (besok)";
    if (subEl) subEl.textContent = "Memuat jadwal besok…";
    remEl.textContent = "--:--:--";
    return;
  }

  const tImsakTomorrow = new Date(`${tomorrowISO}T${imsakTomorrow}:00`).getTime();
  const nightTotal = tImsakTomorrow - tMaghribToday;
  const nightPassed = now - tMaghribToday;
  const pctNight = Math.max(0, Math.min(1, nightPassed / nightTotal));
  const pctInt = Math.round(pctNight * 100);

  pctEl.textContent = `${pctInt}%`;
  fillEl.style.width = `${pctInt}%`;
  textEl.textContent = "Menuju imsak (besok)";
  if (subEl) subEl.textContent = `Imsak besok ${imsakTomorrow} WIB`;
  remEl.textContent = diffToHMS(tImsakTomorrow - now);
}

// ========= Alarm + Notif =========
const audioImsak = new Audio(AUDIO_IMSAK);
const audioAdzan = new Audio(AUDIO_ADZAN);
const audioSubuh = new Audio(AUDIO_SUBUH);
let muteUntil = 0;

function shouldTriggerOnce(key, iso) {
  const k = `alarm_${key}_${iso}`;
  if (localStorage.getItem(k) === "1") return false;
  localStorage.setItem(k, "1");
  return true;
}

function timeMinusMinutes(hhmm, minusMin) {
  const [hh, mm] = String(hhmm).split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  let total = hh * 60 + mm - minusMin;
  while (total < 0) total += 24 * 60;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${pad(nh)}:${pad(nm)}`;
}

// Imsak alarm
function maybeFireImsakAlarm() {
  const todayISO = ymdInTZ();
  const payload = loadedData.get(todayISO);
  if (!payload) return;

  const p = partsInTZ(new Date());
  const nowStr = `${p.hh}:${p.mm}:${p.ss}`;
  const imsakAt = payload.times.imsak ? `${payload.times.imsak}:00` : null;
  const canSound = Date.now() >= muteUntil;

  if (imsakAt && nowStr === imsakAt && shouldTriggerOnce("imsak", todayISO)) {
    toast("Waktu Imsak", `Sudah masuk waktu imsak (${payload.times.imsak} WIB).`);
    if (canSound) {
      audioImsak.currentTime = 0;
      audioImsak.play().catch(() => {});
    }
  }
}

// Pengingat sahur: 30 menit sebelum imsak (sekali per hari)
function maybeFireSahurReminder() {
  const todayISO = ymdInTZ();
  const payload = loadedData.get(todayISO);
  if (!payload) return;

  const imsak = payload.times.imsak;
  if (!imsak) return;

  const remindAt = timeMinusMinutes(imsak, 30);
  if (!remindAt) return;

  const p = partsInTZ(new Date());
  const nowStr = `${p.hh}:${p.mm}:${p.ss}`;
  const canSound = Date.now() >= muteUntil;

  if (nowStr === `${remindAt}:00` && shouldTriggerOnce("sahur", todayISO)) {
    toast("Pengingat Sahur", `30 menit menuju imsak (${imsak} WIB).`);
    if (canSound) {
      audioImsak.currentTime = 0;
      audioImsak.play().catch(() => {});
    }
  }
}

// Adzan 5 waktu (Subuh pakai file khusus)
function maybeFireAdzan5Waktu() {
  const todayISO = ymdInTZ();
  const payload = loadedData.get(todayISO);
  if (!payload) return;

  const p = partsInTZ(new Date());
  const nowStr = `${p.hh}:${p.mm}:${p.ss}`;
  const canSound = Date.now() >= muteUntil;

  const checks = [
    { key: "subuh", label: "Subuh", time: payload.times.subuh, audio: audioSubuh },
    { key: "dzuhur", label: "Dzuhur", time: payload.times.dzuhur, audio: audioAdzan },
    { key: "ashar", label: "Ashar", time: payload.times.ashar, audio: audioAdzan },
    { key: "maghrib", label: "Maghrib", time: payload.times.maghrib, audio: audioAdzan },
    { key: "isya", label: "Isya", time: payload.times.isya, audio: audioAdzan },
  ];

  for (const c of checks) {
    if (!c.time) continue;
    const at = `${c.time}:00`;
    if (nowStr === at && shouldTriggerOnce("adzan_" + c.key, todayISO)) {
      toast(`Waktu ${c.label}`, `Sudah masuk waktu ${c.label} (${c.time} WIB).`);
      if (canSound) {
        try {
          c.audio.currentTime = 0;
          c.audio.play().catch(() => {});
        } catch (e) {}
      }
    }
  }
}

// ========= State =========
const loadedData = new Map(); // iso -> payload
let lastDates = [];

// ========= Load jadwal 30 hari (tabel saja) =========
async function loadCalendar() {
  const cityId = el("cityId").value.trim();
  const cityName = el("cityQuery").value.trim() || "Lokasi";
  const startISO = el("startDate").value.trim();
  const days = Math.max(1, parseInt(el("daysCount").value.trim(), 10) || 30);

  const conc = 4; // default sedang

  if (!cityId) {
    setStatus(`❗ Pilih <b>kota</b> dari hasil pencarian terlebih dahulu.`);
    return;
  }

  el("cityLabel").textContent = cityName;
  el("rangeText").textContent = niceRange(startISO, days);

  const todayISO = ymdInTZ();
  const dIndex = dayNumberInRamadan(startISO, todayISO);
  el("dayIndex").textContent = dIndex ? String(dIndex) : "-";

  const dates = buildDates(startISO, days);
  lastDates = dates;
  loadedData.clear();

  // render tabel awal (Memuat…)
  renderTable(dates);

  // persist
  localStorage.setItem("last_city_name", cityName);
  localStorage.setItem("last_city_id", cityId);
  localStorage.setItem("last_start", startISO);
  localStorage.setItem("last_days", String(days));

  const btn = el("loadBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Memuat…"; }

  const results = await fetchAllWithRetry(dates, cityId, conc);

  for (const iso of dates) {
    const payload = results.get(iso);
    if (!payload) continue;
    loadedData.set(iso, payload);
  }

  renderTable(dates);
  setStatus(`✅ Jadwal lengkap siap: <b>${results.size}/${dates.length}</b> hari.`);

  if (btn) { btn.disabled = false; btn.textContent = "Muat Kalender 30 Hari"; }
}

// ========= Init + Events =========
el("todayText").textContent = fmtTodayLong();

el("exportPngBtn")?.addEventListener("click", exportTablePNG);
el("toastClose").addEventListener("click", closeToast);
el("toastMute").addEventListener("click", () => {
  muteUntil = Date.now() + 5 * 60 * 1000;
  toast("Suara dimatikan", "Selama 5 menit.");
});

el("notifBtn").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    toast("Notifikasi tidak tersedia", "Browser Anda tidak mendukung Notification API.");
    return;
  }
  try {
    const perm = await Notification.requestPermission();
    toast("Izin notifikasi", `Status: ${perm}`);
  } catch (e) {
    toast("Gagal", "Tidak bisa meminta izin notifikasi.");
  }
});

// Search city debounce
let tmr = null;
el("cityQuery").addEventListener("input", () => {
  const q = el("cityQuery").value.trim();
  clearTimeout(tmr);
  if (q.length < 3) {
    el("suggestBox").style.display = "none";
    return;
  }
  tmr = setTimeout(async () => {
    try {
      setStatus(`Mencari kota: <b>${q}</b>…`);
      const list = await searchCityV3(q);
      renderSuggestions(list);
      setStatus(list.length ? `Pilih kota dari daftar hasil (klik).` : `Tidak ada hasil kota untuk <b>${q}</b>.`);
    } catch (e) {
      setStatus(`Koneksi/API sedang bermasalah. Coba lagi.`);
    }
  }, 280);
});

// Load
el("loadBtn").addEventListener("click", loadCalendar);

// GPS
el("gpsBtn").addEventListener("click", () => gpsAutoLokasi({ autoLoad: true }));

// Unlock audio on first interaction (autoplay policy)
window.addEventListener("pointerdown", () => {
  [audioImsak, audioAdzan, audioSubuh].forEach(a => {
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
  });
}, { once: true });

// Tick
setInterval(() => {
  const n = nowInTZ();
  const clock = el("clock");
  if (clock) clock.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;

  markCurrentLine();
  updateProgressBar();

  // Reminder & alarm
  maybeFireSahurReminder();
  maybeFireImsakAlarm();
  maybeFireAdzan5Waktu();
}, 1000);

// Restore last
(async function restore() {
  const name = localStorage.getItem("last_city_name");
  const id = localStorage.getItem("last_city_id");
  const start = localStorage.getItem("last_start");
  const days = localStorage.getItem("last_days");

  if (name) el("cityQuery").value = name;
  if (id) el("cityId").value = id;
  if (start) el("startDate").value = start;
  if (days) el("daysCount").value = days;

  el("cityLabel").textContent = name || "-";

  // Jika pernah pilih kota → langsung load
  if (id) {
    setStatus("Memuat jadwal terakhir…");
    loadCalendar();
    return;
  }

  // Jika belum pernah → coba GPS otomatis
  setStatus("Mendeteksi lokasi otomatis…");

  try {
    await gpsAutoLokasi({ autoLoad: true });
  } catch (e) {
    setStatus("Silakan cari kota untuk memulai.");
  }
})();



function safeFileName(prefix) {
  const city = (el("cityLabel")?.textContent || "Kota")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  const range = (el("rangeText")?.textContent || "Ramadan_2026")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_");

  return `${prefix}_${city}_${range}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportTablePNG() {
  if (typeof html2canvas === "undefined") {
    toast("Export gagal", "html2canvas belum termuat.");
    return;
  }

  const tableWrap = el("tablewrap");
  if (!tableWrap) {
    toast("Export gagal", "Tabel tidak ditemukan.");
    return;
  }

  // Pastikan sudah ada data minimal (optional)
  if (!loadedData || loadedData.size === 0) {
    toast("Export", "Silakan muat jadwal dulu sebelum export.");
    return;
  }

  toast("Export", "Sedang membuat PNG…");

  // Capture tabel
  const canvas = await html2canvas(tableWrap, {
    backgroundColor: null, // transparan (glassy). kalau mau putih: "#ffffff"
    scale: 2,              // lebih tajam
    useCORS: true
  });

  canvas.toBlob((blob) => {
    if (!blob) {
      toast("Export gagal", "Tidak bisa membuat PNG.");
      return;
    }
    downloadBlob(blob, safeFileName("Jadwal_Ramadan") + ".png");
    toast("Export selesai", "PNG berhasil diunduh.");
    setTimeout(() => { try { el("toast").style.display = "none"; } catch(e){} }, 900);
  }, "image/png");
}

// ===== PWA: Register Service Worker =====
(function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      // optional: console.log("SW registered");
    } catch (e) {
      // optional: console.log("SW register failed", e);
    }
  });
})();
