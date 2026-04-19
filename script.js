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
    results: document.getElementById("screen-results")
  };

  const ui = {
    btnGoInstructions: document.getElementById("btn-go-instructions"),
    btnStartExperiment: document.getElementById("btn-start-experiment"),
    btnStartBlock: document.getElementById("btn-start-block"),
    btnContinue: document.getElementById("btn-continue"),
    btnRestart: document.getElementById("btn-restart"),
    btnDownloadRaw: document.getElementById("btn-download-raw"),
    btnDownloadSummary: document.getElementById("btn-download-summary"),
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
  let chartInstance = null;

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
    // Se intenta con varias extensiones para facilitar uso directo en GitHub Pages.
    const base = `assets/stimuli/${imageCode}`;
    const extensions = ["png", "jpg", "jpeg", "webp"];

    return new Promise((resolve) => {
      let index = 0;

      function tryNext() {
        if (index >= extensions.length) {
          resolve(`${base}.png`);
          return;
        }

        const path = `${base}.${extensions[index]}`;
        const img = new Image();
        img.onload = () => resolve(path);
        img.onerror = () => {
          index += 1;
          tryNext();
        };
        img.src = path;
      }

      tryNext();
    });
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

    const stimulusPath = await getStimulusPath(trialObject.imageCode);
    ui.stimulusImage.src = stimulusPath;
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
      const csv = convertToCsv(experimentState.records, [
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
  }

  function showResults() {
    const summaryRows = computeSummary();
    renderResultsTables(summaryRows);
    renderResultsChart(summaryRows);
    setupExportButtons(summaryRows);
    showScreen("results");
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

    showResults();
  }

  function bindEvents() {
    ui.btnGoInstructions.addEventListener("click", () => showScreen("instructions"));

    ui.btnStartExperiment.addEventListener("click", async () => {
      initExperimentState();
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
    showScreen("welcome");
  }

  bootstrap();
})();
