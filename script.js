// Layanan yang ditampilkan. "url" dipakai untuk pengecekan langsung dari browser pengunjung.
const COMPONENTS = [
    { id: "web", name: "Etherthink Website", desc: "www.etherthink.xyz", url: "https://www.etherthink.xyz" },
    { id: "svc", name: "SVC", desc: "svc.etherthink.xyz", url: "https://svc.etherthink.xyz" },
    { id: "S3 Etherthink", name: "S3 Etherthink", desc: "storage.algorithmics.web.id", url: "https://storage.algorithmics.web.id" },
    { id: "Ilkom ITH Web", name: "Website Ilmu Komputer ITH", desc: "ilkomith.cloud", url: "https://ilkomith.cloud" },
    { id: "Thinkpad Etherthink", name: "Thinkpad Etherthink", desc: "qwerty.etherthink.xyz", url: "https://qwerty.etherthink.xyz" },
    { id: "Simpel ITH", name: "Simpel ITH", desc: "simpel.ith.ac.id", url: "https://simpel.ith.ac.id" },
    { id: "Siakad ITH", name: "Siakad ITH", desc: "siakad.ith.ac.id", url: "https://siakad.ith.ac.id" },
    { id: "Algorithmics Website", name: "Algorithmics Website", desc: "algorithmics.web.id", url: "https://algorithmics.web.id" },
    { id: "Centreth Website", name: "Centreth Website", desc: "centreth.web.id", url: "https://centreth.web.id" },
    { id: "Frontier Website", name: "Frontier Website", desc: "frontier.web.id", url: "https://frontier.web.id" },
];

// Riwayat insiden. Hari tanpa insiden otomatis tampil hijau.
// impact: "minor" (terganggu sebagian) atau "major" (tidak bisa diakses)
// end: null jika insiden masih berlangsung
// Contoh (hapus tanda komentar untuk mencoba):
const INCIDENTS = [
    /*
    {
      title: "Website lambat diakses",
      impact: "minor",
      components: ["web"],
      start: "2026-10-03T14:10:00+08:00",
      end:   "2026-10-03T15:05:00+08:00",
      updates: [
        { time: "2026-10-03T15:05:00+08:00", status: "Selesai",       text: "Waktu respons sudah kembali normal." },
        { time: "2026-10-03T14:30:00+08:00", status: "Diidentifikasi", text: "Penyebabnya adalah lonjakan trafik pada server." },
        { time: "2026-10-03T14:10:00+08:00", status: "Diselidiki",    text: "Kami melihat waktu respons yang lebih lambat dari biasanya." }
      ]
    },
    */
];

const CHECK_TIMEOUT_MS = 8000;
const REFRESH_MS = 60000;
const PARTIAL_WEIGHT = 0.3; // gangguan sebagian dihitung 30% downtime

/* =====================================================================
   LOGIKA
   ===================================================================== */
const $ = (id) => document.getElementById(id);
const fmtDate = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });
const fmtDT = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const MIN = 60000, DAY = 86400000;

const live = {}; // id -> {state:'ok'|'bad'|'load', ms}
COMPONENTS.forEach(c => live[c.id] = { state: "load", ms: null });

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function dayCount() { return window.innerWidth < 560 ? 45 : 90; }

function buildDays(n) {
    const today = startOfDay(new Date());
    const days = [];
    for (let i = n - 1; i >= 0; i--) days.push(new Date(today.getTime() - i * DAY));
    return days;
}

function incidentsFor(compId) {
    return INCIDENTS.filter(i => i.components.includes(compId));
}

function dayStats(compId, day) {
    const from = day.getTime(), to = from + DAY, now = Date.now();
    let weighted = 0, worst = 0; const hits = [];
    incidentsFor(compId).forEach(inc => {
        const s = new Date(inc.start).getTime();
        const e = inc.end ? new Date(inc.end).getTime() : now;
        const a = Math.max(s, from), b = Math.min(e, to);
        if (b > a) {
            const mins = (b - a) / MIN;
            const major = inc.impact === "major";
            weighted += mins * (major ? 1 : PARTIAL_WEIGHT);
            worst = Math.max(worst, major ? 2 : 1);
            hits.push({ inc, mins });
        }
    });
    return { weighted, worst, hits };
}

function activeIncidents() { return INCIDENTS.filter(i => !i.end); }

function compState(c) {
    const act = activeIncidents().filter(i => i.components.includes(c.id));
    if (act.some(i => i.impact === "major")) return "bad";
    if (act.length) return "warn";
    const l = live[c.id];
    if (l.state === "load") return "load";
    return l.state === "bad" ? "bad" : "ok";
}

const STATE_TEXT = {
    ok: "Beroperasi normal",
    warn: "Gangguan sebagian",
    bad: "Tidak dapat dijangkau",
    load: "Memeriksa…"
};

function renderComponents() {
    const n = dayCount();
    const days = buildDays(n);
    const root = $("components");
    root.innerHTML = "";

    COMPONENTS.forEach(c => {
        let totalWeighted = 0;
        const bars = days.map(d => {
            const st = dayStats(c.id, d);
            totalWeighted += st.weighted;
            return { d, st };
        });
        const uptime = Math.max(0, 100 - (totalWeighted / (n * 1440)) * 100);
        const uptimeText = uptime >= 99.995 ? "100%" : uptime.toFixed(2).replace(".", ",") + "%";
        const state = compState(c);
        const l = live[c.id];

        const el = document.createElement("div");
        el.className = "comp";
        el.innerHTML = `
      <div class="comp-head">
        <div>
          <div class="comp-name"></div>
          <div class="comp-desc"></div>
        </div>
        <div class="badge" data-s="${state}"><i></i><span>${STATE_TEXT[state]}</span>${l.ms != null && state === "ok" ? `<span class="latency">${l.ms} ms</span>` : ""
            }</div>
      </div>
      <div class="bars" role="list" aria-label="Riwayat ${n} hari terakhir"></div>
      <div class="bar-foot"><span>${n} hari lalu</span><span class="line"></span><b>${uptimeText} uptime</b><span class="line"></span><span>Hari ini</span></div>`;
        el.querySelector(".comp-name").textContent = c.name;
        el.querySelector(".comp-desc").textContent = c.desc;

        const barsEl = el.querySelector(".bars");
        bars.forEach(({ d, st }) => {
            const b = document.createElement("div");
            b.className = "bar";
            b.setAttribute("role", "listitem");
            b.tabIndex = 0;
            const s = st.worst === 2 ? "bad" : st.worst === 1 ? "warn" : "ok";
            b.dataset.s = s;
            const title = fmtShort.format(d);
            let body;
            if (!st.hits.length) body = "Tidak ada insiden";
            else body = st.hits.map(h => `${h.inc.title} (${Math.max(1, Math.round(h.mins))} menit)`).join("\n");
            b.setAttribute("aria-label", `${title}: ${body.replace(/\n/g, "; ")}`);
            b._tip = { title, body };
            barsEl.appendChild(b);
        });
        root.appendChild(el);
    });
}

function renderHero() {
    const hero = $("hero");
    const states = COMPONENTS.map(compState);
    const loading = states.every(s => s === "load");
    const bad = states.filter(s => s === "bad").length;
    const warn = states.filter(s => s === "warn").length;
    const act = activeIncidents();

    let st, title, sub;
    if (loading) { st = "load"; title = "Memeriksa layanan…"; sub = "Mengambil status terbaru."; }
    else if (bad === COMPONENTS.length) { st = "bad"; title = "Semua layanan sedang bermasalah"; sub = "Kami sedang menyelidiki. Cek bagian insiden di bawah untuk perkembangan terbaru."; }
    else if (bad || warn || act.length) { st = bad ? "bad" : "warn"; title = "Sebagian layanan sedang terganggu"; sub = "Layanan lain tetap berjalan normal."; }
    else { st = "ok"; title = "Semua sistem beroperasi normal"; sub = `${COMPONENTS.length} dari ${COMPONENTS.length} layanan merespons dengan baik.`; }

    hero.dataset.state = st;
    $("heroTitle").textContent = title;
    $("heroSub").textContent = sub;
}

function renderIncidents() {
    const root = $("incidents");
    root.innerHTML = "";
    const days = buildDays(14).reverse();
    const nameOf = id => (COMPONENTS.find(c => c.id === id) || { name: id }).name;

    days.forEach(d => {
        const from = d.getTime(), to = from + DAY;
        // insiden dikelompokkan berdasarkan hari mulai
        const list = INCIDENTS
            .filter(i => { const s = new Date(i.start).getTime(); return s >= from && s < to; })
            .sort((a, b) => new Date(b.start) - new Date(a.start));

        const row = document.createElement("div");
        row.className = "day";
        const h = document.createElement("div");
        h.className = "day-date";
        h.textContent = fmtDate.format(d);
        row.appendChild(h);

        if (!list.length) {
            const p = document.createElement("p");
            p.className = "none";
            p.textContent = "Tidak ada insiden dilaporkan.";
            row.appendChild(p);
        } else {
            list.forEach(inc => {
                const box = document.createElement("div");
                box.className = "inc";
                const t = document.createElement("div");
                t.className = "inc-title " + (inc.impact === "major" ? "bad" : "warn");
                t.textContent = inc.title;
                const meta = document.createElement("div");
                meta.className = "inc-meta";
                meta.textContent = `${inc.components.map(nameOf).join(", ")} · ${inc.end ? "Selesai" : "Sedang berlangsung"}`;
                box.append(t, meta);
                (inc.updates || []).forEach(u => {
                    const p = document.createElement("div");
                    p.className = "upd";
                    const b = document.createElement("b");
                    b.textContent = u.status + " – ";
                    p.append(b, document.createTextNode(u.text));
                    const tm = document.createElement("time");
                    tm.textContent = fmtDT.format(new Date(u.time));
                    p.appendChild(tm);
                    box.appendChild(p);
                });
                row.appendChild(box);
            });
        }
        root.appendChild(row);
    });
}

function renderAll() { renderHero(); renderComponents(); renderIncidents(); }

/* Pengecekan langsung dari browser.
   Memakai mode "no-cors": kita tidak bisa membaca isi respons, tapi cukup untuk
   mengetahui apakah server menjawab (sukses) atau tidak (error/timeout). */
async function checkOne(c) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CHECK_TIMEOUT_MS);
    const t0 = performance.now();
    try {
        await fetch(c.url + (c.url.includes("?") ? "&" : "?") + "_=" + Date.now(), { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
        live[c.id] = { state: "ok", ms: Math.round(performance.now() - t0) };
    } catch (e) {
        live[c.id] = { state: "bad", ms: null };
    } finally { clearTimeout(timer); }
}

async function refresh() {
    await Promise.all(COMPONENTS.map(checkOne));
    $("lastCheck").textContent = fmtTime.format(new Date());
    renderAll();
}

/* Tooltip */
const tip = $("tip");
function showTip(el) {
    const t = el._tip; if (!t) return;
    tip.innerHTML = "";
    const s = document.createElement("strong"); s.textContent = t.title;
    tip.appendChild(s);
    t.body.split("\n").forEach(line => { const x = document.createElement("span"); x.textContent = line; tip.appendChild(x); });
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2, 130), window.innerWidth - 130);
    tip.style.left = x + "px";
    tip.style.top = (r.top - 8) + "px";
    tip.classList.add("show");
}
function hideTip() { tip.classList.remove("show"); }
document.addEventListener("mouseover", e => { const b = e.target.closest(".bar"); b ? showTip(b) : hideTip(); });
document.addEventListener("focusin", e => { const b = e.target.closest(".bar"); b ? showTip(b) : hideTip(); });
document.addEventListener("focusout", hideTip);
document.addEventListener("scroll", hideTip, { passive: true });

/* Tema */
const root = document.documentElement;
try { const saved = localStorage.getItem("ether-theme"); if (saved) root.dataset.theme = saved; } catch (e) { }
$("themeBtn").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("ether-theme", root.dataset.theme); } catch (e) { }
});

/* Responsif: jumlah hari berubah di layar sempit */
let lastN = dayCount();
addEventListener("resize", () => { const n = dayCount(); if (n !== lastN) { lastN = n; renderAll(); } });

renderAll();
refresh();
setInterval(refresh, REFRESH_MS);
