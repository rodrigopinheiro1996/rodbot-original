(function () {
  if (typeof window.__rodBotCleanup === 'function') {
    window.__rodBotCleanup();
  } else {
    document.getElementById('blip-auto-panel')?.remove();
    document.getElementById('rf-rodbot-css')?.remove();
  }

  const MENSAGEM_PADRAO = `Realizamos uma nova atualização no seu aplicativo. Por gentileza, verifique se as informações foram esclarecidas. Caso a situação ainda não tenha sido resolvida ou permaneça com alguma dúvida, pedimos que entre em contato conosco novamente para que possamos ajudá-lo(a).`;
  const CONFIG = {
    mensagem: "",
    tagBusca: "",
    pastaDestino: "",
    delayAcoes: 1200,
    delayTrocaTicket: 700
  };
  let rodando = false, pausado = false, tickets = 0, modoAtual = null, modoChave = 'enviar', abaAtiva = 'pasta';
  let wakeLock = null;
  let logOculto = false;

  /*@@PURO-LOTE@@*/

  const THEME_KEY = 'rf_widget_theme_v1';
  const TAB_KEY = 'rf_rodbot_tab_v1';
  const FOLDERS_KEY = 'rf_rodbot_recent_folders_v1';
  const DEFAULT_FOLDERS = ['nv2', 'default'];

  const THEME_LIST = [
    { id: 'lime', label: '🟢 Verde', short: '🟢' },
    { id: 'classic', label: '🔵 Azul', short: '🔵' },
    { id: 'pink', label: '🌸 Rosa', short: '🌸' },
    { id: 'red', label: '🔴 Vermelho', short: '🔴' },
    { id: 'rgb', label: '🌈 LGTV', short: '🌈' }
  ];

  function getSavedTheme() {
    try {
      const t = localStorage.getItem(THEME_KEY);
      return THEME_LIST.some(x => x.id === t) ? t : 'lime';
    } catch {
      return 'lime';
    }
  }
  function saveTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch {}
    try { window.dispatchEvent(new CustomEvent('rf-bm-theme-change', { detail: t })); } catch {}
  }

  function getSavedTab() {
    try {
      const tab = localStorage.getItem(TAB_KEY);
      return ['piloto', 'pasta', 'mensagem', 'fila', 'auto'].includes(tab) ? tab : 'piloto';
    } catch {
      return 'piloto';
    }
  }
  function saveTab(tab) {
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }

  function getRecentFolders() {
    try {
      const raw = JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]');
      const list = Array.isArray(raw) ? raw.filter(x => typeof x === 'string' && x.trim()) : [];
      const merged = [...list];
      for (const d of DEFAULT_FOLDERS) {
        if (!merged.some(x => x.toLowerCase() === d.toLowerCase())) merged.push(d);
      }
      return merged.slice(0, 6);
    } catch {
      return [...DEFAULT_FOLDERS];
    }
  }
  function saveRecentFolder(name) {
    const clean = (name || '').trim();
    if (!clean) return;
    try {
      const cur = getRecentFolders().filter(x => x.toLowerCase() !== clean.toLowerCase());
      cur.unshift(clean);
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(cur.slice(0, 6)));
    } catch {}
  }

  abaAtiva = getSavedTab();

  const styleEl = document.createElement('style');
  styleEl.id = 'rf-rodbot-css';
  styleEl.textContent = `
    @property --rb-rgb-c { syntax: '<color>'; inherits: true; initial-value: #ef4444; }
    @property --rb-rgb-on { syntax: '<color>'; inherits: true; initial-value: #0a0a0a; }
    @property --rb-rgb-dim { syntax: '<color>'; inherits: true; initial-value: rgba(239,68,68,0.14); }
    @property --rb-rgb-glow { syntax: '<color>'; inherits: true; initial-value: rgba(239,68,68,0.30); }
    @keyframes rb-rgb-sync {
      0%   { --rb-rgb-c: #ef4444; --rb-rgb-on: #ffffff; --rb-rgb-dim: rgba(239,68,68,0.14); --rb-rgb-glow: rgba(239,68,68,0.32); }
      16%  { --rb-rgb-c: #f97316; --rb-rgb-on: #0a0a0a; --rb-rgb-dim: rgba(249,115,22,0.14); --rb-rgb-glow: rgba(249,115,22,0.32); }
      33%  { --rb-rgb-c: #eab308; --rb-rgb-on: #0a0a0a; --rb-rgb-dim: rgba(234,179,8,0.14);  --rb-rgb-glow: rgba(234,179,8,0.32); }
      50%  { --rb-rgb-c: #89f336; --rb-rgb-on: #0a0f08; --rb-rgb-dim: rgba(137,243,54,0.14); --rb-rgb-glow: rgba(137,243,54,0.32); }
      66%  { --rb-rgb-c: #22d3ee; --rb-rgb-on: #0a0f08; --rb-rgb-dim: rgba(34,211,238,0.14); --rb-rgb-glow: rgba(34,211,238,0.32); }
      83%  { --rb-rgb-c: #8b5cf6; --rb-rgb-on: #ffffff; --rb-rgb-dim: rgba(139,92,246,0.14); --rb-rgb-glow: rgba(139,92,246,0.32); }
      100% { --rb-rgb-c: #ec4899; --rb-rgb-on: #0a0f08; --rb-rgb-dim: rgba(236,72,153,0.14); --rb-rgb-glow: rgba(236,72,153,0.32); }
    }
    @keyframes rb-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.45; transform: scale(0.85); }
    }
    #ba-win {
      --rb-bg: rgba(16, 19, 23, 0.94);
      --rb-elevated: rgba(11, 15, 20, 0.92);
      --rb-card: rgba(22, 27, 34, 0.92);
      --rb-border: rgba(255, 255, 255, 0.08);
      --rb-border-strong: rgba(255, 255, 255, 0.14);
      --rb-text: #f1f5f9;
      --rb-muted: #94a3b8;
      --rb-accent: #89f336;
      --rb-on-accent: #0a0f08;
      --rb-accent-dim: rgba(137, 243, 54, 0.13);
      --rb-accent-border: rgba(137, 243, 54, 0.34);
      --rb-accent-glow: rgba(137, 243, 54, 0.22);
      position: fixed; top: 16px; right: 16px; z-index: 2147483647; pointer-events: auto;
      width: min(438px, calc(100vw - 20px)); min-width: 330px; max-height: 94vh; overflow-y: auto;
      border-radius: 18px; border: 1px solid var(--rb-border-strong);
      background: radial-gradient(circle at 18% 0%, var(--rb-accent-dim), transparent 55%), var(--rb-bg);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      color: var(--rb-text);
      box-shadow: 0 22px 54px rgba(0, 0, 0, 0.68), 0 0 0 1px rgba(255,255,255,0.03);
      font: 13px/1.45 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      user-select: none;
    }
    #ba-win[data-rf-theme="classic"] {
      --rb-bg: rgba(15, 23, 42, 0.95);
      --rb-elevated: rgba(7, 11, 20, 0.92);
      --rb-card: rgba(21, 31, 51, 0.92);
      --rb-border: rgba(148, 163, 184, 0.15);
      --rb-border-strong: rgba(148, 163, 184, 0.25);
      --rb-accent: #22d3ee;
      --rb-on-accent: #052e20;
      --rb-accent-dim: rgba(34, 211, 238, 0.13);
      --rb-accent-border: rgba(34, 211, 238, 0.38);
      --rb-accent-glow: rgba(34, 211, 238, 0.24);
    }
    #ba-win[data-rf-theme="pink"] {
      --rb-accent: #ec4899;
      --rb-on-accent: #0a0f08;
      --rb-accent-dim: rgba(236, 72, 153, 0.13);
      --rb-accent-border: rgba(236, 72, 153, 0.36);
      --rb-accent-glow: rgba(236, 72, 153, 0.22);
    }
    #ba-win[data-rf-theme="red"] {
      --rb-accent: #ef4444;
      --rb-on-accent: #ffffff;
      --rb-accent-dim: rgba(239, 68, 68, 0.14);
      --rb-accent-border: rgba(239, 68, 68, 0.36);
      --rb-accent-glow: rgba(239, 68, 68, 0.22);
    }
    #ba-win[data-rf-theme="rgb"] {
      --rb-accent: var(--rb-rgb-c);
      --rb-on-accent: var(--rb-rgb-on);
      --rb-accent-dim: var(--rb-rgb-dim);
      --rb-accent-border: var(--rb-rgb-c);
      --rb-accent-glow: var(--rb-rgb-glow);
      animation: rb-rgb-sync 4s linear infinite;
    }
    #ba-win::-webkit-scrollbar, #ba-log::-webkit-scrollbar { width: 5px; }
    #ba-win::-webkit-scrollbar-thumb, #ba-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
    #ba-hdr {
      position: relative; padding: 12px 14px; cursor: grab;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      background: var(--rb-elevated);
      border-bottom: 1px solid var(--rb-border);
      border-radius: 18px 18px 0 0;
    }
    .ba-brand { display: flex; align-items: center; gap: 9px; font-weight: 700; font-size: 14px; letter-spacing: -0.02em; color: var(--rb-text); }
    .ba-brand-badge {
      width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center;
      background: var(--rb-accent-dim); border: 1px solid var(--rb-accent-border);
      box-shadow: 0 0 12px var(--rb-accent-glow); font-size: 14px; line-height: 1;
    }
    .ba-hdr-right { display: flex; align-items: center; gap: 6px; position: relative; }
    #ba-st {
      padding: 3px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700;
      color: #fff; background: rgba(100,116,139,0.55); border: 1px solid rgba(255,255,255,0.1);
    }
    #ba-theme-btn {
      border: 1px solid var(--rb-accent-border); background: var(--rb-accent-dim);
      color: var(--rb-accent); border-radius: 999px; padding: 3px 9px;
      font: 600 11px inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
    }
    #ba-theme-btn:hover { filter: brightness(1.12); }
    #ba-theme-menu {
      position: absolute; top: calc(100% + 6px); right: 26px; z-index: 99;
      min-width: 148px; padding: 5px; border-radius: 12px;
      background: var(--rb-card); border: 1px solid var(--rb-border-strong);
      box-shadow: 0 12px 32px rgba(0,0,0,0.65); display: none;
    }
    #ba-theme-menu[data-open="true"] { display: block; }
    .ba-theme-opt {
      display: flex; width: 100%; align-items: center; gap: 6px;
      padding: 7px 9px; border: 1px solid transparent; border-radius: 8px;
      background: transparent; color: var(--rb-text); font: 500 12px inherit; cursor: pointer; text-align: left;
    }
    .ba-theme-opt:hover, .ba-theme-opt.active {
      background: var(--rb-accent-dim); border-color: var(--rb-accent-border); color: var(--rb-accent);
    }
    #ba-close {
      background: rgba(248, 113, 113, 0.14); color: #fca5a5; border: 1px solid rgba(248, 113, 113, 0.28);
      border-radius: 8px; width: 25px; height: 25px; cursor: pointer; font-weight: 700; font-size: 12px;
      display: flex; align-items: center; justify-content: center; padding: 0; transition: all 0.14s ease;
    }
    #ba-close:hover { background: #ef4444; color: #fff; border-color: #ef4444; }
    .ba-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .ba-tabs {
      display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px;
      background: var(--rb-elevated); border: 1px solid var(--rb-border);
      border-radius: 12px; padding: 4px;
    }
    .ba-tab-btn {
      border: 1px solid transparent; border-radius: 8px; padding: 7px 4px;
      background: transparent; color: var(--rb-muted); font: 600 11px inherit;
      cursor: pointer; transition: all 0.15s ease; display: flex; align-items: center; justify-content: center; gap: 4px;
      white-space: nowrap;
    }
    .ba-tab-btn:hover { color: var(--rb-text); background: rgba(255,255,255,0.03); }
    .ba-tab-btn.active {
      background: var(--rb-accent-dim); color: var(--rb-accent);
      border-color: var(--rb-accent-border); box-shadow: 0 2px 10px var(--rb-accent-glow);
      font-weight: 700;
    }
    .ba-pane { display: none; flex-direction: column; gap: 11px; }
    .ba-pane.active { display: flex; }
    .ba-card {
      background: var(--rb-card); border: 1px solid var(--rb-border); border-radius: 14px; padding: 12px;
    }
    .ba-row-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; gap: 8px; }
    .ba-label { font-size: 12px; color: var(--rb-text); font-weight: 600; letter-spacing: -0.01em; }
    .ba-sub { font-size: 11px; color: var(--rb-muted); line-height: 1.4; }
    .ba-pill-btn {
      background: var(--rb-accent-dim); color: var(--rb-accent); border: 1px solid var(--rb-accent-border);
      border-radius: 999px; padding: 3px 10px; font: 600 10.5px inherit; cursor: pointer; transition: filter 0.14s;
    }
    .ba-pill-btn:hover { filter: brightness(1.14); }
    #ba-transfer-status:empty { display: none; }
    #ba-transfer-status[data-tone="err"] { color: #fca5a5; }
    #ba-transfer-status[data-tone="ok"] { color: #4ade80; }
    #ba-msg, #ba-tag, #ba-folder, #ba-auto-msg, #ba-transfer-name {
      width: 100%; box-sizing: border-box; background: var(--rb-elevated); color: var(--rb-text);
      border: 1px solid var(--rb-border-strong); border-radius: 10px; padding: 9px 11px;
      font: 12.5px/1.45 inherit; outline: none; user-select: text; transition: border-color 0.15s, box-shadow 0.15s;
    }
    #ba-msg, #ba-auto-msg { resize: vertical; }
    #ba-msg:focus, #ba-tag:focus, #ba-folder:focus, #ba-auto-msg:focus {
      border-color: var(--rb-accent-border); box-shadow: 0 0 0 3px var(--rb-accent-glow);
    }
    .ba-chips-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
    .ba-chip-caption { font-size: 10.5px; color: var(--rb-muted); font-weight: 500; }
    .ba-chip {
      background: var(--rb-elevated); border: 1px solid var(--rb-border-strong); color: var(--rb-text);
      border-radius: 999px; padding: 3px 10px; font: 500 11px inherit; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: all 0.14s ease;
    }
    .ba-chip:hover {
      border-color: var(--rb-accent-border); color: var(--rb-accent); background: var(--rb-accent-dim);
      transform: translateY(-1px);
    }
    #ba-mode-switch {
      display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
      background: var(--rb-elevated); border: 1px solid var(--rb-border); border-radius: 10px; padding: 3px;
    }
    #ba-mode-enviar, #ba-mode-finalizar {
      border: none; border-radius: 7px; padding: 7px 8px; font: 700 11.5px inherit; cursor: pointer; transition: all 0.15s;
    }
    #ba-mode-hint {
      margin-top: 8px; font-size: 11px; color: var(--rb-muted); line-height: 1.4;
    }
    .ba-cta {
      width: 100%; padding: 11px 14px; border: none; border-radius: 11px;
      font: 700 13px inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
      background: var(--rb-accent); color: var(--rb-on-accent);
      box-shadow: 0 4px 18px var(--rb-accent-glow); transition: transform 0.12s ease, filter 0.15s ease;
    }
    .ba-cta:hover { filter: brightness(1.08); }
    .ba-cta:active { transform: scale(0.985); }
    /* Visual Pipeline Stepper */
    .ba-pipeline {
      display: flex; flex-direction: column; gap: 0;
      background: var(--rb-card); border: 1px solid var(--rb-border); border-radius: 14px; padding: 12px 13px;
    }
    .ba-step {
      display: flex; gap: 11px; position: relative;
    }
    .ba-step-rail {
      display: flex; flex-direction: column; align-items: center; width: 26px; flex-shrink: 0;
    }
    .ba-step-icon {
      width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 13px; background: var(--rb-elevated); border: 1.5px solid var(--rb-border-strong);
      color: var(--rb-muted); transition: all 0.22s ease; z-index: 2;
    }
    .ba-step-line {
      width: 2px; flex-grow: 1; min-height: 20px; background: var(--rb-border); margin: 3px 0; transition: all 0.22s ease;
    }
    .ba-step:last-of-type .ba-step-line { display: none; }
    .ba-step-body {
      flex-grow: 1; padding-bottom: 11px; min-width: 0;
    }
    .ba-step:last-of-type .ba-step-body { padding-bottom: 3px; }
    .ba-step-hdr {
      display: flex; align-items: center; justify-content: space-between; gap: 6px;
    }
    .ba-step-title {
      font-size: 12px; font-weight: 700; color: var(--rb-text); letter-spacing: -0.01em; transition: color 0.2s ease;
    }
    .ba-step-status {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px;
      background: rgba(255,255,255,0.06); color: var(--rb-muted); border: 1px solid var(--rb-border);
      transition: all 0.22s ease; white-space: nowrap;
    }
    .ba-step-desc {
      font-size: 11px; color: var(--rb-muted); margin: 2px 0 0; line-height: 1.35;
    }
    .ba-step[data-status="active"] .ba-step-icon {
      background: var(--rb-accent-dim); border-color: var(--rb-accent); color: var(--rb-accent);
      box-shadow: 0 0 12px var(--rb-accent-glow); animation: rb-pulse 1.3s ease-in-out infinite;
    }
    .ba-step[data-status="active"] .ba-step-title {
      color: var(--rb-accent);
    }
    .ba-step[data-status="active"] .ba-step-status {
      background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border);
      box-shadow: 0 0 8px var(--rb-accent-glow);
    }
    .ba-step[data-status="active"] .ba-step-line {
      background: linear-gradient(to bottom, var(--rb-accent), var(--rb-border));
    }
    .ba-step[data-status="done"] .ba-step-icon {
      background: rgba(34, 197, 94, 0.16); border-color: #22c55e; color: #4ade80;
    }
    .ba-step[data-status="done"] .ba-step-title {
      color: #f1f5f9;
    }
    .ba-step[data-status="done"] .ba-step-status {
      background: rgba(34, 197, 94, 0.16); color: #4ade80; border-color: rgba(34, 197, 94, 0.36);
    }
    .ba-step[data-status="done"] .ba-step-line {
      background: #22c55e;
    }
    .ba-step[data-status="waiting"] .ba-step-icon {
      background: rgba(245, 158, 11, 0.18); border-color: #f59e0b; color: #fbbf24;
      box-shadow: 0 0 10px rgba(245, 158, 11, 0.3); animation: rb-pulse 1.5s ease-in-out infinite;
    }
    .ba-step[data-status="waiting"] .ba-step-title {
      color: #fbbf24;
    }
    .ba-step[data-status="waiting"] .ba-step-status {
      background: rgba(245, 158, 11, 0.18); color: #fbbf24; border-color: rgba(245, 158, 11, 0.4);
    }
    .ba-loop-card {
      margin-top: 6px; padding: 9px 11px; border-radius: 11px;
      background: var(--rb-elevated); border: 1px dashed var(--rb-border-strong);
      display: flex; align-items: center; gap: 9px; transition: all 0.22s ease;
    }
    .ba-loop-card.active {
      border-style: solid; border-color: var(--rb-accent-border);
      background: var(--rb-accent-dim); box-shadow: 0 0 14px var(--rb-accent-glow);
    }
    .ba-loop-icon {
      font-size: 16px; line-height: 1; flex-shrink: 0;
    }
    .ba-loop-card.active .ba-loop-icon {
      animation: rb-spin 4s linear infinite;
    }
    @keyframes rb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .ba-loop-title {
      font-size: 11.5px; font-weight: 700; color: var(--rb-text); letter-spacing: -0.01em;
    }
    .ba-loop-desc {
      font-size: 10.5px; color: var(--rb-muted); line-height: 1.35; margin-top: 1px;
    }
    #ba-pilot-start {
      background: var(--rb-accent); color: var(--rb-on-accent);
      font-weight: 700; font-size: 13px; letter-spacing: -0.01em;
      border-radius: 12px; box-shadow: 0 4px 18px var(--rb-accent-glow);
      transition: all 0.15s ease;
    }
    #ba-pilot-start:hover { filter: brightness(1.1); transform: translateY(-1px); }
    #ba-pilot-start:active { transform: scale(0.985); }

    #ba-claim-auto {
      background: #1e6bf1;
      color: #ffffff;
      font-weight: 700;
      font-size: 13.5px;
      letter-spacing: -0.01em;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(30, 107, 241, 0.42);
      transition: all 0.15s ease;
    }
    #ba-claim-auto:hover {
      background: #175bd3;
      filter: brightness(1.06);
      box-shadow: 0 6px 20px rgba(30, 107, 241, 0.55);
      transform: translateY(-1px);
    }
    #ba-claim-auto:active {
      transform: scale(0.985);
      background: #134fb8;
    }
    .ba-actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    #ba-pause-all, #ba-unpause-all {
      padding: 11px 10px; border-radius: 11px; font: 600 12px inherit; cursor: pointer;
      border: 1px solid var(--rb-border-strong); background: var(--rb-elevated); color: var(--rb-text);
      display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s ease;
    }
    #ba-pause-all:hover { border-color: rgba(167, 139, 250, 0.55); color: #ddd6fe; background: rgba(139, 92, 246, 0.16); }
    #ba-unpause-all:hover { border-color: var(--rb-accent-border); color: var(--rb-accent); background: var(--rb-accent-dim); }
    #ba-run-bar {
      display: none; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 11px; border-radius: 12px;
      background: var(--rb-accent-dim); border: 1px solid var(--rb-accent-border);
    }
    .ba-run-info { display: flex; align-items: center; gap: 7px; min-width: 0; }
    .ba-run-dot {
      width: 8px; height: 8px; border-radius: 99px; background: var(--rb-accent);
      box-shadow: 0 0 8px var(--rb-accent); animation: rb-pulse 1.3s ease-in-out infinite; flex-shrink: 0;
    }
    #ba-run-label { font-size: 11.5px; font-weight: 700; color: var(--rb-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ba-run-btns { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    #ba-pause {
      padding: 6px 10px; border: none; border-radius: 8px; font: 700 11.5px inherit; cursor: pointer;
      background: #fbbf24; color: #0a0f08;
    }
    #ba-stop {
      padding: 6px 10px; border: 1px solid rgba(248, 113, 113, 0.38); border-radius: 8px;
      background: rgba(248, 113, 113, 0.18); color: #fca5a5; font: 700 11.5px inherit; cursor: pointer;
    }
    #ba-pause:hover, #ba-stop:hover { filter: brightness(1.1); }
    .ba-telemetry {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 2px 2px 0; font-size: 11.5px; color: var(--rb-muted);
    }
    #ba-cnt { color: var(--rb-accent); font-weight: 700; font-size: 13px; }
    .ba-mini-actions { display: flex; align-items: center; gap: 6px; }
    .ba-link-btn {
      background: transparent; border: none; color: var(--rb-muted); font: 500 11px inherit;
      cursor: pointer; padding: 2px 5px; border-radius: 6px; transition: color 0.14s, background 0.14s;
    }
    .ba-link-btn:hover { color: var(--rb-text); background: rgba(255,255,255,0.05); }
    #ba-log {
      background: var(--rb-elevated); border: 1px solid var(--rb-border); border-radius: 11px;
      padding: 9px 11px; max-height: 92px; overflow-y: auto;
      font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--rb-accent);
    }
    #ba-auto-pill {
      display: none; padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700;
      background: var(--rb-accent-dim); color: var(--rb-accent); border: 1px solid var(--rb-accent-border);
    }
    .ba-auto-state {
      padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 700; white-space: nowrap;
      background: rgba(100,116,139,0.35); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1);
    }
    .ba-auto-state[data-tone="on"] { background: rgba(34,197,94,0.18); color: #4ade80; border-color: rgba(34,197,94,0.4); }
    .ba-auto-state[data-tone="wait"] { background: rgba(245,158,11,0.18); color: #fbbf24; border-color: rgba(245,158,11,0.4); }
    .ba-auto-state[data-tone="err"] { background: rgba(248,113,113,0.18); color: #fca5a5; border-color: rgba(248,113,113,0.4); }
    .ba-auto-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .ba-auto-stats > div {
      display: flex; flex-direction: column; gap: 2px; padding: 7px 8px; border-radius: 10px;
      background: var(--rb-elevated); border: 1px solid var(--rb-border);
    }
    .ba-auto-stats b { font-size: 16px; color: var(--rb-accent); }
    #ba-auto-detail[data-tone="err"] { color: #fca5a5; }
    #ba-auto-detail[data-tone="wait"] { color: #fbbf24; }
    .ba-auto-list { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; font: 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .ba-auto-list:empty { display: none; }
    .ba-auto-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 9px; }
  `;
  document.documentElement.appendChild(styleEl);

  // Anti-bloqueio de tela. v10.1: tudo que dá errado aparece no log (antes falhava calado).
  // Obs.: o navegador desliga o anti-bloqueio sozinho quando a página fica escondida (aba trocada, janela
  // minimizada, tela bloqueada) e a regra de bloqueio da TI do Windows pode valer mais que ele.
  let wakeLockLiberando = false;
  let wakeLockSemSuporteAvisado = false;
  async function ativarWakeLock() {
    if (wakeLock) return;
    if (!navigator.wakeLock) {
      if (!wakeLockSemSuporteAvisado) {
        wakeLockSemSuporteAvisado = true;
        log('⚠️ Anti-bloqueio indisponível neste navegador: desligue o bloqueio de tela do Windows antes de sair.');
      }
      return;
    }
    if (document.visibilityState !== 'visible') return; // o navegador só liga com a página visível
    try {
      const trava = await navigator.wakeLock.request('screen');
      wakeLock = trava;
      trava.addEventListener?.('release', () => {
        if (wakeLock === trava) wakeLock = null;
        if (rodando && !wakeLockLiberando) {
          log('🌙 Anti-bloqueio desligado pelo navegador (página escondida ou tela bloqueada).');
        }
      });
      log('🔆 Anti-bloqueio ligado: tela mantida ativa.');
    } catch (err) {
      log(`⚠️ Anti-bloqueio NÃO ligou (${(err && (err.message || err.name)) || err}). A tela pode bloquear e o bot ficar lento ou parar.`);
    }
  }
  async function liberarWakeLock() {
    if (!wakeLock) return;
    wakeLockLiberando = true;
    try {
      await wakeLock.release();
    } catch {} finally {
      wakeLock = null;
      wakeLockLiberando = false;
    }
  }
  function onVisChange() {
    if (!rodando) return;
    if (document.visibilityState === 'visible') {
      log('👀 Página do Blip visível de novo.');
      if (!pausado) ativarWakeLock();
    } else {
      log('⚠️ Página escondida (aba trocada, janela minimizada ou tela bloqueada): o navegador deixa o bot lento. Deixe o Blip aberto e na frente.');
    }
  }
  document.addEventListener('visibilitychange', onVisChange);

  // Relógio de diagnóstico: se o navegador "dormir" (tela bloqueada, suspensão), avisa no log quanto tempo ficou parado.
  const RELOGIO_MS = 5000;
  let relogioAnterior = Date.now();
  let relogioParado = 0;
  const relogioTimer = setInterval(() => {
    const agora = Date.now();
    const salto = loteSalto(relogioAnterior, agora, RELOGIO_MS);
    relogioAnterior = agora;
    if (!rodando) { relogioParado = 0; return; }
    if (salto) {
      if (!relogioParado) log('⚠️ O navegador está segurando o bot (tela bloqueada, suspensão ou página escondida).');
      relogioParado += salto;
    } else if (relogioParado) {
      log(`⏱️ O bot voltou ao ritmo normal depois de ~${loteDuracao(relogioParado)} travado pelo navegador.`);
      relogioParado = 0;
    }
  }, RELOGIO_MS);

  const p = document.createElement('div');
  p.id = 'blip-auto-panel';
  p.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;margin:0;padding:0;border:0;overflow:visible;z-index:2147483647;pointer-events:none;';
  p.innerHTML = `
  <div id="ba-win" data-rf-theme="${getSavedTheme()}">
    <div id="ba-hdr">
      <span class="ba-brand"><span class="ba-brand-badge">🤖</span> rod bot <small style="opacity:.7;font-weight:600;">${LOTE_VERSAO}</small></span>
      <div class="ba-hdr-right">
        <span id="ba-auto-pill" title="Resposta automática a novos chats"></span>
        <span id="ba-st">Parado</span>
        <button id="ba-theme-btn" type="button" title="Alterar tema">🎨</button>
        <div id="ba-theme-menu">
          ${THEME_LIST.map(t => `<button type="button" class="ba-theme-opt" data-ba-theme="${t.id}">${t.label}</button>`).join('')}
        </div>
        <button id="ba-close" type="button" title="Fechar painel">✕</button>
      </div>
    </div>
    <div class="ba-body">
      <div id="ba-tabs" class="ba-tabs" role="tablist">
        <button id="ba-tab-piloto" class="ba-tab-btn" type="button" data-ba-tab="piloto">⚡ Piloto</button>
        <button id="ba-tab-pasta" class="ba-tab-btn" type="button" data-ba-tab="pasta">📁 Pastas</button>
        <button id="ba-tab-mensagem" class="ba-tab-btn" type="button" data-ba-tab="mensagem">✉️ Envio</button>
        <button id="ba-tab-fila" class="ba-tab-btn" type="button" data-ba-tab="fila">📥 Fila</button>
        <button id="ba-tab-auto" class="ba-tab-btn" type="button" data-ba-tab="auto">💬 Auto</button>
      </div>

      <div id="ba-pane-piloto" class="ba-pane">
        <div class="ba-pipeline">
          <div class="ba-step" id="ba-step-1" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">📥</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">1. Puxar Fila (Atender)</span>
                <span class="ba-step-status" id="ba-status-1">Aguardando</span>
              </div>
              <p class="ba-step-desc">Clica em Atender a cada 0.5s até zerar a fila</p>
            </div>
          </div>

          <div class="ba-step" id="ba-step-2" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">✉️</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">2. Enviar Mensagens</span>
                <span class="ba-step-status" id="ba-status-2">Pendente</span>
              </div>
              <p class="ba-step-desc">Dispara texto configurado sem finalizar ticket</p>
            </div>
          </div>

          <div class="ba-step" id="ba-step-3" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">⏸️</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">3. Pausar Todos</span>
                <span class="ba-step-status" id="ba-status-3">Pendente</span>
              </div>
              <p class="ba-step-desc">Coloca todos os clientes atendidos em espera</p>
            </div>
          </div>

          <div class="ba-step" id="ba-step-4" data-status="idle">
            <div class="ba-step-rail">
              <div class="ba-step-icon">📁</div>
              <div class="ba-step-line"></div>
            </div>
            <div class="ba-step-body">
              <div class="ba-step-hdr">
                <span class="ba-step-title">4. Mover para Pasta</span>
                <span class="ba-step-status" id="ba-status-4">Pendente</span>
              </div>
              <p class="ba-step-desc">Envia os tickets para a pasta selecionada</p>
            </div>
          </div>

          <div class="ba-loop-card" id="ba-loop-card">
            <div class="ba-loop-icon">🔄</div>
            <div class="ba-loop-text">
              <div class="ba-loop-title">Loop Contínuo com Sentinela</div>
              <div class="ba-loop-desc" id="ba-loop-desc">Repete o ciclo. Se fila zerar, vigia até surgir 1 ou + clientes.</div>
            </div>
          </div>
        </div>

        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:6px;">
            <span class="ba-label">⚙️ Configurações Rápidas</span>
            <span class="ba-sub" id="ba-pilot-cycle-badge" style="color:var(--rb-accent);font-weight:700;">Ciclo: #0</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <div class="ba-row-head" style="margin-bottom:3px;">
                <label for="ba-pilot-folder" class="ba-sub" style="font-weight:600;color:var(--rb-text);">📁 Pasta Destino:</label>
              </div>
              <input id="ba-pilot-folder" type="text" placeholder="Ex: nv2, default..." />
              <div id="ba-pilot-folder-chips" class="ba-chips-row" style="margin-top:5px;"></div>
            </div>
            <div>
              <div class="ba-row-head" style="margin-bottom:3px;">
                <label for="ba-pilot-msg" class="ba-sub" style="font-weight:600;color:var(--rb-text);">✉️ Mensagem do Envio:</label>
                <button id="ba-pilot-fill-default" class="ba-pill-btn" type="button" title="Preencher mensagem padrão">📋 Usar padrão</button>
              </div>
              <textarea id="ba-pilot-msg" rows="2" placeholder="Digite a mensagem para os clientes..."></textarea>
            </div>
          </div>
        </div>

        <button id="ba-pilot-start" class="ba-cta" type="button">
          ⚡ Iniciar Piloto Automático
        </button>
      </div>

      <div id="ba-pane-pasta" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:4px;">
            <label for="ba-folder" class="ba-label">Nome exato da pasta</label>
          </div>
          <p class="ba-sub" style="margin:0 0 9px;">Percorre a fila e move cada cliente para a pasta correspondente no Blip.</p>
          <input id="ba-folder" type="text" placeholder="Ex: nv2, default..." />
          <div id="ba-folder-chips" class="ba-chips-row"></div>
        </div>
        <button id="ba-move-folder" class="ba-cta" type="button">📁 Mover todos para pasta</button>
      </div>

      <div id="ba-pane-mensagem" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head">
            <label for="ba-msg" class="ba-label">Mensagem para enviar</label>
            <button id="ba-fill-default" class="ba-pill-btn" type="button" title="Preencher com a mensagem padrão">📋 Usar padrão</button>
          </div>
          <textarea id="ba-msg" rows="3" placeholder="Digite ou cole o texto para os clientes da fila..."></textarea>
        </div>
        <div class="ba-card">
          <div class="ba-row-head">
            <span class="ba-label">Modo de operação</span>
          </div>
          <div id="ba-mode-switch">
            <button id="ba-mode-enviar" type="button" aria-pressed="true">🛡️ Só Enviar</button>
            <button id="ba-mode-finalizar" type="button" aria-pressed="false">⚡ Enviar + Finalizar</button>
          </div>
          <div id="ba-mode-hint"></div>
          <div id="ba-tag-wrap" style="display:none;margin-top:9px;padding-top:9px;border-top:1px solid var(--rb-border);">
            <label for="ba-tag" class="ba-label" style="display:block;margin-bottom:5px;">Tag para finalizar</label>
            <input id="ba-tag" type="text" placeholder="Ex: revi, cobran..." />
            <label for="ba-simular" class="ba-sub" style="display:flex;align-items:center;gap:6px;margin-top:9px;cursor:pointer;">
              <input id="ba-simular" type="checkbox" checked style="width:auto;margin:0;" />
              🧪 Simular (abre cada chat e preenche o texto, mas NÃO envia, não põe tag e não finaliza)
            </label>
          </div>
        </div>
        <button id="ba-play" class="ba-cta" type="button">▶ Enviar para todos</button>
      </div>

      <div id="ba-pane-fila" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:4px;">
            <span class="ba-label">📥 Atendimento Automático</span>
            <span class="ba-sub">Aguardando: <b id="ba-queue-count" style="color:var(--rb-accent);font-size:12px;">--</b></span>
          </div>
          <p class="ba-sub" style="margin:0 0 10px;">Clica em "Atender" a cada meio segundo (0.5s) até que a contagem da fila zere.</p>
          <button id="ba-claim-auto" class="ba-cta" type="button">Atender Automático</button>
        </div>
        <div class="ba-card">
          <div class="ba-label" style="margin-bottom:4px;">Controle de espera sem mensagem</div>
          <p class="ba-sub" style="margin:0 0 10px;">Altera o status de espera de todos os clientes visíveis na fila atual.</p>
          <div class="ba-actions-row">
            <button id="ba-pause-all" type="button">⏸️ Pausar todos</button>
            <button id="ba-unpause-all" type="button">▶️ Despausar todos</button>
          </div>
        </div>
        <div class="ba-card">
          <div class="ba-row-head" style="margin-bottom:4px;">
            <label for="ba-transfer-name" class="ba-label">🔁 Transferir para atendente</label>
          </div>
          <p class="ba-sub" style="margin:0 0 9px;">Transfere um ticket por vez, sempre o primeiro da lista atual, para o atendente pesquisado no Blip pelo nome exato. Não envia mensagens nem finaliza.</p>
          <input id="ba-transfer-name" type="text" placeholder="Nome do atendente (exato, como aparece no Blip)" autocomplete="off" />
          <div id="ba-transfer-status" class="ba-sub" style="margin-top:6px;"></div>
          <button id="ba-transfer-start" class="ba-cta" type="button" style="margin-top:9px;">🔁 Transferir todos para o atendente</button>
        </div>
      </div>

      <div id="ba-pane-auto" class="ba-pane">
        <div class="ba-card">
          <div class="ba-row-head">
            <span class="ba-label">💬 Resposta a novos chats</span>
            <span id="ba-auto-state" class="ba-auto-state" data-tone="off">Desativada</span>
          </div>
          <p class="ba-sub" style="margin:0 0 9px;">Envia a mensagem abaixo a cada chat que chegar depois da ativação e pausa o cliente só após confirmar o envio. Chats já presentes na ativação não recebem nada.</p>
          <button id="ba-auto-toggle" class="ba-cta" type="button">▶ Ativar resposta automática</button>
        </div>
        <div class="ba-card">
          <div class="ba-row-head">
            <label for="ba-auto-msg" class="ba-label">Mensagem automática</label>
            <button id="ba-auto-fill-default" class="ba-pill-btn" type="button" title="Preencher com a mensagem padrão">📋 Usar padrão</button>
          </div>
          <textarea id="ba-auto-msg" rows="3" placeholder="Texto enviado a cada novo chat..."></textarea>
          <p class="ba-sub" style="margin:6px 0 0;">Alterações valem a partir do próximo atendimento.</p>
        </div>
        <div class="ba-card">
          <div class="ba-auto-stats">
            <div><span class="ba-sub">Novos chats (BM)</span><b id="ba-auto-count">0</b></div>
            <div><span class="ba-sub">Contador Blip</span><b id="ba-auto-native">--</b></div>
            <div><span class="ba-sub">Na fila do BM</span><b id="ba-auto-queue">0</b></div>
          </div>
          <div id="ba-auto-detail" class="ba-sub" style="margin-top:8px;">Desativada.</div>
          <div id="ba-auto-list" class="ba-auto-list"></div>
          <div class="ba-auto-actions">
            <button id="ba-auto-resume" class="ba-pill-btn" type="button" style="display:none;">▶ Retomar</button>
            <button id="ba-auto-retry-pause" class="ba-pill-btn" type="button" style="display:none;">⏸️ Repetir pausas pendentes</button>
            <button id="ba-auto-reset" class="ba-link-btn" type="button">Zerar contador</button>
          </div>
        </div>
      </div>

      <div id="ba-run-bar">
        <div class="ba-run-info">
          <span class="ba-run-dot"></span>
          <span id="ba-run-label">Executando...</span>
        </div>
        <div class="ba-run-btns">
          <button id="ba-pause" type="button">⏸ Pausar</button>
          <button id="ba-stop" type="button">⏹ Parar</button>
        </div>
      </div>

      <div class="ba-telemetry">
        <span>Concluídos: <span id="ba-cnt">0</span></span>
        <div class="ba-mini-actions">
          <button id="ba-toggle-log" class="ba-link-btn" type="button">Ocultar log</button>
          <button id="ba-clear-log" class="ba-link-btn" type="button">Limpar</button>
          <button id="ba-baixar-log" class="ba-link-btn" type="button" title="Baixa o log salvo (inclui o de antes de reiniciar o PC)">💾 Log</button>
          <button id="ba-baixar-relatorio" class="ba-link-btn" type="button" title="Relatório CSV do último lote Enviar + Finalizar">📄 Relatório</button>
        </div>
      </div>
      <div id="ba-log">Pronto para iniciar.</div>
    </div>
  </div>
  `;
  document.documentElement.appendChild(p);

  const win = document.getElementById('ba-win'), hdr = document.getElementById('ba-hdr');
  const themeBtn = document.getElementById('ba-theme-btn'), themeMenu = document.getElementById('ba-theme-menu');

  function applyTheme(t) {
    const valid = THEME_LIST.find(x => x.id === t) || THEME_LIST[0];
    win.setAttribute('data-rf-theme', valid.id);
    themeBtn.textContent = valid.short + ' Tema';
    themeMenu.querySelectorAll('.ba-theme-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.baTheme === valid.id);
    });
  }
  applyTheme(getSavedTheme());

  themeBtn.onclick = e => {
    e.stopPropagation();
    const isOpen = themeMenu.getAttribute('data-open') === 'true';
    themeMenu.setAttribute('data-open', isOpen ? 'false' : 'true');
  };
  themeMenu.querySelectorAll('.ba-theme-opt').forEach(opt => {
    opt.onclick = e => {
      e.stopPropagation();
      const t = opt.dataset.baTheme;
      saveTheme(t);
      applyTheme(t);
      themeMenu.setAttribute('data-open', 'false');
    };
  });
  function onDocClickCloseTheme(e) {
    if (themeMenu && !themeMenu.contains(e.target) && e.target !== themeBtn) {
      themeMenu.setAttribute('data-open', 'false');
    }
  }
  function onSyncTheme(e) {
    if (e && e.detail) applyTheme(e.detail);
  }
  document.addEventListener('click', onDocClickCloseTheme);
  window.addEventListener('rf-bm-theme-change', onSyncTheme);

  let dg = false, dx = 0, dy = 0;
  hdr.onmousedown = e => {
    if (e.target.closest('button') || e.target.closest('#ba-theme-menu')) return;
    dg = true;
    dx = e.clientX - win.getBoundingClientRect().left;
    dy = e.clientY - win.getBoundingClientRect().top;
    hdr.style.cursor = 'grabbing';
    e.preventDefault();
  };
  function onDocMouseMove(e) {
    if (!dg) return;
    win.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + 'px';
    win.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px';
    win.style.right = 'auto';
  }
  function onDocMouseUp() {
    if (dg) {
      dg = false;
      hdr.style.cursor = 'grab';
    }
  }
  document.addEventListener('mousemove', onDocMouseMove);
  document.addEventListener('mouseup', onDocMouseUp);

  const stEl = document.getElementById('ba-st'), logEl = document.getElementById('ba-log');
  const cntEl = document.getElementById('ba-cnt'), btnPlay = document.getElementById('ba-play');
  const btnPause = document.getElementById('ba-pause'), btnStop = document.getElementById('ba-stop');
  const btnClose = document.getElementById('ba-close');
  const btnFillDefault = document.getElementById('ba-fill-default');
  const btnModeEnviar = document.getElementById('ba-mode-enviar');
  const btnModeFinalizar = document.getElementById('ba-mode-finalizar');
  const modeHintEl = document.getElementById('ba-mode-hint');
  const tagWrapEl = document.getElementById('ba-tag-wrap');
  const btnPauseAll = document.getElementById('ba-pause-all'), btnUnpauseAll = document.getElementById('ba-unpause-all');
  const msgEl = document.getElementById('ba-msg'), tagEl = document.getElementById('ba-tag');
  const folderEl = document.getElementById('ba-folder'), btnMoveFolder = document.getElementById('ba-move-folder');
  const folderChipsEl = document.getElementById('ba-folder-chips');
  const runBarEl = document.getElementById('ba-run-bar'), runLabelEl = document.getElementById('ba-run-label');
  const btnClearLog = document.getElementById('ba-clear-log'), btnToggleLog = document.getElementById('ba-toggle-log');
  const btnBaixarLog = document.getElementById('ba-baixar-log'), btnBaixarRelatorio = document.getElementById('ba-baixar-relatorio');
  const simularEl = document.getElementById('ba-simular');
  const btnClaimAuto = document.getElementById('ba-claim-auto'), queueCountEl = document.getElementById('ba-queue-count');

  const pilotFolderEl = document.getElementById('ba-pilot-folder');
  const pilotMsgEl = document.getElementById('ba-pilot-msg');
  const pilotFolderChipsEl = document.getElementById('ba-pilot-folder-chips');
  const pilotFillDefaultBtn = document.getElementById('ba-pilot-fill-default');
  const btnPilotStart = document.getElementById('ba-pilot-start');

  const tabBtns = [...document.querySelectorAll('.ba-tab-btn')];
  const panes = {
    piloto: document.getElementById('ba-pane-piloto'),
    pasta: document.getElementById('ba-pane-pasta'),
    mensagem: document.getElementById('ba-pane-mensagem'),
    fila: document.getElementById('ba-pane-fila'),
    auto: document.getElementById('ba-pane-auto')
  };

  function aplicarAba(novaAba) {
    if (!panes[novaAba]) return;
    abaAtiva = novaAba;
    saveTab(novaAba);
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.baTab === novaAba));
    Object.keys(panes).forEach(k => panes[k].classList.toggle('active', k === novaAba));
  }
  tabBtns.forEach(b => {
    b.onclick = () => {
      if (rodando) return;
      aplicarAba(b.dataset.baTab);
    };
  });
  aplicarAba(abaAtiva);

  function renderFolderChips() {
    const folders = getRecentFolders();
    const html = `<span class="ba-chip-caption">Rápidas:</span>` +
      folders.map(f => `<button type="button" class="ba-chip" data-folder-chip="${f.replace(/"/g, '&quot;')}">📁 ${f.replace(/</g, '&lt;')}</button>`).join('');
    [folderChipsEl, pilotFolderChipsEl].forEach(container => {
      if (!container) return;
      container.innerHTML = html;
      container.querySelectorAll('.ba-chip').forEach(ch => {
        ch.onclick = () => {
          if (rodando) return;
          const val = ch.dataset.folderChip;
          if (folderEl) folderEl.value = val;
          if (pilotFolderEl) pilotFolderEl.value = val;
          CONFIG.pastaDestino = val;
        };
      });
    });
  }
  renderFolderChips();

  if (pilotFolderEl) {
    bindPanelInput(pilotFolderEl, CONFIG.pastaDestino, val => {
      CONFIG.pastaDestino = val;
      if (folderEl && folderEl.value !== val) folderEl.value = val;
    });
  }
  if (folderEl) {
    folderEl.addEventListener('input', () => {
      if (pilotFolderEl && pilotFolderEl.value !== folderEl.value) {
        pilotFolderEl.value = folderEl.value;
      }
    });
  }

  if (pilotMsgEl) {
    bindPanelInput(pilotMsgEl, CONFIG.mensagem, val => {
      CONFIG.mensagem = val;
      if (msgEl && msgEl.value !== val) msgEl.value = val;
    });
  }
  if (msgEl) {
    msgEl.addEventListener('input', () => {
      if (pilotMsgEl && pilotMsgEl.value !== msgEl.value) {
        pilotMsgEl.value = msgEl.value;
      }
    });
  }

  if (pilotFillDefaultBtn) {
    pilotFillDefaultBtn.onclick = () => {
      if (rodando) return;
      if (pilotMsgEl) {
        pilotMsgEl.value = MENSAGEM_PADRAO;
        pilotMsgEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (msgEl) {
        msgEl.value = MENSAGEM_PADRAO;
        msgEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
      CONFIG.mensagem = MENSAGEM_PADRAO;
      log("📋 Mensagem padrão carregada no Piloto.");
    };
  }

  function bindPanelInput(el, initialVal, onUpdate) {
    el.value = initialVal;
    el.addEventListener('input', () => onUpdate(el.value));
    ['keydown', 'keyup', 'keypress'].forEach(evt => {
      el.addEventListener(evt, e => e.stopPropagation());
    });
  }
  bindPanelInput(msgEl, CONFIG.mensagem, val => { CONFIG.mensagem = val; });
  bindPanelInput(tagEl, CONFIG.tagBusca, val => { CONFIG.tagBusca = val; });
  bindPanelInput(folderEl, CONFIG.pastaDestino, val => { CONFIG.pastaDestino = val; });

  btnClearLog.onclick = () => {
    logEl.innerHTML = '';
    log('🧹 Log limpo.');
  };
  btnToggleLog.onclick = () => {
    logOculto = !logOculto;
    logEl.style.display = logOculto ? 'none' : 'block';
    btnToggleLog.textContent = logOculto ? 'Mostrar log' : 'Ocultar log';
  };

  function aplicarModoVisual() {
    const ehFinalizar = modoChave === 'finalizar';
    btnModeEnviar.setAttribute('aria-pressed', ehFinalizar ? 'false' : 'true');
    btnModeFinalizar.setAttribute('aria-pressed', ehFinalizar ? 'true' : 'false');
    btnModeEnviar.style.background = ehFinalizar ? 'transparent' : 'var(--rb-accent)';
    btnModeEnviar.style.color = ehFinalizar ? 'var(--rb-muted)' : 'var(--rb-on-accent)';
    btnModeEnviar.style.boxShadow = ehFinalizar ? 'none' : '0 2px 12px var(--rb-accent-glow)';
    btnModeFinalizar.style.background = ehFinalizar ? '#0ea5e9' : 'transparent';
    btnModeFinalizar.style.color = ehFinalizar ? '#ffffff' : 'var(--rb-muted)';
    btnModeFinalizar.style.boxShadow = ehFinalizar ? '0 2px 12px rgba(14,165,233,0.4)' : 'none';
    if (ehFinalizar) {
      modeHintEl.innerHTML = '⚡ <b>Modo completo:</b> envia, aplica a tag e finaliza cada ticket.';
      modeHintEl.style.color = '#7dd3fc';
      tagWrapEl.style.display = 'block';
    } else {
      modeHintEl.innerHTML = '🛡️ <b>Modo seguro:</b> escreve para toda a fila sem encerrar tickets.';
      modeHintEl.style.color = 'var(--rb-muted)';
      tagWrapEl.style.display = 'none';
    }
    if (!rodando) {
      btnPlay.textContent = ehFinalizar ? '▶ Atender e Finalizar' : '▶ Enviar para todos';
      btnPlay.style.background = ehFinalizar ? '#0ea5e9' : 'var(--rb-accent)';
      btnPlay.style.color = ehFinalizar ? '#ffffff' : 'var(--rb-on-accent)';
      btnPlay.style.boxShadow = ehFinalizar ? '0 4px 16px rgba(14,165,233,0.35)' : '0 4px 16px var(--rb-accent-glow)';
    }
  }
  function definirModoChave(novoModo) {
    if (rodando || modoChave === novoModo) return;
    modoChave = novoModo;
    aplicarModoVisual();
    log(novoModo === 'finalizar'
      ? '⚡ Modo selecionado: Enviar + Finalizar'
      : '🛡️ Modo selecionado: Só Enviar (sem finalizar)');
  }
  aplicarModoVisual();

  function escapeRegExp(str) {
    return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  function normalizarTexto(str) {
    return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
  }
  function isElementoVisivel(el) {
    if (!el || el.hasAttribute?.('hidden')) return false;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : el.style;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
    }
    return true;
  }
  // v10.1: cada linha é acrescentada sem reescrever o log inteiro (antes ficava mais lento a cada cliente),
  // a tela guarda no máximo LOTE_LOG_MAX_TELA linhas e o log é salvo no navegador (sobrevive a reinício do PC).
  let logSalvo = null;
  let logTimerSalvar = null;
  function logLerSalvo() {
    if (logSalvo) return logSalvo;
    try {
      const s = JSON.parse(localStorage.getItem(LOTE_LOG_CHAVE) || '[]');
      logSalvo = Array.isArray(s) ? s : [];
    } catch {
      logSalvo = [];
    }
    return logSalvo;
  }
  function logSalvarAgora() {
    if (logTimerSalvar) { clearTimeout(logTimerSalvar); logTimerSalvar = null; }
    try { localStorage.setItem(LOTE_LOG_CHAVE, JSON.stringify(logLerSalvo())); } catch {}
  }
  function log(m) {
    const agora = new Date();
    const t = agora.toLocaleTimeString('pt-BR');
    if (logEl.firstChild && logEl.firstChild.nodeType === 3) logEl.textContent = ''; // tira "Pronto para iniciar."
    const linha = document.createElement('div');
    linha.textContent = `[${t}] ${m}`;
    logEl.appendChild(linha);
    while (logEl.childElementCount > LOTE_LOG_MAX_TELA) logEl.firstElementChild.remove();
    logEl.scrollTop = logEl.scrollHeight;
    console.log('[BA] ' + m);
    const salvo = logLerSalvo();
    salvo.push(`${agora.toLocaleDateString('pt-BR')} ${t} ${m}`);
    if (salvo.length > LOTE_LOG_MAX_SALVO) salvo.splice(0, salvo.length - LOTE_LOG_MAX_SALVO);
    if (!logTimerSalvar) logTimerSalvar = setTimeout(logSalvarAgora, 2000);
  }
  function baixarArquivo(nome, conteudo, tipo) {
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function carimboArquivo() {
    const d = new Date();
    const z = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}`;
  }
  function setSt(t, c) { stEl.textContent = t; stEl.style.background = c; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function clickUnico(el) {
    if (!el) return;
    el.focus?.();
    if (el.shadowRoot) {
      const inner = el.shadowRoot.querySelector('button, div, [role="button"]') || el;
      inner.click();
    } else {
      el.click();
    }
  }
  function waitFor(fn, timeout = 10000, interval = 300) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        try {
          const el = fn();
          if (el) return resolve(el);
        } catch(e) {}
        if (Date.now() - start > timeout) return reject(new Error('Timeout aguardando elemento'));
        setTimeout(check, interval);
      };
      check();
    });
  }
  async function fecharAvisosPendentes() {
    const toasts = document.querySelectorAll('button, bds-button, [role="alert"] button');
    for (const b of toasts) {
      const txt = (b.textContent || b.getAttribute('label') || '').trim().toLowerCase();
      if (txt === 'ok' || txt === 'fechar') {
        b.click();
        await sleep(300);
      }
    }
  }
  async function enviarTextoNoChat(texto) {
    await fecharAvisosPendentes();
    const input = await waitFor(() => {
      const el = document.querySelector('#text-input');
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    }, 8000);
    await preencherCampoMensagem(input, texto);
    dispararEnvioEnter(input);
    log("✅ Mensagem enviada!");
    await sleep(CONFIG.delayAcoes);
  }
  // Preenche o #text-input como a aplicação espera (setter nativo + eventos input/change).
  async function preencherCampoMensagem(input, texto) {
    input.focus();
    await sleep(250);
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(input, texto);
    else input.value = texto;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(400);
  }
  function dispararEnvioEnter(input) {
    input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
    }));
  }
  // Tag do passo Enviar + Finalizar. v10.1: só clica na opção igual ao texto (ou que contém o texto).
  // Se não achar, lança erro e o cliente fica como "enviado, NÃO finalizado" — nunca escolhe a 1ª da lista.
  async function passo2_tag(tagParam) {
    const tagAtual = String(tagParam || '').trim();
    if (!tagAtual) throw new Error("A caixa da tag está vazia.");
    CONFIG.tagBusca = tagAtual;
    log("🏷️ Abrindo 'Adicionar tags'...");
    const addTagDiv = await waitFor(() => {
      const typo = [...document.querySelectorAll('bds-typo')].find(t => t.textContent.trim() === 'Adicionar tags');
      if (typo) return typo.parentElement;
      return document.querySelector('.tags-container div.pointer');
    }).catch(() => { throw new Error("'Adicionar tags' não apareceu"); });
    clickUnico(addTagDiv);
    await sleep(CONFIG.delayAcoes);
    const selectChips = await waitFor(() => document.querySelector('bds-select-chips'))
      .catch(() => { throw new Error('a caixa de tags não abriu'); });
    if (!selectChips.shadowRoot) throw new Error("ShadowRoot indisponível");
    log(`🔍 Digitando '${tagAtual}'...`);
    const tagInput = await waitFor(() => {
      return selectChips.shadowRoot.querySelector('input') ||
      selectChips.shadowRoot.querySelector('bds-input')?.shadowRoot?.querySelector('input');
    }).catch(() => { throw new Error('campo de busca da tag não encontrado'); });
    tagInput.focus();
    await sleep(200);
    const iSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (iSetter) iSetter.call(tagInput, tagAtual);
    else tagInput.value = tagAtual;
    tagInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    tagInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    tagInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true }));
    await sleep(1200);
    log("📋 Procurando a tag na lista...");
    const textoOpcao = opt => (autoTextoComposto(opt) || opt.textContent || opt.getAttribute?.('title-text') ||
      opt.getAttribute?.('value') || '').replace(/\s+/g, ' ').trim();
    const tagOption = await waitFor(() => {
      const container = selectChips.shadowRoot.querySelector('div.select__options--open') || selectChips.shadowRoot;
      const visiveis = [...container.querySelectorAll('bds-select-option')].filter(isElementoVisivel);
      const i = loteEscolherTag(visiveis.map(textoOpcao), tagAtual);
      return i === -1 ? null : visiveis[i];
    }, 5000).catch(() => { throw new Error(`a tag "${tagAtual}" não apareceu na lista do Blip`); });
    clickUnico(tagOption);
    log(`✅ Tag selecionada: ${textoOpcao(tagOption) || tagAtual}`);
    await sleep(CONFIG.delayAcoes);
  }
  async function passo3_finalizar() {
    log("🔵 Clicando em 'Finalizar'...");
    const btnFinalizar = await waitFor(() => {
      const btnIcon = document.querySelector('#close-ticket-button-icon');
      if (btnIcon) {
        return btnIcon.shadowRoot?.querySelector('button') || btnIcon;
      }
      return document.querySelector('.pane-chat-buttons button, button#close-ticket-button');
    }).catch(() => { throw new Error("botão 'Finalizar' não encontrado"); });
    clickUnico(btnFinalizar);
    log("✅ Clicou em Finalizar");
    await sleep(700);
  }
  // Modal "Finalizar". v10.1: principal = botão com o texto "Finalizar ticket" (como antes);
  // reserva = botão de uma janela aberta cujo texto diz Finalizar/Confirmar (nunca Cancelar). A reserva vai para o log.
  function modalAberto(m) {
    if (m.tagName === 'BDS-MODAL') {
      const a = m.getAttribute('open');
      return m.open === true || (a !== null && a !== 'false');
    }
    return isElementoVisivel(m);
  }
  async function passo4_confirmarModal() {
    log("📋 Confirmando no modal...");
    let usouReserva = false;
    const btnConfirmar = await waitFor(() => {
      const btns = document.querySelectorAll('button, bds-button');
      for (const b of btns) {
        if (p.contains(b)) continue;
        const txt = (b.textContent || b.getAttribute('label') || '').trim().toLowerCase();
        if (txt.includes('finalizar ticket')) {
          usouReserva = false;
          return b.shadowRoot?.querySelector('button') || b;
        }
      }
      for (const modal of document.querySelectorAll('bds-modal, [role="dialog"]')) {
        if (p.contains(modal) || !modalAberto(modal)) continue;
        for (const b of modal.querySelectorAll('bds-button, button')) {
          if (b.closest('#close-ticket-button, #close-ticket-button-icon')) continue;
          const txt = autoTextoComposto(b) || b.textContent || b.getAttribute('label') || '';
          if (loteBotaoConfirmaFinalizar(txt)) {
            usouReserva = true;
            return b.shadowRoot?.querySelector('button') || b;
          }
        }
      }
      return null;
    }, 12000).catch(() => { throw new Error('o botão de confirmar a finalização não apareceu'); });
    if (usouReserva) log('ℹ️ Botão "Finalizar ticket" não achado pelo texto; usei a reserva (botão de confirmar da janela aberta).');
    await sleep(500);
    btnConfirmar.click();
    log("✅ Confirmação clicada.");
    await sleep(1000);
    await fecharAvisosPendentes();
    await sleep(CONFIG.delayTrocaTicket);
  }

  function atualizarBotoesEstado(emExecucao, tituloExec = '') {
    const controlesBloqueados = [
      btnModeEnviar, btnModeFinalizar, btnFillDefault, pilotFillDefaultBtn,
      btnPauseAll, btnUnpauseAll, btnPlay, btnMoveFolder, btnClaimAuto, ...tabBtns,
      document.getElementById('ba-transfer-name'), document.getElementById('ba-transfer-start')
    ].filter(Boolean);

    if (emExecucao) {
      setSt('Rodando', '#16a34a');
      runBarEl.style.display = 'flex';
      runLabelEl.textContent = tituloExec || 'Automação em execução...';
      btnPause.textContent = '⏸ Pausar';

      if (modoAtual === 'piloto') {
        if (btnPilotStart) {
          btnPilotStart.disabled = false;
          btnPilotStart.style.opacity = '1';
          btnPilotStart.style.cursor = 'pointer';
          btnPilotStart.textContent = '⏹ Interromper Piloto Contínuo';
          btnPilotStart.style.background = '#ef4444';
          btnPilotStart.style.color = '#ffffff';
        }
      } else {
        if (btnPilotStart) {
          btnPilotStart.disabled = true;
          btnPilotStart.style.opacity = '0.52';
          btnPilotStart.style.cursor = 'not-allowed';
        }
      }
    } else {
      setSt('Parado', 'rgba(100,116,139,0.55)');
      runBarEl.style.display = 'none';
      aplicarModoVisual();

      if (btnPilotStart) {
        btnPilotStart.disabled = false;
        btnPilotStart.style.opacity = '1';
        btnPilotStart.style.cursor = 'pointer';
        btnPilotStart.textContent = '⚡ Iniciar Piloto Automático';
        btnPilotStart.style.background = '';
        btnPilotStart.style.color = '';
      }
    }

    for (const b of controlesBloqueados) {
      b.disabled = emExecucao;
      b.style.opacity = emExecucao ? '0.52' : '1';
      b.style.cursor = emExecucao ? 'not-allowed' : 'pointer';
    }
  }
  async function aguardarPausaSeNecessario() {
    while (pausado && rodando) {
      setSt('Pausado', '#d97706');
      await sleep(400);
    }
    if (rodando) setSt('Rodando', '#16a34a');
    return rodando;
  }
  function isAcaoMenuVisivel(el) {
    if (!el) return false;
    if (isElementoVisivel(el)) return true;
    const inner = el.shadowRoot?.querySelector('button, div');
    return !!(inner && isElementoVisivel(inner));
  }
  function encontrarOpcaoMenu(wrap, testId) {
    const local = wrap?.querySelector(`bds-menu-action[data-testid="${testId}"]`);
    if (isAcaoMenuVisivel(local)) return local;
    const abertos = document.querySelectorAll(`bds-menu[open] bds-menu-action[data-testid="${testId}"], div.ticket-menu.visible bds-menu-action[data-testid="${testId}"]`);
    for (const el of abertos) {
      if (isAcaoMenuVisivel(el)) return el;
    }
    return null;
  }
  function menuEstaAberto(wrap) {
    if (!wrap) return false;
    const menu = wrap.querySelector('bds-menu');
    if (menu && (menu.open === true || menu.hasAttribute('open'))) return true;
    return [...wrap.querySelectorAll('bds-menu-action')].some(isAcaoMenuVisivel);
  }
  async function fecharMenuTicket(wrap, btn) {
    const menu = wrap?.querySelector('bds-menu');
    if (menu && typeof menu.open === 'boolean') menu.open = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await sleep(150);
    if (menuEstaAberto(wrap)) {
      clickUnico(btn);
      await sleep(150);
    }
  }
  function dispararCliqueReal(el) {
    if (!el) return;
    try { el.focus?.(); } catch {}
    const rect = el.getBoundingClientRect?.() || { left: 0, top: 0, width: 10, height: 10 };
    const clientX = Math.round(rect.left + (rect.width || 10) / 2);
    const clientY = Math.round(rect.top + (rect.height || 10) / 2);
    const evInit = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY };
    try { el.dispatchEvent(new PointerEvent('pointerover', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('mouseover', evInit)); } catch {}
    try { el.dispatchEvent(new PointerEvent('pointerenter', evInit)); } catch {}
    try { el.dispatchEvent(new PointerEvent('pointerdown', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('mousedown', evInit)); } catch {}
    try { el.dispatchEvent(new PointerEvent('pointerup', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('mouseup', evInit)); } catch {}
    try { el.dispatchEvent(new MouseEvent('click', evInit)); } catch {}
    if (typeof el.click === 'function') {
      try { el.click(); } catch {}
    }
  }

  function obterScrollContainerGeral() {
    const seletores = [
      '.infinite-scroll',
      '.chat-list',
      '[class*="chat-list"]',
      'aside.chat-list',
      '.list-container',
      'aside',
      'main [class*="list"]'
    ];
    for (const sel of seletores) {
      const el = document.querySelector(sel);
      if (el && el.scrollHeight > el.clientHeight + 5) return el;
    }
    return null;
  }

  function encontrarContainerScroll(el) {
    let cur = el?.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      try {
        const st = getComputedStyle(cur);
        if ((st.overflowY === 'auto' || st.overflowY === 'scroll' || st.overflowY === 'overlay') && cur.scrollHeight > cur.clientHeight + 5) {
          return cur;
        }
      } catch {}
      cur = cur.parentElement;
    }
    return obterScrollContainerGeral();
  }

  function obterChaveElemento(el, idxFallback) {
    if (el.id) return el.id;
    const card = el.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || el;
    const aria = card.getAttribute?.('aria-label');
    if (aria) return aria;
    const txt = (card.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    return txt || `idx-${idxFallback}`;
  }

  function rolarCardNoContainer(card, scrollContainer) {
    if (!card) return;
    if (scrollContainer) {
      const cRect = scrollContainer.getBoundingClientRect();
      const eRect = card.getBoundingClientRect();
      if (eRect.top < cRect.top || eRect.bottom > cRect.bottom) {
        scrollContainer.scrollTop += (eRect.top - cRect.top) - (cRect.height / 2) + (eRect.height / 2);
      }
    } else {
      card.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    }
  }

  function encontrarAcaoMoverPara(wrap) {
    const roots = [
      wrap?.querySelector('bds-menu'),
      wrap,
      document.querySelector('div.ticket-menu.visible bds-menu'),
      document.querySelector('div.ticket-menu.visible'),
      document.querySelector('bds-menu[open]')
    ].filter(Boolean);

    for (const r of roots) {
      const actions = [...r.querySelectorAll('bds-menu-action')];
      for (const a of actions) {
        const btnText = normalizarTexto(a.getAttribute('button-text'));
        const sub = normalizarTexto(a.getAttribute('subtitle'));
        const icon = (a.getAttribute('icon-left') || '').toLowerCase();
        if ((btnText === 'MOVER PARA' || btnText.includes('MOVER PARA') || (icon === 'folder' && sub.includes('PASTA'))) && isAcaoMenuVisivel(a)) {
          return a;
        }
      }
    }
    return null;
  }

  function coletarElementosProfundos(root, out = [], depth = 0) {
    if (!root || depth > 8) return out;
    const children = root.children || [];
    for (const ch of children) {
      const tag = ch.tagName ? ch.tagName.toLowerCase() : '';
      if (tag === 'svg' || tag === 'path' || tag === 'style' || tag === 'script') continue;
      out.push(ch);
      if (ch.shadowRoot) {
        coletarElementosProfundos(ch.shadowRoot, out, depth + 1);
      }
      coletarElementosProfundos(ch, out, depth + 1);
    }
    return out;
  }

  function coletarCandidatosPasta(acaoMover, wrap) {
    const lista = [];
    const seen = new Set();
    const pushAll = arr => {
      for (const el of arr) {
        if (!seen.has(el)) {
          seen.add(el);
          lista.push(el);
        }
      }
    };
    if (acaoMover) {
      pushAll(coletarElementosProfundos(acaoMover));
      if (acaoMover.shadowRoot) pushAll(coletarElementosProfundos(acaoMover.shadowRoot));
    }
    if (wrap) {
      const vis = wrap.querySelectorAll('bds-menu-action *, [class*="submenu"] *, [class*="sub-menu"] *');
      pushAll(vis);
    }
    const openSub = document.querySelectorAll('div.ticket-menu.visible bds-menu-action *, bds-menu[open] bds-menu-action *');
    pushAll(openSub);
    return lista;
  }

  function testarCorrespondenciaPasta(alvoNorm, textoBruto) {
    if (!alvoNorm || !textoBruto) return false;
    const candNorm = normalizarTexto(textoBruto);
    if (!candNorm) return false;
    if (candNorm === alvoNorm) return true;
    const pat = new RegExp('^' + escapeRegExp(alvoNorm) + '(?:\\s*\\(?\\d+\\)?|\\s+\\d+)$', 'i');
    if (pat.test(candNorm)) return true;
    const semNum = candNorm.replace(/\\d+/g, '').replace(/[\\(\\)\\[\\]]/g, '').trim();
    if (semNum === alvoNorm) return true;
    return false;
  }

  function coletarNomesPastasVisiveis(acaoMover, wrap) {
    const nomes = [];
    const seen = new Set();
    const candidatos = coletarCandidatosPasta(acaoMover, wrap);
    for (const el of candidatos) {
      const raw = (el.innerText || el.textContent || el.getAttribute?.('button-text') || el.getAttribute?.('label') || '').replace(/\s+/g, ' ').trim();
      if (!raw || raw.length > 35) continue;
      const semCont = raw.replace(/\s*\(\d+\)$|\s+\d+$/, '').trim();
      const lower = semCont.toLowerCase();
      if (!semCont || /^\d+$/.test(semCont) || lower.includes('mover para') || lower.includes('mover o ticket') || lower === 'arrow-right' || lower === 'folder') continue;
      if (!seen.has(lower)) {
        seen.add(lower);
        nomes.push(semCont);
      }
    }
    return nomes.slice(0, 12);
  }

  async function percorrerItensFila({ modo, seletor, tituloInicio, tituloBarra, verboPassado, processarItem, aoErro }) {
    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = modo;
    ativarWakeLock();
    atualizarBotoesEstado(true, tituloBarra || tituloInicio);
    const processados = new Set();
    let alterados = 0;
    let pulados = 0;
    let scrollContainer = null;
    let tentativasFim = 0;
    try {
      const iniciais = [...document.querySelectorAll(seletor)];
      if (iniciais.length === 0) {
        log('⚠️ Nenhum cliente encontrado na fila.');
        return;
      }
      scrollContainer = encontrarContainerScroll(iniciais[0]);
      if (scrollContainer && scrollContainer.scrollTop > 0) {
        scrollContainer.scrollTop = 0;
        await sleep(350);
      }
      cntEl.textContent = '0';
      log(`🚀 ${tituloInicio} (${iniciais.length} visíveis)...`);
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;
        const lista = [...document.querySelectorAll(seletor)];
        let alvo = null;
        let chave = '';
        for (let i = 0; i < lista.length; i++) {
          const item = lista[i];
          const k = obterChaveElemento(item, i);
          if (!processados.has(k)) {
            alvo = item;
            chave = k;
            break;
          }
        }
        if (!alvo) {
          tentativasFim++;
          if (tentativasFim <= 4) {
            scrollContainer = scrollContainer || encontrarContainerScroll(lista[lista.length - 1]);
            log(`⏳ Rolando fila para carregar mais atendimentos (${tentativasFim}/4)...`);
            if (scrollContainer) {
              scrollContainer.scrollTop += Math.max(300, Math.floor(scrollContainer.clientHeight * 0.8));
              scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
            }
            window.dispatchEvent(new Event('scroll'));
            await sleep(1400);
            continue;
          }
          break;
        }
        tentativasFim = 0;
        processados.add(chave);
        try {
          const res = await processarItem(alvo, chave, alterados, scrollContainer);
          if (res === 'alterado') {
            alterados++;
            cntEl.textContent = alterados;
          } else if (res === 'pulado') {
            pulados++;
          }
        } catch (err) {
          log(`❌ Erro (${chave}): ${err.message}`);
          if (aoErro) await aoErro(alvo, err);
          await fecharAvisosPendentes();
        }
        await sleep(350);
      }
      log(`🏁 Finalizado: ${alterados} ${verboPassado}(s)${pulados ? `, ${pulados} pulado(s)` : ''}.`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      log("⏹ Automação parada.");
    }
  }

  async function rolarFila() {
    const sc = obterScrollContainerGeral();
    if (sc) {
      sc.scrollTop += Math.max(300, Math.floor(sc.clientHeight * 0.8));
      sc.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
    const articles = document.querySelectorAll('article.chat-list-item');
    if (articles.length > 0) {
      articles[articles.length - 1].scrollIntoView?.({ block: 'end', behavior: 'instant' });
    }
    window.dispatchEvent(new Event('scroll'));
  }

  async function processarMoverTicket(alvo, pasta, alvoNorm, labelId, totalAtual) {
    const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
    const card = alvo.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || wrap;

    card?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(150);

    // 1. Abre o menu dos 3 pontinhos
    clickUnico(alvo);
    await sleep(250);

    // 2. Localiza a opção "Mover para"
    const acaoMover = await waitFor(() => encontrarAcaoMoverPara(wrap), 3500, 100).catch(() => null);
    if (!acaoMover) {
      log(`⏭️ Opção "Mover para" não disponível no ticket ${labelId}.`);
      await fecharMenuTicket(wrap, alvo);
      return 'pulado';
    }

    if (!(await aguardarPausaSeNecessario())) {
      await fecharMenuTicket(wrap, alvo);
      return 'parado';
    }

    // 3. Hover sobre "Mover para" para abrir o submenu de pastas
    acaoMover.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    acaoMover.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    acaoMover.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const innerBtn = acaoMover.shadowRoot?.querySelector('button.menuaction__button, button') || acaoMover;
    innerBtn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
    innerBtn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    innerBtn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(350);

    // 4. Busca a pasta correspondente no container exato: div.folder-submenu-container > span.custom-submenu-item > span.sub-menu
    const resultado = await waitFor(() => {
      const containers = [
        acaoMover.querySelector('.folder-submenu-container'),
        ...document.querySelectorAll('div.folder-submenu-container, .folder-submenu-container')
      ].filter(Boolean);

      let itens = [];
      for (const c of containers) {
        itens.push(...c.querySelectorAll('.custom-submenu-item, span.custom-submenu-item, [class*="submenu-item"]'));
      }
      if (itens.length === 0) {
        itens = [...acaoMover.querySelectorAll('.custom-submenu-item, span.custom-submenu-item, [class*="submenu-item"], span.sub-menu')];
      }

      for (const item of itens) {
        const nameEl = item.querySelector('.sub-menu, [class*="sub-menu"]') || item;
        const raw = (nameEl.textContent || nameEl.innerText || '').trim();
        if (!raw) continue;
        if (testarCorrespondenciaPasta(alvoNorm, raw)) {
          return { item, nameEl, raw };
        }
      }
      return null;
    }, 2800, 100).catch(() => null);

    if (!(await aguardarPausaSeNecessario())) {
      await fecharMenuTicket(wrap, alvo);
      return 'parado';
    }

    if (!resultado) {
      const vistas = coletarNomesPastasVisiveis(acaoMover, wrap);
      const extra = vistas.length ? ` (Vistas: ${vistas.join(', ')})` : '';
      log(`⚠️ Pasta "${pasta}" não encontrada no ticket ${labelId}${extra}.`);
      await fecharMenuTicket(wrap, alvo);
      return 'pulado';
    }

    // 5. Dispara clique real no item da pasta e no span interno
    const alvoClick = resultado.item;
    const nameClick = resultado.nameEl;
    dispararCliqueReal(alvoClick);
    if (nameClick !== alvoClick) {
      dispararCliqueReal(nameClick);
    }

    saveRecentFolder(pasta);
    renderFolderChips();
    log(`✅ Ticket ${labelId} movido para "${pasta}"! (${totalAtual + 1})`);

    // 6. Aguarda o Blip processar a mudança de pasta
    await sleep(750);
    await fecharAvisosPendentes();
    if (menuEstaAberto(wrap)) {
      await fecharMenuTicket(wrap, alvo);
    }
    return 'alterado';
  }

  async function executarMoverParaPastaTodos(nomePasta) {
    const pasta = (nomePasta || folderEl.value).trim();
    if (!pasta) {
      log('⚠️ Digite o nome exato da pasta antes de iniciar.');
      folderEl.focus();
      return;
    }
    CONFIG.pastaDestino = pasta;
    const alvoNorm = normalizarTexto(pasta);

    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = 'pasta';
    ativarWakeLock();
    atualizarBotoesEstado(true, `Movendo → ${pasta}`);

    cntEl.textContent = '0';
    let alterados = 0;
    let pulados = 0;
    const falhasSeguidas = new Map();
    let tentativasSemTickets = 0;

    log(`🚀 Iniciando movimentação para a pasta "${pasta}"...`);

    try {
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;

        const lista = [...document.querySelectorAll('button.ticket-info-options')];
        if (lista.length === 0) {
          tentativasSemTickets++;
          if (tentativasSemTickets <= 4) {
            log(`⏳ Carregando fila (${tentativasSemTickets}/4)...`);
            await rolarFila();
            await sleep(1200);
            continue;
          }
          log('🏁 Fila vazia ou nenhum cliente restante.');
          break;
        }

        // Pega o primeiro da fila que não esteja em loop de falha
        let alvo = null;
        let chave = '';
        for (let i = 0; i < lista.length; i++) {
          const item = lista[i];
          const k = obterChaveElemento(item, i);
          const falhas = falhasSeguidas.get(k) || 0;
          if (falhas < 2) {
            alvo = item;
            chave = k;
            break;
          }
        }

        if (!alvo) {
          tentativasSemTickets++;
          if (tentativasSemTickets <= 3) {
            log(`⏳ Tentando carregar novos tickets além dos pulados (${tentativasSemTickets}/3)...`);
            await rolarFila();
            await sleep(1400);
            continue;
          }
          log('🏁 Todos os tickets restantes foram processados ou pulados.');
          break;
        }

        tentativasSemTickets = 0;
        const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;

        try {
          const res = await processarMoverTicket(alvo, pasta, alvoNorm, labelId, alterados);
          if (res === 'alterado') {
            alterados++;
            cntEl.textContent = alterados;
            falhasSeguidas.delete(chave);
          } else {
            pulados++;
            const f = falhasSeguidas.get(chave) || 0;
            falhasSeguidas.set(chave, f + 1);
          }
        } catch (err) {
          log(`❌ Erro no ticket ${labelId}: ${err.message}`);
          pulados++;
          const f = falhasSeguidas.get(chave) || 0;
          falhasSeguidas.set(chave, f + 1);
          await fecharAvisosPendentes();
        }

        // Aguarda a fila atualizar (o ticket sair e o próximo tomar o lugar no topo!)
        await sleep(CONFIG.delayAcoes);
      }

      log(`🏁 Finalizado: ${alterados} movido(s) para "${pasta}"${pulados ? `, ${pulados} pulado(s)` : ''}.`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      log("⏹ Automação parada.");
    }
  }

  async function executarModoEsperaTodos(acao) {
    const ehPausar = acao === 'pausar';
    const targetTestId = ehPausar ? 'option-setStandbyMode' : 'option-unsetStandbyMode';
    const oppositeTestId = ehPausar ? 'option-unsetStandbyMode' : 'option-setStandbyMode';
    const verbo = ehPausar ? 'Pausando' : 'Despausando';
    const verboPassado = ehPausar ? 'pausado' : 'despausado';
    await percorrerItensFila({
      modo: acao,
      seletor: 'button.ticket-info-options',
      tituloInicio: `${verbo} todos os clientes`,
      tituloBarra: `${verbo} fila`,
      verboPassado,
      processarItem: async (alvo, chave, totalAtual, scrollContainer) => {
        const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
        const card = alvo.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || wrap;
        const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;
        rolarCardNoContainer(card, scrollContainer);
        card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await sleep(120);
        clickUnico(alvo);
        const acaoEncontrada = await waitFor(() => {
          const t = encontrarOpcaoMenu(wrap, targetTestId);
          if (t) return { tipo: 'alvo', el: t };
          const o = encontrarOpcaoMenu(wrap, oppositeTestId);
          if (o) return { tipo: 'oposto', el: o };
          return null;
        }, 3500, 100);
        if (!(await aguardarPausaSeNecessario())) {
          await fecharMenuTicket(wrap, alvo);
          return 'parado';
        }
        if (acaoEncontrada.tipo === 'alvo') {
          const innerBtn = acaoEncontrada.el.shadowRoot?.querySelector('button.menuaction__button, button') || acaoEncontrada.el;
          await sleep(150);
          clickUnico(innerBtn);
          log(`✅ Ticket ${labelId} ${verboPassado}! (${totalAtual + 1})`);
          await sleep(550);
          await fecharAvisosPendentes();
          return 'alterado';
        }
        log(`⏭️ Ticket ${labelId} já estava ${verboPassado}.`);
        await fecharMenuTicket(wrap, alvo);
        return 'pulado';
      },
      aoErro: async (alvo) => {
        const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
        await fecharMenuTicket(wrap, alvo);
      }
    });
  }

  async function executarEscreverParaTodos(texto) {
    if (rodando) return;
    const mensagem = (texto || msgEl.value).trim();
    if (!mensagem) {
      log('⚠️ Digite uma mensagem antes de iniciar.');
      msgEl.focus();
      return;
    }
    CONFIG.mensagem = mensagem;
    await percorrerItensFila({
      modo: 'escrever',
      seletor: 'article.chat-list-item',
      tituloInicio: 'Escrevendo para todos os clientes',
      tituloBarra: 'Enviando mensagem...',
      verboPassado: 'enviado',
      processarItem: async (card, chave, totalAtual, scrollContainer) => {
        const nome = card.getAttribute('aria-label') || chave;
        rolarCardNoContainer(card, scrollContainer);
        await sleep(120);
        clickUnico(card);
        log(`👤 [${totalAtual + 1}] ${nome}`);
        await sleep(Math.max(800, CONFIG.delayTrocaTicket));
        if (!(await aguardarPausaSeNecessario())) return 'parado';
        await enviarTextoNoChat(mensagem);
        return 'alterado';
      }
    });
  }

  /* ========================================================
     LOTE ENVIAR + FINALIZAR (v10.1)
     - Um ticket por vez, pelo número do ticket (menu-<id>), relendo a lista a cada cliente e rolando
       para o Blip carregar mais (antes só tratava o que estava carregado ou ficava preso).
     - Problema num cliente = pula, registra o motivo e segue. Nunca reenvia: quem recebeu fica 24 h na memória,
       gravada ANTES do Enter (se o PC cair no meio, o ticket fica "incerto" e não recebe de novo).
     - Enviou mas a tag/finalizar falhou = "enviado, NÃO finalizado" + fecha o que ficou aberto.
     - LOTE_FALHAS_SEGUIDAS problemas seguidos = o lote PAUSA (problema geral) e espera você.
     ======================================================== */
  let loteRegistros = [];
  let loteInicio = '';
  function loteLerMemoria() {
    try {
      const o = JSON.parse(localStorage.getItem(LOTE_MEMORIA_CHAVE) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  function loteGravarMemoria(id, estado) {
    const agora = Date.now();
    const o = loteMemoriaLimpar(loteLerMemoria(), agora);
    o[id] = { estado, ts: agora };
    try { localStorage.setItem(LOTE_MEMORIA_CHAVE, JSON.stringify(o)); } catch {}
  }
  function loteRegistrar(id, resultado, motivo) {
    loteRegistros.push({ id, resultado, motivo: motivo || '', hora: new Date().toLocaleTimeString('pt-BR') });
    try {
      localStorage.setItem(LOTE_RELATORIO_CHAVE, JSON.stringify({ inicio: loteInicio, registros: loteRegistros }));
    } catch {}
  }

  // Fecha o que pode ter ficado aberto (lista de tags, modal de finalizar) para não travar o próximo cliente.
  // Deduzido, não confirmado no Blip real: Esc fecha a lista de tags; o modal tem um botão "Cancelar".
  async function loteFecharSobras() {
    const esc = { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, composed: true };
    try {
      (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', esc));
      document.dispatchEvent(new KeyboardEvent('keydown', esc));
    } catch {}
    await sleep(300);
    for (const m of document.querySelectorAll('bds-modal, [role="dialog"]')) {
      if (p.contains(m) || !modalAberto(m)) continue;
      const cancelar = [...m.querySelectorAll('bds-button, button')]
        .find(b => /cancelar/i.test(autoTextoComposto(b) || b.textContent || ''));
      if (cancelar) {
        (cancelar.shadowRoot?.querySelector('button') || cancelar).click();
        log('🧹 Fechei uma janela que ficou aberta (Cancelar).');
        await sleep(400);
      }
    }
    await fecharAvisosPendentes();
  }

  // Um ticket: { resultado: 'finalizado'|'parcial'|'incerto'|'pulado'|'falha'|'simulado', motivo }
  async function loteProcessarTicket(id, op) {
    const msg = op.mensagem;
    if (loteJaRecebeu(loteLerMemoria(), id)) return { resultado: 'pulado', motivo: 'já recebeu a mensagem antes (memória 24 h)' };
    const card = autoCardDoTicket(autoBotaoMenu(id));
    if (!card) return { resultado: 'pulado', motivo: 'o ticket saiu da lista' };
    card.scrollIntoView?.({ block: 'nearest' });
    if (autoIndicioChatAtivo(id) === null) clickUnico(card);
    const indicio = await waitFor(() => autoIndicioChatAtivo(id), AUTO_T.chatAtivo, 200).catch(() => null);
    if (!indicio) return { resultado: 'falha', motivo: 'o chat deste ticket não abriu; nada enviado' };
    const campoLivre = () => {
      const el = autoCampoTexto();
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    };
    const input = await waitFor(campoLivre, AUTO_T.campo, 200).catch(() => null);
    if (!input) return { resultado: 'pulado', motivo: 'campo de mensagem indisponível (cliente em espera ou chat bloqueado)' };
    if (autoTemRascunho(msg)) return { resultado: 'pulado', motivo: 'o chat tem um texto digitado (rascunho); nada foi trocado' };

    if (input.value !== msg) await preencherCampoMensagem(input, msg);
    if (autoCampoTexto() !== input || autoIndicioChatAtivo(id) === null) {
      autoLimparSeNosso(input, msg);
      return { resultado: 'falha', motivo: 'o chat aberto mudou durante o preenchimento; nada enviado' };
    }
    if (input.value !== msg) return { resultado: 'falha', motivo: 'o texto do campo foi alterado; nada enviado' };
    if (op.simular) {
      autoLimparSeNosso(input, msg);
      return { resultado: 'simulado', motivo: 'texto preenchido e apagado; nada enviado' };
    }

    loteGravarMemoria(id, 'enviando'); // antes do Enter: se tudo cair agora, este ticket nunca é reenviado
    const antes = autoContarOcorrencias(msg);
    dispararEnvioEnter(input);
    const envio = await autoConfirmarEnvio(input, msg, antes);
    if (envio === 'nao_enviado') {
      autoLimparSeNosso(input, msg);
      loteGravarMemoria(id, 'nao_enviado');
      return { resultado: 'falha', motivo: 'o envio não ocorreu (o texto ficou no campo); nada enviado' };
    }
    if (envio !== 'confirmado') {
      loteGravarMemoria(id, 'incerto');
      return { resultado: 'incerto', motivo: 'envio sem confirmação na tela; confira (não será reenviado)' };
    }
    loteGravarMemoria(id, 'parcial');
    log(`✉️ #${id}: mensagem enviada e confirmada.`);

    try {
      await passo2_tag(op.tag);
      await passo3_finalizar();
      await passo4_confirmarModal();
    } catch (err) {
      await loteFecharSobras();
      return { resultado: 'parcial', motivo: 'não finalizou: ' + ((err && err.message) || err) };
    }
    // Deduzido: depois de finalizar, o ticket sai da lista (ou o chat dele deixa de estar aberto).
    const fechou = await waitFor(() => !autoBotaoMenu(id) || autoIndicioChatAtivo(id) === null, 8000, 250)
      .then(() => true).catch(() => false);
    if (!fechou) {
      await loteFecharSobras();
      return { resultado: 'parcial', motivo: 'cliquei em finalizar, mas o ticket continua aberto' };
    }
    loteGravarMemoria(id, 'finalizado');
    return { resultado: 'finalizado', motivo: '' };
  }

  const LOTE_ICONES = { finalizado: '🎉', simulado: '🧪', parcial: '⚠️', incerto: '❓', pulado: '⏭️', falha: '❌' };

  async function loteEnviarFinalizar({ mensagem, tag, simular }) {
    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = 'atender';
    loteRegistros = [];
    loteInicio = new Date().toLocaleString('pt-BR');
    atualizarBotoesEstado(true, simular ? '🧪 Simulando (nada é enviado)...' : 'Enviando e finalizando...');
    cntEl.textContent = '0';
    log(`▶ ${simular ? '🧪 SIMULAÇÃO de Enviar + Finalizar' : 'Enviar + Finalizar'} iniciado (${LOTE_VERSAO}). Tag: "${tag}".`);
    await ativarWakeLock();
    const tentados = new Set();
    let rolagens = 0;
    let seguidas = 0;
    let feitos = 0;
    try {
      const inicial = autoColetarTickets();
      log(`📋 ${inicial.ids.length} cliente(s) carregados na lista agora; o bot rola a lista para buscar o resto.`);
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;
        const id = loteEscolherProximo(autoColetarTickets().ids, tentados);
        if (!id) {
          if (rolagens >= LOTE_ROLAGENS_FIM) break;
          rolagens++;
          log(`⏳ Procurando mais clientes na lista (${rolagens}/${LOTE_ROLAGENS_FIM})...`);
          await rolarFila();
          await sleep(1500);
          continue;
        }
        rolagens = 0;
        tentados.add(id);
        log(`━━━ Ticket #${id} (${tentados.size}º) ━━━`);
        let r;
        try {
          r = await loteProcessarTicket(id, { mensagem, tag, simular });
        } catch (err) {
          await loteFecharSobras().catch(() => {});
          r = { resultado: 'falha', motivo: (err && err.message) || String(err) };
        }
        loteRegistrar(id, r.resultado, r.motivo);
        log(`${LOTE_ICONES[r.resultado] || '•'} #${id}: ${LOTE_ESTADOS_TEXTO[r.resultado] || r.resultado}${r.motivo ? ` — ${r.motivo}` : ''}.`);
        if (r.resultado === 'finalizado' || r.resultado === 'simulado') {
          feitos++;
          cntEl.textContent = feitos;
        }
        seguidas = ['falha', 'parcial', 'incerto'].includes(r.resultado) ? seguidas + 1 : 0;
        if (seguidas >= LOTE_FALHAS_SEGUIDAS && rodando) {
          pausado = true;
          btnPause.textContent = '▶ Retomar';
          log(`✋ ${seguidas} clientes seguidos com problema: lote PAUSADO. Confira a tela do Blip e clique em Retomar (ou Parar).`);
          seguidas = 0;
        }
        await sleep(CONFIG.delayTrocaTicket);
      }
      if (rodando) log('🏁 Não há mais clientes na lista.');
    } catch (err) {
      log(`❌ Falha geral, lote parado: ${(err && err.message) || err}`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      log(`📊 Resumo: ${loteResumo(loteRegistros).texto}.`);
      const problemas = loteRegistros.filter(x => x.resultado !== 'finalizado' && x.resultado !== 'simulado');
      for (const x of problemas.slice(0, 30)) log(`   #${x.id}: ${LOTE_ESTADOS_TEXTO[x.resultado]}${x.motivo ? ` — ${x.motivo}` : ''}`);
      if (problemas.length > 30) log(`   ... e mais ${problemas.length - 30}. Veja tudo em 📄 Relatório.`);
      log('⏹ Automação parada.');
      logSalvarAgora();
    }
  }

  function obterCamposPainel(exigirTag = true) {
    const mensagem = msgEl.value.trim();
    if (!mensagem) {
      log("⚠️ Digite uma mensagem na caixa antes de iniciar.");
      msgEl.focus();
      return null;
    }
    CONFIG.mensagem = mensagem;
    let tag = tagEl.value.trim();
    if (exigirTag) {
      if (!tag) {
        log("⚠️ Digite o nome da tag na caixa antes de iniciar.");
        tagEl.focus();
        return null;
      }
      CONFIG.tagBusca = tag;
    }
    return { mensagem, tag };
  }

  btnBaixarLog.onclick = () => {
    logSalvarAgora();
    const linhas = logLerSalvo();
    if (!linhas.length) { log('ℹ️ Ainda não há log salvo.'); return; }
    baixarArquivo(`rodbot-log_${carimboArquivo()}.txt`, linhas.join('\r\n') + '\r\n', 'text/plain;charset=utf-8');
  };
  btnBaixarRelatorio.onclick = () => {
    let dados = null;
    try { dados = JSON.parse(localStorage.getItem(LOTE_RELATORIO_CHAVE) || 'null'); } catch {}
    const regs = (dados && Array.isArray(dados.registros)) ? dados.registros : loteRegistros;
    if (!regs.length) { log('ℹ️ Nenhum lote Enviar + Finalizar registrado ainda.'); return; }
    baixarArquivo(`rodbot-relatorio_${carimboArquivo()}.csv`, loteCsv(regs), 'text/csv;charset=utf-8');
    log(`📄 Relatório baixado (lote de ${(dados && dados.inicio) || 'agora'}: ${loteResumo(regs).texto}).`);
  };

  btnModeEnviar.onclick = () => definirModoChave('enviar');
  btnModeFinalizar.onclick = () => definirModoChave('finalizar');
  btnFillDefault.onclick = () => {
    if (rodando) return;
    msgEl.value = MENSAGEM_PADRAO;
    CONFIG.mensagem = MENSAGEM_PADRAO;
    msgEl.focus();
    log("📋 Mensagem padrão preenchida.");
  };

  btnMoveFolder.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    executarMoverParaPastaTodos(folderEl.value);
  };

  btnPlay.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    const ehFinalizar = modoChave === 'finalizar';
    const campos = obterCamposPainel(ehFinalizar);
    if (!campos) return;
    if (ehFinalizar) {
      const simular = !!simularEl?.checked;
      const naTela = autoColetarTickets().ids.length;
      const ok = simular || confirm(
        `⚠️ MODO ENVIAR + FINALIZAR (ENVIO REAL)\n\nIsso vai enviar a mensagem, aplicar a tag "${campos.tag}" e FINALIZAR todos os tickets da lista (${naTela} carregados agora; o bot rola para buscar o resto).\n\nDica: rode antes com "Simular" marcado.\n\nDeseja iniciar agora?`
      );
      if (!ok) {
        log("⚠️ Ação cancelada pelo usuário.");
        return;
      }
      loteEnviarFinalizar({ mensagem: campos.mensagem, tag: campos.tag, simular });
    } else {
      executarEscreverParaTodos(campos.mensagem);
    }
  };

  function alternarPausa() {
    if (!rodando) return;
    if (!pausado) {
      pausado = true;
      btnPause.textContent = '▶ Retomar';
      log("⏸ Automação pausada.");
    } else {
      ativarWakeLock();
      pausado = false;
      btnPause.textContent = '⏸ Pausar';
      log("▶ Automação retomada.");
    }
  }
  function pararExecucao() {
    rodando = false;
    pausado = false;
    liberarWakeLock();
    log("⏹ Interrompendo...");
  }
  // Pausar/Parar também são tratados na fase de captura da window: modais do Blip (focus trap /
  // "clique fora") podem interromper a propagação no document e o onclick do painel nunca rodaria.
  const eventosControleTratados = new WeakSet();
  function onCapturaControles(e) {
    const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const acao = caminho.includes(btnStop) ? pararExecucao : caminho.includes(btnPause) ? alternarPausa : null;
    if (!acao) return;
    eventosControleTratados.add(e);
    acao();
  }
  window.addEventListener('click', onCapturaControles, true);
  btnPause.onclick = e => { if (!eventosControleTratados.has(e)) alternarPausa(); };
  btnStop.onclick = e => { if (!eventosControleTratados.has(e)) pararExecucao(); };

  function obterContagemFila() {
    const el = document.querySelector('#waiting-tickets-count');
    if (!el) return null;
    const raw = (el.shadowRoot?.textContent || el.textContent || el.innerText || '').trim();
    const m = raw.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  function atualizarBadgeFila() {
    if (queueCountEl) {
      const c = obterContagemFila();
      queueCountEl.textContent = c !== null ? c : '--';
    }
  }
  const queueTimer = setInterval(atualizarBadgeFila, 1000);

  function obterBotaoAtender() {
    const host = document.querySelector('#claim-ticket-button');
    if (!host) return null;
    const isHostDisabled = host.hasAttribute('disabled') || host.getAttribute('aria-disabled') === 'true';
    const inner = host.shadowRoot?.querySelector('button') || host;
    const isInnerDisabled = inner.hasAttribute('disabled') || inner.getAttribute('aria-disabled') === 'true';
    return { host, inner, disabled: isHostDisabled || isInnerDisabled };
  }

  async function executarAtendimentoAutomatico() {
    if (rodando) return;
    rodando = true;
    pausado = false;
    modoAtual = 'claim';
    ativarWakeLock();
    atualizarBotoesEstado(true, 'Atendendo fila (0.5s)...');
    cntEl.textContent = '0';
    let solicitados = 0;

    const countInicial = obterContagemFila();
    log(`🚀 Iniciando atendimento automático a cada 0.5s (Fila atual: ${countInicial !== null ? countInicial : 'lendo...'})`);

    try {
      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) break;

        const countAtual = obterContagemFila();
        atualizarBadgeFila();

        if (countAtual !== null && countAtual <= 0) {
          log('🎉 A contagem da fila chegou a 0! Finalizado.');
          break;
        }

        const btnInfo = obterBotaoAtender();
        if (!btnInfo || !btnInfo.host) {
          log('⚠️ Botão "Atender" (#claim-ticket-button) não encontrado na tela.');
          break;
        }

        if (btnInfo.disabled) {
          if (countAtual !== null && countAtual <= 0) {
            log('🎉 Fila zerada!');
            break;
          }
          await sleep(250);
          continue;
        }

        const clickTarget = btnInfo.inner || btnInfo.host;
        dispararCliqueReal(clickTarget);
        if (btnInfo.host !== clickTarget) {
          dispararCliqueReal(btnInfo.host);
        }

        solicitados++;
        cntEl.textContent = solicitados;
        const countRest = obterContagemFila();
        const infoRest = countRest !== null ? ` | Fila: ${countRest}` : '';
        log(`📥 [${solicitados}] Atender clicado${infoRest}`);

        if (countRest !== null && countRest <= 0) {
          log('🎉 A contagem da fila chegou a 0! Finalizado.');
          break;
        }

        await sleep(500);
      }
    } catch (err) {
      log(`❌ Erro no atendimento automático: ${err.message}`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      atualizarBadgeFila();
      log(`🏁 Atendimento automático finalizado. Total solicitados: ${solicitados}.`);
    }
  }

  /* ========================================================
     PILOTO AUTOMÁTICO - PIPELINE VISUAL & LOOP CONTÍNUO
     ======================================================== */
  let pilotoCiclo = 0;

  function resetarStepper() {
    atualizarStepper(1, 'idle', 'Aguardando');
    atualizarStepper(2, 'idle', 'Pendente');
    atualizarStepper(3, 'idle', 'Pendente');
    atualizarStepper(4, 'idle', 'Pendente');
  }

  function atualizarStepper(stepNum, status, badgeText) {
    const stepEl = document.getElementById(`ba-step-${stepNum}`);
    const statusEl = document.getElementById(`ba-status-${stepNum}`);
    if (stepEl) stepEl.setAttribute('data-status', status);
    if (statusEl && badgeText) statusEl.textContent = badgeText;
  }

  async function pilotoEtapa1_PuxarFila() {
    atualizarStepper(1, 'active', 'Verificando fila...');
    log('📥 [Etapa 1/4] Verificando fila de atendimento...');

    let count = obterContagemFila();
    atualizarBadgeFila();

    // Se a fila já está zerada (0)
    if (count !== null && count <= 0) {
      const chatsAbertos = document.querySelectorAll('article.chat-list-item, button.ticket-info-options').length;
      if (chatsAbertos > 0) {
        log(`ℹ️ Fila zerada (0), porém há ${chatsAbertos} ticket(s) ativo(s) na tela. Prosseguindo...`);
        atualizarStepper(1, 'done', 'Fila zerada (0)');
        return true;
      }

      // Modo Sentinela se não há clientes
      atualizarStepper(1, 'waiting', '👁️ Sentinela: fila vazia');
      setSt('👁️ Sentinela', '#f59e0b');
      const loopDesc = document.getElementById('ba-loop-desc');
      if (loopDesc) loopDesc.textContent = '👁️ Fila zerada (0). Sentinela vigiando até surgir novo cliente (1+)...';
      log('👁️ [Sentinela] Fila zerada (0). Aguardando novo cliente na fila...');

      while (rodando) {
        if (!(await aguardarPausaSeNecessario())) return false;
        await sleep(1500);
        count = obterContagemFila();
        atualizarBadgeFila();
        if (count !== null && count > 0) {
          log(`🔔 [Sentinela] Detectado(s) ${count} cliente(s) na fila! Iniciando atendimento...`);
          setSt('Rodando', '#16a34a');
          if (loopDesc) loopDesc.textContent = `Ciclo #${pilotoCiclo} em andamento. Puxando ${count} cliente(s)...`;
          break;
        }
      }
      if (!rodando) return false;
    }

    atualizarStepper(1, 'active', `Puxando (${count ?? '...'})`);
    let solicitados = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const cAtual = obterContagemFila();
      atualizarBadgeFila();
      if (cAtual !== null && cAtual <= 0) {
        log('🎉 A contagem da fila chegou a 0!');
        break;
      }

      const btnInfo = obterBotaoAtender();
      if (!btnInfo || !btnInfo.host) {
        log('⚠️ Botão "Atender" (#claim-ticket-button) não localizado.');
        break;
      }

      if (btnInfo.disabled) {
        if (cAtual !== null && cAtual <= 0) break;
        await sleep(250);
        continue;
      }

      const target = btnInfo.inner || btnInfo.host;
      dispararCliqueReal(target);
      if (btnInfo.host !== target) dispararCliqueReal(btnInfo.host);

      solicitados++;
      cntEl.textContent = solicitados;
      atualizarStepper(1, 'active', `Puxando (Restam: ${cAtual !== null ? cAtual : '?'})`);
      log(`📥 [Atender #${solicitados}]${cAtual !== null ? ` Fila atual: ${cAtual}` : ''}`);

      const rest = obterContagemFila();
      if (rest !== null && rest <= 0) {
        log('🎉 A contagem da fila chegou a 0!');
        break;
      }

      await sleep(500);
    }

    atualizarStepper(1, 'done', 'Fila zerada (0)');
    log('⏳ Aguardando tickets renderizarem no painel...');
    await sleep(1600);
    return true;
  }

  async function pilotoEtapa2_EnviarMensagens() {
    const mensagem = (CONFIG.mensagem || pilotMsgEl?.value || msgEl?.value || '').trim();
    if (!mensagem) {
      log('ℹ️ Nenhuma mensagem definida no piloto. Avançando...');
      atualizarStepper(2, 'done', 'Sem mensagem');
      return true;
    }

    atualizarStepper(2, 'active', 'Carregando chats...');
    log('✉️ [Etapa 2/4] Enviando mensagem em todos os chats ativos...');

    const processados = new Set();
    let enviados = 0;
    let scrollContainer = obterScrollContainerGeral();
    let tentativasVazio = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const cards = [...document.querySelectorAll('article.chat-list-item')];
      if (cards.length === 0) {
        tentativasVazio++;
        if (tentativasVazio <= 3) {
          await sleep(800);
          continue;
        }
        log('ℹ️ Nenhum chat ativo encontrado para envio de mensagem.');
        break;
      }

      let alvo = null;
      let chave = '';
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const k = obterChaveElemento(c, i);
        if (!processados.has(k)) {
          alvo = c;
          chave = k;
          break;
        }
      }

      if (!alvo) break;

      processados.add(chave);
      tentativasVazio = 0;
      const nome = alvo.getAttribute('aria-label') || chave;
      atualizarStepper(2, 'active', `Enviando (${enviados + 1})`);

      rolarCardNoContainer(alvo, scrollContainer);
      await sleep(150);
      clickUnico(alvo);
      log(`👤 [${enviados + 1}] Chat selecionado: ${nome}`);
      await sleep(Math.max(800, CONFIG.delayTrocaTicket));

      if (!(await aguardarPausaSeNecessario())) return false;

      try {
        await enviarTextoNoChat(mensagem);
        enviados++;
        cntEl.textContent = enviados;
      } catch (err) {
        log(`⚠️ Não foi possível enviar texto para ${nome}: ${err.message}`);
        await fecharAvisosPendentes();
      }

      await sleep(CONFIG.delayAcoes);
    }

    atualizarStepper(2, 'done', `Enviados (${enviados})`);
    log(`✅ [Etapa 2/4 Concluída] Mensagens enviadas: ${enviados}.`);
    await sleep(600);
    return true;
  }

  async function pilotoEtapa3_PausarTodos() {
    atualizarStepper(3, 'active', 'Localizando tickets...');
    log('⏸️ [Etapa 3/4] Colocando todos os clientes em espera (standby)...');

    const processados = new Set();
    let pausados = 0;
    let jaPausados = 0;
    let scrollContainer = obterScrollContainerGeral();
    let tentativasVazio = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const botoes = [...document.querySelectorAll('button.ticket-info-options')];
      if (botoes.length === 0) {
        tentativasVazio++;
        if (tentativasVazio <= 3) {
          await sleep(800);
          continue;
        }
        log('ℹ️ Nenhum ticket encontrado para pausar.');
        break;
      }

      let alvo = null;
      let chave = '';
      for (let i = 0; i < botoes.length; i++) {
        const b = botoes[i];
        const k = obterChaveElemento(b, i);
        if (!processados.has(k)) {
          alvo = b;
          chave = k;
          break;
        }
      }

      if (!alvo) break;

      processados.add(chave);
      tentativasVazio = 0;

      const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
      const card = alvo.closest('article.chat-list-item, [class*="chat-list-item"], [class*="ticket"]') || wrap;
      const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;

      atualizarStepper(3, 'active', `Pausando (${pausados + 1})`);
      rolarCardNoContainer(card, scrollContainer);
      card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await sleep(120);

      clickUnico(alvo);

      const acaoEncontrada = await waitFor(() => {
        const t = encontrarOpcaoMenu(wrap, 'option-setStandbyMode');
        if (t) return { tipo: 'alvo', el: t };
        const o = encontrarOpcaoMenu(wrap, 'option-unsetStandbyMode');
        if (o) return { tipo: 'oposto', el: o };
        return null;
      }, 3500, 100);

      if (!(await aguardarPausaSeNecessario())) {
        await fecharMenuTicket(wrap, alvo);
        return false;
      }

      if (acaoEncontrada && acaoEncontrada.tipo === 'alvo') {
        const innerBtn = acaoEncontrada.el.shadowRoot?.querySelector('button.menuaction__button, button') || acaoEncontrada.el;
        await sleep(150);
        clickUnico(innerBtn);
        pausados++;
        cntEl.textContent = pausados;
        log(`⏸️ Ticket ${labelId} colocado em espera! (${pausados})`);
        await sleep(550);
        await fecharAvisosPendentes();
      } else {
        jaPausados++;
        log(`⏭️ Ticket ${labelId} já estava em espera.`);
        await fecharMenuTicket(wrap, alvo);
      }

      await sleep(CONFIG.delayAcoes);
    }

    atualizarStepper(3, 'done', `Pausados (${pausados})`);
    log(`✅ [Etapa 3/4 Concluída] ${pausados} ticket(s) pausado(s)${jaPausados ? `, ${jaPausados} já estavam pausados` : ''}.`);
    await sleep(600);
    return true;
  }

  async function pilotoEtapa4_MandarPraPasta() {
    const pasta = (CONFIG.pastaDestino || pilotFolderEl?.value || folderEl?.value || '').trim();
    if (!pasta) {
      log('⚠️ Nenhuma pasta configurada. Pulando movimentação...');
      atualizarStepper(4, 'done', 'Sem pasta');
      return true;
    }

    const alvoNorm = normalizarTexto(pasta);
    atualizarStepper(4, 'active', `Movendo → ${pasta}`);
    log(`📁 [Etapa 4/4] Movendo todos os tickets para a pasta "${pasta}"...`);

    let alterados = 0;
    let pulados = 0;
    const falhasSeguidas = new Map();
    let tentativasSemTickets = 0;

    while (rodando) {
      if (!(await aguardarPausaSeNecessario())) return false;

      const lista = [...document.querySelectorAll('button.ticket-info-options')];
      if (lista.length === 0) {
        tentativasSemTickets++;
        if (tentativasSemTickets <= 4) {
          log(`⏳ Carregando fila (${tentativasSemTickets}/4)...`);
          await rolarFila();
          await sleep(1200);
          continue;
        }
        log('🏁 Todos os tickets foram movidos para a pasta!');
        break;
      }

      let alvo = null;
      let chave = '';
      for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        const k = obterChaveElemento(item, i);
        const falhas = falhasSeguidas.get(k) || 0;
        if (falhas < 2) {
          alvo = item;
          chave = k;
          break;
        }
      }

      if (!alvo) {
        tentativasSemTickets++;
        if (tentativasSemTickets <= 3) {
          log(`⏳ Carregando tickets (${tentativasSemTickets}/3)...`);
          await rolarFila();
          await sleep(1400);
          continue;
        }
        log('🏁 Todos os tickets restantes foram movidos ou pulados.');
        break;
      }

      tentativasSemTickets = 0;
      const labelId = alvo.id ? `#${alvo.id.replace('menu-', '')}` : chave;

      try {
        const res = await processarMoverTicket(alvo, pasta, alvoNorm, labelId, alterados);
        if (res === 'alterado') {
          alterados++;
          cntEl.textContent = alterados;
          atualizarStepper(4, 'active', `Movidos: ${alterados}`);
          falhasSeguidas.delete(chave);
        } else {
          pulados++;
          const f = falhasSeguidas.get(chave) || 0;
          falhasSeguidas.set(chave, f + 1);
        }
      } catch (err) {
        log(`❌ Erro no ticket ${labelId}: ${err.message}`);
        pulados++;
        const f = falhasSeguidas.get(chave) || 0;
        falhasSeguidas.set(chave, f + 1);
        await fecharAvisosPendentes();
      }

      await sleep(CONFIG.delayAcoes);
    }

    atualizarStepper(4, 'done', `Movidos (${alterados})`);
    log(`✅ [Etapa 4/4 Concluída] ${alterados} ticket(s) movido(s) para "${pasta}"${pulados ? `, ${pulados} pulado(s)` : ''}.`);
    await sleep(600);
    return true;
  }

  async function executarPilotoLoop() {
    if (rodando) {
      rodando = false;
      pausado = false;
      log('⏹ Interrompendo piloto automático...');
      return;
    }

    const pasta = (CONFIG.pastaDestino || pilotFolderEl?.value || folderEl?.value || '').trim();
    if (!pasta) {
      log('⚠️ Digite o nome da pasta de destino antes de iniciar o Piloto.');
      if (pilotFolderEl) pilotFolderEl.focus();
      return;
    }
    CONFIG.pastaDestino = pasta;
    saveRecentFolder(pasta);

    const msg = (CONFIG.mensagem || pilotMsgEl?.value || msgEl?.value || '').trim();
    CONFIG.mensagem = msg;

    rodando = true;
    pausado = false;
    modoAtual = 'piloto';
    pilotoCiclo = 0;
    ativarWakeLock();
    atualizarBotoesEstado(true, '⚡ Piloto Contínuo');

    const loopCard = document.getElementById('ba-loop-card');
    if (loopCard) loopCard.classList.add('active');

    const loopDesc = document.getElementById('ba-loop-desc');

    log('🚀 PILOTO AUTOMÁTICO INICIADO EM LOOP CONTÍNUO!');
    log(`📂 Pasta Destino: "${pasta}" | ✉️ Mensagem: ${msg ? 'Ativa' : 'Desativada (apenas mover)'}`);

    try {
      while (rodando) {
        pilotoCiclo++;
        const cycleBadge = document.getElementById('ba-pilot-cycle-badge');
        if (cycleBadge) cycleBadge.textContent = `Ciclo: #${pilotoCiclo}`;
        if (loopDesc) loopDesc.textContent = `Ciclo #${pilotoCiclo} em andamento. Executando as 4 etapas...`;

        log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        log(`🔄 INICIANDO CICLO #${pilotoCiclo} DO PILOTO`);
        log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        resetarStepper();

        // 1. Puxar fila até zerar (sentinela se tiver 0)
        const ok1 = await pilotoEtapa1_PuxarFila();
        if (!ok1 || !rodando) break;

        // 2. Só enviar mensagem sem finalizar
        const ok2 = await pilotoEtapa2_EnviarMensagens();
        if (!ok2 || !rodando) break;

        // 3. Pausar todos os clientes
        const ok3 = await pilotoEtapa3_PausarTodos();
        if (!ok3 || !rodando) break;

        // 4. Mover todos para a pasta configurada
        const ok4 = await pilotoEtapa4_MandarPraPasta();
        if (!ok4 || !rodando) break;

        log(`🎉 Ciclo #${pilotoCiclo} concluído com sucesso!`);
        if (loopDesc) loopDesc.textContent = `Ciclo #${pilotoCiclo} concluído! Verificando fila para o próximo ciclo...`;
        await sleep(1000);
      }
    } catch (err) {
      log(`❌ Erro no loop do piloto: ${err.message}`);
    } finally {
      rodando = false;
      pausado = false;
      modoAtual = null;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      resetarStepper();

      if (loopCard) loopCard.classList.remove('active');
      if (loopDesc) loopDesc.textContent = 'Repete o fluxo. Se fila = 0, vigia até surgir 1 ou + clientes.';
      log(`🏁 Piloto automático parado. Total de ciclos: ${pilotoCiclo}.`);
    }
  }

  btnPilotStart.onclick = () => {
    if (!rodando && autoBloqueiaOutras()) return;
    executarPilotoLoop();
  };

  btnClaimAuto.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    executarAtendimentoAutomatico();
  };

  /* ========================================================
     RESPOSTA AUTOMÁTICA A NOVOS CHATS
     Detecta chats que chegam à lista depois da ativação, envia a mensagem
     configurada, confirma o envio pela interface e só então pausa (standby)
     o cliente. Um único worker processa a fila, um chat por vez.
     ======================================================== */
  const AUTO_MSG_KEY = 'rf_rodbot_auto_msg_v1';
  const AUTO_COUNT_KEY = 'rf_rodbot_auto_count_v1';
  const AUTO_TICKETS_KEY = 'rf_rodbot_auto_tickets_v1';
  const AUTO_TICKETS_TTL = 24 * 60 * 60 * 1000;
  const AUTO_TICKETS_MAX = 500;
  const AUTO_T = Object.assign({
    debounce: 250,        // agrupa mutações antes de reexaminar a fila
    reconciliar: 1500,    // revalida observers/elementos e reexamina a fila
    janelaFiltro: 3000,   // após interação com o filtro, ids novos são absorvidos sem contar
    janelaRolagem: 4000,  // após rolagem da lista (carregamento de itens antigos), idem
    chatAtivo: 6000,
    campo: 8000,
    confirmarEnvio: 8000,
    menu: 3500,
    verificarPausa: 3000,
    entreTickets: 600,
    espera: 1000
  }, (window.__rodBotAutoTimeouts && typeof window.__rodBotAutoTimeouts === 'object') ? window.__rodBotAutoTimeouts : {});

  // Seletores centralizados. Fila e contador: caminhos verificados na interface do Blip em 18/11/2026.
  // Menu do ticket, card, campo de texto e opções de espera: os mesmos já usados pelo restante do bookmarklet.
  const AUTO_SEL = {
    filaContainer: 'div#sidenav-div > div:nth-of-type(3) > div > div > div:nth-of-type(3) > div:nth-of-type(1) > div',
    // Área da lista inteira: busca, filtro "Todos", pastas (nv2, default...) e atendimentos (verificado 18/11/2026).
    // Obs.: no Blip, 'main > div > div' é a lista de pastas DENTRO da barra lateral, não o chat aberto.
    areaLista: 'div#sidenav-div > div:nth-of-type(3) > div > div',
    // Número do ticket no cabeçalho do chat aberto ("Ticket: #3148288"), verificado 18/11/2026.
    // O Blip repete esse id num drawer fora de #pane-chat-div, por isso o escopo.
    cabecalhoTicket: '#pane-chat-div [id="ticket-sequential-id"]',
    sidenav: '#sidenav-div',
    filtroDropdown: 'bds-dropdown#ticket-filter-dropdown',
    contadorChip: 'bds-dropdown#ticket-filter-dropdown > div > bds-chip-tag',
    menuTicket: 'button.ticket-info-options[id^="menu-"]',
    card: 'article.chat-list-item',
    campoTexto: '#text-input',
    opcaoPausar: 'option-setStandbyMode',
    opcaoDespausar: 'option-unsetStandbyMode'
  };
  const AUTO_ESTADOS = {
    pendente: '⏳ pendente', processando: '⚙️ processando', enviado: '✉️ enviado',
    pausado: '⏸️ pausado', falha: '❌ falha', falha_pausa: '⚠️ enviado, pausa pendente',
    suspenso: '✋ suspenso', descartado: '🗑️ descartado'
  };
  const AUTO_IGNORAR_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SVG', 'TEMPLATE', 'NOSCRIPT']);

  const autoMsgEl = document.getElementById('ba-auto-msg');
  const autoToggleBtn = document.getElementById('ba-auto-toggle');
  const autoStateEl = document.getElementById('ba-auto-state');
  const autoCountEl = document.getElementById('ba-auto-count');
  const autoNativeEl = document.getElementById('ba-auto-native');
  const autoQueueEl = document.getElementById('ba-auto-queue');
  const autoDetailEl = document.getElementById('ba-auto-detail');
  const autoListEl = document.getElementById('ba-auto-list');
  const autoResumeBtn = document.getElementById('ba-auto-resume');
  const autoRetryPauseBtn = document.getElementById('ba-auto-retry-pause');
  const autoResetBtn = document.getElementById('ba-auto-reset');
  const autoFillDefaultBtn = document.getElementById('ba-auto-fill-default');
  const autoPillEl = document.getElementById('ba-auto-pill');

  const auto = {
    ativo: false,
    destruido: false,
    gen: 0,                 // muda a cada ativação/desativação; invalida etapas pré-envio em curso
    baselinePronta: false,
    vistos: new Set(),      // identidades (id do ticket) já conhecidas: nunca voltam a ser "novas"
    registros: new Map(),   // id -> { id, estado, motivo, ts }
    fila: [],               // [{ id, soPausa }]
    atual: null,
    workerAtivo: false,
    suspensa: '',
    aguardando: '',
    supressaoAte: 0,
    motivoSupressao: '',
    assinaturaFiltro: null,
    ultimoNativo: null,
    mudancasNativo: 0,
    reconexoes: 0,
    avisoLeitura: '',
    ultimoErro: '',
    contador: 0,
    obs: { fila: null, chip: null, typo: null, filtro: null },
    alvos: { fila: null, chip: null, typo: null, filtro: null },
    timerScan: null,
    timerRecon: null
  };

  function autoLerContador() {
    try {
      const n = parseInt(localStorage.getItem(AUTO_COUNT_KEY) || '0', 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }
  function autoSalvarContador() {
    try { localStorage.setItem(AUTO_COUNT_KEY, String(auto.contador)); } catch {}
  }
  // Por ticket, só identidade e estado (nada do conteúdo das conversas).
  function autoLerTickets() {
    try {
      const o = JSON.parse(localStorage.getItem(AUTO_TICKETS_KEY) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  function autoGravarTicket(id, patch) {
    const agora = Date.now();
    const o = autoLerTickets();
    for (const k of Object.keys(o)) {
      if (!o[k] || agora - (o[k].ts || 0) > AUTO_TICKETS_TTL) delete o[k];
    }
    o[id] = { ...(o[id] || {}), ...patch, ts: agora };
    const chaves = Object.keys(o).sort((a, b) => (o[a].ts || 0) - (o[b].ts || 0));
    while (chaves.length > AUTO_TICKETS_MAX) delete o[chaves.shift()];
    try { localStorage.setItem(AUTO_TICKETS_KEY, JSON.stringify(o)); } catch {}
  }
  auto.contador = autoLerContador();

  function autoLerMensagem() {
    return (autoMsgEl?.value || '').trim();
  }
  function autoCampoTexto() {
    return document.querySelector(AUTO_SEL.campoTexto);
  }
  // Rascunho = texto no campo diferente da própria mensagem automática (que pode ter ficado
  // como rascunho do chat-alvo se o operador trocou de chat no meio do processamento).
  function autoTemRascunho(msg = autoLerMensagem()) {
    const c = autoCampoTexto();
    const v = c ? (c.value || '') : '';
    return !!v.trim() && v !== msg;
  }
  function autoBotaoMenu(id) {
    const b = document.getElementById('menu-' + id);
    return b && b.matches?.(AUTO_SEL.menuTicket) && !p.contains(b) ? b : null;
  }
  function autoCardDoTicket(btn) {
    return btn?.closest(AUTO_SEL.card) || btn?.closest('[class*="chat-list-item"]') || null;
  }
  function autoContemComposto(ancestral, no) {
    let n = no;
    while (n) {
      if (n === ancestral) return true;
      n = n.parentNode || n.host || null;
    }
    return false;
  }
  // Texto renderizado, atravessando Shadow Roots e slots (o <p> do bds-typo exibe o texto via <slot>).
  function autoTextoComposto(no, prof = 0) {
    if (!no || prof > 14) return '';
    if (no.nodeType === 3) return no.nodeValue || '';
    if (no.nodeType !== 1 && no.nodeType !== 11) return '';
    if (no.nodeType === 1 && no.tagName === 'SLOT') {
      const atribuidos = typeof no.assignedNodes === 'function' ? no.assignedNodes({ flatten: true }) : [];
      const fonte = atribuidos.length ? atribuidos : [...no.childNodes];
      return fonte.map(n => autoTextoComposto(n, prof + 1)).join('');
    }
    if (no.nodeType === 1 && no.shadowRoot) return autoTextoComposto(no.shadowRoot, prof + 1);
    return [...no.childNodes].map(n => autoTextoComposto(n, prof + 1)).join('');
  }

  // Resolução centralizada da fila e do contador nativo; qualquer peça ausente vira null.
  function autoResolverContador() {
    const chip = document.querySelector(AUTO_SEL.contadorChip);
    const chipRoot = chip?.shadowRoot || null;
    const typo = chipRoot?.querySelector('bds-typo') || null;
    const typoRoot = typo?.shadowRoot || null;
    const texto = typoRoot?.querySelector('p[part="bds-typo__text"]') || typoRoot?.querySelector('p') || null;
    const alternativo = chipRoot ? (chipRoot.querySelectorAll('div')[0] || null) : null;
    // No Blip o chip também tem um bds-typo no light DOM (slot); último recuo: texto renderizado do chip.
    const bruto = (autoTextoComposto(texto) || autoTextoComposto(typo) || autoTextoComposto(alternativo) ||
      autoTextoComposto(chip) || '').replace(/\s+/g, ' ').trim();
    const m = bruto.match(/\d+/);
    return { chip, chipRoot, typo, typoRoot, texto: bruto, numero: m ? parseInt(m[0], 10) : null };
  }
  function autoColetarTickets() {
    const container = document.querySelector(AUTO_SEL.filaContainer);
    let botoes = container ? [...container.querySelectorAll(AUTO_SEL.menuTicket)] : [];
    let origem = 'contêiner';
    if (!botoes.length) {
      const area = document.querySelector(AUTO_SEL.areaLista);
      const daArea = area ? [...area.querySelectorAll(AUTO_SEL.menuTicket)] : [];
      if (daArea.length) {
        botoes = daArea;
        origem = 'área da lista';
      }
    }
    if (!botoes.length) {
      const globais = [...document.querySelectorAll(AUTO_SEL.menuTicket)];
      if (globais.length) {
        botoes = globais;
        origem = container ? 'documento (contêiner sem tickets)' : 'documento (contêiner ausente)';
      }
    }
    const ids = [];
    const aqui = new Set();
    let duplicados = 0;
    for (const b of botoes) {
      if (p.contains(b)) continue;
      const id = (b.id || '').slice(5).trim();
      if (!id) continue;
      if (aqui.has(id)) { duplicados++; continue; }
      aqui.add(id);
      ids.push(id);
    }
    const cards = (container || document).querySelectorAll(AUTO_SEL.card).length;
    return { container, origem, ids, duplicados, semIdentidade: Math.max(0, cards - ids.length) };
  }
  function autoFiltroAberto() {
    const dd = document.querySelector(AUTO_SEL.filtroDropdown);
    return !!(dd && (dd.open === true || dd.hasAttribute('open') || dd.getAttribute('aria-expanded') === 'true'));
  }
  function autoAssinaturaFiltro(nat) {
    const dd = document.querySelector(AUTO_SEL.filtroDropdown);
    // Sem texto legível (Shadow Root ainda indisponível/substituído) a assinatura é desconhecida:
    // não compara, para o contador "aparecer" não ser confundido com troca de filtro.
    if (!dd || !nat.texto) return null;
    const attrs = el => el ? [...el.attributes]
      .filter(a => !/^(class|style|open|aria-expanded|data-open)$/i.test(a.name))
      .map(a => a.name + '=' + a.value).sort().join(',') : '';
    return [nat.texto, attrs(dd), attrs(nat.chip)].join('|').replace(/\d+/g, '#');
  }
  function autoSuprimir(ms, motivo) {
    const ate = Date.now() + ms;
    if (ate > auto.supressaoAte) {
      auto.supressaoAte = ate;
      auto.motivoSupressao = motivo;
    }
  }
  function autoMotivoAbsorcao() {
    if (autoFiltroAberto()) return 'filtro aberto';
    if (Date.now() < auto.supressaoAte) return auto.motivoSupressao;
    if (rodando && modoAtual !== 'claim') return 'outra automação do BM em execução';
    return '';
  }

  function autoReexaminar() {
    if (!auto.ativo || auto.destruido) return;
    try {
      const nat = autoResolverContador();
      if (nat.numero !== auto.ultimoNativo) {
        if (auto.ultimoNativo !== null && nat.numero !== null) auto.mudancasNativo++;
        auto.ultimoNativo = nat.numero;
      }
      const assinatura = autoAssinaturaFiltro(nat);
      if (assinatura !== null) {
        if (auto.assinaturaFiltro !== null && assinatura !== auto.assinaturaFiltro) autoSuprimir(AUTO_T.janelaFiltro, 'troca de filtro');
        auto.assinaturaFiltro = assinatura;
      }
      if (autoFiltroAberto()) autoSuprimir(AUTO_T.janelaFiltro, 'filtro aberto');

      const leitura = autoColetarTickets();
      auto.avisoLeitura = leitura.semIdentidade
        ? `${leitura.semIdentidade} chat(s) sem identidade estável (menu-<id>) não são monitorados.`
        : (leitura.origem !== 'contêiner' && leitura.ids.length ? `Lista lida pelo ${leitura.origem}.` : '');
      if (leitura.duplicados) {
        auto.ultimoErro = 'identidades duplicadas na lista; leitura ignorada';
        autoRender();
        return;
      }

      if (!auto.baselinePronta) {
        const vazioConfiavel = !!leitura.container && leitura.ids.length === 0 && leitura.semIdentidade === 0 && nat.numero === 0;
        if (leitura.ids.length || vazioConfiavel) {
          leitura.ids.forEach(id => auto.vistos.add(id));
          auto.baselinePronta = true;
          log(`📸 Estado inicial registrado: ${leitura.ids.length} chat(s) já presentes (não recebem mensagem).`);
          if (nat.numero !== null && nat.numero > leitura.ids.length) {
            log(`ℹ️ O Blip indica ${nat.numero} chat(s), ${leitura.ids.length} renderizado(s). Itens antigos carregados por rolagem são ignorados.`);
          }
        }
        autoRender();
        return;
      }

      const novos = leitura.ids.filter(id => !auto.vistos.has(id));
      if (!novos.length) {
        autoRender();
        return;
      }
      const motivo = autoMotivoAbsorcao();
      if (motivo) {
        novos.forEach(id => auto.vistos.add(id));
        log(`↪️ ${novos.length} chat(s) passaram a aparecer durante ${motivo}; registrados sem contar.`);
        autoRender();
        return;
      }
      const persistidos = autoLerTickets();
      for (const id of novos) {
        auto.vistos.add(id);
        const ant = persistidos[id];
        if (ant && ant.contado) {
          if (ant.envio === 'enviado' && !ant.pausado) {
            autoRegistrar(id, 'falha_pausa', 'mensagem enviada antes; pausa pendente');
          }
          continue;
        }
        auto.contador++;
        autoSalvarContador();
        autoGravarTicket(id, { contado: true });
        autoRegistrar(id, 'pendente', 'novo chat detectado');
        if (!auto.fila.some(it => it.id === id && !it.soPausa)) auto.fila.push({ id, soPausa: false });
        log(`🆕 Novo chat #${id} (total do BM: ${auto.contador}).`);
      }
      autoRender();
      autoAgendarWorker();
    } catch (err) {
      auto.ultimoErro = `leitura da fila: ${err.message}`;
      autoRender();
    }
  }
  function autoAgendarScan() {
    if (!auto.ativo || auto.destruido || auto.timerScan) return;
    auto.timerScan = setTimeout(() => {
      auto.timerScan = null;
      autoReexaminar();
    }, AUTO_T.debounce);
  }

  // Observers: fila (light DOM) + dois Shadow Roots do contador + atributos do filtro.
  // Um observer no document não atravessa Shadow DOM, por isso cada raiz é observada.
  function autoConectar(nome, alvo, opcoes) {
    const atual = auto.alvos[nome];
    if (atual === alvo && auto.obs[nome] && (!alvo || alvo.isConnected !== false)) return;
    if (auto.obs[nome]) {
      auto.obs[nome].disconnect();
      auto.obs[nome] = null;
    }
    if (atual && alvo && atual !== alvo) auto.reconexoes++;
    auto.alvos[nome] = alvo || null;
    if (!alvo) return;
    const mo = new MutationObserver(() => autoAgendarScan());
    mo.observe(alvo, opcoes);
    auto.obs[nome] = mo;
    autoAgendarScan();
  }
  function autoGarantirObservers() {
    if (!auto.ativo || auto.destruido) return;
    // Observa a área inteira da lista (inclui o conteúdo das pastas), com recuos se ela não existir.
    const alvoFila = document.querySelector(AUTO_SEL.areaLista) || document.querySelector(AUTO_SEL.filaContainer) ||
      document.querySelector(AUTO_SEL.sidenav) || document.body;
    autoConectar('fila', alvoFila, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] });
    const nat = autoResolverContador();
    autoConectar('chip', nat.chipRoot, { childList: true, subtree: true, characterData: true, attributes: true });
    autoConectar('typo', nat.typoRoot, { childList: true, subtree: true, characterData: true });
    autoConectar('filtro', document.querySelector(AUTO_SEL.filtroDropdown), { attributes: true });
  }
  function autoDesconectarObservers() {
    for (const k of Object.keys(auto.obs)) {
      auto.obs[k]?.disconnect();
      auto.obs[k] = null;
      auto.alvos[k] = null;
    }
  }

  function autoOnInteracao(e) {
    if (!auto.ativo) return;
    const caminho = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const dd = document.querySelector(AUTO_SEL.filtroDropdown);
    if (dd && (caminho.includes(dd) || (e.target?.nodeType === 1 && dd.contains(e.target)))) {
      autoSuprimir(AUTO_T.janelaFiltro, 'troca de filtro');
      autoAgendarScan();
      return;
    }
    // Expandir/recolher pastas ou buscar na lista revela chats antigos: não são recebimentos.
    // Cliques em um card de chat (abrir, menu de 3 pontos) não entram aqui.
    const area = document.querySelector(AUTO_SEL.areaLista);
    if (area && caminho.includes(area) && !caminho.some(n => n.nodeType === 1 && n.matches?.(AUTO_SEL.card))) {
      autoSuprimir(AUTO_T.janelaRolagem, 'uso de pastas/busca da lista');
      autoAgendarScan();
    }
  }
  function autoOnRolagem(e) {
    if (!auto.ativo) return;
    const alvo = e.target;
    if (!alvo || alvo.nodeType !== 1) return;
    const lista = document.querySelector(AUTO_SEL.filaContainer);
    const sidenav = document.querySelector(AUTO_SEL.sidenav);
    if ((lista && (alvo === lista || alvo.contains(lista) || lista.contains(alvo))) || (sidenav && sidenav.contains(alvo))) {
      autoSuprimir(AUTO_T.janelaRolagem, 'rolagem da lista');
    }
  }
  const AUTO_EVENTOS = [
    ['pointerdown', autoOnInteracao, true],
    ['click', autoOnInteracao, true],
    ['keydown', autoOnInteracao, true],
    ['scroll', autoOnRolagem, true],
    ['wheel', autoOnRolagem, { capture: true, passive: true }]
  ];

  // Contagem de ocorrências de um texto no DOM visível, atravessando Shadow Roots.
  // Conta só o elemento mais profundo que contém o texto; tags de formulário/script são ignoradas.
  function autoSemEspaco(s) {
    return (s || '').replace(/\s+/g, '');
  }
  function autoRaizesTexto(base = document.body) {
    const raizes = base ? [base] : [];
    for (let i = 0; i < raizes.length && raizes.length < 4000; i++) {
      for (const el of raizes[i].querySelectorAll('*')) {
        if (el.shadowRoot) raizes.push(el.shadowRoot);
      }
    }
    return raizes;
  }
  function autoVarrer(no, teste, pular) {
    let n = 0, texto = '';
    for (const filho of no.childNodes) {
      if (filho.nodeType === 3) { texto += filho.nodeValue; continue; }
      if (filho.nodeType !== 1) continue;
      if (AUTO_IGNORAR_TAGS.has(filho.tagName.toUpperCase()) || (pular && pular(filho))) continue;
      const bruto = filho.textContent || '';
      if (!teste(bruto)) { texto += bruto; continue; }
      const r = autoVarrer(filho, teste, pular);
      n += r.n;
      texto += r.texto;
    }
    if (!n && teste(texto)) n = 1;
    return { n, texto };
  }
  function autoContarTexto(teste, pular, base) {
    let total = 0;
    for (const raiz of autoRaizesTexto(base)) {
      if (pular && raiz.host && pular(raiz.host)) continue;
      if (!teste(raiz.textContent || '')) continue;
      total += autoVarrer(raiz, teste, pular).n;
    }
    return total;
  }
  function autoContarOcorrencias(msg) {
    const chave = autoSemEspaco(msg).slice(0, 120);
    if (!chave) return 0;
    return autoContarTexto(t => autoSemEspaco(t).includes(chave));
  }

  // Evidência de que o chat aberto é o do ticket: URL, card marcado como selecionado
  // (único na lista) ou o número do ticket exibido fora da lista lateral.
  function autoCardMarcado(card) {
    if (card.getAttribute('aria-selected') === 'true') return true;
    const cur = card.getAttribute('aria-current');
    if (cur && cur !== 'false') return true;
    return [...card.classList].some(c => /(^|[-_])(active|selected|current)$/i.test(c));
  }
  // Painel do chat aberto = maior ancestral do #text-input que não contém a lista lateral.
  // Avisos/toasts globais ficam fora dele; o cabeçalho do chat aberto fica dentro.
  function autoRaizPainelChat() {
    // No Blip o campo fica em #pane-chat-div; a raiz sobe até antes de incluir a barra lateral.
    const campo = autoCampoTexto();
    const lateral = document.querySelector(AUTO_SEL.sidenav) || document.querySelector(AUTO_SEL.filaContainer);
    if (!campo || !lateral) return null;
    let raiz = null;
    for (let n = campo; n && n !== document.body && n !== document.documentElement; n = n.parentNode || n.host) {
      if (n.nodeType === 1) {
        if (autoContemComposto(n, lateral)) break;
        raiz = n;
      }
    }
    return raiz;
  }
  // Quantas vezes o número do ticket aparece no painel do chat aberto (inclui Shadow Roots).
  function autoContarIdPainel(id) {
    const raiz = autoRaizPainelChat();
    if (!raiz) return 0;
    const esc = escapeRegExp(id);
    const re = id.length >= 6
      ? new RegExp('(^|[^0-9A-Za-z])#?' + esc + '($|[^0-9A-Za-z])')
      : new RegExp('#' + esc + '($|[^0-9A-Za-z])');
    return autoContarTexto(t => re.test(t), null, raiz);
  }
  // Números de ticket exibidos no cabeçalho do chat aberto; null = cabeçalho ausente/ilegível.
  function autoTicketsNoCabecalho() {
    const nums = [];
    for (const el of document.querySelectorAll(AUTO_SEL.cabecalhoTicket)) {
      if (!isElementoVisivel(el)) continue;
      nums.push(...(autoTextoComposto(el).match(/\d+/g) || []));
    }
    return nums.length ? nums : null;
  }
  function autoIndicioChatAtivo(id) {
    // Indício principal e decisivo: se o cabeçalho mostra outro ticket, não é este chat,
    // mesmo que o número apareça em outro lugar (ex.: histórico do mesmo cliente).
    const cabecalho = autoTicketsNoCabecalho();
    if (cabecalho) return cabecalho.includes(id) ? 'cabeçalho' : null;
    try {
      if (new RegExp('[/=]' + escapeRegExp(id) + '($|[/?&#])').test(decodeURIComponent(location.href))) return 'url';
    } catch {}
    const btn = autoBotaoMenu(id);
    const card = autoCardDoTicket(btn);
    if (card && autoCardMarcado(card)) {
      const marcados = [...document.querySelectorAll(AUTO_SEL.card)].filter(autoCardMarcado);
      if (marcados.length === 1) return 'card';
    }
    return autoContarIdPainel(id) > 0 ? 'painel' : null;
  }

  function autoRegistrar(id, estado, motivo = '') {
    const r = auto.registros.get(id) || { id };
    r.estado = estado;
    r.motivo = motivo;
    r.ts = Date.now();
    auto.registros.delete(id);
    auto.registros.set(id, r);
    while (auto.registros.size > 200) {
      const antigo = auto.registros.keys().next().value;
      if (auto.atual && auto.atual.id === antigo) break;
      auto.registros.delete(antigo);
    }
    if (estado === 'falha' || estado === 'falha_pausa' || estado === 'suspenso') {
      auto.ultimoErro = `#${id}: ${motivo}`;
      log(`⚠️ Chat #${id}: ${motivo}`);
    } else if (estado === 'pausado' && auto.ultimoErro.startsWith(`#${id}:`)) {
      auto.ultimoErro = ''; // o mesmo ticket foi concluído depois da falha
    }
    autoRender();
  }
  function autoSuspender(motivo) {
    if (auto.suspensa) return;
    auto.suspensa = motivo;
    log(`✋ Resposta automática suspensa — ${motivo}.`);
    autoRender();
  }
  function autoInterromper(id, motivo) {
    autoRegistrar(id, 'suspenso', motivo);
    autoSuspender(`chat #${id}: ${motivo}`);
  }
  function autoSetAguardando(t) {
    if (auto.aguardando === t) return;
    auto.aguardando = t;
    autoRender();
  }
  function autoLimparSeNosso(input, msg) {
    try {
      if (!input || input.value !== msg) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter && input instanceof HTMLTextAreaElement) setter.call(input, '');
      else input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {}
  }

  // Envio confirmado = campo esvaziado E nova ocorrência do texto na conversa.
  // Texto ainda no campo sem nova ocorrência = não enviado. Qualquer outra combinação = ambíguo.
  async function autoConfirmarEnvio(input, msg, antes) {
    const fim = Date.now() + AUTO_T.confirmarEnvio;
    let apareceu = false;
    while (Date.now() < fim && !auto.destruido) {
      await sleep(250);
      const campo = autoCampoTexto();
      const limpo = !!campo && !(campo.value || '').trim();
      apareceu = autoContarOcorrencias(msg) > antes;
      if (limpo && apareceu) return 'confirmado';
    }
    if (auto.destruido) return 'interrompido'; // painel fechado: estado fica "enviando" (nunca reenvia)
    const campo = autoCampoTexto();
    if (!apareceu && campo === input && input.value === msg) return 'nao_enviado';
    return 'ambiguo';
  }

  async function autoProcessarTicket(id) {
    const gen = auto.gen;
    const vivo = () => auto.ativo && gen === auto.gen && !auto.destruido;
    const msg = autoLerMensagem(); // lida da configuração no início de cada atendimento
    const anterior = autoLerTickets()[id];
    if (anterior && anterior.envio) {
      if (anterior.envio === 'enviado' && !anterior.pausado) {
        autoRegistrar(id, 'enviado', 'mensagem já enviada antes; somente pausando');
        await autoPausar(id);
      } else {
        autoRegistrar(id, anterior.pausado ? 'pausado' : 'falha', 'já processado antes; nada reenviado');
      }
      return;
    }
    if (!msg) {
      autoRegistrar(id, 'suspenso', 'mensagem automática vazia');
      autoSuspender('a mensagem automática está vazia');
      return;
    }
    autoRegistrar(id, 'processando', 'abrindo o chat');
    const btn = await waitFor(() => autoBotaoMenu(id), 4000, 200).catch(() => null);
    if (!btn) return autoRegistrar(id, 'falha', 'o ticket saiu da lista; nada enviado');
    const card = autoCardDoTicket(btn);
    if (!card) return autoRegistrar(id, 'falha', 'card do ticket não encontrado; nada enviado');
    if (!vivo()) return autoRegistrar(id, 'descartado', 'automação desativada antes do envio');
    if (autoTemRascunho(msg)) return autoInterromper(id, 'há texto digitado no chat aberto; nada foi trocado');

    clickUnico(card);
    const indicio = await waitFor(() => autoIndicioChatAtivo(id), AUTO_T.chatAtivo, 200).catch(() => null);
    if (!indicio) return autoInterromper(id, 'não foi possível confirmar que o chat aberto é deste ticket; nada enviado');
    if (!vivo()) return autoRegistrar(id, 'descartado', 'automação desativada antes do envio');

    const input = await waitFor(() => {
      const el = autoCampoTexto();
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    }, AUTO_T.campo, 200).catch(() => null);
    if (!input) return autoRegistrar(id, 'falha', 'campo de mensagem indisponível; nada enviado');
    if (autoTemRascunho(msg)) return autoInterromper(id, 'o chat do cliente tem um rascunho; o texto não foi alterado');
    if (autoIndicioChatAtivo(id) === null) return autoInterromper(id, 'o chat aberto mudou antes do preenchimento');

    if (input.value !== msg) {
      autoRegistrar(id, 'processando', 'preenchendo a mensagem');
      await preencherCampoMensagem(input, msg);
    }

    // Reverificação imediatamente antes do envio.
    if (!vivo()) {
      autoLimparSeNosso(input, msg);
      return autoRegistrar(id, 'descartado', 'automação desativada antes do envio');
    }
    if (autoCampoTexto() !== input || autoIndicioChatAtivo(id) === null) {
      autoLimparSeNosso(input, msg);
      return autoInterromper(id, 'o chat aberto mudou durante o processamento; nada enviado');
    }
    if (input.value !== msg) return autoInterromper(id, 'o texto do campo foi alterado manualmente; nada enviado');

    const antes = autoContarOcorrencias(msg);
    autoGravarTicket(id, { envio: 'enviando' }); // a partir daqui o ticket nunca recebe reenvio automático
    autoRegistrar(id, 'processando', 'enviando');
    dispararEnvioEnter(input);
    const resultado = await autoConfirmarEnvio(input, msg, antes);
    if (resultado === 'interrompido') return;
    if (resultado !== 'confirmado') {
      autoLimparSeNosso(input, msg);
      autoGravarTicket(id, { envio: resultado });
      return autoRegistrar(id, 'falha', resultado === 'nao_enviado'
        ? 'o envio não ocorreu (texto permaneceu no campo); cliente não pausado'
        : 'envio sem confirmação na interface; cliente não pausado e sem reenvio automático');
    }
    autoGravarTicket(id, { envio: 'enviado' });
    autoRegistrar(id, 'enviado', 'envio confirmado; pausando');
    log(`✉️ Chat #${id}: mensagem enviada e confirmada.`);
    await autoPausar(id);
  }

  // Pausa pelo mesmo caminho já usado em "Pausar todos": menu do ticket → option-setStandbyMode.
  async function autoTentarPausa(id) {
    const alvo = autoBotaoMenu(id);
    if (!alvo) return { ok: false, motivo: 'ticket não encontrado na lista' };
    const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
    const card = autoCardDoTicket(alvo) || wrap;
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(120);
    clickUnico(alvo);
    const acao = await waitFor(() => {
      const t = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar);
      if (t) return { tipo: 'alvo', el: t };
      const o = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar);
      if (o) return { tipo: 'oposto', el: o };
      return null;
    }, AUTO_T.menu, 100).catch(() => null);
    if (!acao) {
      await fecharMenuTicket(wrap, alvo);
      return { ok: false, motivo: 'opção de espera não apareceu no menu' };
    }
    if (acao.tipo === 'oposto') {
      await fecharMenuTicket(wrap, alvo);
      return { ok: true, nota: 'já estava em espera' };
    }
    const innerBtn = acao.el.shadowRoot?.querySelector('button.menuaction__button, button') || acao.el;
    await sleep(150);
    clickUnico(innerBtn);
    await sleep(550);
    await fecharAvisosPendentes();
    const verif = await autoVerificarPausa(id);
    if (verif === 'confirmado') return { ok: true, nota: '' };
    if (verif === 'sumiu') return { ok: true, nota: 'saiu da lista após a pausa (não verificável)' };
    return { ok: false, motivo: 'a pausa não foi confirmada no menu do ticket' };
  }
  async function autoVerificarPausa(id) {
    const fim = Date.now() + AUTO_T.verificarPausa;
    while (Date.now() < fim && !auto.destruido) {
      const alvo = autoBotaoMenu(id);
      if (!alvo) return 'sumiu';
      const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
      if (!menuEstaAberto(wrap)) clickUnico(alvo);
      const acao = await waitFor(() => {
        if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar)) return 'oposto';
        if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar)) return 'alvo';
        return null;
      }, 1500, 100).catch(() => null);
      await fecharMenuTicket(wrap, alvo);
      if (acao === 'oposto') return 'confirmado';
      await sleep(400);
    }
    return 'nao_confirmado';
  }
  async function autoPausar(id) {
    let motivo = '';
    for (let tentativa = 1; tentativa <= 2 && !auto.destruido; tentativa++) {
      autoRegistrar(id, 'enviado', tentativa === 1 ? 'pausando' : 'pausando (nova tentativa)');
      const r = await autoTentarPausa(id).catch(err => ({ ok: false, motivo: err.message }));
      if (r.ok) {
        autoGravarTicket(id, { pausado: true });
        autoRegistrar(id, 'pausado', r.nota);
        log(`⏸️ Chat #${id} pausado${r.nota ? ` (${r.nota})` : ''}.`);
        return true;
      }
      motivo = r.motivo;
      await sleep(700);
    }
    autoRegistrar(id, 'falha_pausa', `mensagem enviada; pausa falhou (${motivo}). Use "Repetir pausas pendentes"`);
    return false;
  }

  function autoAgendarWorker() {
    if (!auto.workerAtivo && !auto.destruido && auto.fila.length) autoWorker();
  }
  async function autoWorker() {
    if (auto.workerAtivo || auto.destruido) return;
    auto.workerAtivo = true;
    try {
      while (!auto.destruido && auto.fila.length) {
        const prox = auto.fila[0];
        if (!prox.soPausa) {
          if (!auto.ativo) { auto.fila.shift(); continue; }
          if (auto.suspensa) break;
        }
        if (rodando) {
          autoSetAguardando('outra automação do BM em execução');
          await sleep(AUTO_T.espera);
          continue;
        }
        if (!prox.soPausa) {
          if (autoTemRascunho()) {
            autoSetAguardando('há texto digitado no chat aberto (rascunho do operador)');
            await sleep(AUTO_T.espera);
            continue;
          }
          if (!autoLerMensagem()) {
            autoSuspender('a mensagem automática está vazia');
            break;
          }
        }
        auto.fila.shift();
        auto.atual = prox; // definido de forma síncrona: bloqueia o início de outras automações
        auto.aguardando = '';
        autoRender();
        try {
          if (prox.soPausa) await autoPausar(prox.id);
          else await autoProcessarTicket(prox.id);
        } catch (err) {
          autoRegistrar(prox.id, 'falha', `erro inesperado: ${err.message}`);
        } finally {
          auto.atual = null;
          autoRender();
        }
        await sleep(AUTO_T.entreTickets);
      }
    } finally {
      auto.workerAtivo = false;
      auto.aguardando = '';
      autoRender();
    }
  }

  function autoAtivar() {
    if (auto.ativo || auto.destruido) return;
    if (!autoLerMensagem()) {
      log('⚠️ Digite a mensagem automática antes de ativar.');
      autoMsgEl?.focus();
      autoRender();
      return;
    }
    auto.ativo = true;
    auto.gen++;
    auto.baselinePronta = false;
    auto.suspensa = '';
    auto.aguardando = '';
    auto.ultimoErro = '';
    auto.assinaturaFiltro = null;
    auto.supressaoAte = 0;
    for (const [tipo, fn, opt] of AUTO_EVENTOS) document.addEventListener(tipo, fn, opt);
    autoGarantirObservers();
    auto.timerRecon = setInterval(() => {
      autoGarantirObservers();
      autoReexaminar();
    }, AUTO_T.reconciliar);
    log('▶ Resposta automática ativada. Registrando os chats atuais...');
    autoReexaminar();
    autoRender();
  }
  function autoDesativar() {
    if (!auto.ativo) return;
    auto.ativo = false;
    auto.gen++;
    for (const [tipo, fn, opt] of AUTO_EVENTOS) document.removeEventListener(tipo, fn, opt);
    clearInterval(auto.timerRecon);
    auto.timerRecon = null;
    clearTimeout(auto.timerScan);
    auto.timerScan = null;
    autoDesconectarObservers();
    const descartados = auto.fila.filter(it => !it.soPausa);
    auto.fila = auto.fila.filter(it => it.soPausa);
    descartados.forEach(it => autoRegistrar(it.id, 'descartado', 'automação desativada antes do envio'));
    for (const r of auto.registros.values()) {
      if (r.estado === 'suspenso') { r.estado = 'descartado'; r.motivo = 'automação desativada'; }
    }
    auto.suspensa = '';
    auto.aguardando = '';
    log(`⏹ Resposta automática desativada. ${descartados.length} pendente(s) descartado(s).`);
    if (auto.atual && !auto.atual.soPausa) {
      log(`ℹ️ Chat #${auto.atual.id} em andamento: se a mensagem já saiu, a pausa será concluída; senão, nada será enviado.`);
    }
    autoRender();
  }
  function autoRetomar() {
    if (!auto.suspensa) return;
    auto.suspensa = '';
    const persistidos = autoLerTickets();
    const voltar = [...auto.registros.values()]
      .filter(r => r.estado === 'suspenso' && !(persistidos[r.id] && persistidos[r.id].envio))
      .map(r => r.id)
      .filter(id => !auto.fila.some(it => it.id === id && !it.soPausa));
    voltar.reverse().forEach(id => {
      auto.fila.unshift({ id, soPausa: false });
      autoRegistrar(id, 'pendente', 'retomado');
    });
    log(`▶ Resposta automática retomada${voltar.length ? ` (${voltar.length} chat(s) de volta à fila)` : ''}.`);
    autoRender();
    autoAgendarWorker();
  }
  function autoRepetirPausas() {
    const ids = [...auto.registros.values()].filter(r => r.estado === 'falha_pausa').map(r => r.id);
    let n = 0;
    for (const id of ids) {
      if (auto.fila.some(it => it.id === id && it.soPausa) || (auto.atual && auto.atual.id === id)) continue;
      auto.fila.unshift({ id, soPausa: true });
      n++;
    }
    log(`⏸️ Repetindo a pausa de ${n} chat(s); nenhuma mensagem será reenviada.`);
    autoRender();
    autoAgendarWorker();
  }
  function autoBloqueiaOutras() {
    if (!auto.atual) return false;
    log(`⚠️ Aguarde: a resposta automática está processando o chat #${auto.atual.id}.`);
    return true;
  }

  function autoRender() {
    if (auto.destruido || !autoStateEl) return;
    const pendentes = auto.fila.filter(it => !it.soPausa).length + (auto.atual && !auto.atual.soPausa ? 1 : 0);
    autoCountEl.textContent = String(auto.contador);
    autoQueueEl.textContent = String(pendentes);
    autoNativeEl.textContent = auto.ultimoNativo === null ? '--' : String(auto.ultimoNativo);
    let tom = 'off', rotulo = 'Desativada';
    let detalhe = 'Desativada. Ao ativar, os chats atuais são registrados e só os próximos recebem a mensagem.';
    if (auto.ativo) {
      tom = 'on';
      rotulo = 'Ativa';
      detalhe = auto.atual ? `Processando o chat #${auto.atual.id}…` : 'Vigiando a fila de chats…';
      if (!auto.baselinePronta) {
        tom = 'wait';
        rotulo = 'Iniciando';
        detalhe = 'Aguardando a lista de chats carregar para registrar o estado inicial…';
      }
      if (auto.aguardando) {
        tom = 'wait';
        rotulo = 'Aguardando';
        detalhe = `Aguardando: ${auto.aguardando}.`;
      }
      if (auto.suspensa) {
        tom = 'err';
        rotulo = 'Suspensa';
        detalhe = `Suspensa — ${auto.suspensa}. Resolva e clique em Retomar.`;
      }
      if (auto.avisoLeitura) detalhe += ` ${auto.avisoLeitura}`;
    } else if (auto.atual) {
      detalhe = `Concluindo o chat #${auto.atual.id}…`;
    }
    if (auto.ultimoErro && tom !== 'err') detalhe += ` Última falha: ${auto.ultimoErro}.`;
    autoStateEl.textContent = rotulo;
    autoStateEl.setAttribute('data-tone', tom);
    autoDetailEl.textContent = detalhe;
    autoDetailEl.setAttribute('data-tone', tom === 'err' || (auto.ultimoErro && auto.ativo) ? 'err' : tom === 'wait' ? 'wait' : '');

    autoToggleBtn.textContent = auto.ativo ? '⏹ Desativar resposta automática' : '▶ Ativar resposta automática';
    autoToggleBtn.style.background = auto.ativo ? '#ef4444' : '';
    autoToggleBtn.style.color = auto.ativo ? '#ffffff' : '';
    autoResumeBtn.style.display = auto.suspensa ? '' : 'none';
    const temPausaPendente = [...auto.registros.values()].some(r => r.estado === 'falha_pausa');
    autoRetryPauseBtn.style.display = temPausaPendente ? '' : 'none';

    autoPillEl.style.display = auto.ativo ? 'inline-block' : 'none';
    autoPillEl.textContent = `${auto.suspensa ? '✋' : '💬'} ${auto.contador}`;

    const recentes = [...auto.registros.values()].slice(-6).reverse();
    autoListEl.replaceChildren(...recentes.map(r => {
      const linha = document.createElement('div');
      linha.textContent = `#${r.id} · ${AUTO_ESTADOS[r.estado] || r.estado}${r.motivo ? ` · ${r.motivo}` : ''}`;
      return linha;
    }));
  }

  function autoDestruir() {
    autoDesativar();
    auto.destruido = true;
    auto.fila = [];
    if (window.__rodBotAuto && window.__rodBotAuto.instancia === auto) delete window.__rodBotAuto;
  }

  if (autoMsgEl) {
    let salva = '';
    try { salva = localStorage.getItem(AUTO_MSG_KEY) || ''; } catch {}
    bindPanelInput(autoMsgEl, salva, val => {
      try { localStorage.setItem(AUTO_MSG_KEY, val); } catch {}
      if (!val.trim() && auto.ativo) autoRender();
    });
  }
  autoFillDefaultBtn.onclick = () => {
    autoMsgEl.value = MENSAGEM_PADRAO;
    autoMsgEl.dispatchEvent(new Event('input', { bubbles: true }));
    log('📋 Mensagem padrão carregada na resposta automática.');
  };
  autoToggleBtn.onclick = () => (auto.ativo ? autoDesativar() : autoAtivar());
  autoResumeBtn.onclick = () => autoRetomar();
  autoRetryPauseBtn.onclick = () => autoRepetirPausas();
  autoResetBtn.onclick = () => {
    auto.contador = 0;
    autoSalvarContador();
    log('🧹 Contador de novos chats zerado.');
    autoRender();
  };
  for (const [id, r] of Object.entries(autoLerTickets())) {
    if (r && r.envio === 'enviado' && !r.pausado) {
      auto.registros.set(id, { id, estado: 'falha_pausa', motivo: 'mensagem enviada em execução anterior; pausa pendente', ts: r.ts || 0 });
    }
  }
  window.__rodBotAuto = {
    instancia: auto,
    snapshot: () => ({
      ativo: auto.ativo, baselinePronta: auto.baselinePronta, contador: auto.contador,
      fila: auto.fila.map(it => (it.soPausa ? 'pausa:' : '') + it.id), atual: auto.atual ? auto.atual.id : null,
      suspensa: auto.suspensa, aguardando: auto.aguardando, ultimoNativo: auto.ultimoNativo,
      mudancasNativo: auto.mudancasNativo, reconexoes: auto.reconexoes, ultimoErro: auto.ultimoErro,
      observers: Object.keys(auto.obs).filter(k => auto.obs[k]), vistos: [...auto.vistos],
      registros: [...auto.registros.values()].map(r => ({ ...r }))
    })
  };
  autoRender();

  /* ========================================================
     TRANSFERÊNCIA EM MASSA PARA ATENDENTE
     Sempre o PRIMEIRO ticket da lista atual: abre, transfere pelo modal do Blip,
     confirma uma única vez e só conta quando o ticket sai da lista.
     ======================================================== */
  const TRANSF_T = Object.assign({
    abrir: 8000,       // chat do ticket carregar / botão de transferência aparecer
    modal: 8000,       // modal e campo de atendente aparecerem
    opcoes: 10000,     // resultados da pesquisa do Blip
    confirmar: 8000,   // botão "Transferir ticket" habilitar
    resultado: 20000,  // ticket sair da lista após a confirmação
    esperaModal: 3000, // espera mínima após o campo "Selecionar atendente" aparecer
    pronto: 6000,      // lista de atendentes carregar antes de digitar (não fatal)
    filtro: 5000,      // 1ª digitação: pesquisa ser aplicada pelo Blip
    leituraVazia: 800, // intervalo entre leituras da lista vazia
    carregando: 20000  // lista vazia com contador > 0 (carregamento)
  }, (window.__rodBotTransfTimeouts && typeof window.__rodBotTransfTimeouts === 'object') ? window.__rodBotTransfTimeouts : {});
  // Seletores fornecidos a partir do Blip real (18/11/2026).
  const TRANSF_SEL = {
    botaoTransferir: 'bds-button-icon[icon="transfer"][variant="secondary"]',
    radioAtendente: 'bds-radio[label="Atendente"]',
    autocomplete: 'bds-autocomplete#autocompleteAttendant',
    opcao: 'bds-select-option',
    confirmar: 'bds-button#confirm-transfer-btn'
  };
  const transfNomeEl = document.getElementById('ba-transfer-name');
  const transfStatusEl = document.getElementById('ba-transfer-status');
  const btnTransfer = document.getElementById('ba-transfer-start');
  let painelFechado = false;
  class TransfInterrompido extends Error {}
  class TransfSuspenso extends Error {}

  function tNorm(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function tDesabilitado(el) {
    return !el || el.disabled === true || el.hasAttribute?.('disabled') || el.getAttribute?.('aria-disabled') === 'true';
  }
  function tVisivel(el) {
    return !!el && el.isConnected && isElementoVisivel(el);
  }
  function tStatus(texto, tom = '') {
    transfStatusEl.textContent = texto;
    transfStatusEl.setAttribute('data-tone', tom);
  }
  // Espera por condição; o tempo pausado não conta. Antes da confirmação, "Parar" interrompe a espera.
  async function tEsperar(fn, timeout, paravel = true) {
    let fim = Date.now() + timeout;
    for (;;) {
      if (painelFechado) throw new TransfInterrompido('painel fechado');
      if (paravel && !rodando) throw new TransfInterrompido('parado pelo usuário');
      let r = null;
      try { r = fn(); } catch {}
      if (r) return r;
      if (pausado && rodando) fim += 150;
      else if (Date.now() > fim) return null;
      await sleep(150);
    }
  }
  async function tAntesDeClicar() {
    if (!(await aguardarPausaSeNecessario()) || painelFechado) {
      throw new TransfInterrompido(painelFechado ? 'painel fechado' : 'parado pelo usuário');
    }
  }
  function tClicar(el) {
    if (el) el.click(); // um único clique (nada de cliques duplicados em ações do Blip)
  }

  // Lista atual: tickets fora das pastas, na ordem exibida; null = lista ainda não renderizada.
  function tListarTickets() {
    const cont = document.querySelector(AUTO_SEL.filaContainer) || document.querySelector(AUTO_SEL.areaLista);
    if (!cont) return null;
    return [...cont.querySelectorAll(AUTO_SEL.menuTicket)]
      .filter(b => !b.closest('.folder-list') && !p.contains(b))
      .map(b => (b.id || '').slice(5).trim())
      .filter(Boolean);
  }
  // Primeiro ticket da lista atual, distinguindo lista vazia de carregamento.
  async function tPrimeiroTicket() {
    let vaziasSeguidas = 0;
    const inicio = Date.now();
    for (;;) {
      if (painelFechado) throw new TransfInterrompido('painel fechado');
      if (!rodando) throw new TransfInterrompido('parado pelo usuário');
      const ids = tListarTickets();
      if (ids && ids.length) return ids[0];
      const nativo = autoResolverContador().numero;
      if (ids && nativo === 0) vaziasSeguidas++;
      else if (ids && nativo === null) vaziasSeguidas += 0.5; // contador ilegível: exige mais leituras
      else vaziasSeguidas = 0;
      if (vaziasSeguidas >= 3) return null;
      if (Date.now() - inicio > TRANSF_T.carregando) {
        throw new TransfSuspenso(ids === null
          ? 'a lista de atendimentos não foi encontrada'
          : `a lista está vazia, mas o contador do Blip indica ${nativo}; carregamento não concluiu (tickets dentro de pastas não são processados)`);
      }
      await sleep(TRANSF_T.leituraVazia);
    }
  }

  function tBotaoTransferir() {
    const noChat = [...document.querySelectorAll('#pane-chat-div ' + TRANSF_SEL.botaoTransferir)];
    const hosts = noChat.length ? noChat : [...document.querySelectorAll(TRANSF_SEL.botaoTransferir)];
    const host = hosts.find(tVisivel);
    const inner = host?.shadowRoot?.querySelector('button.icon__button');
    return inner ? { host, inner, habilitado: !tDesabilitado(host) && !tDesabilitado(inner) } : null;
  }
  function tRadioAtendente() {
    return [...document.querySelectorAll(TRANSF_SEL.radioAtendente)].find(tVisivel) || null;
  }
  function tRadioMarcado(host) {
    if (!host) return false;
    if (host.checked === true) return true;
    const i = host.shadowRoot?.querySelector('input[type="radio"]');
    return !!(i && i.checked);
  }
  // Número do ticket no título do modal ("Transferir atendimento do Ticket #3148290"), se legível.
  function tTicketDoModal(ancora) {
    for (let n = ancora, i = 0; n && i < 25; i++, n = n.parentNode || n.host) {
      if (n.nodeType !== 1) continue;
      const m = (n.textContent || '').match(/Transferir[^#]{0,60}Ticket\s*#\s*(\d+)/i);
      if (m) return m[1];
    }
    return null;
  }
  function tAutocomplete() {
    return [...document.querySelectorAll(TRANSF_SEL.autocomplete)].find(tVisivel) || null;
  }
  function tInputAuto(ac) {
    return ac?.shadowRoot?.querySelector('input[type="text"]') || null;
  }
  function tSetaAuto(ac) {
    const icone = ac?.shadowRoot?.querySelector('bds-icon[aria-label="arrow-down"]');
    return icone?.shadowRoot?.querySelector('div.icon-inner') || icone || null;
  }
  // Opções podem estar no light DOM (portal) ou dentro do Shadow Root do autocomplete.
  function tOpcoes(ac) {
    const todas = new Set([...document.querySelectorAll(TRANSF_SEL.opcao)]);
    if (ac?.shadowRoot) ac.shadowRoot.querySelectorAll(TRANSF_SEL.opcao).forEach(o => todas.add(o));
    return [...todas].filter(tOpcaoVisivel);
  }
  // O Blip mantém todas as opções no DOM e só esconde as que não batem com a pesquisa:
  // conta como visível apenas a opção com área real e com o div[role="button"] interno exibido.
  function tOpcaoVisivel(op) {
    if (!tVisivel(op)) return false;
    const r = op.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const inner = op.shadowRoot?.querySelector('div[role="button"]');
    if (inner) {
      const s = getComputedStyle(inner);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
      const ri = inner.getBoundingClientRect();
      if (ri.width < 1 || ri.height < 1) return false;
    }
    return true;
  }
  function tConfirmar() {
    const host = [...document.querySelectorAll(TRANSF_SEL.confirmar)].find(tVisivel);
    const inner = host?.shadowRoot?.querySelector('button[type="button"]');
    return inner ? { host, inner, habilitado: !tDesabilitado(host) && !tDesabilitado(inner) } : null;
  }
  // Fecha o modal sem transferir (botão "Cancelar" do modal; se não houver, Escape).
  function tCancelarModal() {
    if (!tConfirmar() && !tRadioAtendente()) return;
    const cancelar = [...document.querySelectorAll('bds-button, button')]
      .find(b => tVisivel(b) && !p.contains(b) && (b.textContent || '').trim() === 'Cancelar');
    if (cancelar) tClicar(cancelar.shadowRoot?.querySelector('button') || cancelar);
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  function tSemAcento(s) {
    return tNorm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function tRotulos() {
    return tOpcoes(tAutocomplete()).map(op => op.getAttribute('aria-label') || '');
  }
  // Digita como um usuário: um caractere por vez com keydown → InputEvent(insertText) → keyup.
  // Atribuir só .value (ou o texto inteiro de uma vez) pode não disparar a pesquisa do Blip.
  async function tDigitar(input, texto, atraso) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const definir = v => (setter ? setter.call(input, v) : (input.value = v));
    const opc = { bubbles: true, composed: true };
    input.focus();
    if (input.value) {
      definir('');
      input.dispatchEvent(new InputEvent('input', { ...opc, inputType: 'deleteContentBackward' }));
      await sleep(atraso);
    }
    let atual = '';
    for (const ch of texto) {
      if (painelFechado || !rodando) throw new TransfInterrompido(painelFechado ? 'painel fechado' : 'parado pelo usuário');
      input.dispatchEvent(new KeyboardEvent('keydown', { ...opc, key: ch }));
      atual += ch;
      definir(atual);
      input.dispatchEvent(new InputEvent('input', { ...opc, data: ch, inputType: 'insertText' }));
      input.dispatchEvent(new KeyboardEvent('keyup', { ...opc, key: ch }));
      await sleep(atraso);
    }
    input.dispatchEvent(new Event('change', opc));
  }
  // Abre a lista e espera as opções carregarem e estabilizarem (não fatal: há Blips que só listam ao digitar).
  async function tEsperarAutocompletePronto() {
    let chave = '', desde = Date.now(), cliques = 0, ultimoClique = 0;
    return tEsperar(() => {
      const ac = tAutocomplete();
      const inp = tInputAuto(ac);
      if (!ac || !inp || tDesabilitado(inp)) return null;
      const rot = tRotulos();
      if (!rot.length) {
        // abre a lista; no máximo 2 cliques espaçados (a seta alterna abrir/fechar)
        if (cliques < 2 && Date.now() - ultimoClique > 2500) { cliques++; ultimoClique = Date.now(); tClicar(tSetaAuto(ac)); }
        return null;
      }
      const k = rot.join('|');
      if (k !== chave) { chave = k; desde = Date.now(); return null; }
      return Date.now() - desde >= 500 ? true : null;
    }, TRANSF_T.pronto);
  }
  // Espera o resultado da pesquisa. Sem filtro aplicado (lista igual à de antes) não decide "não encontrado".
  async function tEsperarOpcao(alvo, antes, timeout) {
    let chave = '', desde = Date.now(), ultimo = { iguais: 0, total: 0, filtrou: false };
    const r = await tEsperar(() => {
      const ops = tOpcoes(tAutocomplete());
      const rot = ops.map(op => op.getAttribute('aria-label') || '');
      const iguais = ops.filter(op => tNorm(op.getAttribute('aria-label')) === alvo);
      const k = rot.join('|');
      ultimo = { iguais: iguais.length, total: ops.length, filtrou: k !== antes, rotulos: rot };
      if (k !== chave) { chave = k; desde = Date.now(); return null; }
      const estavel = Date.now() - desde;
      if (iguais.length === 1 && estavel >= 400) return { op: iguais[0] };
      if (iguais.length > 1 && estavel >= 800) return { ambiguo: iguais.length };
      return null;
    }, timeout);
    return r || { ...ultimo, semFiltro: !ultimo.filtrou };
  }
  function tParecidos(rotulos, nome) {
    const palavras = tSemAcento(nome).split(' ').filter(w => w.length >= 3);
    const todas = rotulos.filter(r => palavras.length && palavras.every(w => tSemAcento(r).includes(w)));
    const alguma = rotulos.filter(r => palavras.some(w => tSemAcento(r).includes(w)));
    return [...new Set(todas.length ? todas : alguma)].slice(0, 5);
  }
  async function tPesquisarAtendente(nome, alvo) {
    const antes = tRotulos().join('|');
    let r = null;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      await tAntesDeClicar();
      const campo = tInputAuto(tAutocomplete());
      if (!campo) throw new TransfSuspenso('o campo de pesquisa do atendente sumiu');
      await tDigitar(campo, nome, tentativa === 1 ? 40 : 110);
      r = await tEsperarOpcao(alvo, antes, tentativa === 1 ? TRANSF_T.filtro : TRANSF_T.opcoes);
      if (r.op) return r.op;
      if (r.ambiguo || r.iguais > 1) {
        throw new TransfSuspenso(`há ${r.ambiguo || r.iguais} atendentes chamados "${nome}" no Blip; não é possível escolher com segurança`);
      }
      if (!(r.semFiltro && tentativa === 1)) break;
      log('↻ O Blip não aplicou a pesquisa; digitando de novo, mais devagar...');
    }
    const parecidos = tParecidos(r.rotulos || [], nome);
    if (!r.total) {
      // Sem resultado visível: dica a partir de todas as opções que o Blip carregou (inclusive escondidas).
      const ac = tAutocomplete();
      const todas = [...document.querySelectorAll(TRANSF_SEL.opcao), ...(ac?.shadowRoot ? ac.shadowRoot.querySelectorAll(TRANSF_SEL.opcao) : [])]
        .map(op => op.getAttribute('aria-label') || '');
      const dica = tParecidos(todas, nome);
      throw new TransfSuspenso(`o Blip não retornou atendentes para "${nome}"` + (dica.length ? ` (nomes parecidos no Blip: ${dica.join(', ')})` : ''));
    }
    throw new TransfSuspenso(`nenhum atendente com o nome exato "${nome}" (${r.total} resultado(s)` +
      (r.semFiltro ? '; o Blip não aplicou a pesquisa' : '') +
      (parecidos.length ? `; parecidos: ${parecidos.join(', ')}` : '') + '; nome parcial não é aceito)');
  }

  async function tTransferirTicket(id, nome, alvo) {
    let confirmado = false;
    const garantirChat = etapa => {
      if (autoIndicioChatAtivo(id) === null) throw new TransfSuspenso(`o atendimento aberto deixou de ser o #${id} (${etapa})`);
    };
    try {
      const card = autoCardDoTicket(autoBotaoMenu(id));
      if (!card) throw new TransfSuspenso(`card do ticket #${id} não encontrado`);
      if (autoIndicioChatAtivo(id) === null) {
        await tAntesDeClicar();
        tClicar(card);
      }
      if (!(await tEsperar(() => autoIndicioChatAtivo(id), TRANSF_T.abrir))) {
        throw new TransfSuspenso(`não foi possível confirmar que o chat aberto é o do ticket #${id}`);
      }

      const botao = await tEsperar(() => { const b = tBotaoTransferir(); return b && b.habilitado ? b : null; }, TRANSF_T.abrir);
      if (!botao) throw new TransfSuspenso('botão de transferência não encontrado ou desabilitado');
      await tAntesDeClicar();
      garantirChat('antes de abrir a transferência');
      tClicar(botao.inner);

      const radio = await tEsperar(tRadioAtendente, TRANSF_T.modal);
      if (!radio) throw new TransfSuspenso('o modal de transferência não abriu');
      const ticketModal = tTicketDoModal(radio);
      if (ticketModal && ticketModal !== id) throw new TransfSuspenso(`o modal aberto é do ticket #${ticketModal}, esperado #${id}`);

      if (!tRadioMarcado(radio)) {
        await tAntesDeClicar();
        tClicar(radio.shadowRoot?.querySelector('label') || radio.shadowRoot?.querySelector('input[type="radio"]') || radio);
      }
      if (!(await tEsperar(() => tRadioMarcado(tRadioAtendente()), 4000))) throw new TransfSuspenso('não foi possível selecionar "Atendente"');

      const ac = await tEsperar(() => { const a = tAutocomplete(); return a && tInputAuto(a) ? a : null; }, TRANSF_T.modal);
      if (!ac) throw new TransfSuspenso('o campo "Selecionar atendente" não apareceu');
      // O modal do Blip termina de carregar depois de exibir o campo: espera mínima antes de mexer nele
      // (pausar estende; parar interrompe), depois espera a lista de atendentes estabilizar.
      await tEsperar(() => null, TRANSF_T.esperaModal);
      await tAntesDeClicar();
      await tEsperarAutocompletePronto();
      log(`🔎 Ticket #${id}: pesquisando "${nome}" no Blip...`);
      const opcao = await tPesquisarAtendente(nome, alvo); // pesquisa NO BLIP com o nome do painel

      // Clicar no nome do resultado é o que libera "Transferir ticket" no Blip.
      const alvoClique = () => opcao.isConnected ? (opcao.shadowRoot?.querySelector('div[role="button"]') || opcao) : null;
      await tAntesDeClicar();
      tClicar(alvoClique());
      const liberou = () => { const c = tConfirmar(); return c && c.habilitado; };
      if (!(await tEsperar(liberou, 2000)) && alvoClique()) {
        log('↻ O botão não liberou; clicando no nome do atendente novamente (seleção, não confirmação)...');
        await tAntesDeClicar();
        dispararCliqueReal(alvoClique());
      }
      if (!(await tEsperar(liberou, TRANSF_T.confirmar))) {
        throw new TransfSuspenso('o botão "Transferir ticket" não liberou após clicar no atendente');
      }
      if (tNorm(tInputAuto(tAutocomplete())?.value) !== alvo) {
        throw new TransfSuspenso('o atendente selecionado no Blip não corresponde ao nome informado');
      }

      // Validação final, imediatamente antes da ÚNICA confirmação.
      await tAntesDeClicar();
      garantirChat('antes de confirmar');
      const ticketModal2 = tTicketDoModal(tRadioAtendente() || tConfirmar()?.host);
      if (ticketModal2 && ticketModal2 !== id) throw new TransfSuspenso(`o modal passou a ser do ticket #${ticketModal2}`);
      if (tNorm(tInputAuto(tAutocomplete())?.value) !== alvo) throw new TransfSuspenso('a seleção de atendente mudou antes da confirmação');
      const conf = tConfirmar();
      if (!conf || !conf.habilitado) throw new TransfSuspenso('o botão "Transferir ticket" ficou desabilitado antes da confirmação');
      confirmado = true;
      tClicar(conf.inner);
      log(`📨 Ticket #${id}: transferência confirmada no Blip; aguardando a saída da lista...`);

      // Após confirmar: só observa (Parar não interrompe; não há nova tentativa).
      const saiu = await tEsperar(() => (autoBotaoMenu(id) ? null : true), TRANSF_T.resultado, false);
      if (!saiu) {
        throw new TransfSuspenso(tConfirmar()
          ? `resultado incerto para o ticket #${id}: o modal continua aberto após a confirmação (não será repetida)`
          : `o ticket #${id} continua na lista após a confirmação; verifique no Blip antes de continuar`);
      }
    } catch (err) {
      if (!confirmado) tCancelarModal();
      throw err;
    }
  }

  async function executarTransferenciaAtendente() {
    if (rodando || autoBloqueiaOutras()) return;
    const nome = (transfNomeEl.value || '').trim();
    if (!nome) {
      tStatus('Informe o nome do atendente.', 'err');
      log('⚠️ Digite o nome do atendente antes de transferir.');
      transfNomeEl.focus();
      return;
    }
    const alvo = tNorm(nome);
    rodando = true;
    pausado = false;
    modoAtual = 'transferir';
    ativarWakeLock();
    atualizarBotoesEstado(true, `Transferindo → ${nome}`);
    cntEl.textContent = '0';
    tStatus(`Transferindo para "${nome}"...`);
    const assinaturaInicial = autoAssinaturaFiltro(autoResolverContador());
    const feitos = new Set();
    let transferidos = 0;
    log(`🔁 Transferência em massa para "${nome}" iniciada (sempre o primeiro da lista).`);
    try {
      while (rodando) {
        await tAntesDeClicar();
        const assinatura = autoAssinaturaFiltro(autoResolverContador());
        if (assinaturaInicial !== null && assinatura !== null && assinatura !== assinaturaInicial) {
          throw new TransfSuspenso('o filtro/fila da lista mudou durante a execução');
        }
        const id = await tPrimeiroTicket();
        if (!id) {
          log('🏁 Lista vazia: nenhum ticket restante.');
          break;
        }
        if (feitos.has(id)) throw new TransfSuspenso(`o ticket #${id} voltou ao topo da lista depois de transferido`);
        log(`➡️ Ticket #${id}: primeiro da lista.`);
        await tTransferirTicket(id, nome, alvo);
        feitos.add(id);
        transferidos++;
        cntEl.textContent = transferidos;
        log(`✅ Ticket #${id} transferido para "${nome}" (${transferidos}).`);
      }
      tStatus(`Concluído: ${transferidos} ticket(s) transferido(s) para "${nome}".`, 'ok');
    } catch (err) {
      if (err instanceof TransfSuspenso) {
        tStatus(`Suspenso após ${transferidos} transferência(s): ${err.message}.`, 'err');
        log(`✋ Transferência suspensa: ${err.message}.`);
      } else if (err instanceof TransfInterrompido) {
        tStatus(`Interrompido (${err.message}) após ${transferidos} transferência(s).`, 'err');
        log(`⏹ Transferência interrompida: ${err.message}.`);
      } else {
        tStatus(`Erro inesperado: ${err.message}`, 'err');
        log(`❌ Erro na transferência: ${err.message}`);
      }
    } finally {
      if (!painelFechado) {
        rodando = false;
        pausado = false;
        modoAtual = null;
        await liberarWakeLock();
        atualizarBotoesEstado(false);
        log(`🏁 Transferência encerrada: ${transferidos} ticket(s).`);
      }
    }
  }
  bindPanelInput(transfNomeEl, '', () => { if (!rodando) tStatus(''); });
  btnTransfer.onclick = () => {
    if (rodando || autoBloqueiaOutras()) return;
    executarTransferenciaAtendente();
  };

  function fecharPainel() {
    painelFechado = true;
    window.removeEventListener('click', onCapturaControles, true);
    autoDestruir();
    clearInterval(queueTimer);
    clearInterval(relogioTimer);
    logSalvarAgora();
    rodando = false;
    pausado = false;
    modoAtual = null;
    liberarWakeLock();
    document.removeEventListener('visibilitychange', onVisChange);
    document.removeEventListener('mousemove', onDocMouseMove);
    document.removeEventListener('mouseup', onDocMouseUp);
    document.removeEventListener('click', onDocClickCloseTheme);
    window.removeEventListener('rf-bm-theme-change', onSyncTheme);
    p.remove();
    styleEl.remove();
    if (window.__rodBotCleanup === fecharPainel) {
      delete window.__rodBotCleanup;
    }
  }
  btnClose.onclick = fecharPainel;
  window.__rodBotCleanup = fecharPainel;
  btnPauseAll.onclick = () => { if (!autoBloqueiaOutras()) executarModoEsperaTodos('pausar'); };
  btnUnpauseAll.onclick = () => { if (!autoBloqueiaOutras()) executarModoEsperaTodos('despausar'); };
  log(`🤖 rod bot ${LOTE_VERSAO} pronto! Escolha uma aba acima.`);
  if (logLerSalvo().length > 1) log(`💾 Há log salvo de antes (${logLerSalvo().length} linhas): clique em "💾 Log" para baixar.`);
})();;void 0;