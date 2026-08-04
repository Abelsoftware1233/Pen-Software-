/* ═══════════════════════════════════════════════════════════
   PentestKit Pro – Frontend Logic
   ═══════════════════════════════════════════════════════════ */

const API = window.location.origin;  // Empty = same origin (Flask serves both)

// ─── Animated Background ─────────────────────────────────────

(function initBackground() {
  const canvas = document.getElementById("bg-canvas");
  const ctx    = canvas.getContext("2d");
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.reset = function() {
      this.x  = Math.random() * W;
      this.y  = Math.random() * H;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r  = Math.random() * 1.5 + 0.5;
      this.a  = Math.random() * 0.5 + 0.1;
    };
    this.update = function() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    };
    this.draw = function() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,255,${this.a})`;
      ctx.fill();
    };
    this.reset();
  }

  function init() {
    particles = Array.from({ length: 80 }, () => new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // Lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,229,255,${0.12 * (1 - d / 120)})`;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
      particles[i].update();
      particles[i].draw();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => { resize(); init(); });
  resize();
  init();
  draw();
})();

// ─── Clock ────────────────────────────────────────────────────

function updateClock() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleTimeString("en-GB", { hour12: false });
}
updateClock();
setInterval(updateClock, 1000);

// ─── Server Status ────────────────────────────────────────────

async function checkServer() {
  try {
    const r = await fetch(`${API}/api/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "127.0.0.1" }),
      signal: AbortSignal.timeout(3000)
    });
    const dot = document.getElementById("server-dot");
    const txt = document.getElementById("server-status");
    if (r.ok) {
      dot.className = "status-dot online";
      txt.textContent = "SERVER ONLINE";
      txt.style.color = "var(--accent3)";
    } else throw new Error();
  } catch {
    document.getElementById("server-dot").className = "status-dot offline";
    document.getElementById("server-status").textContent = "SERVER OFFLINE";
    document.getElementById("server-status").style.color = "var(--accent2)";
  }
}
checkServer();
setInterval(checkServer, 15000);

// ─── Navigation ───────────────────────────────────────────────

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tool-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tool-${btn.dataset.tool}`).classList.add("active");
  });
});

// ─── Session Log ──────────────────────────────────────────────

let logHistory = [];

function addLog(tool, target, status) {
  const now   = new Date().toLocaleTimeString("en-GB", { hour12: false });
  const entry = { time: now, tool, target, status, id: Date.now() };
  logHistory.unshift(entry);

  const log = document.getElementById("session-log");
  const div = document.createElement("div");
  div.className = "log-entry";
  div.innerHTML = `
    <span class="log-time">[${now}]</span>
    <span class="log-status ${status === 'OK' ? 'log-ok' : 'log-err'}">${status}</span><br>
    <span class="log-tool">${tool}</span> → <span class="log-target">${target}</span>
  `;
  log.prepend(div);
}

function clearLog() {
  document.getElementById("session-log").innerHTML = "";
  logHistory = [];
}

// ─── Helpers ──────────────────────────────────────────────────

function showLoading(boxId) {
  const box = document.getElementById(boxId);
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="loader">
      <div class="loader-dots">
        <span></span><span></span><span></span>
      </div>
      SCANNING...
    </div>
  `;
}

function showError(boxId, msg) {
  const box = document.getElementById(boxId);
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="error-box">
      <span class="error-icon">✖</span>
      <div><strong>ERROR:</strong> ${escHtml(msg)}</div>
    </div>
  `;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function apiCall(endpoint, body) {
  const r = await fetch(`${API}/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add("loading");
    btn.querySelector(".btn-text").textContent = "RUNNING";
  } else {
    btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = btn.dataset.origText;
  }
}

// ─── Ping ─────────────────────────────────────────────────────

async function runPing() {
  const target = document.getElementById("ping-target").value.trim();
  if (!target) return alert("Enter a target");
  const box = "ping-output";
  showLoading(box);
  try {
    const d = await apiCall("ping", { target });
    addLog("PING", target, d.alive ? "OK" : "ERR");
    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>PING RESULTS // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div class="out-row">
        <span class="out-key">TARGET:</span>
        <span class="out-val accent">${escHtml(d.target)}</span>
      </div>
      <div class="out-row">
        <span class="out-key">RESOLVED IP:</span>
        <span class="out-val accent">${escHtml(d.ip)}</span>
      </div>
      <div class="out-row">
        <span class="out-key">STATUS:</span>
        <span class="out-val ${d.alive ? 'good' : 'bad'}">${d.alive ? '● ONLINE' : '● OFFLINE'}</span>
      </div>
      ${d.stats.summary ? `<div class="out-row"><span class="out-key">PACKETS:</span><span class="out-val">${escHtml(d.stats.summary)}</span></div>` : ""}
      ${d.stats.rtt ? `<div class="out-row"><span class="out-key">RTT:</span><span class="out-val">${escHtml(d.stats.rtt)}</span></div>` : ""}
      <div class="raw-output">${escHtml(d.output)}</div>
    `;
  } catch(e) {
    addLog("PING", target, "ERR");
    showError(box, e.message);
  }
}

// ─── DNS ──────────────────────────────────────────────────────

async function runDNS() {
  const target = document.getElementById("dns-target").value.trim();
  if (!target) return alert("Enter a domain");
  const box = "dns-output";
  showLoading(box);
  try {
    const d = await apiCall("dns", { target });
    addLog("DNS", target, "OK");

    let rows = "";
    for (const [type, vals] of Object.entries(d.records)) {
      if (vals && vals.length) {
        rows += `<div class="out-section">
          <div class="out-section-title">${type} RECORDS</div>`;
        vals.forEach(v => {
          rows += `<div class="out-row"><span class="out-val">${escHtml(v)}</span></div>`;
        });
        rows += `</div>`;
      }
    }

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>DNS ENUMERATION // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      ${rows || '<div class="out-row"><span class="out-val bad">No records found</span></div>'}
    `;
  } catch(e) {
    addLog("DNS", target, "ERR");
    showError(box, e.message);
  }
}

// ─── WHOIS ───────────────────────────────────────────────────

async function runWhois() {
  const target = document.getElementById("whois-target").value.trim();
  if (!target) return alert("Enter a domain");
  const box = "whois-output";
  showLoading(box);
  try {
    const d = await apiCall("whois", { target });
    addLog("WHOIS", target, "OK");

    let rows = "";
    for (const [field, vals] of Object.entries(d.fields)) {
      if (vals && vals.length) {
        rows += `<div class="out-row">
          <span class="out-key">${escHtml(field)}:</span>
          <span class="out-val">${vals.map(escHtml).join("<br>")}</span>
        </div>`;
      }
    }

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>WHOIS LOOKUP // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      ${rows}
      <details style="margin-top:12px">
        <summary style="color:var(--text-dim);font-size:0.68rem;cursor:pointer;letter-spacing:1px">▶ RAW WHOIS DATA</summary>
        <div class="raw-output">${escHtml(d.raw)}</div>
      </details>
    `;
  } catch(e) {
    addLog("WHOIS", target, "ERR");
    showError(box, e.message);
  }
}

// ─── Subdomains ──────────────────────────────────────────────

async function runSubdomain() {
  const target = document.getElementById("subdomain-target").value.trim();
  if (!target) return alert("Enter a domain");
  const box = "subdomain-output";
  showLoading(box);
  try {
    const d = await apiCall("subdomains", { target });
    addLog("SUBDOMAIN", target, d.found.length ? "OK" : "NONE");

    const rows = d.found.length
      ? d.found.map(s => `
          <div class="out-row">
            <span class="out-key accent">${escHtml(s.subdomain)}</span>
            <span class="out-val">${escHtml(s.ip)}</span>
          </div>
        `).join("")
      : `<div class="out-row"><span class="out-val bad">No subdomains found</span></div>`;

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>SUBDOMAIN SCAN // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div class="out-row">
        <span class="out-key">CHECKED:</span>
        <span class="out-val">${d.checked} wordlist entries</span>
      </div>
      <div class="out-row">
        <span class="out-key">FOUND:</span>
        <span class="out-val ${d.found.length ? 'warn' : 'good'}">${d.found.length} subdomains</span>
      </div>
      <div class="out-section">
        <div class="out-section-title">DISCOVERED SUBDOMAINS</div>
        ${rows}
      </div>
    `;
  } catch(e) {
    addLog("SUBDOMAIN", target, "ERR");
    showError(box, e.message);
  }
}

// ─── Port Scanner ─────────────────────────────────────────────

function togglePortOptions() {
  const t = document.getElementById("ps-type").value;
  document.getElementById("ps-range-group").style.display  = t === "range"  ? "flex" : "none";
  document.getElementById("ps-custom-group").style.display = t === "custom" ? "flex" : "none";
}

async function runPortScan() {
  const target = document.getElementById("ps-target").value.trim();
  const scan_type = document.getElementById("ps-type").value;
  const port_range = document.getElementById("ps-range")?.value || "1-1024";
  const custom_ports = document.getElementById("ps-custom")?.value || "";
  if (!target) return alert("Enter a target");
  const box = "ps-output";
  showLoading(box);
  try {
    const d = await apiCall("portscan", { target, scan_type, port_range, custom_ports });
    addLog("PORTSCAN", target, "OK");

    const rows = d.open_ports.length
      ? `<table class="port-table">
          <thead>
            <tr><th>PORT</th><th>SERVICE</th><th>STATE</th><th>BANNER</th></tr>
          </thead>
          <tbody>
            ${d.open_ports.map(p => `
              <tr>
                <td class="out-val accent">${p.port}</td>
                <td class="out-val warn">${escHtml(p.service)}</td>
                <td><span class="badge badge-open">OPEN</span></td>
                <td class="out-val" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(p.banner)}">${escHtml(p.banner || "–")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>`
      : `<div class="out-row"><span class="out-val good">No open ports found</span></div>`;

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>PORT SCAN // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div class="out-row"><span class="out-key">TARGET IP:</span><span class="out-val accent">${escHtml(d.ip)}</span></div>
      <div class="out-row"><span class="out-key">PORTS SCANNED:</span><span class="out-val">${d.ports_scanned}</span></div>
      <div class="out-row"><span class="out-key">OPEN PORTS:</span><span class="out-val ${d.open_ports.length ? 'warn' : 'good'}">${d.open_ports.length}</span></div>
      <div class="out-row"><span class="out-key">ELAPSED:</span><span class="out-val">${d.elapsed}s</span></div>
      <div class="out-section">${rows}</div>
    `;
  } catch(e) {
    addLog("PORTSCAN", target, "ERR");
    showError(box, e.message);
  }
}

// ─── Network Scan ─────────────────────────────────────────────

async function runNetScan() {
  const cidr = document.getElementById("net-cidr").value.trim();
  if (!cidr) return alert("Enter a CIDR range");
  const box = "net-output";
  showLoading(box);
  try {
    const d = await apiCall("netscan", { cidr });
    addLog("NETSCAN", cidr, d.count ? "OK" : "NONE");

    const rows = d.alive.length
      ? d.alive.map(h => `
          <div class="out-row">
            <span class="out-key accent">● ${escHtml(h.ip)}</span>
            <span class="out-val good">ALIVE</span>
          </div>
        `).join("")
      : `<div class="out-row"><span class="out-val bad">No live hosts found</span></div>`;

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>NETWORK SWEEP // ${escHtml(cidr)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div class="out-row"><span class="out-key">TOTAL HOSTS:</span><span class="out-val">${d.total_hosts}</span></div>
      <div class="out-row"><span class="out-key">LIVE HOSTS:</span><span class="out-val ${d.count ? 'warn' : 'good'}">${d.count}</span></div>
      <div class="out-section">
        <div class="out-section-title">LIVE HOSTS</div>
        ${rows}
      </div>
    `;
  } catch(e) {
    addLog("NETSCAN", cidr, "ERR");
    showError(box, e.message);
  }
}

// ─── Traceroute ───────────────────────────────────────────────

async function runTraceroute() {
  const target = document.getElementById("trace-target").value.trim();
  if (!target) return alert("Enter a target");
  const box = "trace-output";
  showLoading(box);
  try {
    const d = await apiCall("traceroute", { target });
    addLog("TRACEROUTE", target, "OK");

    const hops = d.hops.map((h, i) => `
      <div class="hop-row">
        <span class="hop-num">${String(i + 1).padStart(2, "0")}.</span>
        <span class="hop-data">${escHtml(h)}</span>
      </div>
    `).join("");

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>TRACEROUTE // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div class="out-row"><span class="out-key">TARGET IP:</span><span class="out-val accent">${escHtml(d.ip)}</span></div>
      <div class="out-row"><span class="out-key">HOPS:</span><span class="out-val">${d.hops.length}</span></div>
      <div class="out-section">
        <div class="out-section-title">ROUTE</div>
        ${hops}
      </div>
    `;
  } catch(e) {
    addLog("TRACEROUTE", target, "ERR");
    showError(box, e.message);
  }
}

// ─── HTTP Headers ─────────────────────────────────────────────

async function runHeaders() {
  const target = document.getElementById("hdr-target").value.trim();
  if (!target) return alert("Enter a URL");
  const box = "hdr-output";
  showLoading(box);
  try {
    const d = await apiCall("headers", { target });
    addLog("HEADERS", target, "OK");

    const gradeClass = `grade-${d.grade}`;

    const secGrid = d.security_analysis.map(s => `
      <div class="sec-item ${s.present ? 'sec-present' : 'sec-missing'}">
        <span class="sec-icon">${s.present ? '✔' : '✖'}</span>
        <span class="sec-name">${escHtml(s.header)}</span>
        <span class="badge ${s.present ? 'badge-low' : 'badge-high'}">${s.risk}</span>
      </div>
    `).join("");

    const allHdrs = Object.entries(d.all_headers).map(([k, v]) => `
      <div class="out-row">
        <span class="out-key">${escHtml(k)}:</span>
        <span class="out-val">${escHtml(v)}</span>
      </div>
    `).join("");

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>HTTP ANALYSIS // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div style="display:flex;align-items:center;margin-bottom:16px;gap:16px">
        <div class="grade-box ${gradeClass}">${d.grade}</div>
        <div>
          <div style="color:var(--text-dim);font-size:0.68rem;letter-spacing:2px">SECURITY GRADE</div>
          <div style="color:var(--text);margin-top:4px">${d.score} / ${d.max_score} security headers present</div>
          <div class="out-row" style="margin-top:6px"><span class="out-key">HTTP STATUS:</span><span class="out-val ${d.status_code < 400 ? 'good' : 'bad'}">${d.status_code}</span></div>
        </div>
      </div>
      <div class="out-section">
        <div class="out-section-title">SECURITY HEADERS</div>
        <div class="security-grid">${secGrid}</div>
      </div>
      <details style="margin-top:12px">
        <summary style="color:var(--text-dim);font-size:0.68rem;cursor:pointer;letter-spacing:1px">▶ ALL RESPONSE HEADERS</summary>
        <div class="out-section" style="margin-top:8px">${allHdrs}</div>
      </details>
    `;
  } catch(e) {
    addLog("HEADERS", target, "ERR");
    showError(box, e.message);
  }
}

// ─── SSL Inspector ────────────────────────────────────────────

async function runSSL() {
  const target = document.getElementById("ssl-target").value.trim();
  if (!target) return alert("Enter a hostname");
  const box = "ssl-output";
  showLoading(box);
  try {
    const d = await apiCall("ssl", { target });
    addLog("SSL", target, "OK");

    const issuesHtml = d.issues.length
      ? d.issues.map(i => `
          <div class="out-row">
            <span class="badge badge-${i.severity.toLowerCase()}">${i.severity}</span>
            <span class="out-val" style="margin-left:8px">${escHtml(i.msg)}</span>
          </div>`).join("")
      : `<div class="out-row"><span class="out-val good">✔ No issues detected</span></div>`;

    const sanHtml = d.san && d.san.length
      ? d.san.slice(0, 10).map(s => `<span class="out-val" style="margin-right:8px">${escHtml(s)}</span>`).join("")
      : "None";

    document.getElementById(box).innerHTML = `
      <div class="out-header">
        <span>SSL/TLS INSPECTION // ${escHtml(target)}</span>
        <span>${d.timestamp}</span>
      </div>
      <div class="out-section">
        <div class="out-section-title">CERTIFICATE INFO</div>
        <div class="out-row"><span class="out-key">COMMON NAME:</span><span class="out-val accent">${escHtml(d.subject?.commonName || "–")}</span></div>
        <div class="out-row"><span class="out-key">ORGANIZATION:</span><span class="out-val">${escHtml(d.subject?.organizationName || "–")}</span></div>
        <div class="out-row"><span class="out-key">ISSUER:</span><span class="out-val">${escHtml(d.issuer?.organizationName || d.issuer?.commonName || "–")}</span></div>
        <div class="out-row"><span class="out-key">VALID FROM:</span><span class="out-val">${escHtml(d.not_before)}</span></div>
        <div class="out-row"><span class="out-key">VALID UNTIL:</span><span class="out-val ${d.expired ? 'bad' : d.days_left < 30 ? 'warn' : 'good'}">${escHtml(d.not_after)} ${d.days_left !== null ? `(${d.days_left}d left)` : ''}</span></div>
        <div class="out-row"><span class="out-key">STATUS:</span><span class="out-val ${d.expired ? 'bad' : 'good'}">${d.expired ? '✖ EXPIRED' : '✔ VALID'}</span></div>
      </div>
      <div class="out-section">
        <div class="out-section-title">PROTOCOL</div>
        <div class="out-row"><span class="out-key">TLS VERSION:</span><span class="out-val ${['TLSv1.2','TLSv1.3'].includes(d.version) ? 'good' : 'bad'}">${escHtml(d.version || "–")}</span></div>
        <div class="out-row"><span class="out-key">CIPHER SUITE:</span><span class="out-val">${escHtml(d.cipher ? d.cipher[0] : "–")}</span></div>
        <div class="out-row"><span class="out-key">KEY BITS:</span><span class="out-val">${escHtml(d.cipher ? d.cipher[2] : "–")}</span></div>
      </div>
      <div class="out-section">
        <div class="out-section-title">SUBJECT ALT NAMES</div>
        <div style="padding:4px 0;line-height:2">${sanHtml}</div>
      </div>
      <div class="out-section">
        <div class="out-section-title">SECURITY FINDINGS</div>
        ${issuesHtml}
      </div>
    `;
  } catch(e) {
    addLog("SSL", target, "ERR");
    showError(box, e.message);
  }
}

// ─── Enter key support ────────────────────────────────────────

document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const active = document.querySelector(".tool-panel.active");
  if (!active) return;
  const id = active.id.replace("tool-", "");
  const map = {
    ping: runPing, dns: runDNS, whois: runWhois,
    subdomain: runSubdomain, portscan: runPortScan,
    netscan: runNetScan, traceroute: runTraceroute,
    headers: runHeaders, ssl: runSSL
  };
  if (map[id]) map[id]();
});
