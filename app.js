const PLACE = {
  name: "Чешмели",
  version: "3.5",
  latitude: 36.677778,
  longitude: 34.438611,
  shoreFacingDegrees: 131,
  timezone: "Europe/Istanbul",
};

PLACE.onshoreDirection = (PLACE.shoreFacingDegrees + 180) % 360;

const state = {
  hours: 24,
  forecast: [],
};

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
  if (score >= 68) return { text: "Высокий", className: "high", color: "#ff8b72" };
  if (score >= 40) return { text: "Средний", className: "medium", color: "#ffd45a" };
  return { text: "Низкий", className: "low", color: "#62e39a" };
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
  if (height >= 1.1 || windSpeed >= 26) {
    return { text: "Опасно", className: "high", color: "#ff8b72" };
  }
  if (height >= 0.65 || windSpeed >= 18) {
    return { text: "Под присмотром", className: "medium", color: "#ffd45a" };
  }
  return { text: "Безопасно", className: "low", color: "#62e39a" };
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
        ? "Волна даёт энергию для катания, но детям нужен присмотр у кромки воды."
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
  const calmRetention = item.waveHeight < 0.35 && driftSpeed < 0.12 ? 1 : 0;

  const score = Math.round(
    10 +
      onshoreTransport * 45 +
      energeticBeach * shoreWave * 16 +
      rainPower * 14 +
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
      name: "Дрейф",
      value: `${onshoreDrift >= 0 ? "к берегу" : "от берега"} ${Math.abs(onshoreDrift).toFixed(2)} м/с`,
      detail: rainPower > 0.45 ? "дождь может добавить сток с берега" : "сумма течения, ветра и волны",
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

  const [weather, marine, air] = await Promise.all([
    fetchJson(weatherUrl),
    fetchJson(marineUrl),
    fetchJson(airUrl),
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

function renderForecast() {
  const visible = state.forecast.slice(0, state.hours);
  const now = visible[0];
  applyTimeTheme(new Date(now.time));
  const averageRisk = Math.round(
    visible.reduce((sum, item) => sum + item.risk.score, 0) / Math.max(visible.length, 1)
  );
  const peak = visible.reduce((max, item) => (item.risk.score > max.risk.score ? item : max), now);
  const label = riskLabel(averageRisk);
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
  el.waveScore.textContent = `${wave.score}/100`;
  el.waveScore.style.color = wave.score >= 76 ? "#62e39a" : wave.score >= 52 ? "#ffd45a" : "#70c7ff";
  el.waveTitle.textContent = wave.title;
  el.waveSummary.textContent = wave.summary;
  el.riskScore.textContent = averageRisk;
  el.gauge.style.background = `conic-gradient(${label.color} ${averageRisk * 3.6}deg, rgba(255, 255, 255, 0.18) 0deg)`;
  el.riskTitle.textContent = `${label.text} риск у берега`;
  el.heroSummary.textContent =
    `Вода ${
      now.waterTemperature == null ? "--" : Math.round(now.waterTemperature)
    }°C · УФ ${Math.round(now.uvIndex)} · мусор ${peak.risk.score}/100 ${formatHour(peak.time).toLowerCase()} · AQI ${now.europeanAqi == null ? "--" : Math.round(now.europeanAqi)}`;
  el.riskSummary.textContent =
    `Пик ожидается ${formatHour(peak.time).toLowerCase()}: ${peak.risk.score} из 100. ` +
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
    ["Дети", "", "", wave.child.color],
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

  ctx.beginPath();
  items.forEach((item, index) => {
    const x = pad.left + (index / Math.max(items.length - 1, 1)) * plotWidth;
    const y = pad.top + plotHeight - (item.risk.score / 100) * plotHeight;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const gradient = ctx.createLinearGradient(pad.left, 0, width - pad.right, 0);
  gradient.addColorStop(0, "#62e39a");
  gradient.addColorStop(0.55, "#ffd45a");
  gradient.addColorStop(1, "#ff8b72");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 3;
  ctx.stroke();

  const firstY = pad.top + plotHeight - (items[0].risk.score / 100) * plotHeight;
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
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

refresh();
applyTimeTheme();
