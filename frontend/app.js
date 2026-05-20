'use strict';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

// ── State ──────────────────────────────────────────────────────────────
let sessionId = null;
let sessionStatus = null;
let thinkingEl = null;

// ── DOM refs ───────────────────────────────────────────────────────────
const thread    = document.getElementById('chat-thread');
const actionBar = document.getElementById('action-bar');
const input     = document.getElementById('message-input');
const sendBtn   = document.getElementById('send-btn');
const statusBadge = document.getElementById('status-badge');

// ── Bootstrap ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initSession);

// ── Session ────────────────────────────────────────────────────────────
async function initSession() {
  try {
    const res = await fetch('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    sessionId = data.sessionId;

    appendMessage('system',
      '◈ AWS Architecture Advisor ready.\n\n' +
      'Describe the system you want to build. I\'ll ask clarifying questions ' +
      'before generating an architecture recommendation.\n\n' +
      'Example: "I need a REST API for a mobile app handling 50k daily users, ' +
      'storing user profiles and transaction history."'
    );

    setInputEnabled(true);
  } catch (err) {
    appendMessage('error', `Failed to start session: ${err.message}`);
  }
}

// ── Send message ───────────────────────────────────────────────────────
async function sendMessage(text) {
  if (!text.trim() || !sessionId) return;

  appendMessage('user', text);
  setLoading(true);

  try {
    const res = await fetch(`/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    appendMessage('assistant', data.message);
    updateStatus(data.status);
    updateActionBar(data.status);
  } catch (err) {
    appendMessage('error', `Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// ── Message rendering ──────────────────────────────────────────────────
const PREFIXES = { user: '▶', assistant: '◈', system: '·', error: '✕' };

function appendMessage(role, text) {
  const row = buildRow(role);
  row.body.textContent = text;
  thread.appendChild(row.el);
  scrollToBottom();
  return row.el;
}

function appendRichMessage(role, contentEl) {
  const row = buildRow(role);
  row.body.appendChild(contentEl);
  thread.appendChild(row.el);
  scrollToBottom();
  return row.el;
}

function buildRow(role) {
  const el   = document.createElement('div');
  el.className = `message ${role}`;

  const pre  = document.createElement('span');
  pre.className = 'message-prefix';
  pre.textContent = PREFIXES[role] || '·';

  const body = document.createElement('div');
  body.className = 'message-body';

  el.appendChild(pre);
  el.appendChild(body);
  return { el, body };
}

function scrollToBottom() {
  thread.scrollTop = thread.scrollHeight;
}

// ── Status badge ───────────────────────────────────────────────────────
const STATUS_LABELS = {
  CLARIFYING:             'Clarifying',
  READY_TO_GENERATE:      'Ready',
  ARCHITECTURE_GENERATED: 'Arch Generated',
  ARCHITECTURE_APPROVED:  'Approved',
  CDK_GENERATED:          'CDK Generated',
};

function updateStatus(status) {
  if (!status) return;
  sessionStatus = status;
  statusBadge.textContent = STATUS_LABELS[status] || status;
  statusBadge.className = `status-badge visible ${status}`;
}

// ── Action bar ─────────────────────────────────────────────────────────
function updateActionBar(status) {
  actionBar.innerHTML = '';

  if (status === 'READY_TO_GENERATE') {
    mkBtn('Generate Architecture', 'primary', fetchArchitecture);
  } else if (status === 'ARCHITECTURE_GENERATED') {
    mkBtn('View Diagram', '',        fetchDiagram);
    mkBtn('Approve Architecture', 'success', approveArchitecture);
  } else if (status === 'ARCHITECTURE_APPROVED') {
    mkBtn('Generate CDK', 'primary', generateCdk);
  } else if (status === 'CDK_GENERATED') {
    mkBtn('New Session', '', () => window.location.reload());
  }
}

function mkBtn(label, variant, handler) {
  const btn = document.createElement('button');
  btn.className = ['action-btn', variant].filter(Boolean).join(' ');
  btn.textContent = label;
  btn.addEventListener('click', handler);
  actionBar.appendChild(btn);
}

// ── Architecture ───────────────────────────────────────────────────────
async function fetchArchitecture() {
  actionBar.innerHTML = '';
  setLoading(true);
  appendMessage('system', 'Generating architecture recommendation… this may take a moment.');

  try {
    const res = await fetch(`/sessions/${sessionId}/architecture`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    updateStatus('ARCHITECTURE_GENERATED');
    await renderArchitecture(data);
    updateActionBar('ARCHITECTURE_GENERATED');
  } catch (err) {
    appendMessage('error', `Architecture generation failed: ${err.message}`);
    updateActionBar(sessionStatus);
  } finally {
    setLoading(false);
  }
}

async function renderArchitecture(data) {
  const card = el('div', 'arch-card message-body');

  // Summary
  section(card, 'Summary', () => {
    const p = el('p', 'arch-summary');
    p.textContent = data.summary;
    return p;
  });

  // Cost
  section(card, 'Estimated Monthly Cost', () => {
    const p = el('p', 'arch-cost');
    p.textContent = data.estimatedMonthlyCost;
    return p;
  });

  // Services
  if (data.services?.length) {
    section(card, 'Services', () => {
      const table = el('table', 'services-table');
      table.innerHTML = '<thead><tr><th>Service</th><th>Tier</th><th>Purpose</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (const svc of data.services) {
        const tr = document.createElement('tr');
        tr.innerHTML =
          `<td>${esc(svc.name)}</td>` +
          `<td><span class="tier-badge">${esc(svc.tier)}</span></td>` +
          `<td>${esc(svc.purpose)}</td>`;
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      return table;
    });
  }

  // Tradeoffs
  if (data.tradeoffs?.length) {
    section(card, 'Tradeoffs', () => {
      const list = el('div', 'tradeoff-list');
      for (const t of data.tradeoffs) {
        const item = el('div', 'tradeoff-item');
        item.innerHTML =
          `<div><span class="tradeoff-aspect">${esc(t.aspect)}</span>` +
          `<span class="tradeoff-impact ${esc(t.impact)}">${esc(t.impact)}</span></div>` +
          `<div>✓ ${esc(t.chosen)}</div>` +
          `<div style="color:var(--text-muted)">✗ ${esc(t.alternative)}</div>`;
        list.appendChild(item);
      }
      return list;
    });
  }

  // Well-Architected alignment
  if (data.wellArchitectedAlignment?.length) {
    section(card, 'Well-Architected Alignment', () => {
      const list = el('div', 'tradeoff-list');
      for (const p of data.wellArchitectedAlignment) {
        const scoreColour = p.score === 'STRONG' ? 'LOW' : p.score === 'ADEQUATE' ? 'MEDIUM' : 'HIGH';
        const item = el('div', 'tradeoff-item');
        item.innerHTML =
          `<div><span class="tradeoff-aspect">${esc(p.pillar)}</span>` +
          `<span class="tradeoff-impact ${scoreColour}">${esc(p.score)}</span></div>` +
          `<div style="color:var(--text-muted)">${esc(p.notes)}</div>`;
        list.appendChild(item);
      }
      return list;
    });
  }

  // Inline diagram (rendered after card is in DOM)
  let diagramWrapper = null;
  if (data.diagram) {
    section(card, 'Architecture Diagram', () => {
      diagramWrapper = el('div', 'diagram-wrapper');
      return diagramWrapper;
    });
  }

  appendRichMessage('assistant', card);

  if (diagramWrapper && data.diagram) {
    await renderMermaid(diagramWrapper, data.diagram);
  }
}

function section(parent, label, buildContent) {
  const wrap = document.createElement('div');
  const lbl  = el('div', 'arch-section-label');
  lbl.textContent = label;
  wrap.appendChild(lbl);
  wrap.appendChild(buildContent());
  parent.appendChild(wrap);
}

// ── Diagram ────────────────────────────────────────────────────────────
async function fetchDiagram() {
  setLoading(true);
  try {
    const res = await fetch(`/sessions/${sessionId}/diagram`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const wrapper = el('div', 'diagram-wrapper');
    appendRichMessage('assistant', wrapper);
    await renderMermaid(wrapper, data.mermaidSyntax);
  } catch (err) {
    appendMessage('error', `Diagram failed: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

async function renderMermaid(container, syntax) {
  try {
    const id = `mermaid-${Date.now()}`;
    const { svg } = await mermaid.render(id, syntax);
    container.innerHTML = svg;
    scrollToBottom();
  } catch (err) {
    container.textContent = `Diagram render error: ${err.message}`;
  }
}

// ── Approve ────────────────────────────────────────────────────────────
async function approveArchitecture() {
  actionBar.innerHTML = '';
  setLoading(true);
  try {
    const res = await fetch(`/sessions/${sessionId}/architecture/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const status = data.status || 'ARCHITECTURE_APPROVED';
    updateStatus(status);
    appendMessage('system', 'Architecture approved. Ready to generate CDK infrastructure code.');
    updateActionBar(status);
  } catch (err) {
    appendMessage('error', `Approval failed: ${err.message}`);
    updateActionBar(sessionStatus);
  } finally {
    setLoading(false);
  }
}

// ── CDK generation ─────────────────────────────────────────────────────
async function generateCdk() {
  actionBar.innerHTML = '';
  setLoading(true);
  appendMessage('system', 'Generating AWS CDK TypeScript code…');
  try {
    const res = await fetch(`/sessions/${sessionId}/generate-cdk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    updateStatus('CDK_GENERATED');
    renderCdkCode(data);
    updateActionBar('CDK_GENERATED');
  } catch (err) {
    appendMessage('error', `CDK generation failed: ${err.message}`);
    updateActionBar(sessionStatus);
  } finally {
    setLoading(false);
  }
}

function renderCdkCode(data) {
  const block = el('div', 'cdk-block');

  const header = el('div', 'cdk-block-header');
  const filename = `lib/${data.stackName || 'generated'}-stack.ts`;
  const meta = [data.mode || 'complete', data.environment || 'dev'].join(' · ');
  header.innerHTML = `<span>${esc(filename)}</span><span>${esc(meta)}</span>`;
  block.appendChild(header);

  const pre  = document.createElement('pre');
  const code = document.createElement('code');
  code.className = 'language-typescript';
  code.textContent = data.code;
  pre.appendChild(code);
  block.appendChild(pre);

  if (data.dependencies?.length) {
    const deps = el('div', '');
    deps.style.cssText =
      'padding:8px 14px;border-top:1px solid var(--border);' +
      'font-size:11px;color:var(--text-muted)';
    deps.textContent = `npm install ${data.dependencies.join(' ')}`;
    block.appendChild(deps);
  }

  appendRichMessage('assistant', block);
  Prism.highlightElement(code);
  scrollToBottom();
}

// ── Loading state ──────────────────────────────────────────────────────
function setLoading(active) {
  if (active) {
    if (thinkingEl) return;
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.innerHTML =
      '<span class="message-prefix">◈</span>' +
      '<div class="thinking">Thinking' +
      '<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>' +
      '</div>';
    thread.appendChild(div);
    thinkingEl = div;
    scrollToBottom();
    setInputEnabled(false);
  } else {
    thinkingEl?.remove();
    thinkingEl = null;
    setInputEnabled(true);
  }
}

function setInputEnabled(enabled) {
  input.disabled  = !enabled;
  sendBtn.disabled = !enabled;
  if (enabled) input.focus();
}

// ── Input wiring ───────────────────────────────────────────────────────
sendBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  resizeInput();
  sendMessage(text);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    resizeInput();
    sendMessage(text);
  }
});

input.addEventListener('input', resizeInput);

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
}

// ── Utilities ──────────────────────────────────────────────────────────
function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
