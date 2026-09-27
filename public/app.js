const SAMPLES = {
  english1: "Train 12101 Rajdhani Express delayed at PUNE. Expected arrival 14:35 due to heavy rain.",
  english2: "Train 11010 Express delayed at NGP. Expected arrival 18:20.",
  hindi: "गाड़ी संख्या 12101 राजधानी एक्सप्रेस स्टेशन PUNE पर 14:35 बजे भारी बारिश के कारण पहुंचेगी.",
  marathi: "गाडी क्रमांक 12101 एक्सप्रेस स्थानक PUNE येथे 14:35 वाजता खराब हवामानामुळे येईल.",
  garbage: "This is completely unrelated garbage."
};

const BULK_SAMPLES = {
  valid: [
    "Train 12101 Rajdhani Express delayed at PUNE. Expected arrival 14:35 due to heavy rain.",
    "Train 11010 Express delayed at NGP. Expected arrival 18:20."
  ],
  mixed: [
    "Train 12101 Rajdhani Express delayed at PUNE. Expected arrival 14:35 due to heavy rain.",
    "This is completely unrelated garbage."
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  initCharGauge();
  checkHealth();
  fetchConfig();
});

// Theme Manager
const THEMES = [
  { id: "cyber-dark", name: "Cyber Dark", icon: "🌌" },
  { id: "terminal-amber", name: "Amber CRT", icon: "⚡" },
  { id: "light-studio", name: "Clean Light", icon: "☀️" }
];

function initTheme() {
  const saved = localStorage.getItem("operator_theme") || "cyber-dark";
  applyTheme(saved);

  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "cyber-dark";
      const currentIndex = THEMES.findIndex((t) => t.id === current);
      const nextTheme = THEMES[(currentIndex + 1) % THEMES.length];
      applyTheme(nextTheme.id);
    });
  }
}

function applyTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  try {
    localStorage.setItem("operator_theme", themeId);
  } catch {}
  const themeObj = THEMES.find((t) => t.id === themeId) || THEMES[0];
  const iconEl = document.getElementById("themeIcon");
  const nameEl = document.getElementById("themeName");
  if (iconEl) iconEl.textContent = themeObj.icon;
  if (nameEl) nameEl.textContent = themeObj.name;
}

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll(".tab-pill");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-pill").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.getAttribute("data-tab");
      document.getElementById(target)?.classList.add("active");
    });
  });
}

// Character Gauge
function initCharGauge() {
  const input = document.getElementById("singleInput");
  const counter = document.getElementById("charGauge");
  if (!input || !counter) return;

  input.addEventListener("input", () => {
    const len = input.value.length;
    counter.textContent = `${len} / 2000 CHARS`;
    if (len > 2000) {
      counter.style.color = "#ef4444";
    } else {
      counter.style.color = "#979797";
    }
  });
}

// Health Check
async function checkHealth() {
  try {
    const res = await fetch("/health");
    const el = document.getElementById("healthText");
    if (res.ok) {
      if (el) el.textContent = "HEALTH: OK (200)";
    } else {
      if (el) el.textContent = "HEALTH: OFFLINE";
    }
  } catch {
    const el = document.getElementById("healthText");
    if (el) el.textContent = "HEALTH: OFFLINE";
  }
}

// Fetch Server Config
async function fetchConfig() {
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const cfg = await res.json();
      if (document.getElementById("cfgNetwork")) document.getElementById("cfgNetwork").textContent = cfg.network;
      if (document.getElementById("cfgPayTo")) document.getElementById("cfgPayTo").textContent = cfg.payTo;
      if (document.getElementById("cfgSinglePrice")) document.getElementById("cfgSinglePrice").textContent = `$${cfg.parsePrice} USDC`;
      if (document.getElementById("cfgBulkPrice")) document.getElementById("cfgBulkPrice").textContent = `$${cfg.bulkPrice} USDC`;
      if (document.getElementById("cfgFacilitator")) document.getElementById("cfgFacilitator").textContent = cfg.facilitatorUrl;
      if (document.getElementById("cfgBuyerKey")) document.getElementById("cfgBuyerKey").textContent = cfg.hasBuyerKey ? "Configured in .env" : "Missing";
    }
  } catch (err) {
    console.warn("Could not fetch server config:", err);
  }
}

// Load Presets
function loadSample(type) {
  if (SAMPLES[type]) {
    const input = document.getElementById("singleInput");
    if (input) {
      input.value = SAMPLES[type];
      input.dispatchEvent(new Event("input"));
    }
  }
}

function loadBulkSample(type) {
  if (BULK_SAMPLES[type]) {
    const input = document.getElementById("bulkInput");
    if (input) {
      input.value = BULK_SAMPLES[type].join("\n");
    }
  }
}

// Execute Paid Single Parse via x402 Buyer Flow (/api/demo-buy)
async function executePaidSingleParse() {
  const notice = document.getElementById("singleInput")?.value.trim();
  const viewport = document.getElementById("singleOutputViewport");
  const badge = document.getElementById("singleBadge");

  if (!notice) {
    alert("Please enter or select a railway notice first.");
    return;
  }

  if (viewport) {
    viewport.innerHTML = `
      <div class="flat-result-card">
        <div class="result-card-header">
          <h4>EXECUTING x402 BUYER PAYMENT PROTOCOL...</h4>
        </div>
        <div style="font-size: 13px; color: var(--color-slate); line-height: 1.8;">
          1. Sending initial HTTP request to <code>POST /parse</code>...<br/>
          2. Intercepted <code>HTTP 402 Payment Required</code> ($0.001 USDC on Base Sepolia)...<br/>
          3. Signing EIP-712 / Permit2 x402 authorization header with Buyer Wallet...<br/>
          4. Retrying request with <code>payment-signature</code>...
        </div>
      </div>
    `;
  }

  try {
    const res = await fetch("/api/demo-buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice })
    });

    const text = await res.text();
    let result = {};
    try {
      result = JSON.parse(text);
    } catch {
      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-error-card">
            <h4>Server Response Error (${res.status})</h4>
            <p>The server returned non-JSON content. If you haven't restarted the server after updates, please restart it using <code>npm run dev</code>.</p>
          </div>
        `;
      }
      return;
    }

    const data = result.data || {};
    const status = result.status || res.status;

    if (status === 200) {
      if (badge) badge.textContent = `200 OK (x402 $0.001 SETTLED)`;

      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-result-card">
            <div class="result-card-header">
              <h4>RAILWAY NOTICE PARSED SUCCESSFULLY</h4>
              <span class="mint-pill">x402 $0.001 SETTLED</span>
            </div>
            <div style="font-size: 12px; color: var(--color-smoke); margin-bottom: 14px;">
              Buyer Wallet: <code>${result.buyerAddress || "0x..."}</code>
            </div>
            <div class="detail-grid-row">
              <div class="detail-box-cell">
                <span class="lbl">Train Number & Name</span>
                <span class="val">${data.train?.number || "-"} ${data.train?.name ? "(" + data.train.name + ")" : ""}</span>
              </div>
              <div class="detail-box-cell">
                <span class="lbl">Station Code</span>
                <span class="val">${data.station || "-"}</span>
              </div>
              <div class="detail-box-cell">
                <span class="lbl">Expected Arrival Time</span>
                <span class="val">${data.expectedTime || "-"}</span>
              </div>
              <div class="detail-box-cell">
                <span class="lbl">Reason</span>
                <span class="val" style="color: var(--color-carbon-black);">${data.reason || "None specified"}</span>
              </div>
            </div>
            <pre class="code-display-block">${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
      }
    } else {
      if (badge) badge.textContent = `${status} ERROR (SETTLEMENT CANCELLED)`;

      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-error-card">
            <h4>${data.error || "PARSER_FAILURE"} (${status})</h4>
            <p style="font-size: 14px; color: var(--color-slate);">${data.message || "Could not extract required railway delay information."}</p>
            <div style="font-size: 12px; color: var(--color-smoke); margin-top: 8px;">
              Buyer Wallet: <code>${result.buyerAddress || "0x..."}</code>
            </div>
            <div class="zero-charge-pill">
              x402 Settlement Cancelled — Caller keeps their coin!
            </div>
          </div>
        `;
      }
    }
  } catch (err) {
    if (viewport) {
      viewport.innerHTML = `<div class="flat-error-card"><h4>x402 Buyer Flow Error</h4><p>${err.message}</p></div>`;
    }
  }
}

// Execute Paid Bulk Parse via x402 Buyer Flow (/api/demo-buy-bulk)
async function executePaidBulkParse() {
  const text = document.getElementById("bulkInput")?.value.trim();
  const viewport = document.getElementById("bulkOutputViewport");
  const badge = document.getElementById("bulkBadge");

  if (!text) {
    alert("Please enter bulk notices first.");
    return;
  }

  const notices = text.split("\n").map((n) => n.trim()).filter(Boolean);

  if (viewport) {
    viewport.innerHTML = `
      <div class="flat-result-card">
        <div class="result-card-header">
          <h4>EXECUTING BULK x402 BUYER PAYMENT PROTOCOL...</h4>
        </div>
        <div style="font-size: 13px; color: var(--color-slate); line-height: 1.8;">
          1. Sending initial HTTP request to <code>POST /parse/bulk</code>...<br/>
          2. Intercepted <code>HTTP 402 Payment Required</code> ($0.005 USDC on Base Sepolia)...<br/>
          3. Signing EIP-712 / Permit2 x402 authorization header with Buyer Wallet...<br/>
          4. Retrying request with signed <code>payment-signature</code>...
        </div>
      </div>
    `;
  }

  try {
    const res = await fetch("/api/demo-buy-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notices })
    });

    const textRes = await res.text();
    let result = {};
    try {
      result = JSON.parse(textRes);
    } catch {
      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-error-card">
            <h4>Server Response Error (${res.status})</h4>
            <p>The server returned non-JSON content. Please restart the dev server using <code>npm run dev</code>.</p>
          </div>
        `;
      }
      return;
    }

    const data = result.data || {};
    const status = result.status || res.status;

    if (status === 200) {
      if (badge) badge.textContent = `200 OK (x402 $0.005 SETTLED)`;

      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-result-card">
            <div class="result-card-header">
              <h4>BULK NOTICES PARSED SUCCESSFULLY</h4>
              <span class="mint-pill">x402 $0.005 SETTLED</span>
            </div>
            <div style="font-size: 12px; color: var(--color-smoke); margin-bottom: 12px;">
              Buyer Wallet: <code>${result.buyerAddress || "0x..."}</code>
            </div>
            <pre class="code-display-block">${JSON.stringify(data, null, 2)}</pre>
          </div>
        `;
      }
    } else {
      if (badge) badge.textContent = `${status} ERROR (SETTLEMENT CANCELLED)`;

      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-error-card">
            <h4>${data.error || "BULK_PARSER_FAILURE"} (${status})</h4>
            <p>${data.message || "Failed to process bulk notices."}</p>
            <div style="font-size: 12px; color: var(--color-smoke); margin-top: 8px;">
              Buyer Wallet: <code>${result.buyerAddress || "0x..."}</code>
            </div>
            <div class="zero-charge-pill">
              x402 Settlement Cancelled — Caller keeps their coin!
            </div>
          </div>
        `;
      }
    }
  } catch (err) {
    if (viewport) {
      viewport.innerHTML = `<div class="flat-error-card"><h4>Bulk x402 Buyer Flow Error</h4><p>${err.message}</p></div>`;
    }
  }
}

// Unpaid Single Parse (Triggers 402 directly)
async function executeSingleParse() {
  const notice = document.getElementById("singleInput")?.value.trim();
  const viewport = document.getElementById("singleOutputViewport");
  const badge = document.getElementById("singleBadge");

  if (!notice) {
    alert("Please enter or select a railway notice first.");
    return;
  }

  if (viewport) viewport.innerHTML = `<div class="flat-empty-state"><p>Sending POST /parse request without payment header...</p></div>`;

  try {
    const res = await fetch("/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notice })
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 402) {
      if (badge) badge.textContent = `402 PAYMENT REQUIRED`;

      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-error-card">
            <h4>HTTP 402 PAYMENT REQUIRED</h4>
            <p style="color: var(--color-slate);">The x402 payment gate intercepted the call. Payment header required ($0.001 USDC on Base Sepolia).</p>
            <div style="margin-top: 14px; font-size: 13px; font-weight: 600;">
              Click <strong>EXECUTE x402 PAID CALL</strong> above to automatically sign & satisfy this payment requirement!
            </div>
          </div>
        `;
      }
    } else if (res.status === 200) {
      if (badge) badge.textContent = `200 OK`;
      if (viewport) viewport.innerHTML = `<pre class="code-display-block">${JSON.stringify(data, null, 2)}</pre>`;
    } else {
      if (badge) badge.textContent = `${res.status} ERROR`;
      if (viewport) viewport.innerHTML = `<div class="flat-error-card"><h4>Error (${res.status})</h4><p>${data.message || "Failed"}</p></div>`;
    }
  } catch (err) {
    if (viewport) viewport.innerHTML = `<div class="flat-error-card"><h4>Network Error</h4><p>${err.message}</p></div>`;
  }
}

// Unpaid Bulk Parse (Triggers 402 directly)
async function executeBulkParse() {
  const text = document.getElementById("bulkInput")?.value.trim();
  const viewport = document.getElementById("bulkOutputViewport");
  const badge = document.getElementById("bulkBadge");

  if (!text) {
    alert("Please enter bulk notices first.");
    return;
  }

  const notices = text.split("\n").map((n) => n.trim()).filter(Boolean);

  if (viewport) viewport.innerHTML = `<div class="flat-empty-state"><p>Sending POST /parse/bulk request without payment header...</p></div>`;

  try {
    const res = await fetch("/parse/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notices })
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 402) {
      if (badge) badge.textContent = `402 PAYMENT REQUIRED`;

      if (viewport) {
        viewport.innerHTML = `
          <div class="flat-error-card">
            <h4>HTTP 402 PAYMENT REQUIRED</h4>
            <p style="color: var(--color-slate);">Bulk parsing requires $0.005 USDC on Base Sepolia.</p>
            <div style="margin-top: 14px; font-size: 13px; font-weight: 600;">
              Click <strong>EXECUTE BULK x402 PAID CALL</strong> above to automatically sign & satisfy this payment requirement!
            </div>
          </div>
        `;
      }
    } else {
      if (viewport) viewport.innerHTML = `<pre class="code-display-block">${JSON.stringify(data, null, 2)}</pre>`;
    }
  } catch (err) {
    if (viewport) viewport.innerHTML = `<div class="flat-error-card"><h4>Network Error</h4><p>${err.message}</p></div>`;
  }
}

// Expose globals for onclick handlers
window.loadSample = loadSample;
window.loadBulkSample = loadBulkSample;
window.executePaidSingleParse = executePaidSingleParse;
window.executePaidBulkParse = executePaidBulkParse;
window.executeSingleParse = executeSingleParse;
window.executeBulkParse = executeBulkParse;
