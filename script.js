/*
  Experimento figura-fondo (PEC)
  - 2 bloques: natural e invertido (24 ensayos cada uno)
  - Secuencia ensayo: fijacion -> estimulo 100 ms -> mascara -> respuesta
  - Registro por ensayo y analisis AS/BS por bloque
*/

(() => {
  const TRIALS_PER_BLOCK = 24;
  const STIMULUS_DURATION_MS = 100;
  const FIXATION_MIN_MS = 500;
  const FIXATION_MAX_MS = 1000;
  const MASK_MIN_MS = 500;
  const MASK_MAX_MS = 1000;

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
    participantSessionMeta: document.getElementById("participant-session-meta"),
    analysisParticipantMeta: document.getElementById("analysis-participant-meta"),
    blockTitle: document.getElementById("block-title"),
    blockDescription: document.getElementById("block-description"),
    fixation: document.getElementById("fixation"),
    stimulusImage: document.getElementById("stimulus-image"),
    mask: document.getElementById("mask"),
    trialCounter: document.getElementById("trial-counter"),
    trialTotal: document.getElementById("trial-total"),
    responseButtons: document.querySelectorAll(".response-btn"),
    freqTableBody: document.querySelector("#table-frequency tbody"),
    pctTableBody: document.querySelector("#table-percentage tbody"),
    chartCanvas: document.getElementById("results-chart")
  };

  let experimentState;
  let analysisState = { records: [], summaryRows: [] };
  let chartInstance = null;
  const processedStimulusCache = new Map();

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

  function createCleanBinaryStimulus(img) {
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, width, height);

    const srcData = ctx.getImageData(0, 0, width, height);
    const data = srcData.data;
    const binary = new Uint8Array(width * height);

    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      binary[p] = lum >= 128 ? 255 : 0;
    }

    const cleaned = new Uint8Array(binary);

    // Limpieza suave: corrige pixeles aislados sin deformar la figura global.
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        let whiteNeighbors = 0;

        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            if (ox === 0 && oy === 0) continue;
            const nIdx = (y + oy) * width + (x + ox);
            if (binary[nIdx] === 255) whiteNeighbors += 1;
          }
        }

        if (binary[idx] === 255 && whiteNeighbors <= 1) {
          cleaned[idx] = 0;
        } else if (binary[idx] === 0 && whiteNeighbors >= 7) {
          cleaned[idx] = 255;
        }
      }
    }

    // Elimina motas negras pequenas encerradas en regiones blancas.
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);

    function removeSmallBlackIslands(maxIslandSize) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const start = y * width + x;
          if (visited[start] || cleaned[start] !== 0) {
            continue;
          }

          let qStart = 0;
          let qEnd = 0;
          queue[qEnd] = start;
          qEnd += 1;
          visited[start] = 1;

          const island = [];

          while (qStart < qEnd) {
            const idx = queue[qStart];
            qStart += 1;
            island.push(idx);

            const px = idx % width;
            const py = (idx - px) / width;

            const neighbors = [
              idx - 1,
              idx + 1,
              idx - width,
              idx + width
            ];

            if (px === 0) neighbors[0] = -1;
            if (px === width - 1) neighbors[1] = -1;
            if (py === 0) neighbors[2] = -1;
            if (py === height - 1) neighbors[3] = -1;

            for (let n = 0; n < neighbors.length; n += 1) {
              const nIdx = neighbors[n];
              if (nIdx < 0 || visited[nIdx] || cleaned[nIdx] !== 0) {
                continue;
              }
              visited[nIdx] = 1;
              queue[qEnd] = nIdx;
              qEnd += 1;
            }
          }

          if (island.length <= maxIslandSize) {
            for (let i = 0; i < island.length; i += 1) {
              cleaned[island[i]] = 255;
            }
          }
        }
      }
    }

    removeSmallBlackIslands(20);

    for (let i = 0, p = 0; p < cleaned.length; i += 4, p += 1) {
      const value = cleaned[p];
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }

    ctx.putImageData(srcData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async function getProcessedStimulusSrc(imageCode) {
    if (processedStimulusCache.has(imageCode)) {
      return processedStimulusCache.get(imageCode);
    }

    const path = getStimulusPath(imageCode);
    try {
      const img = await loadImage(path);
      const processedSrc = createCleanBinaryStimulus(img);
      processedStimulusCache.set(imageCode, processedSrc);
      return processedSrc;
    } catch {
      processedStimulusCache.set(imageCode, path);
      return path;
    }
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

    const stimulusSrc = await getProcessedStimulusSrc(trialObject.imageCode);
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
      ui.trialCounter.textContent = String(trialNumber);
      ui.trialTotal.textContent = String(TRIALS_PER_BLOCK);

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
      return;
    }

    const summaryRows = computeSummaryFromRecords(experimentState.records);
    analysisState = {
      records: [...experimentState.records],
      summaryRows
    };
    ui.participantSessionMeta.textContent = `Participante: ${experimentState.participant.nombre} | Edad: ${experimentState.participant.edad} | Género: ${experimentState.participant.genero}`;
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
    const rawFile = ui.inputRawCsv.files[0];
    const summaryFile = ui.inputSummaryCsv.files[0];

    if (!rawFile && !summaryFile) {
      alert("Selecciona al menos un CSV para procesar.");
      return;
    }

    const [rawText, summaryText] = await Promise.all([readFileText(rawFile), readFileText(summaryFile)]);

    let loadedRecords = analysisState.records;
    let loadedSummary = analysisState.summaryRows;

    if (rawText) {
      loadedRecords = parseRawRecords(rawText);
      loadedSummary = computeSummaryFromRecords(loadedRecords);
    }

    if (summaryText) {
      loadedSummary = parseSummaryRows(summaryText);
    }

    showAnalysis(loadedSummary, loadedRecords);
  }

  function bindEvents() {
    ui.btnGoInstructions.addEventListener("click", () => showScreen("instructions"));
    ui.btnBackWelcome.addEventListener("click", () => showScreen("welcome"));
    ui.btnParticipantFinish.addEventListener("click", () => showScreen("welcome"));

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
      await startBlockFlow();
    });

    ui.btnStartBlock.addEventListener("click", async () => {
      await advanceExperiment();
    });

    ui.btnContinue.addEventListener("click", async () => {
      await startBlockFlow();
    });

    ui.btnRestart.addEventListener("click", () => {
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
    showScreen("welcome");
  }

  bootstrap();
})();
