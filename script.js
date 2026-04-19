/*
  Experimento figura-fondo (PEC)
  - 2 bloques: natural e invertido (24 ensayos cada uno)
  - Secuencia ensayo: fijacion -> estimulo 100 ms -> mascara -> respuesta
  - Registro por ensayo y analisis AS/BS por bloque
*/

(() => {
  const TRIALS_PER_BLOCK = 24;
  const TOTAL_TRIALS = TRIALS_PER_BLOCK * 2;
  const STIMULUS_DURATION_MS = 100;
  const FIXATION_MIN_MS = 500;
  const FIXATION_MAX_MS = 1000;
  const MASK_MIN_MS = 500;
  const MASK_MAX_MS = 1000;
  const BREAK_DURATION_SECONDS = 120;
  const ALPHA = 0.05;

  const CONFIG = {
    // Valores validos en URL: ?block1=natural o ?block1=invertido
    forcedFirstBlock: new URLSearchParams(window.location.search).get("block1")
  };

  const BLOCKS = {
    natural: ["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10", "N11", "N12"],
    invertido: ["I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8", "I9", "I10", "I11", "I12"]
  };

  /*
    Tabla AS oficial (respuesta dominante por imagen).
    Si tu PDF oficial difiere, cambia solo este objeto.
    Valor esperado: "B" (blanco) o "N" (negro).
  */
  const AS_KEY = {
    N1: "N",
    N2: "N",
    N3: "B",
    N4: "B",
    N5: "N",
    N6: "N",
    N7: "B",
    N8: "B",
    N9: "N",
    N10: "N",
    N11: "B",
    N12: "B",
    I1: "B",
    I2: "B",
    I3: "N",
    I4: "N",
    I5: "B",
    I6: "B",
    I7: "N",
    I8: "N",
    I9: "B",
    I10: "B",
    I11: "N",
    I12: "N"
  };

  const screens = {
    welcome: document.getElementById("screen-welcome"),
    instructions: document.getElementById("screen-instructions"),
    blockStart: document.getElementById("screen-block-start"),
    trial: document.getElementById("screen-trial"),
    response: document.getElementById("screen-response"),
    breakScreen: document.getElementById("screen-break"),
    participantEnd: document.getElementById("screen-participant-end"),
    analysis: document.getElementById("screen-analysis")
  };

  const ui = {
    btnGoInstructions: document.getElementById("btn-go-instructions"),
    btnStartExperiment: document.getElementById("btn-start-experiment"),
    btnStartBlock: document.getElementById("btn-start-block"),
    btnContinue: document.getElementById("btn-continue"),
    btnDownloadParticipantReport: document.getElementById("btn-download-participant-report"),
    btnParticipantFinish: document.getElementById("btn-participant-finish"),
    btnRestart: document.getElementById("btn-restart"),
    btnBackWelcome: document.getElementById("btn-back-welcome"),
    btnUseCurrentSession: document.getElementById("btn-use-current-session"),
    btnProcessCsv: document.getElementById("btn-process-csv"),
    btnDownloadRaw: document.getElementById("btn-download-raw"),
    btnDownloadSummary: document.getElementById("btn-download-summary"),
    btnDownloadChart: document.getElementById("btn-download-chart"),
    inputRawCsv: document.getElementById("input-raw-csv"),
    inputSummaryCsv: document.getElementById("input-summary-csv"),
    participantName: document.getElementById("participant-name"),
    participantAge: document.getElementById("participant-age"),
    participantGender: document.getElementById("participant-gender"),
    analysisParticipantMeta: document.getElementById("analysis-participant-meta"),
    breakTimer: document.getElementById("break-timer"),
    blockTitle: document.getElementById("block-title"),
    blockDescription: document.getElementById("block-description"),
    fixation: document.getElementById("fixation"),
    stimulusImage: document.getElementById("stimulus-image"),
    mask: document.getElementById("mask"),
    responseButtons: document.querySelectorAll(".response-btn"),
    freqTableBody: document.querySelector("#table-frequency tbody"),
    pctTableBody: document.querySelector("#table-percentage tbody"),
    statsTableBody: document.querySelector("#table-stats tbody"),
    chartCanvas: document.getElementById("results-chart")
    ,
    headerProgress: document.getElementById("pec-progress"),
    headerProgressLabel: document.getElementById("pec-progress-label")
  };

  let experimentState;
  let analysisState = { records: [], summaryRows: [] };
  let chartInstance = null;
  let breakTimerInterval = null;

  function resolveFirstBlock() {
    const requested = (CONFIG.forcedFirstBlock || "").toLowerCase();
    if (requested === "natural" || requested === "invertido") {
      return requested;
    }
    return Math.random() < 0.5 ? "natural" : "invertido";
  }

  function initExperimentState() {
    const firstBlock = resolveFirstBlock();
    const secondBlock = firstBlock === "natural" ? "invertido" : "natural";

    experimentState = {
      participant: null,
      blockOrder: [firstBlock, secondBlock],
      currentBlockIndex: 0,
      currentTrialIndex: 0,
      currentTrialObject: null,
      allTrialsByBlock: {},
      records: []
    };

    experimentState.allTrialsByBlock[firstBlock] = buildBlockTrials(firstBlock);
    experimentState.allTrialsByBlock[secondBlock] = buildBlockTrials(secondBlock);
  }

  function buildBlockTrials(blockType) {
    const codes = [...BLOCKS[blockType], ...BLOCKS[blockType]];
    return shuffle(codes).map((imageCode, index) => ({
      imageCode,
      trialNumberInBlock: index + 1
    }));
  }

  function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showScreen(screenKey) {
    Object.values(screens).forEach((screen) => screen.classList.remove("active"));
    screens[screenKey].classList.add("active");

    const immersiveScreens = new Set(["trial", "response"]);
    document.body.classList.toggle("immersive-mode", immersiveScreens.has(screenKey));

    if (experimentState && Array.isArray(experimentState.records)) {
      updateHeaderProgress(experimentState.records.length);
    }
  }

  function updateHeaderProgress(completed) {
    const value = Math.max(0, Math.min(TOTAL_TRIALS, Number(completed) || 0));
    const pct = value === 0 ? 0 : Math.max((value / TOTAL_TRIALS) * 100, 2);
    ui.headerProgress.style.width = `${pct}%`;
    ui.headerProgressLabel.textContent = `Paso ${value}/${TOTAL_TRIALS}`;
  }

  function buildParticipantReportRows(records) {
    if (!records.length) return [];

    const participant = records[0].participante || "";
    const edad = records[0].edad || "";
    const genero = records[0].genero || "";
    const summary = computeSummaryFromRecords(records);

    return records.map((row) => {
      const blockSummary = summary.find((s) => s.bloque === row.bloque) || {
        asCount: 0,
        bsCount: 0,
        asPct: 0,
        bsPct: 0
      };

      return {
        participante: participant,
        edad,
        genero,
        bloque: row.bloque,
        ensayo: row.ensayo,
        imagen: row.imagen,
        respuesta: row.respuesta,
        clasificacion: row.clasificacion,
        frecuencia_AS_bloque: blockSummary.asCount,
        frecuencia_BS_bloque: blockSummary.bsCount,
        porcentaje_AS_bloque: blockSummary.asPct.toFixed(2),
        porcentaje_BS_bloque: blockSummary.bsPct.toFixed(2)
      };
    });
  }

  function hideStimulusElements() {
    ui.fixation.classList.add("hidden");
    ui.stimulusImage.classList.add("hidden");
    ui.mask.classList.add("hidden");
  }

  function getCurrentBlockType() {
    return experimentState.blockOrder[experimentState.currentBlockIndex];
  }

  function getStimulusPath(imageCode) {
    // En este proyecto los estimulos se distribuyen como PNG.
    return `assets/stimuli/${imageCode}.png`;
  }

  function loadImage(path, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
      img.src = path;
    });
  }

  function formatBreakTime(seconds) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function startBreakTimer() {
    if (breakTimerInterval) {
      clearInterval(breakTimerInterval);
      breakTimerInterval = null;
    }

    let remaining = BREAK_DURATION_SECONDS;
    ui.btnContinue.disabled = true;
    ui.breakTimer.textContent = formatBreakTime(remaining);

    breakTimerInterval = setInterval(() => {
      remaining -= 1;
      ui.breakTimer.textContent = formatBreakTime(Math.max(remaining, 0));

      if (remaining <= 0) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
        ui.btnContinue.disabled = false;
      }
    }, 1000);
  }

  function getAsBsLabel(imageCode, response) {
    const asResponse = AS_KEY[imageCode];
    if (!asResponse) {
      return "BS";
    }
    return response === asResponse ? "AS" : "BS";
  }

  function setBlockStartScreen() {
    const blockNum = experimentState.currentBlockIndex + 1;

    ui.blockTitle.textContent = `Inicio bloque ${blockNum}`;
    ui.blockDescription.textContent = "Pulsa para comenzar el siguiente bloque de ensayos.";
    showScreen("blockStart");
  }

  function applyRandomNoiseMask() {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;

    const context = canvas.getContext("2d");
    const imageData = context.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const value = Math.random() < 0.5 ? 0 : 255;
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);
    ui.mask.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
  }

  async function runTrial(trialObject) {
    showScreen("trial");
    hideStimulusElements();

    ui.fixation.classList.remove("hidden");
    await wait(randomInt(FIXATION_MIN_MS, FIXATION_MAX_MS));

    ui.fixation.classList.add("hidden");

    const stimulusSrc = getStimulusPath(trialObject.imageCode);
    try {
      await loadImage(stimulusSrc);
    } catch {
      // Si falla la precarga, se intenta mostrar la ruta igualmente.
    }

    ui.stimulusImage.src = stimulusSrc;
    ui.stimulusImage.classList.remove("hidden");
    await wait(STIMULUS_DURATION_MS);

    ui.stimulusImage.classList.add("hidden");
    applyRandomNoiseMask();
    ui.mask.classList.remove("hidden");
    await wait(randomInt(MASK_MIN_MS, MASK_MAX_MS));
    ui.mask.classList.add("hidden");
  }

  function askResponse() {
    return new Promise((resolve) => {
      const blockType = getCurrentBlockType();
      const trialNumber = experimentState.currentTrialIndex + 1;

      showScreen("response");

      const handlers = [];

      function clearHandlersAndDisable() {
        ui.responseButtons.forEach((btn, idx) => {
          btn.disabled = true;
          btn.removeEventListener("click", handlers[idx]);
        });
      }

      ui.responseButtons.forEach((button, index) => {
        button.disabled = false;

        const handler = () => {
          clearHandlersAndDisable();

          const response = button.dataset.response;
          const label = getAsBsLabel(experimentState.currentTrialObject.imageCode, response);

          experimentState.records.push({
            participante: experimentState.participant.nombre,
            edad: experimentState.participant.edad,
            genero: experimentState.participant.genero,
            bloque: blockType,
            ensayo: trialNumber,
            imagen: experimentState.currentTrialObject.imageCode,
            respuesta: response,
            clasificacion: label
          });

          updateHeaderProgress(experimentState.records.length);

          resolve();
        };

        handlers[index] = handler;

        button.addEventListener("click", handler, { once: true });
      });
    });
  }

  async function runBlock() {
    const blockType = getCurrentBlockType();
    const blockTrials = experimentState.allTrialsByBlock[blockType];

    for (let i = 0; i < blockTrials.length; i += 1) {
      experimentState.currentTrialIndex = i;
      experimentState.currentTrialObject = blockTrials[i];

      await runTrial(blockTrials[i]);
      await askResponse();
    }
  }

  function computeSummary() {
    const blockNames = ["natural", "invertido"];
    return blockNames.map((block) => {
      const blockRecords = experimentState.records.filter((r) => r.bloque === block);
      const asCount = blockRecords.filter((r) => r.clasificacion === "AS").length;
      const bsCount = blockRecords.filter((r) => r.clasificacion === "BS").length;
      const total = blockRecords.length || 1;

      return {
        bloque: block,
        asCount,
        bsCount,
        asPct: (asCount / total) * 100,
        bsPct: (bsCount / total) * 100
      };
    });
  }

  function blockLabel(block) {
    return block === "natural" ? "Natural" : "Invertido";
  }

  function normalizeHeader(header) {
    return String(header || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .replaceAll("_", "");
  }

  function normalizeBlock(value) {
    const raw = String(value || "").toLowerCase().trim();
    if (raw === "natural") return "natural";
    if (raw === "invertido") return "invertido";
    return raw;
  }

  function toNumber(value) {
    const n = Number(String(value || "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function parseCsv(text) {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") {
          i += 1;
        }
        row.push(current);
        if (row.some((cell) => cell !== "")) {
          rows.push(row);
        }
        row = [];
        current = "";
        continue;
      }

      current += char;
    }

    row.push(current);
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }

    if (rows.length === 0) {
      return [];
    }

    const rawHeaders = rows[0];
    const headers = rawHeaders.map((header) => normalizeHeader(header));
    return rows.slice(1).map((cells) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = (cells[index] || "").trim();
      });
      return entry;
    });
  }

  function parseRawRecords(text) {
    return parseCsv(text).map((row) => ({
      participante: row.participante || "",
      edad: row.edad || "",
      genero: row.genero || row.sexo || "",
      bloque: normalizeBlock(row.bloque),
      ensayo: Number(row.ensayo || 0),
      imagen: row.imagen || "",
      respuesta: row.respuesta || "",
      clasificacion: row.clasificacion || row.asbs || ""
    }));
  }

  function parseSummaryRows(text) {
    return parseCsv(text).map((row) => ({
      bloque: normalizeBlock(row.bloque),
      asCount: toNumber(row.frecuenciaas || row.as || row.ascount),
      bsCount: toNumber(row.frecuenciabs || row.bs || row.bscount),
      asPct: toNumber(row.porcentajeas || row.aspct),
      bsPct: toNumber(row.porcentajebs || row.bspct)
    }));
  }

  function computeSummaryFromRecords(records) {
    const blockNames = ["natural", "invertido"];
    return blockNames.map((block) => {
      const blockRecords = records.filter((r) => r.bloque === block);
      const asCount = blockRecords.filter((r) => r.clasificacion === "AS").length;
      const bsCount = blockRecords.filter((r) => r.clasificacion === "BS").length;
      const total = blockRecords.length || 1;

      return {
        bloque: block,
        asCount,
        bsCount,
        asPct: (asCount / total) * 100,
        bsPct: (bsCount / total) * 100
      };
    });
  }

  function aggregateSummaryRows(rows) {
    const result = {
      natural: { bloque: "natural", asCount: 0, bsCount: 0, asPct: 0, bsPct: 0 },
      invertido: { bloque: "invertido", asCount: 0, bsCount: 0, asPct: 0, bsPct: 0 }
    };

    rows.forEach((row) => {
      const block = row.bloque;
      if (block !== "natural" && block !== "invertido") {
        return;
      }
      result[block].asCount += Number(row.asCount || 0);
      result[block].bsCount += Number(row.bsCount || 0);
    });

    Object.values(result).forEach((row) => {
      const total = row.asCount + row.bsCount;
      if (total > 0) {
        row.asPct = (row.asCount / total) * 100;
        row.bsPct = (row.bsCount / total) * 100;
      } else {
        row.asPct = 0;
        row.bsPct = 0;
      }
    });

    return [result.natural, result.invertido];
  }

  function getBlockCounts(summaryRows, block) {
    const row = summaryRows.find((item) => item.bloque === block);
    const asCount = Number(row?.asCount || 0);
    const bsCount = Number(row?.bsCount || 0);
    const total = asCount + bsCount;
    return { asCount, bsCount, total };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalCdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const poly =
      0.3193815 * t +
      -0.3565638 * t * t +
      1.781478 * t * t * t +
      -1.821256 * t * t * t * t +
      1.330274 * t * t * t * t * t;
    const approx = 1 - d * poly;
    return x >= 0 ? approx : 1 - approx;
  }

  function twoSidedPFromZ(z) {
    const p = 2 * (1 - normalCdf(Math.abs(z)));
    return clamp(p, 0, 1);
  }

  function wilsonInterval(k, n, z = 1.959963984540054) {
    if (!n || n <= 0) {
      return { lower: 0, upper: 0 };
    }

    const p = k / n;
    const z2 = z * z;
    const denom = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denom;
    const margin =
      (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

    return {
      lower: clamp(center - margin, 0, 1),
      upper: clamp(center + margin, 0, 1)
    };
  }

  function buildLogFactorials(maxN) {
    const logs = new Array(maxN + 1).fill(0);
    for (let i = 2; i <= maxN; i += 1) {
      logs[i] = logs[i - 1] + Math.log(i);
    }
    return logs;
  }

  function binomialTwoSidedPValue(k, n) {
    if (!n || n <= 0) return 1;

    const logFacts = buildLogFactorials(n);
    const ln2 = Math.log(2);

    function logP(x) {
      return logFacts[n] - logFacts[x] - logFacts[n - x] - n * ln2;
    }

    const logPObs = logP(k);
    let p = 0;

    for (let x = 0; x <= n; x += 1) {
      const current = logP(x);
      if (current <= logPObs + 1e-12) {
        p += Math.exp(current);
      }
    }

    return clamp(p, 0, 1);
  }

  function chiSquarePValueDf1(chiSquare) {
    if (!Number.isFinite(chiSquare) || chiSquare < 0) {
      return 1;
    }

    const z = Math.sqrt(chiSquare);
    const p = 2 * (1 - normalCdf(z));
    return clamp(p, 0, 1);
  }

  function formatPValue(p) {
    if (!Number.isFinite(p)) return "-";
    if (p < 0.0001) return "< 0.0001";
    return p.toFixed(4);
  }

  function significanceText(p, alpha = ALPHA) {
    if (!Number.isFinite(p)) return "No disponible";
    return p < alpha ? "Significativo" : "No significativo";
  }

  function computeInferentialStats(summaryRows) {
    const natural = getBlockCounts(summaryRows, "natural");
    const invertido = getBlockCounts(summaryRows, "invertido");

    const nNat = natural.total;
    const nInv = invertido.total;
    const kNat = natural.asCount;
    const kInv = invertido.asCount;
    const pNat = nNat > 0 ? kNat / nNat : 0;
    const pInv = nInv > 0 ? kInv / nInv : 0;

    const natCi = wilsonInterval(kNat, nNat);
    const invCi = wilsonInterval(kInv, nInv);

    const globalN = nNat + nInv;
    const globalK = kNat + kInv;
    const globalP = globalN > 0 ? globalK / globalN : 0;
    const globalCi = wilsonInterval(globalK, globalN);

    const pooled = globalN > 0 ? globalK / globalN : 0;
    const diff = pNat - pInv;

    let zDiff = NaN;
    let pDiff = NaN;
    if (nNat > 0 && nInv > 0) {
      const seDiff = Math.sqrt(pooled * (1 - pooled) * (1 / nNat + 1 / nInv));
      if (seDiff > 0) {
        zDiff = diff / seDiff;
        pDiff = twoSidedPFromZ(zDiff);
      }
    }

    const total = globalN;
    const rowTotalNat = nNat;
    const rowTotalInv = nInv;
    const colTotalAs = globalK;
    const colTotalBs = total - globalK;

    let chiSquare = NaN;
    let pChiSquare = NaN;
    let phi = NaN;

    if (total > 0) {
      const eNatAs = (rowTotalNat * colTotalAs) / total;
      const eNatBs = (rowTotalNat * colTotalBs) / total;
      const eInvAs = (rowTotalInv * colTotalAs) / total;
      const eInvBs = (rowTotalInv * colTotalBs) / total;

      const validExpected = [eNatAs, eNatBs, eInvAs, eInvBs].every((v) => v > 0);
      if (validExpected) {
        chiSquare =
          ((kNat - eNatAs) ** 2) / eNatAs +
          ((natural.bsCount - eNatBs) ** 2) / eNatBs +
          ((kInv - eInvAs) ** 2) / eInvAs +
          ((invertido.bsCount - eInvBs) ** 2) / eInvBs;
        pChiSquare = chiSquarePValueDf1(chiSquare);
        phi = Math.sqrt(chiSquare / total);
      }
    }

    return {
      natural: {
        n: nNat,
        asCount: kNat,
        pAs: pNat,
        pValueBinomial: binomialTwoSidedPValue(kNat, nNat),
        ci: natCi
      },
      invertido: {
        n: nInv,
        asCount: kInv,
        pAs: pInv,
        pValueBinomial: binomialTwoSidedPValue(kInv, nInv),
        ci: invCi
      },
      global: {
        n: globalN,
        asCount: globalK,
        pAs: globalP,
        pValueBinomial: binomialTwoSidedPValue(globalK, globalN),
        ci: globalCi
      },
      comparison: {
        difference: diff,
        z: zDiff,
        pValue: pDiff,
        chiSquare,
        pChiSquare,
        phi
      }
    };
  }

  function renderStatsTable(summaryRows) {
    if (!ui.statsTableBody) {
      return;
    }

    const stats = computeInferentialStats(summaryRows);
    const rows = [
      {
        prueba: "Natural vs azar (AS=50%)",
        n: stats.natural.n,
        estadistico: `AS=${stats.natural.asCount} (${(stats.natural.pAs * 100).toFixed(2)}%), IC95% [${
          (stats.natural.ci.lower * 100).toFixed(2)
        }%, ${(stats.natural.ci.upper * 100).toFixed(2)}%]`,
        p: stats.natural.pValueBinomial,
        decision: significanceText(stats.natural.pValueBinomial)
      },
      {
        prueba: "Invertido vs azar (AS=50%)",
        n: stats.invertido.n,
        estadistico: `AS=${stats.invertido.asCount} (${(stats.invertido.pAs * 100).toFixed(2)}%), IC95% [${
          (stats.invertido.ci.lower * 100).toFixed(2)
        }%, ${(stats.invertido.ci.upper * 100).toFixed(2)}%]`,
        p: stats.invertido.pValueBinomial,
        decision: significanceText(stats.invertido.pValueBinomial)
      },
      {
        prueba: "Global vs azar (AS=50%)",
        n: stats.global.n,
        estadistico: `AS=${stats.global.asCount} (${(stats.global.pAs * 100).toFixed(2)}%), IC95% [${
          (stats.global.ci.lower * 100).toFixed(2)
        }%, ${(stats.global.ci.upper * 100).toFixed(2)}%]`,
        p: stats.global.pValueBinomial,
        decision: significanceText(stats.global.pValueBinomial)
      },
      {
        prueba: "Natural vs Invertido (proporciones AS)",
        n: stats.global.n,
        estadistico: Number.isFinite(stats.comparison.z)
          ? `Dif=${(stats.comparison.difference * 100).toFixed(2)} pp, z=${stats.comparison.z.toFixed(3)}`
          : "No disponible",
        p: stats.comparison.pValue,
        decision: significanceText(stats.comparison.pValue)
      },
      {
        prueba: "Asociacion bloque-respuesta",
        n: stats.global.n,
        estadistico: Number.isFinite(stats.comparison.chiSquare)
          ? `chi2(1)=${stats.comparison.chiSquare.toFixed(3)}, phi=${stats.comparison.phi.toFixed(3)}`
          : "No disponible",
        p: stats.comparison.pChiSquare,
        decision: significanceText(stats.comparison.pChiSquare)
      }
    ];

    ui.statsTableBody.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.prueba}</td>
        <td>${row.n}</td>
        <td>${row.estadistico}</td>
        <td>${formatPValue(row.p)}</td>
        <td>${row.decision}</td>
      `;
      ui.statsTableBody.appendChild(tr);
    });
  }

  function renderResultsTables(summaryRows) {
    ui.freqTableBody.innerHTML = "";
    ui.pctTableBody.innerHTML = "";

    summaryRows.forEach((row) => {
      const freqTr = document.createElement("tr");
      freqTr.innerHTML = `
        <td>${blockLabel(row.bloque)}</td>
        <td>${row.asCount}</td>
        <td>${row.bsCount}</td>
      `;
      ui.freqTableBody.appendChild(freqTr);

      const pctTr = document.createElement("tr");
      pctTr.innerHTML = `
        <td>${blockLabel(row.bloque)}</td>
        <td>${row.asPct.toFixed(2)}%</td>
        <td>${row.bsPct.toFixed(2)}%</td>
      `;
      ui.pctTableBody.appendChild(pctTr);
    });

    renderStatsTable(summaryRows);
  }

  function renderResultsChart(summaryRows) {
    const natural = summaryRows.find((r) => r.bloque === "natural");
    const invertido = summaryRows.find((r) => r.bloque === "invertido");

    const data = [
      natural ? natural.asPct : 0,
      natural ? natural.bsPct : 0,
      invertido ? invertido.asPct : 0,
      invertido ? invertido.bsPct : 0
    ];

    if (chartInstance) {
      chartInstance.destroy();
    }

    chartInstance = new Chart(ui.chartCanvas, {
      type: "bar",
      data: {
        labels: ["Natural AS", "Natural BS", "Invertido AS", "Invertido BS"],
        datasets: [
          {
            label: "%",
            data,
            borderWidth: 1,
            backgroundColor: ["#2f6fed", "#7e8a9a", "#2f6fed", "#7e8a9a"]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: "Porcentaje"
            }
          }
        }
      }
    });
  }

  function convertToCsv(rows, headers) {
    const csvHeaders = headers.join(",");
    const csvRows = rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          if (value === null || value === undefined) return "";
          const text = String(value).replaceAll('"', '""');
          return `"${text}"`;
        })
        .join(",")
    );

    return [csvHeaders, ...csvRows].join("\n");
  }

  function downloadCsv(filename, csvText) {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function setupExportButtons(summaryRows) {
    ui.btnDownloadRaw.onclick = () => {
      const csv = convertToCsv(analysisState.records, [
        "participante",
        "edad",
        "genero",
        "bloque",
        "ensayo",
        "imagen",
        "respuesta",
        "clasificacion"
      ]);
      downloadCsv("datos_brutos_figura_fondo.csv", csv);
    };

    ui.btnDownloadSummary.onclick = () => {
      const rows = summaryRows.map((row) => ({
        bloque: blockLabel(row.bloque),
        frecuencia_AS: row.asCount,
        frecuencia_BS: row.bsCount,
        porcentaje_AS: row.asPct.toFixed(2),
        porcentaje_BS: row.bsPct.toFixed(2)
      }));

      const csv = convertToCsv(rows, [
        "bloque",
        "frecuencia_AS",
        "frecuencia_BS",
        "porcentaje_AS",
        "porcentaje_BS"
      ]);
      downloadCsv("resultados_figura_fondo.csv", csv);
    };

    ui.btnDownloadChart.onclick = () => {
      if (!chartInstance) {
        return;
      }
      const dataUrl = chartInstance.toBase64Image("image/png", 1);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = "grafica_resultados_figura_fondo.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    };
  }

  function showAnalysis(summaryRows, records) {
    const rows = summaryRows || analysisState.summaryRows || [];
    const rowsForRender = rows.length
      ? rows
      : [
          { bloque: "natural", asCount: 0, bsCount: 0, asPct: 0, bsPct: 0 },
          { bloque: "invertido", asCount: 0, bsCount: 0, asPct: 0, bsPct: 0 }
        ];

    analysisState = {
      records: records || analysisState.records,
      summaryRows: rows
    };

    const firstRecord = analysisState.records[0];
    if (firstRecord && firstRecord.participante) {
      const genero = firstRecord.genero || "-";
      ui.analysisParticipantMeta.textContent = `Participante: ${firstRecord.participante} | Edad: ${firstRecord.edad} | Género: ${genero}`;
    } else {
      ui.analysisParticipantMeta.textContent = "Sin datos de participante cargados.";
    }

    renderResultsTables(rowsForRender);
    renderResultsChart(rowsForRender);
    setupExportButtons(rowsForRender);
    showScreen("analysis");
  }

  async function startBlockFlow() {
    setBlockStartScreen();
  }

  async function advanceExperiment() {
    await runBlock();

    const justFinishedBlock = getCurrentBlockType();
    if (justFinishedBlock === experimentState.blockOrder[0]) {
      experimentState.currentBlockIndex = 1;
      experimentState.currentTrialIndex = 0;
      showScreen("breakScreen");
      startBreakTimer();
      return;
    }

    const summaryRows = computeSummaryFromRecords(experimentState.records);
    analysisState = {
      records: [...experimentState.records],
      summaryRows
    };
    updateHeaderProgress(experimentState.records.length);
    showScreen("participantEnd");
  }

  function validateParticipantInfo() {
    const nombre = ui.participantName.value.trim();
    const edad = Number(ui.participantAge.value);
    const genero = ui.participantGender.value;
    const singleNamePattern = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'-]{2,}$/;

    if (!singleNamePattern.test(nombre)) {
      alert("Introduce solo nombre (sin apellidos), sin espacios ni numeros.");
      ui.participantName.focus();
      return null;
    }

    if (!Number.isInteger(edad) || edad < 1 || edad > 120) {
      alert("Introduce una edad valida entre 1 y 120.");
      ui.participantAge.focus();
      return null;
    }

    if (!genero) {
      alert("Selecciona una opcion de genero.");
      ui.participantGender.focus();
      return null;
    }

    return { nombre, edad, genero };
  }

  async function readFileText(file) {
    if (!file) return "";
    return file.text();
  }

  async function processCsvUploads() {
    const rawFiles = Array.from(ui.inputRawCsv.files || []);
    const summaryFiles = Array.from(ui.inputSummaryCsv.files || []);

    if (rawFiles.length === 0 && summaryFiles.length === 0) {
      alert("Selecciona al menos un CSV para procesar.");
      return;
    }

    const rawTexts = await Promise.all(rawFiles.map((file) => readFileText(file)));
    const summaryTexts = await Promise.all(summaryFiles.map((file) => readFileText(file)));

    let loadedRecords = analysisState.records;
    let loadedSummary = analysisState.summaryRows;

    if (rawTexts.length > 0) {
      loadedRecords = rawTexts.flatMap((text) => parseRawRecords(text));
      loadedSummary = computeSummaryFromRecords(loadedRecords);
      updateHeaderProgress(loadedRecords.length);
    }

    if (summaryTexts.length > 0) {
      const parsedSummaryRows = summaryTexts.flatMap((text) => parseSummaryRows(text));
      loadedSummary = aggregateSummaryRows(parsedSummaryRows);
    }

    showAnalysis(loadedSummary, loadedRecords);
  }

  function bindEvents() {
    ui.btnGoInstructions.addEventListener("click", () => showScreen("instructions"));
    ui.btnBackWelcome.addEventListener("click", () => showScreen("welcome"));
    ui.btnParticipantFinish.addEventListener("click", () => showScreen("welcome"));

    ui.btnDownloadParticipantReport.addEventListener("click", () => {
      if (!experimentState || !experimentState.records.length) {
        alert("No hay datos del participante para exportar.");
        return;
      }

      const rows = buildParticipantReportRows(experimentState.records);
      const csv = convertToCsv(rows, [
        "participante",
        "edad",
        "genero",
        "bloque",
        "ensayo",
        "imagen",
        "respuesta",
        "clasificacion",
        "frecuencia_AS_bloque",
        "frecuencia_BS_bloque",
        "porcentaje_AS_bloque",
        "porcentaje_BS_bloque"
      ]);
      downloadCsv("informe_participante_figura_fondo.csv", csv);
    });

    // Acceso interno no visible al panel de investigador.
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.altKey && event.shiftKey && event.key.toLowerCase() === "r") {
        event.preventDefault();
        showAnalysis(analysisState.summaryRows, analysisState.records);
      }
    });

    ui.btnUseCurrentSession.addEventListener("click", () => {
      if (!analysisState.records.length) {
        alert("Aun no hay datos de sesion. Ejecuta el experimento o carga un CSV.");
        return;
      }
      showAnalysis(analysisState.summaryRows, analysisState.records);
    });

    ui.btnProcessCsv.addEventListener("click", async () => {
      await processCsvUploads();
    });

    ui.btnStartExperiment.addEventListener("click", async () => {
      const participant = validateParticipantInfo();
      if (!participant) {
        return;
      }
      initExperimentState();
      experimentState.participant = participant;
      updateHeaderProgress(0);
      await startBlockFlow();
    });

    ui.btnStartBlock.addEventListener("click", async () => {
      await advanceExperiment();
    });

    ui.btnContinue.addEventListener("click", async () => {
      await startBlockFlow();
    });

    ui.btnRestart.addEventListener("click", () => {
      if (breakTimerInterval) {
        clearInterval(breakTimerInterval);
        breakTimerInterval = null;
      }

      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      initExperimentState();
      analysisState = { records: [], summaryRows: [] };
      ui.inputRawCsv.value = "";
      ui.inputSummaryCsv.value = "";
      ui.participantName.value = "";
      ui.participantAge.value = "";
      ui.participantGender.value = "";
      updateHeaderProgress(0);
      showScreen("welcome");
    });
  }

  function validateAsKey() {
    const expectedCodes = [...BLOCKS.natural, ...BLOCKS.invertido];
    const missing = expectedCodes.filter((code) => !AS_KEY[code]);
    if (missing.length > 0) {
      console.warn("Faltan claves AS para:", missing.join(", "));
    }
  }

  function bootstrap() {
    validateAsKey();
    bindEvents();
    initExperimentState();
    experimentState.participant = { nombre: "", edad: "", genero: "" };
    ui.breakTimer.textContent = formatBreakTime(BREAK_DURATION_SECONDS);
    ui.btnContinue.disabled = true;
    updateHeaderProgress(0);

    const isAnalysisPage = window.location.pathname.toLowerCase().endsWith("/analysis.html");
    if (isAnalysisPage) {
      showAnalysis(analysisState.summaryRows, analysisState.records);
    } else {
      showScreen("welcome");
    }
  }

  bootstrap();
})();
