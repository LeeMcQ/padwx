import https from "node:https";
import { writeFileSync } from "node:fs";

const TOKEN = "30f4bcffc72b4612b595a3aff024ec55";
const HOST = "hbkweatherstation.sansa.org.za";
const PORT = 8081;
const PANELS = { hbk: 36, mtj: 38 };
const META = {
  hbk: { name: "Hartebeesthoek", shortName: "HBK", region: "Magaliesberg pad", elevationM: 1553 },
  mtj: { name: "Matjiesfontein", shortName: "MTJ", region: "Karoo deep-space pad", elevationM: 890 },
};

const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false, maxSockets: 6 });

function postJson(path, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: HOST,
        port: PORT,
        path,
        method: "POST",
        agent,
        rejectUnauthorized: false,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) reject(new Error(`Grafana ${res.statusCode}`));
          else resolve(JSON.parse(text));
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.write(body);
    req.end();
  });
}

function newest(values, times) {
  if (!values?.length) return null;
  const first = values.findIndex((v) => v != null && Number.isFinite(v));
  let last = -1;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null && Number.isFinite(values[i])) { last = i; break; }
  }
  if (first < 0) return null;
  if (times && times[first] != null && times[last] != null) {
    return times[last] >= times[first] ? values[last] : values[first];
  }
  return values[last];
}

function parseSnapshot(site, frame) {
  if (!frame?.schema?.fields || !frame.data?.values) return null;
  const byName = {};
  frame.schema.fields.forEach((f, i) => { byName[f.name] = frame.data.values[i] ?? []; });
  const times = byName.time;
  const pick = (k) => newest(byName[k], times);
  const time = pick("time");
  const windDirection = pick("wind_direction");
  const windSpeed = pick("wind_speed");
  const airTemp = pick("air_temp");
  const airHumidity = pick("air_humidity");
  const airPressure = pick("air_pressure");
  if ([time, windDirection, windSpeed, airTemp, airHumidity, airPressure].some((v) => v == null)) return null;
  return {
    site, time, windDirection, windSpeed, airTemp, airHumidity, airPressure,
    rainAccumulation: pick("rain_accumulation") ?? 0,
    rainDuration: pick("rain_duration") ?? 0,
    rainIntensity: pick("rain_intensity") ?? 0,
    hailAccumulation: pick("hail_accumulation") ?? 0,
    hailDuration: pick("hail_duration") ?? 0,
    hailIntensity: pick("hail_intensity") ?? 0,
  };
}

async function queryPanel(id, timeoutMs) {
  const now = Date.now();
  const body = JSON.stringify({
    intervalMs: 60000,
    maxDataPoints: 16,
    timeRange: { from: new Date(now - 20 * 60 * 1000).toISOString(), to: new Date(now).toISOString() },
  });
  return postJson(`/api/public/dashboards/${TOKEN}/panels/${id}/query`, body, timeoutMs);
}

const [hbk, mtj] = await Promise.allSettled([
  queryPanel(PANELS.hbk, 10000),
  queryPanel(PANELS.mtj, 20000),
]);
const hbkSnap = hbk.status === "fulfilled" ? parseSnapshot("hbk", hbk.value.results?.A?.frames?.[0]) : null;
const mtjSnap = mtj.status === "fulfilled" ? parseSnapshot("mtj", mtj.value.results?.A?.frames?.[0]) : null;
const errors = [];
if (!hbkSnap) errors.push("HBK unreachable");
if (!mtjSnap) errors.push("MTJ unreachable");
const payload = {
  fetchedAt: Date.now(),
  stale: Boolean(errors.length),
  error: errors.length ? errors.join(" · ") : undefined,
  sites: {
    hbk: { site: "hbk", ...META.hbk, now: hbkSnap, series: [] },
    mtj: { site: "mtj", ...META.mtj, now: mtjSnap, series: [] },
  },
};
if (!hbkSnap && !mtjSnap) {
  console.error("no samples");
  process.exit(1);
}
writeFileSync("weather.json", JSON.stringify(payload));
console.log("wrote weather.json", payload.sites.hbk.now?.airTemp, payload.sites.mtj.now?.airTemp);
