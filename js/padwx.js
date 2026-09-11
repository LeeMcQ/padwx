/* PadWx MTJ — static dashboard logic */
(function () {
  "use strict";

  const CARDINALS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const TZ = "Africa/Johannesburg";
  const LIVE_URL = "https://leemcq.github.io/padwx/weather.json";

  const META = {
    hbk: { name: "Hartebeesthoek", short: "HBK", region: "Magaliesberg pad", elevationM: 1553 },
    mtj: { name: "Matjiesfontein", short: "MTJ", region: "Karoo deep-space pad", elevationM: 890 },
  };

  // Embedded last-good MTJ/HBK demo (mirrors weather.json) — used when live MTJ is null/unreachable
  let EMBEDDED_DEMO = null;

  const params = new URLSearchParams(location.search);
  const widget = params.get("view") === "widget" || document.body.dataset.view === "widget";
  let choice =
    params.get("site") === "hbk" || params.get("site") === "mtj" || params.get("site") === "both"
      ? params.get("site")
      : localStorage.getItem("padwx-site") || (widget ? "mtj" : "mtj");
  if (widget && choice === "both") choice = "mtj";
  let tab = params.get("tab") || "now";
  let payload = null;
  let usingFallback = false;
  let liveError = null;

  if (widget) document.body.classList.add("widget-only");

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function cardinal(deg) {
    if (deg == null || Number.isNaN(deg)) return "—";
    return CARDINALS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
  }

  function clock(ms) {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  }

  function dateLabel(ms) {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: TZ,
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  }

  function hPa(pa) {
    return pa / 100;
  }

  /** Magnus dew point °C */
  function dewpointC(t, rh) {
    const a = 17.27, b = 237.7;
    const alpha = (a * t) / (b + t) + Math.log(Math.max(rh, 0.1) / 100);
    return (b * alpha) / (a - alpha);
  }

  /** Ideal-gas air density kg/m³ (dry approx) */
  function airDensity(pa, tC) {
    return pa / (287.05 * (tC + 273.15));
  }

  /** Steadman apparent temperature (Australian BOM style) */
  function feelsLike(tC, rh, windKmh) {
    const ws = Math.max(0, windKmh) / 3.6; // m/s
    const e = (rh / 100) * 6.105 * Math.exp((17.27 * tC) / (237.7 + tC));
    return tC + 0.33 * e - 0.7 * ws - 4.0;
  }

  function gates(s) {
    const crane = s.windSpeed < 20 ? "go" : s.windSpeed < 32 ? "caution" : "hold";
    let pour = "go";
    if (s.rainIntensity > 0 || s.rainAccumulation > 0.2 || s.airTemp < 5) pour = "hold";
    else if (s.airTemp < 8) pour = "caution";
    const align =
      s.windSpeed > 18 || s.rainIntensity > 0 ? "hold" : s.windSpeed > 12 ? "caution" : "go";
    return { crane, pour, align };
  }

  function gustOf(now) {
    return now.windGust ?? now.highestWindSpeed ?? null;
  }

  function todayHiLo(site) {
    const series = site.series || [];
    if (!series.length || !site.now) return { hi: null, lo: null };
    const now = new Date(site.now.time);
    const parts = new Intl.DateTimeFormat("en-ZA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year").value;
    const m = parts.find((p) => p.type === "month").value;
    const d = parts.find((p) => p.type === "day").value;
    const dayKey = `${y}-${m}-${d}`;
    const temps = [];
    for (const p of series) {
      const pp = new Intl.DateTimeFormat("en-ZA", {
        timeZone: TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(p.time));
      const key = `${pp.find((x) => x.type === "year").value}-${pp.find((x) => x.type === "month").value}-${pp.find((x) => x.type === "day").value}`;
      if (key === dayKey && p.airTemp != null) temps.push(p.airTemp);
    }
    if (site.now.airTemp != null) temps.push(site.now.airTemp);
    if (!temps.length) return { hi: null, lo: null };
    return { hi: Math.max(...temps), lo: Math.min(...temps) };
  }

  function svgIcon(name) {
    const icons = {
      wind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h8"/></svg>`,
      gust: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 7h9a2.5 2.5 0 1 0-2.5-2.5"/><path d="M4 12h13a2.5 2.5 0 1 1-2.5 2.5"/><path d="M4 17h7"/><path d="M17 17l3-2-3-2"/></svg>`,
      drop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z"/></svg>`,
      rain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 15a4 4 0 1 1 1.2-7.8A5 5 0 0 1 20 10a3.5 3.5 0 0 1-.2 7H7z"/><path d="M8 19v2M12 18v3M16 19v2"/></svg>`,
      gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-3"/></svg>`,
      thermo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a3.5 3.5 0 1 1-4 0z"/><path d="M12 16v2"/></svg>`,
      cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
      gear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
      check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 13l4 4L19 7"/></svg>`,
      warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 9v4M12 17h.01"/><path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/></svg>`,
      hold: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>`,
      refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.6-6.2"/><path d="M21 3v6h-6"/></svg>`,
      sat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m13 7 4 4M8.5 15.5l-3 3M14 4l6 6-8.5 8.5H5.5V12.5L14 4z"/><path d="M5 19l3-1"/></svg>`,
      signal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 18v-2M10 18v-5M14 18V9M18 18V6"/></svg>`,
      sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
      bars: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V10M10 19V5M16 19v-7M22 19V8"/></svg>`,
      clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
      moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z"/></svg>`,
      cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 17a4 4 0 1 1 1-7.8A5 5 0 0 1 20 12a3.5 3.5 0 0 1 0 7H7z"/></svg>`,
    };
    return icons[name] || "";
  }

  function orbitalIcon() {
    return `<svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(34,211,238,.35)" stroke-width="1"/>
      <circle cx="32" cy="32" r="20" fill="none" stroke="rgba(103,232,249,.2)" stroke-dasharray="2 3"/>
      <path d="M38 20a14 14 0 1 1-12 22 11.5 11.5 0 0 0 12-22z" fill="#e2e8f0"/>
      <circle cx="46" cy="16" r="1.6" fill="#a5f3fc"/>
      <circle cx="50" cy="28" r="1.1" fill="#c4b5fd"/>
    </svg>`;
  }

  function weatherIcon(kind) {
    if (kind === "day") return svgIcon("sun");
    if (kind === "dawn" || kind === "dusk") return svgIcon("cloud");
    return svgIcon("moon");
  }

  function gateIcon(state) {
    if (state === "go") return svgIcon("check");
    if (state === "caution") return svgIcon("warn");
    return svgIcon("hold");
  }

  function drawSparkline(canvas, series, key, color) {
    if (!canvas || !series?.length) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 300;
    const cssH = canvas.clientHeight || 72;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const vals = series.map((p) => p[key]).filter((v) => v != null && Number.isFinite(v));
    if (vals.length < 2) return;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = 4;
    const span = max - min || 1;
    const pts = series.filter((p) => p[key] != null);
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = pad + (i / (pts.length - 1)) * (cssW - pad * 2);
      const y = cssH - pad - ((p[key] - min) / span) * (cssH - pad * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // fill
    const last = pts[pts.length - 1];
    const first = pts[0];
    const x0 = pad;
    const x1 = pad + ((pts.length - 1) / (pts.length - 1)) * (cssW - pad * 2);
    ctx.lineTo(x1, cssH);
    ctx.lineTo(x0, cssH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, color + "33");
    grad.addColorStop(1, color + "00");
    ctx.fillStyle = grad;
    ctx.fill();
  }

  function axisLabels(series) {
    if (!series?.length) return [];
    const n = 6;
    const out = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.round((i / (n - 1)) * (series.length - 1));
      out.push(dateLabel(series[idx].time));
    }
    return out;
  }

  function compassSvg(deg) {
    return `<svg class="compass" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#070b18" stroke="rgba(34,211,238,.45)" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(34,211,238,.15)" stroke-dasharray="2 4"/>
      <text x="50" y="16" text-anchor="middle" fill="#67e8f9" font-size="8" font-family="monospace">N</text>
      <text x="50" y="94" text-anchor="middle" fill="#64748b" font-size="7" font-family="monospace">S</text>
      <text x="10" y="53" text-anchor="middle" fill="#64748b" font-size="7" font-family="monospace">W</text>
      <text x="90" y="53" text-anchor="middle" fill="#64748b" font-size="7" font-family="monospace">E</text>
      <g transform="rotate(${deg} 50 50)">
        <polygon points="50,14 56,50 50,44 44,50" fill="#22d3ee"/>
        <polygon points="50,86 56,50 50,56 44,50" fill="#64748b"/>
      </g>
      <circle cx="50" cy="50" r="3.5" fill="#e2e8f0"/>
    </svg>`;
  }

  function enrichSite(siteId, site) {
    const meta = META[siteId];
    return {
      site: siteId,
      name: site?.name || meta.name,
      shortName: site?.shortName || meta.short,
      region: site?.region || meta.region,
      elevationM: site?.elevationM ?? meta.elevationM,
      now: site?.now || null,
      series: site?.series || [],
      localTrend: site?.localTrend || null,
    };
  }

  function mergeWithDemo(live) {
    usingFallback = false;
    liveError = live?.error || null;
    const demo = EMBEDDED_DEMO;
    if (!demo) return live;

    const out = {
      fetchedAt: live?.fetchedAt || demo.fetchedAt,
      stale: Boolean(live?.stale),
      error: live?.error,
      sites: {
        hbk: enrichSite("hbk", live?.sites?.hbk),
        mtj: enrichSite("mtj", live?.sites?.mtj),
      },
    };

    // Prefer live HBK when present
    if (!out.sites.hbk.now && demo.sites.hbk.now) {
      out.sites.hbk = { ...demo.sites.hbk };
      usingFallback = true;
      out.stale = true;
    } else if (out.sites.hbk.now && (!out.sites.hbk.series || !out.sites.hbk.series.length) && demo.sites.hbk.series?.length) {
      out.sites.hbk.series = demo.sites.hbk.series;
      out.sites.hbk.localTrend = out.sites.hbk.localTrend || demo.sites.hbk.localTrend;
    }

    // MTJ often null on live feed — fill from demo for design fidelity
    if (!out.sites.mtj.now) {
      out.sites.mtj = { ...demo.sites.mtj };
      usingFallback = true;
      out.stale = true;
      if (!out.error) out.error = "MTJ unreachable — showing last-good demo sample";
    } else if (!out.sites.mtj.series?.length && demo.sites.mtj.series?.length) {
      out.sites.mtj.series = demo.sites.mtj.series;
      out.sites.mtj.localTrend = out.sites.mtj.localTrend || demo.sites.mtj.localTrend;
      // keep live now but ensure gust field
      if (out.sites.mtj.now && gustOf(out.sites.mtj.now) == null && demo.sites.mtj.now) {
        out.sites.mtj.now = {
          ...out.sites.mtj.now,
          windGust: demo.sites.mtj.now.windGust,
          highestWindSpeed: demo.sites.mtj.now.highestWindSpeed,
        };
      }
    }

    // Ensure localTrend exists
    for (const id of ["hbk", "mtj"]) {
      if (!out.sites[id].localTrend && demo.sites[id].localTrend) {
        out.sites[id].localTrend = demo.sites[id].localTrend;
      }
      // normalize gust
      if (out.sites[id].now && gustOf(out.sites[id].now) == null) {
        out.sites[id].now.windGust = out.sites[id].now.windSpeed;
      }
    }
    return out;
  }

  function buildLocalTrend(site) {
    if (site.localTrend?.length) return site.localTrend;
    // Derive rough hourly strip from last series points + synthetic forward
    const now = site.now;
    if (!now) return [];
    const base = now.airTemp;
    const slots = [
      { label: "Now", airTemp: base, rainChance: now.rainIntensity > 0 ? 40 : 0, icon: "night" },
      { label: "+3h", airTemp: base - 1.5, rainChance: 0, icon: "night" },
      { label: "+6h", airTemp: base - 3, rainChance: 0, icon: "night" },
      { label: "+9h", airTemp: base - 2, rainChance: 5, icon: "dawn" },
      { label: "+12h", airTemp: base + 2, rainChance: 5, icon: "day" },
      { label: "+15h", airTemp: base + 5, rainChance: 10, icon: "day" },
      { label: "+18h", airTemp: base + 3, rainChance: 10, icon: "day" },
      { label: "+21h", airTemp: base, rainChance: 0, icon: "dusk" },
    ];
    return slots;
  }

  function boardHTML(siteId) {
    const site = payload.sites[siteId];
    const now = site?.now;
    if (!now) {
      return `<article class="shell board" data-site="${siteId}">
        <p class="brand-kicker">${META[siteId].short}</p>
        <h2>${META[siteId].name}</h2>
        <p class="brand-sub">Waiting for a sample.</p>
      </article>`;
    }

    const g = gates(now);
    const feel = feelsLike(now.airTemp, now.airHumidity, now.windSpeed);
    const hl = todayHiLo(site);
    const gust = gustOf(now);
    const series = site.series || [];
    const chartTemp = series.length ? series[series.length - 1].airTemp : now.airTemp;
    const chartWind = series.length ? series[series.length - 1].windSpeed : now.windSpeed;
    const chartHum = series.length ? series[series.length - 1].airHumidity : now.airHumidity;
    const axes = axisLabels(series);
    const trend = buildLocalTrend(site);
    const dew = dewpointC(now.airTemp, now.airHumidity);
    const rho = airDensity(now.airPressure, now.airTemp);
    const staleSite = usingFallback && siteId === "mtj" && liveError;

    return `
    <article class="shell board" data-site="${siteId}">
      <header class="topbar">
        <div>
          <p class="brand-kicker">${site.shortName}</p>
          <div class="brand-row">
            <h1>${site.name}</h1>
            <span class="live-dot${payload.stale ? " stale" : ""}" title="${payload.stale ? "Stale / demo" : "Live"}"></span>
          </div>
          <p class="brand-sub">${site.region}${site.elevationM ? ` · ${site.elevationM} m` : ""}.</p>
        </div>
        <div class="meta-right">
          <div class="meta-icons" aria-hidden="true">${svgIcon("sat")}${svgIcon("signal")}</div>
          <div>
            <div>Updated ${clock(now.time)} SAST</div>
            <div>${payload.stale || staleSite ? "Demo / last-good" : "Live telemetry"}</div>
          </div>
          <button type="button" class="btn-icon refresh-btn" title="Refresh" aria-label="Refresh">${svgIcon("refresh")}</button>
        </div>
      </header>

      <div class="view-panel view-now ${tab === "now" ? "active" : ""}" data-view="now">
        <div class="hero-grid">
          <div class="hero">
            <div class="orbital">${orbitalIcon()}</div>
            <div class="temp-block">
              <p class="temp">${now.airTemp.toFixed(1)}<span>°C</span></p>
              <p class="feels">Feels like <strong>${feel.toFixed(1)}°C</strong></p>
            </div>
          </div>
          <div class="metrics">
            <div class="metric"><p class="label">${svgIcon("wind")} Wind</p><p class="value">${cardinal(now.windDirection)} ${now.windSpeed.toFixed(0)} km/h</p></div>
            <div class="metric"><p class="label">${svgIcon("gust")} Wind Gust</p><p class="value">${gust != null ? gust.toFixed(1) : "—"} km/h</p></div>
            <div class="metric"><p class="label">${svgIcon("drop")} RH</p><p class="value">${now.airHumidity.toFixed(0)}%</p></div>
            <div class="metric"><p class="label">${svgIcon("rain")} Rain Accum.</p><p class="value">${(now.rainAccumulationTotal ?? now.rainAccumulation).toFixed(2)} mm</p></div>
            <div class="metric"><p class="label">${svgIcon("gauge")} Pressure</p><p class="value">${hPa(now.airPressure).toFixed(0)} hPa</p></div>
            <div class="metric"><p class="label">${svgIcon("thermo")} Today's High / Low</p><p class="value"><span class="hi">${hl.hi != null ? hl.hi.toFixed(1) + "°" : "—"}</span> / <span class="lo">${hl.lo != null ? hl.lo.toFixed(1) + "°" : "—"}</span></p></div>
          </div>
        </div>

        <div class="charts">
          <div class="chart-card">
            <div class="chart-head"><span class="title">Temperature</span><span class="badge temp">${Number(chartTemp).toFixed(1)}°C</span></div>
            <canvas class="spark" data-key="airTemp" data-color="#a855f7"></canvas>
            <div class="chart-axis">${axes.map((a) => `<span>${a}</span>`).join("")}</div>
          </div>
          <div class="chart-card">
            <div class="chart-head"><span class="title">Wind Speed</span><span class="badge wind">${Number(chartWind).toFixed(2)} km/h</span></div>
            <canvas class="spark" data-key="windSpeed" data-color="#38bdf8"></canvas>
            <div class="chart-axis">${axes.map((a) => `<span>${a}</span>`).join("")}</div>
          </div>
          <div class="chart-card">
            <div class="chart-head"><span class="title">Humidity</span><span class="badge hum">${Number(chartHum).toFixed(1)}%</span></div>
            <canvas class="spark" data-key="airHumidity" data-color="#4ade80"></canvas>
            <div class="chart-axis">${axes.map((a) => `<span>${a}</span>`).join("")}</div>
          </div>
        </div>

        <div class="bottom-row">
          <section class="panel">
            <h3>${svgIcon("cal")} Local Trend</h3>
            <div class="trend-strip">
              ${trend
                .map(
                  (s) => `<div class="trend-slot">
                  <div class="t-label">${s.label}</div>
                  <div class="t-icon">${weatherIcon(s.icon || "night")}</div>
                  <p class="t-temp">${Number(s.airTemp).toFixed(s.label === "Now" ? 1 : 0)}°</p>
                  <p class="t-rain">${s.rainChance ?? 0}%</p>
                </div>`
                )
                .join("")}
            </div>
          </section>
          <section class="panel">
            <h3>${svgIcon("gear")} Operational Status</h3>
            <div class="gates">
              <div class="gate ${g.crane}">${gateIcon(g.crane)} Crane ${g.crane}</div>
              <div class="gate ${g.pour}">${gateIcon(g.pour)} Pour ${g.pour}</div>
              <div class="gate ${g.align}">${gateIcon(g.align)} Align ${g.align}</div>
            </div>
          </section>
        </div>
      </div>

      <div class="view-panel view-trend ${tab === "trend" ? "active" : ""}" data-view="trend">
        <div class="compass-wrap">
          ${compassSvg(now.windDirection)}
          <div>
            <p class="brand-kicker">Wind</p>
            <p class="temp" style="font-size:2rem;margin:0">${cardinal(now.windDirection)} ${now.windSpeed.toFixed(1)} <span style="font-size:.5em;color:var(--muted)">km/h</span></p>
            <p class="feels">Gust ${gust != null ? gust.toFixed(1) : "—"} km/h · Dir ${now.windDirection.toFixed(0)}°</p>
          </div>
        </div>
        <div class="charts">
          <div class="chart-card">
            <div class="chart-head"><span class="title">Temperature</span><span class="badge temp">${now.airTemp.toFixed(1)}°C</span></div>
            <canvas class="spark" data-key="airTemp" data-color="#a855f7"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-head"><span class="title">Wind Speed</span><span class="badge wind">${now.windSpeed.toFixed(2)} km/h</span></div>
            <canvas class="spark" data-key="windSpeed" data-color="#38bdf8"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-head"><span class="title">Humidity</span><span class="badge hum">${now.airHumidity.toFixed(1)}%</span></div>
            <canvas class="spark" data-key="airHumidity" data-color="#4ade80"></canvas>
          </div>
        </div>
        <section class="panel">
          <h3>${svgIcon("cal")} Local Trend</h3>
          <div class="trend-strip">
            ${trend
              .map(
                (s) => `<div class="trend-slot">
                <div class="t-label">${s.label}</div>
                <div class="t-icon">${weatherIcon(s.icon || "night")}</div>
                <p class="t-temp">${Number(s.airTemp).toFixed(0)}°</p>
                <p class="t-rain">${s.rainChance ?? 0}%</p>
              </div>`
              )
              .join("")}
          </div>
        </section>
      </div>

      <div class="view-panel view-history ${tab === "history" ? "active" : ""}" data-view="history">
        <dl class="detail-grid">
          <div class="detail-card"><dt>Dew point</dt><dd>${dew.toFixed(1)} °C</dd></div>
          <div class="detail-card"><dt>Air density</dt><dd>${rho.toFixed(2)} kg/m³</dd></div>
          <div class="detail-card"><dt>Pressure</dt><dd>${hPa(now.airPressure).toFixed(1)} hPa</dd></div>
          <div class="detail-card"><dt>Rain intensity</dt><dd>${now.rainIntensity.toFixed(2)} mm/h</dd></div>
          <div class="detail-card"><dt>Rain accum.</dt><dd>${(now.rainAccumulationTotal ?? now.rainAccumulation).toFixed(2)} mm</dd></div>
          <div class="detail-card"><dt>Hail accum.</dt><dd>${(now.hailAccumulation ?? 0).toFixed(2)}</dd></div>
          <div class="detail-card"><dt>Elevation</dt><dd>${site.elevationM} m</dd></div>
          <div class="detail-card"><dt>Series points</dt><dd>${series.length}</dd></div>
        </dl>
        <div class="charts">
          <div class="chart-card">
            <div class="chart-head"><span class="title">Air Pressure (series)</span><span class="badge wind">${hPa(now.airPressure).toFixed(0)} hPa</span></div>
            <canvas class="spark" data-key="airPressure" data-color="#c084fc" data-scale="hpa"></canvas>
            <div class="chart-axis">${axes.map((a) => `<span>${a}</span>`).join("")}</div>
          </div>
          <div class="chart-card">
            <div class="chart-head"><span class="title">Wind Gust</span><span class="badge wind">${gust != null ? gust.toFixed(1) : "—"} km/h</span></div>
            <canvas class="spark" data-key="windGust" data-color="#38bdf8"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-head"><span class="title">Rain Intensity</span><span class="badge hum">${now.rainIntensity.toFixed(2)}</span></div>
            <canvas class="spark" data-key="rainIntensity" data-color="#22d3ee"></canvas>
          </div>
        </div>
        <p class="footer-note">Derived: feels-like (Steadman), dew point (Magnus), density (ideal gas). Gates match PadWx Android / legacy logic.</p>
      </div>
    </article>`;
  }

  function visibleSites() {
    if (choice === "both" && !widget) return ["hbk", "mtj"];
    return [choice === "hbk" ? "hbk" : "mtj"];
  }

  function paintCharts(root) {
    $$(".board", root).forEach((board) => {
      const siteId = board.dataset.site;
      const site = payload.sites[siteId];
      let series = site.series || [];
      $$("canvas.spark", board).forEach((cv) => {
        // only paint visible panel canvases for correct width
        const panel = cv.closest(".view-panel");
        if (panel && !panel.classList.contains("active")) return;
        let key = cv.dataset.key;
        let data = series;
        if (key === "airPressure") {
          data = series.map((p) => ({ ...p, airPressure: hPa(p.airPressure) }));
        }
        drawSparkline(cv, data, key, cv.dataset.color || "#22d3ee");
      });
    });
  }

  function render() {
    const boards = $("#boards");
    const toggle = $("#siteToggle");
    $$("button", toggle).forEach((b) => {
      b.setAttribute("aria-pressed", b.dataset.site === choice ? "true" : "false");
      if (widget && b.dataset.site === "both") b.classList.add("hidden");
    });
    $$(".nav-pill button").forEach((b) => {
      b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false");
    });
    $$(".pager-dots span").forEach((d, i) => {
      d.classList.toggle("on", ["now", "trend", "history"][i] === tab);
    });

    const banner = $("#banner");
    if (!payload) {
      boards.innerHTML = `<article class="shell"><p class="brand-sub">Fetching pad weather…</p></article>`;
      banner.classList.add("hidden");
      return;
    }

    if (payload.stale || usingFallback || payload.error) {
      banner.textContent =
        (payload.error ? payload.error + " · " : "") +
        (usingFallback ? "Showing enriched last-good demo sample for design fidelity. " : "") +
        `Fetched ${clock(payload.fetchedAt)} SAST.`;
      banner.classList.remove("hidden");
    } else {
      banner.classList.add("hidden");
    }

    boards.className = "boards" + (visibleSites().length > 1 ? " both" : "");
    boards.innerHTML = visibleSites().map(boardHTML).join("");

    $$(".refresh-btn", boards).forEach((btn) => btn.addEventListener("click", () => load()));

    // defer chart paint for layout
    requestAnimationFrame(() => paintCharts(boards));
  }

  function setTab(next) {
    tab = next;
    const u = new URL(location.href);
    u.searchParams.set("tab", tab);
    history.replaceState({}, "", u);
    // re-render to flip panels & repaint canvases
    render();
  }

  function setSite(next) {
    choice = next;
    localStorage.setItem("padwx-site", choice);
    const u = new URL(location.href);
    u.searchParams.set("site", choice);
    if (widget) u.searchParams.set("view", "widget");
    history.replaceState({}, "", u);
    render();
  }

  async function loadEmbedded() {
    try {
      const res = await fetch("weather.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("local " + res.status);
      EMBEDDED_DEMO = await res.json();
    } catch (e) {
      console.warn("local weather.json missing", e);
      EMBEDDED_DEMO = {
        fetchedAt: Date.now(),
        stale: true,
        sites: {
          hbk: { ...META.hbk, site: "hbk", now: null, series: [] },
          mtj: { ...META.mtj, site: "mtj", now: null, series: [] },
        },
      };
    }
  }

  async function load() {
    $$(".refresh-btn").forEach((b) => b.classList.add("spin"));
    $("#refreshTop")?.classList.add("spin");
    try {
      // Try local first (enriched), then optionally refresh live merge from GitHub pages
      let local = null;
      try {
        const r = await fetch("weather.json?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) local = await r.json();
      } catch (_) {}

      let live = null;
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 3500);
        const r2 = await fetch(LIVE_URL + "?t=" + Date.now(), { cache: "no-store", mode: "cors", signal: ac.signal });
        clearTimeout(to);
        if (r2.ok) live = await r2.json();
      } catch (_) {}

      if (!EMBEDDED_DEMO) EMBEDDED_DEMO = local;
      if (local?.sites?.mtj?.now) EMBEDDED_DEMO = local;

      // Paint local/enriched immediately so UI is never blank while live fetch merges
      if (local && !payload) {
        payload = local;
        usingFallback = Boolean(local.demo);
        render();
      }

      if (live) {
        payload = mergeWithDemo(live);
        // Prefer local series richness when live series empty
        if (local?.sites) {
          for (const id of ["hbk", "mtj"]) {
            if ((!payload.sites[id].series || !payload.sites[id].series.length) && local.sites[id]?.series?.length) {
              payload.sites[id].series = local.sites[id].series;
              payload.sites[id].localTrend = payload.sites[id].localTrend || local.sites[id].localTrend;
            }
            // If live MTJ null we already swapped demo now; if live has MTJ, keep live now
          }
        }
      } else if (local) {
        payload = local;
        usingFallback = Boolean(local.demo);
        liveError = "Live GitHub weather.json unreachable";
        if (local.demo) payload.stale = true;
      } else {
        throw new Error("No weather data");
      }
    } catch (e) {
      if (EMBEDDED_DEMO) {
        payload = { ...EMBEDDED_DEMO, stale: true, error: String(e.message || e) };
        usingFallback = true;
      } else {
        $("#banner").textContent = "Could not load pad weather.";
        $("#banner").classList.remove("hidden");
      }
    }
    $$(".refresh-btn").forEach((b) => b.classList.remove("spin"));
    $("#refreshTop")?.classList.remove("spin");
    render();
  }

  function bind() {
    $$("#siteToggle button").forEach((b) => b.addEventListener("click", () => setSite(b.dataset.site)));
    $$(".nav-pill button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
    $("#refreshTop")?.addEventListener("click", () => load());
    window.addEventListener("resize", () => {
      if (payload) paintCharts($("#boards"));
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  async function boot() {
    bind();
    await loadEmbedded();
    render();
    await load();
    setInterval(load, 15 * 60 * 1000);
  }

  boot();
})();
