const PLACE = {
  name: "Чешмели",
  version: "4.9.1",
  latitude: 36.677778,
  longitude: 34.438611,
  shoreFacingDegrees: 131,
  timezone: "Europe/Istanbul",
};

PLACE.onshoreDirection = (PLACE.shoreFacingDegrees + 180) % 360;

const state = {
  hours: 24,
  forecast: [],
  currentItem: null,
  currentLabel: null,
  observation: null,
};

const RUNOFF_CATCHMENTS = [
  {
    name: "Kargıpınarı/Gilindire",
    shortName: "Kargıpınarı",
    delayHours: 5,
    weight: 1,
    points: [
      { name: "верховье Tepeköy", latitude: 36.84, longitude: 34.32, weight: 0.6 },
      { name: "средняя долина Elvanlı", latitude: 36.76, longitude: 34.37, weight: 0.4 },
    ],
  },
  {
    name: "Tece/Fındıkpınarı",
    shortName: "Tece",
    delayHours: 7,
    weight: 0.85,
    points: [
      { name: "верховье Fındıkpınarı", latitude: 36.96, longitude: 34.42, weight: 0.65 },
      { name: "средняя долина Tece", latitude: 36.82, longitude: 34.48, weight: 0.35 },
    ],
  },
];

const REGIONAL_RAIN_POINTS = [
  { name: "Erdemli hills", latitude: 36.82, longitude: 34.23, weight: 1 },
  { name: "Kargıpınarı hills", latitude: 36.86, longitude: 34.34, weight: 1 },
  { name: "Tece/Fındıkpınarı hills", latitude: 36.96, longitude: 34.43, weight: 1 },
  { name: "Mezitli uplands", latitude: 36.88, longitude: 34.55, weight: 0.9 },
  { name: "Mersin north", latitude: 36.91, longitude: 34.67, weight: 0.85 },
  { name: "Toroslar east", latitude: 37.02, longitude: 34.78, weight: 0.75 },
];

const el = {
  updatedAt: document.querySelector("#updatedAt"),
  refreshButton: document.querySelector("#refreshButton"),
  temperatureNow: document.querySelector("#temperatureNow"),
  conditionNow: document.querySelector("#conditionNow"),
  heroSummary: document.querySelector("#heroSummary"),
  windNow: document.querySelector("#windNow"),
  waveNow: document.querySelector("#waveNow"),
  waterNow: document.querySelector("#waterNow"),
  uvNow: document.querySelector("#uvNow"),
  riskNow: document.querySelector("#riskNow"),
  airNow: document.querySelector("#airNow"),
  airScore: document.querySelector("#airScore"),
  airTitle: document.querySelector("#airTitle"),
  airSummary: document.querySelector("#airSummary"),
  airMetrics: document.querySelector("#airMetrics"),
  waveScore: document.querySelector("#waveScore"),
  waveTitle: document.querySelector("#waveTitle"),
  waveSummary: document.querySelector("#waveSummary"),
  waveMetrics: document.querySelector("#waveMetrics"),
  riskScore: document.querySelector("#riskScore"),
  riskTitle: document.querySelector("#riskTitle"),
  riskSummary: document.querySelector("#riskSummary"),
  riskFactors: document.querySelector("#riskFactors"),
  gauge: document.querySelector(".gauge"),
  seaStatus: document.querySelector("#seaStatus"),
  seaDrift: document.querySelector("#seaDrift"),
  windVectorValue: document.querySelector("#windVectorValue"),
  windVectorMarker: document.querySelector("#windVectorMarker"),
  windVectorNote: document.querySelector("#windVectorNote"),
  currentVectorValue: document.querySelector("#currentVectorValue"),
  currentVectorMarker: document.querySelector("#currentVectorMarker"),
  currentVectorNote: document.querySelector("#currentVectorNote"),
  chart: document.querySelector("#riskChart"),
  forecastList: document.querySelector("#forecastList"),
  segments: document.querySelectorAll(".segment"),
  openObservationButton: document.querySelector("#openObservationButton"),
  closeObservationButton: document.querySelector("#closeObservationButton"),
  observationDialog: document.querySelector("#observationDialog"),
  cleanlinessOptions: document.querySelector("#cleanlinessOptions"),
  observationPreview: document.querySelector("#observationPreview"),
  sendTelegramButton: document.querySelector("#sendTelegramButton"),
  copyObservationButton: document.querySelector("#copyObservationButton"),
};

function degreesToCompass(deg) {
  const labels = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
  return labels[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

function directionCloseness(direction, target) {
  const diff = Math.abs((((direction - target) % 360) + 540) % 360 - 180);
  return Math.max(0, 1 - diff / 90);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function vectorFromDirection(speed, directionToDegrees) {
  const radians = (directionToDegrees * Math.PI) / 180;
  return {
    east: Math.sin(radians) * speed,
    north: Math.cos(radians) * speed,
  };
}

function projectionOnDirection(vector, directionToDegrees) {
  const unit = vectorFromDirection(1, directionToDegrees);
  return vector.east * unit.east + vector.north * unit.north;
}

function localShoreVector(speed, directionToDegrees) {
  const vector = vectorFromDirection(speed, directionToDegrees);
  return {
    across: projectionOnDirection(vector, PLACE.shoreFacingDegrees),
    along: projectionOnDirection(vector, PLACE.shoreFacingDegrees + 90),
  };
}

function localArrowRotation(local) {
  return Math.atan2(local.along, local.across) * (180 / Math.PI);
}

function driftLabel(local) {
  const absAcross = Math.abs(local.across);
  const absAlong = Math.abs(local.along);
  if (absAcross < 0.03 && absAlong < 0.03) return "штиль";
  if (absAcross > absAlong * 1.15) return local.across < 0 ? "к пляжу" : "в море";
  return "вдоль берега";
}

function driftPercent(local) {
  const limit = 0.18;
  return clamp(50 - (local.across / limit) * 50, 6, 94);
}

function getPlaceHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: PLACE.timezone,
  }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value ?? date.getHours());
}

function applyTimeTheme(date = new Date()) {
  const hour = getPlaceHour(date);
  const theme = hour >= 5 && hour < 10 ? "morning" : hour >= 10 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "evening" : "night";
  document.body.dataset.theme = theme;
}

function uvLabel(value) {
  if (value >= 11) return "экстр.";
  if (value >= 8) return "очень выс.";
  if (value >= 6) return "выс.";
  if (value >= 3) return "сред.";
  return "низк.";
}

function riskLabel(score) {
  if (score >= 68) return { text: "Высокий", className: "high", color: "#ff6b5f" };
  if (score >= 40) return { text: "Средний", className: "medium", color: "#ffb84d" };
  return { text: "Низкий", className: "low", color: "#62e39a" };
}

function runoffLabel(score) {
  if (score >= 0.68) return "сильный";
  if (score >= 0.36) return "заметный";
  if (score >= 0.16) return "слабый";
  return "нет";
}

function airQualityLabel(aqi) {
  if (aqi > 100) return { text: "Экстр.", className: "high", color: "#ff8b72" };
  if (aqi >= 80) return { text: "Очень плохой", className: "high", color: "#ff8b72" };
  if (aqi >= 60) return { text: "Плохой", className: "high", color: "#ff8b72" };
  if (aqi >= 40) return { text: "Умеренный", className: "medium", color: "#ffd45a" };
  if (aqi >= 20) return { text: "Нормальный", className: "medium", color: "#ffd45a" };
  return { text: "Хороший", className: "low", color: "#62e39a" };
}

function waveHeightLabel(height) {
  if (height >= 1.4) return { text: "Высокая", className: "high", color: "#ff8b72" };
  if (height >= 0.75) return { text: "Активная", className: "medium", color: "#ffd45a" };
  if (height >= 0.35) return { text: "Мягкая", className: "low", color: "#62e39a" };
  return { text: "Почти штиль", className: "low", color: "#70c7ff" };
}

function childWaveLabel(height, windSpeed) {
  if (height >= 1.1 || windSpeed >= 30) {
    return { text: "Не купаться", note: "опасно", className: "high", color: "#ff8b72" };
  }
  if (height >= 0.7 || windSpeed >= 24) {
    return { text: "Под присмотром", note: "", className: "medium", color: "#ffd45a" };
  }
  return { text: "Безопасно", note: "купание", className: "low", color: "#62e39a" };
}

function bodyboardProfile(item) {
  const height = item.waveHeight;
  const period = item.wavePeriod;
  const windSpeed = item.windSpeed;
  const windToward = (item.windDirection + 180) % 360;
  const waveToward = (item.waveDirection + 180) % 360;
  const waveToBeach = directionCloseness(waveToward, PLACE.onshoreDirection);
  const onshoreWind = directionCloseness(windToward, PLACE.onshoreDirection);
  const heightScore =
    height < 0.25 ? 8 : height < 0.45 ? 28 : height < 0.8 ? 72 : height < 1.25 ? 92 : height < 1.65 ? 68 : 34;
  const periodScore = clamp((period - 3) / 5, 0, 1) * 100;
  const windPenalty = clamp((windSpeed - 18) / 18, 0, 1) * 28 + onshoreWind * clamp((windSpeed - 12) / 18, 0, 1) * 12;
  const alignmentBoost = waveToBeach * 12;
  const score = Math.round(clamp(heightScore * 0.58 + periodScore * 0.28 + alignmentBoost - windPenalty, 0, 100));
  const child = childWaveLabel(height, windSpeed);
  let title = "Слабая волна";
  if (score >= 76) title = "Хорошо для катания";
  else if (score >= 52) title = "Можно кататься";
  else if (height >= 1.5 || windSpeed >= 30) title = "Слишком жёстко";
  else if (height < 0.35) title = "Мало волны";

  return {
    score,
    title,
    child,
    height: waveHeightLabel(height),
    summary:
      `${height.toFixed(1)} м, период ${period.toFixed(0)} с. ` +
      (score >= 76
        ? "Волна даёт энергию для катания, детям нужен взрослый рядом."
        : score >= 52
          ? "Кататься можно, качество зависит от серий и ветра."
          : height >= 1.5 || windSpeed >= 30
            ? "Много энергии и ветра: детям небезопасно, катание только для уверенных."
            : "Мягкие условия у берега, волна слабая для активного катания."),
  };
}

function weatherCondition(code, rainProbability) {
  if (rainProbability >= 55) return { text: "Возможен дождь", symbol: "☔" };
  if ([95, 96, 99].includes(code)) return { text: "Гроза", symbol: "⚡" };
  if ([61, 63, 65, 80, 81, 82].includes(code)) return { text: "Дождь", symbol: "☔" };
  if ([45, 48].includes(code)) return { text: "Туманно", symbol: "≋" };
  if ([1, 2].includes(code)) return { text: "Переменная облачность", symbol: "⛅" };
  if (code === 3) return { text: "Облачно", symbol: "☁" };
  return { text: "Ясно", symbol: "☀" };
}

function rainAtHour(source, targetMs) {
  if (!source?.rainByHour) return 0;
  const hourMs = 60 * 60 * 1000;
  const rounded = Math.round(targetMs / hourMs) * hourMs;
  return source.rainByHour.get(rounded) ?? 0;
}

function rainSum(source, centerMs, hoursBefore, hoursAfter = 0) {
  let total = 0;
  for (let offset = -hoursBefore; offset <= hoursAfter; offset += 1) {
    total += rainAtHour(source, centerMs + offset * 60 * 60 * 1000);
  }
  return total;
}

function calculateRunoff(time, runoffSources) {
  if (!runoffSources?.length) {
    return {
      score: 0,
      label: "нет",
      source: "нет данных",
      rainMm: 0,
      details: [],
    };
  }

  const timeMs = new Date(time).getTime();
  const details = runoffSources.map((catchment) => {
    const delayMs = catchment.delayHours * 60 * 60 * 1000;
    const delayedMs = timeMs - delayMs;
    let weightedRain = 0;
    let totalWeight = 0;

    catchment.sources.forEach((source) => {
      let sourceRain = 0;
      [0, 1, 2, 3, 4, 5].forEach((offset) => {
        sourceRain += rainAtHour(source, delayedMs - offset * 60 * 60 * 1000);
      });
      weightedRain += sourceRain * source.weight;
      totalWeight += source.weight;
    });

    const rainMm = totalWeight > 0 ? weightedRain / totalWeight : 0;
    const score = clamp(rainMm / 18, 0, 1) * catchment.weight;
    return {
      name: catchment.name,
      shortName: catchment.shortName,
      delayHours: catchment.delayHours,
      rainMm,
      score,
    };
  });

  const strongest = details.reduce((max, item) => (item.score > max.score ? item : max), details[0]);
  const combined = clamp(details.reduce((sum, item) => sum + item.score, 0), 0, 1);

  return {
    score: combined,
    label: runoffLabel(combined),
    source: strongest?.shortName ?? "нет данных",
    rainMm: strongest?.rainMm ?? 0,
    details,
  };
}

function calculateRegionalRain(time, regionalSources) {
  if (!regionalSources?.length) {
    return {
      score: 0,
      label: "нет",
      coverage: 0,
      averageRainMm: 0,
      wetPoints: 0,
    };
  }

  const timeMs = new Date(time).getTime();
  let weightedCoverage = 0;
  let weightedRain = 0;
  let totalWeight = 0;
  let wetPoints = 0;

  regionalSources.forEach((source) => {
    const rain24h = rainSum(source, timeMs, 18, 6);
    const rain12h = rainSum(source, timeMs, 10, 2);
    const active = rain24h >= 4 || rain12h >= 2;
    if (active) wetPoints += 1;
    weightedCoverage += (active ? 1 : 0) * source.weight;
    weightedRain += rain24h * source.weight;
    totalWeight += source.weight;
  });

  const coverage = totalWeight > 0 ? weightedCoverage / totalWeight : 0;
  const averageRainMm = totalWeight > 0 ? weightedRain / totalWeight : 0;
  const coveragePower = clamp((coverage - 0.25) / 0.65, 0, 1);
  const intensityPower = clamp(averageRainMm / 22, 0, 1);
  const score = clamp(coveragePower * 0.62 + intensityPower * 0.38, 0, 1);

  return {
    score,
    label: runoffLabel(score),
    coverage,
    averageRainMm,
    wetPoints,
  };
}

function calculateRisk(item) {
  const windToward = (item.windDirection + 180) % 360;
  const waveToward = (item.waveDirection + 180) % 360;
  const onshoreCurrent = directionCloseness(item.currentDirection, PLACE.onshoreDirection);
  const onshoreWind = directionCloseness(windToward, PLACE.onshoreDirection);
  const shoreWave = directionCloseness(waveToward, PLACE.onshoreDirection);
  const windDriftSpeed = (item.windSpeed / 3.6) * 0.03;
  const waveDriftSpeed = clamp((item.waveHeight * item.wavePeriod) / 90, 0, 0.12);
  const currentVector = vectorFromDirection(item.currentSpeed, item.currentDirection);
  const windVector = vectorFromDirection(windDriftSpeed, windToward);
  const waveVector = vectorFromDirection(waveDriftSpeed, waveToward);
  const driftNorth = currentVector.north + windVector.north + waveVector.north;
  const driftEast = currentVector.east + windVector.east + waveVector.east;
  const driftVector = { east: driftEast, north: driftNorth };
  const driftSpeed = Math.hypot(driftNorth, driftEast);
  const onshoreDrift = projectionOnDirection(driftVector, PLACE.onshoreDirection);
  const alongshoreSpeed = Math.sqrt(Math.max(0, driftSpeed ** 2 - onshoreDrift ** 2));
  const onshoreTransport = clamp((onshoreDrift + 0.04) / 0.36, 0, 1);
  const alongshoreTrapping = clamp((alongshoreSpeed - Math.abs(onshoreDrift)) / 0.28, 0, 1);
  const energeticBeach = clamp(item.waveHeight / 1.4, 0, 1);
  const rainPower = clamp(item.rainProbability / 80, 0, 1);
  const runoffPower = item.runoff?.score ?? 0;
  const regionalRainPower = item.regionalRain?.score ?? 0;
  const calmRetention = item.waveHeight < 0.35 && driftSpeed < 0.12 ? 1 : 0;

  const score = Math.round(
    10 +
      onshoreTransport * 45 +
      energeticBeach * shoreWave * 16 +
      rainPower * 7 +
      runoffPower * 16 +
      regionalRainPower * 14 +
      calmRetention * 8 +
      alongshoreTrapping * 7
  );

  const factors = [
    {
      name: "Ветер",
      value: `${Math.round(item.windSpeed)} км/ч, ${degreesToCompass(item.windDirection)}`,
      detail: onshoreWind > 0.55 ? "ветровой снос направлен к берегу" : "ветровой снос не главный фактор",
    },
    {
      name: "Течение",
      value: `${item.currentSpeed.toFixed(2)} м/с, к ${degreesToCompass(item.currentDirection)}`,
      detail: onshoreCurrent > 0.55 ? "движется к берегу" : "уводит вдоль берега или от него",
    },
    {
      name: "Волны",
      value: `${item.waveHeight.toFixed(1)} м, приходит с ${degreesToCompass(item.waveDirection)}`,
      detail: shoreWave > 0.5 ? "распространение волны поджимает к пляжу" : "умеренное влияние",
    },
    {
      name: "Горный сток",
      value:
        item.runoff?.label === "нет"
          ? "нет сигнала"
          : `${item.runoff.label}, ${item.runoff.source}`,
      detail:
        item.runoff?.score > 0.16
          ? `дождь выше по руслу мог прийти к морю с задержкой`
          : "в верховьях ручьёв нет заметного дождевого сигнала",
    },
    {
      name: "Фронт дождя",
      value:
        item.regionalRain?.label === "нет"
          ? "нет сигнала"
          : `${item.regionalRain.label}, ${Math.round((item.regionalRain.coverage ?? 0) * 100)}% зоны`,
      detail:
        item.regionalRain?.score > 0.16
          ? "широкий дождь по горам повышает общий смыв сегодня и завтра"
          : "нет широкого дождевого фронта по горной зоне",
    },
    {
      name: "Дрейф",
      value: `${onshoreDrift >= 0 ? "к берегу" : "от берега"} ${Math.abs(onshoreDrift).toFixed(2)} м/с`,
      detail:
        runoffPower > 0.28 || regionalRainPower > 0.28
          ? "дождевой смыв усиливает источник мусора"
          : "сумма течения, ветра и волны",
    },
  ];

  return {
    score: clamp(score, 0, 100),
    factors,
    drift: { north: driftNorth, east: driftEast, speed: driftSpeed, onshore: onshoreDrift },
  };
}

function getNearestIndex(times) {
  const now = Date.now();
  let best = 0;
  let bestDiff = Infinity;
  times.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - now);
    if (diff < bestDiff) {
      best = index;
      bestDiff = diff;
    }
  });
  return best;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function loadRainPoint(point) {
  const runoffUrl = new URL("https://api.open-meteo.com/v1/forecast");
  runoffUrl.search = new URLSearchParams({
    latitude: point.latitude,
    longitude: point.longitude,
    hourly: "precipitation,rain,showers,precipitation_probability",
    forecast_days: "4",
    past_hours: "24",
    timezone: PLACE.timezone,
  });

  const data = await fetchJson(runoffUrl);
  const rainByHour = new Map();
  data.hourly.time.forEach((time, index) => {
    const rain =
      data.hourly.precipitation?.[index] ??
      (data.hourly.rain?.[index] ?? 0) + (data.hourly.showers?.[index] ?? 0);
    rainByHour.set(new Date(time).getTime(), rain ?? 0);
  });

  return {
    name: point.name,
    weight: point.weight,
    rainByHour,
  };
}

async function loadRunoffSources() {
  const catchments = await Promise.all(
    RUNOFF_CATCHMENTS.map(async (catchment) => {
      const sources = await Promise.all(
        catchment.points.map((point) => loadRainPoint(point))
      );

      return { ...catchment, sources };
    })
  );

  return catchments;
}

async function loadRegionalRainSources() {
  return Promise.all(REGIONAL_RAIN_POINTS.map((point) => loadRainPoint(point)));
}

async function loadForecast() {
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: PLACE.latitude,
    longitude: PLACE.longitude,
    hourly: "temperature_2m,relative_humidity_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code,uv_index",
    forecast_days: "4",
    timezone: PLACE.timezone,
  });

  const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
  marineUrl.search = new URLSearchParams({
    latitude: PLACE.latitude,
    longitude: PLACE.longitude,
    hourly: "wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature",
    forecast_days: "4",
    timezone: PLACE.timezone,
  });

  const airUrl = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  airUrl.search = new URLSearchParams({
    latitude: PLACE.latitude,
    longitude: PLACE.longitude,
    hourly: "european_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,dust",
    forecast_days: "4",
    timezone: PLACE.timezone,
  });

  const [weather, marine, air, runoffSources, regionalRainSources] = await Promise.all([
    fetchJson(weatherUrl),
    fetchJson(marineUrl),
    fetchJson(airUrl),
    loadRunoffSources().catch(() => []),
    loadRegionalRainSources().catch(() => []),
  ]);
  const start = getNearestIndex(weather.hourly.time);
  const airStart = getNearestIndex(air.hourly.time);

  return weather.hourly.time.slice(start, start + 72).map((time, offset) => {
    const weatherIndex = start + offset;
    const marineIndex = Math.min(start + offset, marine.hourly.time.length - 1);
    const airIndex = Math.min(airStart + offset, air.hourly.time.length - 1);
    const item = {
      time,
      temperature: weather.hourly.temperature_2m[weatherIndex] ?? 0,
      humidity: weather.hourly.relative_humidity_2m[weatherIndex] ?? 0,
      rainProbability: weather.hourly.precipitation_probability[weatherIndex] ?? 0,
      weatherCode: weather.hourly.weather_code[weatherIndex] ?? 0,
      uvIndex: weather.hourly.uv_index?.[weatherIndex] ?? 0,
      windSpeed: weather.hourly.wind_speed_10m[weatherIndex] ?? 0,
      windDirection: weather.hourly.wind_direction_10m[weatherIndex] ?? 0,
      waveHeight: marine.hourly.wave_height?.[marineIndex] ?? 0,
      waveDirection: marine.hourly.wave_direction?.[marineIndex] ?? 180,
      wavePeriod: marine.hourly.wave_period?.[marineIndex] ?? 0,
      currentSpeed: (marine.hourly.ocean_current_velocity?.[marineIndex] ?? 0) / 3.6,
      currentDirection: marine.hourly.ocean_current_direction?.[marineIndex] ?? 180,
      waterTemperature: marine.hourly.sea_surface_temperature?.[marineIndex] ?? null,
      europeanAqi: air.hourly.european_aqi?.[airIndex] ?? null,
      pm10: air.hourly.pm10?.[airIndex] ?? null,
      pm25: air.hourly.pm2_5?.[airIndex] ?? null,
      ozone: air.hourly.ozone?.[airIndex] ?? null,
      nitrogenDioxide: air.hourly.nitrogen_dioxide?.[airIndex] ?? null,
      dust: air.hourly.dust?.[airIndex] ?? null,
      runoff: calculateRunoff(time, runoffSources),
      regionalRain: calculateRegionalRain(time, regionalRainSources),
      demo: false,
    };
    return { ...item, risk: calculateRisk(item) };
  });
}

function makeDemoForecast() {
  const base = new Date();
  base.setMinutes(0, 0, 0);
  return Array.from({ length: 72 }, (_, index) => {
    const hour = new Date(base.getTime() + index * 60 * 60 * 1000);
    const dayWave = Math.sin(index / 7);
    const item = {
      time: hour.toISOString(),
      temperature: 29 + Math.sin(index / 8) * 3,
      humidity: 62 + Math.cos(index / 9) * 12,
      rainProbability: index % 19 > 14 ? 42 : 10,
      weatherCode: index % 19 > 14 ? 61 : index % 9 > 5 ? 2 : 0,
      uvIndex: Math.max(0, 9 * Math.sin(((index % 24) / 24) * Math.PI)),
      windSpeed: 9 + Math.max(0, Math.sin(index / 6)) * 18,
      windDirection: 190 + Math.sin(index / 10) * 55,
      waveHeight: 0.35 + Math.max(0, dayWave) * 0.9,
      waveDirection: 185 + Math.cos(index / 8) * 60,
      wavePeriod: 4 + Math.max(0, dayWave) * 2,
      currentSpeed: 0.08 + Math.max(0, Math.cos(index / 11)) * 0.28,
      currentDirection: 330 + Math.sin(index / 9) * 55,
      waterTemperature: 28 + Math.sin(index / 20) * 0.8,
      europeanAqi: 24 + Math.max(0, Math.sin(index / 8)) * 26,
      pm10: 16 + Math.max(0, Math.sin(index / 9)) * 18,
      pm25: 7 + Math.max(0, Math.sin(index / 10)) * 10,
      ozone: 70 + Math.max(0, Math.cos(index / 7)) * 35,
      nitrogenDioxide: 12 + Math.max(0, Math.sin(index / 5)) * 20,
      dust: 4 + Math.max(0, Math.cos(index / 13)) * 16,
      runoff: {
        score: index % 22 > 14 ? 0.38 : 0.08,
        label: index % 22 > 14 ? "заметный" : "нет",
        source: "Kargıpınarı",
        rainMm: index % 22 > 14 ? 7 : 1,
        details: [],
      },
      regionalRain: {
        score: index % 30 > 18 ? 0.48 : 0.06,
        label: index % 30 > 18 ? "заметный" : "нет",
        coverage: index % 30 > 18 ? 0.62 : 0.12,
        averageRainMm: index % 30 > 18 ? 12 : 1,
        wetPoints: index % 30 > 18 ? 4 : 1,
      },
      demo: true,
    };
    return { ...item, risk: calculateRisk(item) };
  });
}

function formatHour(time) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function formatShortHour(time) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
  }).format(new Date(time));
}

function formatAxisHour(time) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
  }).format(new Date(time));
}

function getCurrentForecastItem(items) {
  const nowMs = Date.now();
  return items.reduce((closest, item) => {
    const closestDelta = Math.abs(new Date(closest.time).getTime() - nowMs);
    const itemDelta = Math.abs(new Date(item.time).getTime() - nowMs);
    return itemDelta < closestDelta ? item : closest;
  }, items[0]);
}

function buildObservation(cleanliness) {
  const now = state.currentItem;
  const label = state.currentLabel ?? riskLabel(now?.risk?.score ?? 0);
  const sentAt = new Date();

  return {
    type: "cesmeli_sea_observation",
    appVersion: PLACE.version,
    sentAt: sentAt.toISOString(),
    localTime: new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: PLACE.timezone,
    }).format(sentAt),
    place: {
      name: PLACE.name,
      latitude: PLACE.latitude,
      longitude: PLACE.longitude,
      shoreFacingDegrees: PLACE.shoreFacingDegrees,
    },
    actual: {
      cleanlinessValue: Number(cleanliness.value),
      cleanlinessLabel: cleanliness.label,
    },
    forecast: now
      ? {
          forecastTime: now.time,
          riskScore: now.risk.score,
          riskLevel: label.text,
          windSpeedKmh: Math.round(now.windSpeed),
          windDirection: degreesToCompass(now.windDirection),
          waveHeightM: Number(now.waveHeight.toFixed(1)),
          wavePeriodS: Math.round(now.wavePeriod),
          currentSpeedMs: Number(now.currentSpeed.toFixed(2)),
          currentDirection: degreesToCompass(now.currentDirection),
          waterTemperatureC: now.waterTemperature == null ? null : Math.round(now.waterTemperature),
          uvIndex: Math.round(now.uvIndex),
          airAqi: now.europeanAqi == null ? null : Math.round(now.europeanAqi),
          runoff: now.runoff
            ? {
                label: now.runoff.label,
                source: now.runoff.source,
                score: Number(now.runoff.score.toFixed(2)),
                rainMm: Number(now.runoff.rainMm.toFixed(1)),
              }
            : null,
          regionalRain: now.regionalRain
            ? {
                label: now.regionalRain.label,
                score: Number(now.regionalRain.score.toFixed(2)),
                coveragePercent: Math.round((now.regionalRain.coverage ?? 0) * 100),
                averageRainMm: Number(now.regionalRain.averageRainMm.toFixed(1)),
              }
            : null,
        }
      : null,
  };
}

function observationText(observation) {
  const forecast = observation.forecast;
  const lines = [
    "Наблюдение моря",
    `${observation.place.name} · ${observation.localTime}`,
    `Факт: ${observation.actual.cleanlinessLabel}`,
  ];

  if (forecast) {
    lines.push(
      `Прогноз мусора: ${forecast.riskScore}/100 (${forecast.riskLevel})`,
      `Ветер: ${forecast.windSpeedKmh} км/ч ${forecast.windDirection}`,
      `Волны: ${forecast.waveHeightM} м, период ${forecast.wavePeriodS} с`,
      `Течение: ${forecast.currentSpeedMs} м/с ${forecast.currentDirection}`,
      `Горный сток: ${forecast.runoff?.label ?? "нет данных"}`,
      `Фронт дождя: ${forecast.regionalRain?.label ?? "нет данных"}`
    );
  }

  lines.push(`Координаты: ${observation.place.latitude}, ${observation.place.longitude}`);
  return lines.join("\n");
}

function updateObservationPreview() {
  const observation = state.observation;
  if (!observation) {
    el.observationPreview.textContent = "Выберите оценку, и приложение подготовит запись для отправки.";
    el.sendTelegramButton.disabled = true;
    el.copyObservationButton.disabled = true;
    el.copyObservationButton.textContent = "Скопировать";
    return;
  }

  el.observationPreview.textContent = observationText(observation);
  el.sendTelegramButton.disabled = false;
  el.copyObservationButton.disabled = false;
  el.copyObservationButton.textContent = "Скопировать";
}

function renderForecast() {
  const visible = state.forecast.slice(0, state.hours);
  const now = getCurrentForecastItem(visible);
  applyTimeTheme(new Date(now.time));
  const currentRisk = now.risk.score;
  const peak = visible.reduce((max, item) => (item.risk.score > max.risk.score ? item : max), now);
  const label = riskLabel(currentRisk);
  state.currentItem = now;
  state.currentLabel = label;
  const condition = weatherCondition(now.weatherCode, now.rainProbability);
  const airLabel = airQualityLabel(now.europeanAqi ?? 0);
  const wave = bodyboardProfile(now);

  el.temperatureNow.textContent = `${Math.round(now.temperature)}°C`;
  el.conditionNow.textContent = condition.text;
  el.windNow.textContent = `${Math.round(now.windSpeed)} км/ч ${degreesToCompass(now.windDirection)}`;
  el.waveNow.textContent = `${now.waveHeight.toFixed(1)} м`;
  el.waterNow.textContent =
    now.waterTemperature == null ? "--" : `${Math.round(now.waterTemperature)}°C`;
  const displayUv = Math.round(now.uvIndex);
  el.uvNow.textContent = `${displayUv} ${uvLabel(displayUv)}`;
  el.riskNow.textContent = label.text === "Максимальный" ? "Макс." : label.text;
  el.riskNow.style.color = label.color;
  el.airNow.textContent = now.europeanAqi == null ? "--" : `AQI ${Math.round(now.europeanAqi)}`;
  el.airNow.style.color = airLabel.color;
  el.airScore.textContent = now.europeanAqi == null ? "--" : Math.round(now.europeanAqi);
  el.airScore.style.color = airLabel.color;
  el.airTitle.textContent = `${airLabel.text} воздух`;
  el.airSummary.textContent =
    now.europeanAqi == null
      ? "Данные воздуха сейчас недоступны."
      : `Главные частицы: PM2.5 ${Math.round(now.pm25 ?? 0)} и PM10 ${Math.round(now.pm10 ?? 0)} мкг/м³.`;
  el.waveScore.textContent = wave.score;
  el.waveScore.style.color = wave.score >= 76 ? "#62e39a" : wave.score >= 52 ? "#ffd45a" : "#70c7ff";
  el.waveTitle.textContent = wave.title;
  el.waveSummary.textContent = wave.summary;
  el.riskScore.textContent = currentRisk;
  el.gauge.style.background = `conic-gradient(${label.color} ${currentRisk * 3.6}deg, rgba(255, 255, 255, 0.18) 0deg)`;
  el.riskTitle.textContent = `${label.text} риск у берега`;
  el.heroSummary.textContent =
    `Вода ${
      now.waterTemperature == null ? "--" : Math.round(now.waterTemperature)
    }°C · УФ ${Math.round(now.uvIndex)} · мусор ${currentRisk}/100 сейчас · AQI ${now.europeanAqi == null ? "--" : Math.round(now.europeanAqi)}`;
  el.riskSummary.textContent =
    `Сейчас ${currentRisk} из 100. Пик ${formatHour(peak.time).toLowerCase()}: ${peak.risk.score} из 100. ` +
    (label.className === "high"
      ? "Лучше проверить море перед купанием и выбрать участок с открытым обзором воды."
      : label.className === "medium"
        ? "Условия смешанные: мусор может появляться пятнами, особенно возле волнорезов и бухточек."
        : "Факторы в основном не поджимают плавающий мусор к пляжу.");

  el.riskFactors.innerHTML = now.risk.factors
    .map(
      (factor) => `
        <div class="factor">
          <b>${factor.name}</b>
          <span>${factor.value}</span>
          <small>${factor.detail}</small>
        </div>
      `
    )
    .join("");

  el.airMetrics.innerHTML = [
    ["PM2.5", now.pm25, "мкг/м³"],
    ["PM10", now.pm10, "мкг/м³"],
    ["O₃", now.ozone, "мкг/м³"],
    ["Пыль", now.dust, "мкг/м³"],
  ]
    .map(
      ([name, value, unit]) => `
        <div>
          <span>${name}</span>
          <strong>${value == null ? "--" : Math.round(value)}</strong>
          <small>${unit}</small>
        </div>
      `
    )
    .join("");

  el.waveMetrics.innerHTML = [
    ["Высота", `${now.waveHeight.toFixed(1)} м`, wave.height.text, wave.height.color],
    ["Период", `${now.wavePeriod.toFixed(0)} с`, now.wavePeriod >= 6 ? "энергичнее" : "короткий", "#70c7ff"],
    ["Направление", degreesToCompass(now.waveDirection), "откуда волна", "#69f0e3"],
    ["Дети", wave.child.text, wave.child.note, wave.child.color],
  ]
    .map(
      ([name, value, note, color]) => `
        <div>
          <span>${name}</span>
          ${value ? `<strong style="color: ${color}">${value}</strong>` : ""}
          ${note ? `<small>${note}</small>` : ""}
        </div>
      `
    )
    .join("");

  const windToward = (now.windDirection + 180) % 360;
  const windDriftLocal = localShoreVector((now.windSpeed / 3.6) * 0.03, windToward);
  const currentLocal = localShoreVector(now.currentSpeed, now.currentDirection);
  el.seaStatus.textContent =
    now.risk.drift.onshore > 0.08
      ? "Дрейф к пляжу"
      : now.risk.drift.onshore < -0.06
        ? "Дрейф в море"
        : "Вдоль берега";
  el.seaDrift.textContent =
    `Ветер ${driftLabel(windDriftLocal)} · течение ${driftLabel(currentLocal)}`;
  el.windVectorValue.textContent = `${Math.round(now.windSpeed)} км/ч ${degreesToCompass(now.windDirection)}`;
  el.windVectorNote.textContent = driftLabel(windDriftLocal);
  el.windVectorMarker.style.left = `${driftPercent(windDriftLocal)}%`;
  el.currentVectorValue.textContent = `${now.currentSpeed.toFixed(2)} м/с ${degreesToCompass(now.currentDirection)}`;
  el.currentVectorNote.textContent = driftLabel(currentLocal);
  el.currentVectorMarker.style.left = `${driftPercent(currentLocal)}%`;

  renderCards(visible.slice(0, 24));
  renderChart(visible);
}

function renderCards(items) {
  el.forecastList.innerHTML = items
    .map((item) => {
      const label = riskLabel(item.risk.score);
      const condition = weatherCondition(item.weatherCode, item.rainProbability);
      return `
        <article class="hour-card">
          <time>${formatShortHour(item.time)}</time>
          <div class="weather-symbol">${condition.symbol}</div>
          <strong>${Math.round(item.temperature)}°C</strong>
          <p>${Math.round(item.windSpeed)} км/ч ${degreesToCompass(item.windDirection)}</p>
          <p>${item.waveHeight.toFixed(1)} м · ${item.waterTemperature == null ? "--" : Math.round(item.waterTemperature) + "°"} вода</p>
          <span class="badge ${label.className}">${item.risk.score}</span>
        </article>
      `;
    })
    .join("");
}

function renderChart(items) {
  const canvas = el.chart;
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);

  const width = rect.width;
  const height = rect.height;
  const pad = { left: 34, right: 18, top: 34, bottom: 50 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 1;
  [25, 50, 75].forEach((mark) => {
    const y = pad.top + plotHeight - (mark / 100) * plotHeight;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.font = "12px system-ui";
    ctx.fillText(String(mark), 8, y + 4);
  });

  const step = items.length <= 24 ? 3 : items.length <= 48 ? 6 : 12;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "11px system-ui";
  items.forEach((item, index) => {
    if (index % step !== 0 && index !== items.length - 1) return;
    const x = pad.left + (index / Math.max(items.length - 1, 1)) * plotWidth;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotHeight);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    ctx.fillText(formatAxisHour(item.time), x, pad.top + plotHeight + 12);
  });

  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    const x1 = pad.left + ((index - 1) / Math.max(items.length - 1, 1)) * plotWidth;
    const y1 = pad.top + plotHeight - (previous.risk.score / 100) * plotHeight;
    const x2 = pad.left + (index / Math.max(items.length - 1, 1)) * plotWidth;
    const y2 = pad.top + plotHeight - (current.risk.score / 100) * plotHeight;
    const segmentRisk = Math.round((previous.risk.score + current.risk.score) / 2);
    ctx.strokeStyle = riskLabel(segmentRisk).color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const firstY = pad.top + plotHeight - (items[0].risk.score / 100) * plotHeight;
  ctx.fillStyle = riskLabel(items[0].risk.score).color;
  ctx.beginPath();
  ctx.arc(pad.left, firstY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "13px system-ui";
  ctx.fillText("Риск мусора", pad.left, 22);
}

async function refresh() {
  applyTimeTheme();
  el.updatedAt.textContent = "Обновляю прогноз...";
  el.refreshButton.disabled = true;
  try {
    state.forecast = await loadForecast();
    el.updatedAt.textContent = `Обновлено ${new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())}`;
  } catch (error) {
    state.forecast = makeDemoForecast();
    el.updatedAt.textContent = "Нет доступа к онлайн-данным, показан демо-прогноз";
  } finally {
    el.refreshButton.disabled = false;
    renderForecast();
  }
}

el.refreshButton.addEventListener("click", refresh);
el.segments.forEach((button) => {
  button.addEventListener("click", () => {
    el.segments.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.hours = Number(button.dataset.hours);
    renderForecast();
  });
});

window.addEventListener("resize", () => {
  if (state.forecast.length > 0) renderChart(state.forecast.slice(0, state.hours));
});

el.openObservationButton.addEventListener("click", () => {
  state.observation = null;
  el.cleanlinessOptions.querySelectorAll("button").forEach((button) => {
    button.classList.remove("active");
  });
  updateObservationPreview();
  el.observationDialog.showModal();
});

el.closeObservationButton.addEventListener("click", () => {
  el.observationDialog.close();
});

el.cleanlinessOptions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (!button) return;
  el.cleanlinessOptions.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.observation = buildObservation({
    value: button.dataset.value,
    label: button.dataset.label,
  });
  updateObservationPreview();
});

el.sendTelegramButton.addEventListener("click", () => {
  if (!state.observation) return;
  const url = new URL("https://t.me/share/url");
  url.searchParams.set("url", "https://posmo333.github.io/cesmeli-weather-sea-app/");
  url.searchParams.set("text", observationText(state.observation));
  window.open(url.toString(), "_blank", "noopener");
});

el.copyObservationButton.addEventListener("click", async () => {
  if (!state.observation) return;
  const text = observationText(state.observation);
  try {
    await navigator.clipboard.writeText(text);
    el.copyObservationButton.textContent = "Скопировано";
    setTimeout(() => {
      if (state.observation) el.copyObservationButton.textContent = "Скопировать";
    }, 1400);
  } catch (error) {
    el.observationPreview.textContent = `${text}\n\nЕсли копирование не сработало, выделите этот текст вручную.`;
  }
});

refresh();
applyTimeTheme();
