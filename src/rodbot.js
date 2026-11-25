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
  let rodando = false, pausado = false, modoAtual = null;
  let wakeLock = null;
  let logOculto = false;

  /*@@PURO-LOTE@@*/

  const THEME_KEY = 'rf_widget_theme_v1';
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
      <div class="ba-card" id="ba-auto-card">
        <div class="ba-row-head">
          <span class="ba-label">💬 Chats novos</span>
          <span id="ba-auto-state" class="ba-auto-state" data-tone="off">Desativada</span>
        </div>
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
  const cntEl = document.getElementById('ba-cnt');
  const btnPause = document.getElementById('ba-pause'), btnStop = document.getElementById('ba-stop');
  const btnClose = document.getElementById('ba-close');
  const runBarEl = document.getElementById('ba-run-bar'), runLabelEl = document.getElementById('ba-run-label');
  const btnClearLog = document.getElementById('ba-clear-log'), btnToggleLog = document.getElementById('ba-toggle-log');
  const btnBaixarLog = document.getElementById('ba-baixar-log'), btnBaixarRelatorio = document.getElementById('ba-baixar-relatorio');
  const queueCountEl = document.getElementById('ba-queue-count'); // badge da antiga aba Fila: hoje null



  btnClearLog.onclick = () => {
    logEl.innerHTML = '';
    log('🧹 Log limpo.');
  };
  btnToggleLog.onclick = () => {
    logOculto = !logOculto;
    logEl.style.display = logOculto ? 'none' : 'block';
    btnToggleLog.textContent = logOculto ? 'Mostrar log' : 'Ocultar log';
  };

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
    await pausaAcao(CONFIG.delayAcoes);
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
    const tagAtual = String(tagParam || '').trim(); // a tag vem do passo Enviar + Finalizar
    if (!tagAtual) throw new Error("A tag do passo está vazia.");
    CONFIG.tagBusca = tagAtual;
    log("🏷️ Abrindo 'Adicionar tags'...");
    const addTagDiv = await waitFor(() => {
      const typo = [...document.querySelectorAll('bds-typo')].find(t => t.textContent.trim() === 'Adicionar tags');
      if (typo) return typo.parentElement;
      return document.querySelector('.tags-container div.pointer');
    }).catch(() => { throw new Error("'Adicionar tags' não apareceu"); });
    clickUnico(addTagDiv);
    await pausaAcao(CONFIG.delayAcoes);
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
    await pausaAcao(CONFIG.delayAcoes);
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
      for (const b of document.querySelectorAll('button, bds-button')) {
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
          if (loteBotaoConfirmaFinalizar(autoTextoComposto(b) || b.textContent || b.getAttribute('label') || '')) {
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
    await pausaAcao(CONFIG.delayTrocaTicket);
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

  // Memória de envio (24 h, por ticket + mensagem): gravada ANTES do Enter, para nunca reenviar.
  function loteLerMemoria() {
    try {
      const o = JSON.parse(localStorage.getItem(LOTE_MEMORIA_CHAVE) || '{}');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  function loteGravarMemoria(chave, estado) {
    const agora = Date.now();
    const o = loteMemoriaLimpar(loteLerMemoria(), agora);
    o[chave] = { estado, ts: agora };
    try { localStorage.setItem(LOTE_MEMORIA_CHAVE, JSON.stringify(o)); } catch {}
  }

  // Relatório da execução (📄 Relatório): uma linha por ticket e passo. Fica salvo (sobrevive a reinício do PC).
  let loteRegistros = [];
  let loteInicio = '';
  function loteRegistrar(id, passo, resultado, motivo) {
    loteRegistros.push({ id, passo, resultado, motivo: motivo || '', hora: new Date().toLocaleTimeString('pt-BR') });
    try {
      localStorage.setItem(LOTE_RELATORIO_CHAVE, JSON.stringify({ inicio: loteInicio, registros: loteRegistros }));
    } catch {}
  }

  function atualizarBotoesEstado(emExecucao, tituloExec = '') {
    if (emExecucao) {
      setSt('Rodando', '#16a34a');
      runBarEl.style.display = 'flex';
      runLabelEl.textContent = tituloExec || 'Automação em execução...';
      btnPause.textContent = '⏸ Pausar';
    } else {
      setSt('Parado', 'rgba(100,116,139,0.55)');
      runBarEl.style.display = 'none';
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
  // No Blip real o bds-menu fechado só fica transparente: as opções continuam com tamanho na tela. Por isso o estado
  // vem do próprio bds-menu (atributo/propriedade `open`, medido no Blip em 23/11/2026) e não da visibilidade.
  function bdsMenuAberto(menu) {
    return !!menu && (menu.open === true || menu.hasAttribute('open'));
  }
  function encontrarOpcaoMenu(wrap, testId) {
    const local = wrap?.querySelector(`bds-menu-action[data-testid="${testId}"]`);
    const menuLocal = local?.closest('bds-menu');
    if (isAcaoMenuVisivel(local) && (!menuLocal || bdsMenuAberto(menuLocal))) return local;
    const abertos = document.querySelectorAll(`bds-menu[open] bds-menu-action[data-testid="${testId}"], div.ticket-menu.visible bds-menu-action[data-testid="${testId}"]`);
    for (const el of abertos) {
      if (isAcaoMenuVisivel(el)) return el;
    }
    return null;
  }
  function menuEstaAberto(wrap) {
    if (!wrap) return false;
    const menu = wrap.querySelector('bds-menu');
    if (menu) return bdsMenuAberto(menu);
    return [...wrap.querySelectorAll('bds-menu-action')].some(isAcaoMenuVisivel);
  }
  async function fecharMenuTicket(wrap, btn) {
    const menu = wrap?.querySelector('bds-menu');
    if (menu && typeof menu.open === 'boolean') menu.open = false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    await sleep(150);
    if (menuEstaAberto(wrap)) {
      // No Blip, Escape não fecha; a outzone do bds-menu fecha. O ⋮ alterna, então só é clicado sem outzone.
      clickUnico(menu?.shadowRoot?.querySelector('.outzone') || btn);
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
    log(`✅ Ticket ${labelId} movido para "${pasta}"! (${totalAtual + 1})`);

    // 6. Aguarda o Blip processar a mudança de pasta
    await sleep(750);
    await fecharAvisosPendentes();
    if (menuEstaAberto(wrap)) {
      await fecharMenuTicket(wrap, alvo);
    }
    return 'alterado';
  }


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

/* Velocidade (função pura, sem DOM). Spec §7 e §8.
 *
 * Faixa 0.5 a 2.0, passo 0.1, padrão 1.0 (= tempos de hoje). Maior = mais rápido:
 * pausa efetiva = pausa atual ÷ velocidade, com piso de 50% da pausa atual (por isso 2.0 é o máximo).
 * Só vale para as pausas de RITMO entre ações (ver docs/plano/pausas.md). A pausa entre ciclos não muda.
 */

const VEL_MIN = 0.5;
const VEL_MAX = 2;
const VEL_PADRAO = 1;
const CICLO_MIN_S = 0;
const CICLO_MAX_S = 60;
const CICLO_PADRAO_S = 1;

function velNumero(entrada) {
  if (typeof entrada === 'number') return entrada;
  if (typeof entrada !== 'string') return NaN;
  const t = entrada.trim().replace(',', '.');
  return t === '' || !/^-?\d*\.?\d+$/.test(t) ? NaN : Number(t);
}

function velVazia(entrada) {
  return entrada === null || entrada === undefined || (typeof entrada === 'string' && entrada.trim() === '');
}

// Para o campo: devolve o valor corrigido e o aviso a mostrar (null quando não houve correção).
function normalizarVelocidade(entrada) {
  if (velVazia(entrada)) return { valor: VEL_PADRAO, aviso: null };
  const n = velNumero(entrada);
  if (!Number.isFinite(n)) return { valor: VEL_PADRAO, aviso: 'Valor inválido' };
  if (n > VEL_MAX) return { valor: VEL_MAX, aviso: 'Máximo 2.0' };
  if (n < VEL_MIN) return { valor: VEL_MIN, aviso: 'Mínimo 0.5' };
  return { valor: Math.round(n * 10) / 10, aviso: null };
}

function pausa(msAtual, velocidade) {
  const n = velNumero(velocidade);
  const vel = Number.isFinite(n) ? Math.min(VEL_MAX, Math.max(VEL_MIN, n)) : VEL_PADRAO;
  return Math.max(Math.round(msAtual / vel), Math.ceil(msAtual * 0.5));
}

function velocidadeDoPasso(passo, velocidadeFluxo) {
  if (!passo || velVazia(passo.velocidade)) return velocidadeFluxo;
  return normalizarVelocidade(passo.velocidade).valor;
}

function seloVelocidade(passo) {
  if (!passo || velVazia(passo.velocidade)) return null;
  return '×' + normalizarVelocidade(passo.velocidade).valor.toFixed(1);
}

// Pausa entre ciclos (§7): valor do usuário em segundos; a velocidade é ignorada de propósito.
function pausaEntreCiclos(segundos /*, velocidade (ignorada) */) {
  return Math.round(segundos * 1000);
}

function normalizarPausaCiclos(entrada) {
  if (velVazia(entrada)) return { valor: CICLO_PADRAO_S, aviso: null };
  const n = velNumero(entrada);
  if (!Number.isFinite(n)) return { valor: CICLO_PADRAO_S, aviso: 'Valor inválido' };
  if (n > CICLO_MAX_S) return { valor: CICLO_MAX_S, aviso: 'Máximo 60 s' };
  if (n < CICLO_MIN_S) return { valor: CICLO_MIN_S, aviso: 'Mínimo 0 s' };
  return { valor: Math.round(n * 10) / 10, aviso: null };
}
/* Pausas de RITMO entre ações (Tarefa 7, spec §8). Precisa de velocidade.js e de `sleep` (01-base.js).
 *
 * Só as pausas classificadas como "entra" em docs/plano/pausas.md chamam pausaAcao; as esperas de UI,
 * polling, recuos e prazos continuam com sleep/waitFor. Com velocidade 1.0 nada muda.
 */

let velocidadeAtual = 1; // o motor define ao iniciar cada passo; o painel antigo usa 1.0

function definirVelocidadeAtual(v) {
  velocidadeAtual = normalizarVelocidade(v).valor;
  return velocidadeAtual;
}

function pausaAcao(ms) {
  return sleep(pausa(ms, velocidadeAtual));
}
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

  const autoStateEl = document.getElementById('ba-auto-state');
  const autoCountEl = document.getElementById('ba-auto-count');
  const autoNativeEl = document.getElementById('ba-auto-native');
  const autoQueueEl = document.getElementById('ba-auto-queue');
  const autoDetailEl = document.getElementById('ba-auto-detail');
  const autoListEl = document.getElementById('ba-auto-list');
  const autoResumeBtn = document.getElementById('ba-auto-resume');
  const autoRetryPauseBtn = document.getElementById('ba-auto-retry-pause');
  const autoResetBtn = document.getElementById('ba-auto-reset');
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
    timerRecon: null,
    consumidor: null        // fluxo 🆕/👥: recebe os ids novos no lugar do worker do Auto
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
    return ''; // o Auto antigo não envia mais nada sozinho: quem envia é o fluxo (🆕/👥)
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
    // o próprio fluxo 🆕/👥 que consome o observador não é "outra automação" (seus cliques não revelam chats antigos)
    if (rodando && modoAtual !== 'claim' && !(auto.consumidor && modoAtual === 'fluxo')) return 'outra automação do BM em execução';
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
        if (auto.consumidor) {
          log(`🆕 Novo chat #${id} (total do BM: ${auto.contador}).`);
          auto.consumidor(id);
          continue;
        }
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
        await pausaAcao(AUTO_T.entreTickets);
      }
    } finally {
      auto.workerAtivo = false;
      auto.aguardando = '';
      autoRender();
    }
  }

  // consumidor: usado pelo fluxo 🆕/👥 (só o observador; quem processa é o motor, não o worker do Auto).
  function autoAtivar(consumidor = null) {
    if (auto.ativo || auto.destruido) return;
    if (!consumidor) return; // só o fluxo 🆕/👥 ativa o observador
    auto.ativo = true;
    auto.consumidor = consumidor;
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
    log(consumidor ? '👁️ Vigiando chats novos. Registrando os chats atuais...' : '▶ Resposta automática ativada. Registrando os chats atuais...');
    autoReexaminar();
    autoRender();
  }
  function autoDesativar() {
    if (!auto.ativo) return;
    const eraFluxo = !!auto.consumidor;
    auto.ativo = false;
    auto.consumidor = null;
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
    log(eraFluxo ? '⏹ Vigia de chats novos encerrada.' : `⏹ Resposta automática desativada. ${descartados.length} pendente(s) descartado(s).`);
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
     TRANSFERÊNCIA PARA ATENDENTE OU FILA
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
    confirmar: 'bds-button#confirm-transfer-btn',
    // Fila: medido no Blip real em 24/11/2026. "Fila" já vem marcada; as opções têm o nome só no texto.
    radioFila: 'bds-radio[label="Fila"]',
    autocompleteFila: 'bds-autocomplete#autocompleteTeam'
  };
  const TRANSF_DESTINOS = {
    atendente: { radio: TRANSF_SEL.radioAtendente, autocomplete: TRANSF_SEL.autocomplete, rotulo: 'Atendente', campo: 'Selecionar atendente' },
    fila: { radio: TRANSF_SEL.radioFila, autocomplete: TRANSF_SEL.autocompleteFila, rotulo: 'Fila', campo: 'Selecionar fila' }
  };
  let tDestino = TRANSF_DESTINOS.atendente; // destino da transferência em andamento
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
  function tRadioDestino() {
    return [...document.querySelectorAll(tDestino.radio)].find(tVisivel) || null;
  }
  function tAlgumRadio() {
    return [...document.querySelectorAll(`${TRANSF_SEL.radioAtendente}, ${TRANSF_SEL.radioFila}`)].find(tVisivel) || null;
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
    return [...document.querySelectorAll(tDestino.autocomplete)].find(tVisivel) || null;
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
  // Na lista de filas, as opções que não servem ganham o atributo `invisible` (medido no Blip real).
  function tOpcaoVisivel(op) {
    if (!tVisivel(op) || op.hasAttribute('invisible')) return false;
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
    if (!tConfirmar() && !tAlgumRadio()) return;
    const cancelar = [...document.querySelectorAll('bds-button, button')]
      .find(b => tVisivel(b) && !p.contains(b) && (b.textContent || '').trim() === 'Cancelar');
    if (cancelar) tClicar(cancelar.shadowRoot?.querySelector('button') || cancelar);
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
  }

  function tSemAcento(s) {
    return tNorm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  // Nome da opção: atendentes têm aria-label; filas têm o nome só no texto (medido no Blip real).
  function tRotulo(op) {
    return (op.getAttribute('aria-label') || op.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function tRotulos() {
    return tOpcoes(tAutocomplete()).map(tRotulo);
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
      const rot = ops.map(tRotulo);
      const iguais = ops.filter(op => tNorm(tRotulo(op)) === alvo);
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
        .map(tRotulo);
      const dica = tParecidos(todas, nome);
      throw new TransfSuspenso(`o Blip não retornou atendentes para "${nome}"` + (dica.length ? ` (nomes parecidos no Blip: ${dica.join(', ')})` : ''));
    }
    throw new TransfSuspenso(`nenhum atendente com o nome exato "${nome}" (${r.total} resultado(s)` +
      (r.semFiltro ? '; o Blip não aplicou a pesquisa' : '') +
      (parecidos.length ? `; parecidos: ${parecidos.join(', ')}` : '') + '; nome parcial não é aceito)');
  }

  // Fila: a lista é curta e já vem inteira; escolhe sem digitar, como o BM fez no Blip (abre a lista e clica no nome).
  async function tEscolherFila(nome, alvo) {
    const r = await tEsperarOpcao(alvo, '', TRANSF_T.opcoes);
    if (r.op) return r.op;
    if (r.ambiguo || r.iguais > 1) throw new TransfSuspenso(`há ${r.ambiguo || r.iguais} filas chamadas "${nome}" no Blip`);
    if (!r.total) throw new TransfSuspenso('a lista de filas do Blip não abriu (nenhuma fila visível)');
    const parecidos = tParecidos(r.rotulos || [], nome);
    throw new TransfSuspenso(`nenhuma fila com o nome exato "${nome}"` +
      (parecidos.length ? ` (parecidas: ${parecidos.join(', ')})` : '') +
      `; filas no Blip: ${(r.rotulos || []).join(', ')}`);
  }

  // destino: 'atendente' (padrão, Transferir antigo) ou 'fila'.
  async function tTransferirTicket(id, nome, alvo, destino = 'atendente') {
    tDestino = TRANSF_DESTINOS[destino] || TRANSF_DESTINOS.atendente;
    const ehFila = tDestino === TRANSF_DESTINOS.fila;
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

      const radio = await tEsperar(tRadioDestino, TRANSF_T.modal);
      if (!radio) throw new TransfSuspenso('o modal de transferência não abriu');
      const ticketModal = tTicketDoModal(radio);
      if (ticketModal && ticketModal !== id) throw new TransfSuspenso(`o modal aberto é do ticket #${ticketModal}, esperado #${id}`);

      if (!tRadioMarcado(radio)) {
        await tAntesDeClicar();
        tClicar(radio.shadowRoot?.querySelector('label') || radio.shadowRoot?.querySelector('input[type="radio"]') || radio);
      }
      if (!(await tEsperar(() => tRadioMarcado(tRadioDestino()), 4000))) throw new TransfSuspenso(`não foi possível selecionar "${tDestino.rotulo}"`);

      const ac = await tEsperar(() => { const a = tAutocomplete(); return a && tInputAuto(a) ? a : null; }, TRANSF_T.modal);
      if (!ac) throw new TransfSuspenso(`o campo "${tDestino.campo}" não apareceu`);
      // O modal do Blip termina de carregar depois de exibir o campo: espera mínima antes de mexer nele
      // (pausar estende; parar interrompe), depois abre a lista (seta, no máximo 2 cliques) e espera estabilizar.
      await tEsperar(() => null, TRANSF_T.esperaModal);
      await tAntesDeClicar();
      await tEsperarAutocompletePronto();
      let opcao;
      if (ehFila) {
        log(`🔎 Ticket #${id}: escolhendo a fila "${nome}" no Blip...`);
        opcao = await tEscolherFila(nome, alvo);
      } else {
        log(`🔎 Ticket #${id}: pesquisando "${nome}" no Blip...`);
        opcao = await tPesquisarAtendente(nome, alvo); // pesquisa NO BLIP com o nome do painel
      }

      // Clicar no nome do resultado (div[role="button"] interno) é o que libera "Transferir ticket" no Blip.
      const alvoClique = () => opcao.isConnected ? (opcao.shadowRoot?.querySelector('div[role="button"]') || opcao) : null;
      await tAntesDeClicar();
      tClicar(alvoClique());
      const liberou = () => { const c = tConfirmar(); return c && c.habilitado; };
      if (!(await tEsperar(liberou, 2000)) && alvoClique()) {
        log(`↻ O botão não liberou; clicando no nome ${ehFila ? 'da fila' : 'do atendente'} novamente (seleção, não confirmação)...`);
        await tAntesDeClicar();
        dispararCliqueReal(alvoClique());
      }
      if (!(await tEsperar(liberou, TRANSF_T.confirmar))) {
        throw new TransfSuspenso(`o botão "Transferir ticket" não liberou após clicar ${ehFila ? 'na fila' : 'no atendente'}`);
      }
      if (tNorm(tInputAuto(tAutocomplete())?.value) !== alvo) {
        throw new TransfSuspenso(`${ehFila ? 'a fila selecionada' : 'o atendente selecionado'} no Blip não corresponde ao nome informado`);
      }

      // Validação final, imediatamente antes da ÚNICA confirmação.
      await tAntesDeClicar();
      garantirChat('antes de confirmar');
      const ticketModal2 = tTicketDoModal(tRadioDestino() || tConfirmar()?.host);
      if (ticketModal2 && ticketModal2 !== id) throw new TransfSuspenso(`o modal passou a ser do ticket #${ticketModal2}`);
      if (!tRadioMarcado(tRadioDestino())) throw new TransfSuspenso(`"${tDestino.rotulo}" deixou de estar marcado antes da confirmação`);
      if (tNorm(tInputAuto(tAutocomplete())?.value) !== alvo) throw new TransfSuspenso(`a seleção ${ehFila ? 'de fila' : 'de atendente'} mudou antes da confirmação`);
      const conf = tConfirmar();
      if (!conf || !conf.habilitado) throw new TransfSuspenso('o botão "Transferir ticket" ficou desabilitado antes da confirmação');
      confirmado = true;
      tClicar(conf.inner);
      log(`📨 Ticket #${id}: transferência para ${ehFila ? 'a fila' : 'o atendente'} "${nome}" confirmada no Blip; aguardando a saída da lista...`);

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


/* Validador do fluxo (função pura, sem DOM). Spec §6.
 *
 * validarFluxo({ paraQuem, passos }) → { ok:true } | { ok:false, erros:[{ indice, regra, mensagem, correcao?, dica? }] }
 *   - paraQuem: 'aguardando' (⏳) | 'caindo' (🆕) | 'ambos' (👥)
 *   - passo: { tipo:'atender' } | { tipo:'enviar', modo:'so'|'finalizar' } | { tipo:'espera', modo:'pausar'|'despausar' }
 *            | { tipo:'mover' } | { tipo:'transferir' }
 *   - indice: base 1 (como o usuário vê). O validador devolve TODOS os erros de cada passo.
 *
 * Estado simulado: tickets ∈ {'ha','vazio'}; pausados ∈ {'desconhecido','nenhum','alguns','todos'}.
 * Início em ⏳: há + desconhecido. Em 🆕/👥 (por chat, regra 11): há + nenhum.
 * Cada passo é avaliado contra o estado e depois APLICADO (mesmo com erro), para os passos
 * seguintes serem avaliados como o usuário os enxerga.
 */

function fluxoEstadoInicial(paraQuem) {
  return paraQuem === 'caindo' || paraQuem === 'ambos'
    ? { tickets: 'ha', pausados: 'nenhum' }
    : { tickets: 'ha', pausados: 'desconhecido' };
}

const FLUXO_MAX_PASSOS = 8;
const FLUXO_MODOS = ['aguardando', 'caindo', 'ambos'];

// O que a paleta oferece por modo (§4): Atender e Despausar só existem em ⏳.
// Sem modo escolhido (fluxo novo "+"), a paleta inteira fica desabilitada.
function disponibilidade(paraQuem) {
  if (paraQuem === 'aguardando') return { atender: true, despausar: true };
  if (paraQuem === 'caindo' || paraQuem === 'ambos') return { atender: false, despausar: false };
  return { atender: false, despausar: false, paleta: false, dica: 'Escolha para quem primeiro' };
}

function fluxoPassoDisponivel(paraQuem, passo) {
  if (FLUXO_MODOS.indexOf(paraQuem) === -1) return true; // sem modo: o erro é 'sem-para-quem', não o do passo
  const d = disponibilidade(paraQuem);
  if (passo.tipo === 'atender') return d.atender;
  if (passo.tipo === 'espera' && passo.modo === 'despausar') return d.despausar;
  return true;
}

// Loop (§7): efetivo = escolha do usuário E Atender em 1º (só ⏳). `habilitado` diz se o interruptor pode ser mexido.
function loopEfetivo(fluxo) {
  const paraQuem = fluxo && fluxo.paraQuem;
  const passos = (fluxo && fluxo.passos) || [];
  if (paraQuem === 'caindo' || paraQuem === 'ambos') {
    return { efetivo: false, habilitado: false, motivo: 'Este modo já vigia até Parar' };
  }
  if (paraQuem !== 'aguardando') {
    return { efetivo: false, habilitado: false, motivo: 'Escolha para quem primeiro' };
  }
  const temAtenderEm1o = passos.length > 0 && passos[0].tipo === 'atender';
  if (!temAtenderEm1o) {
    return { efetivo: false, habilitado: false, motivo: 'O loop precisa de Atender em 1º' };
  }
  return { efetivo: !!fluxo.loopEscolha, habilitado: true, motivo: null };
}

function fluxoErro(indice, regra, mensagem, extra) {
  return Object.assign(
    { indice, regra, mensagem, correcao: { acao: 'remover', indice, texto: 'Remover passo ' + indice } },
    extra || {}
  );
}

function fluxoGlobal(regra, mensagem) {
  return { indice: null, regra, mensagem };
}

function fluxoRotulo(passo) {
  if (passo.tipo === 'atender') return 'Atender';
  if (passo.tipo === 'enviar') return passo.modo === 'finalizar' ? 'Enviar + Finalizar' : 'Enviar';
  if (passo.tipo === 'espera') return passo.modo === 'despausar' ? 'Despausar' : 'Pausar';
  if (passo.tipo === 'mover') return 'Mover';
  return 'Transferir';
}

// Validação (spec §6). Cada passo é avaliado contra o estado e depois aplicado, mesmo com erro.
// Devolve TODOS os erros de cada passo (regra 10); `causa` = índice do passo que provocou o erro.
function validarFluxo(fluxo) {
  const passos = (fluxo && fluxo.passos) || [];
  const paraQuem = fluxo && fluxo.paraQuem;
  const estado = fluxoEstadoInicial(paraQuem);
  const porChat = paraQuem === 'caindo' || paraQuem === 'ambos';
  // rastros do que já aconteceu (índices base 1), só para apontar a causa
  const rastro = { pausou: null, despausou: null, enviou: null, esvaziou: null };
  const erros = [];

  // erros globais (sem passo: indice null)
  if (FLUXO_MODOS.indexOf(paraQuem) === -1) {
    erros.push(fluxoGlobal('sem-para-quem', 'Escolha para quem o fluxo vale'));
  }
  if (passos.length === 0) erros.push(fluxoGlobal('fluxo-vazio', 'Adicione pelo menos um passo'));
  if (passos.length > FLUXO_MAX_PASSOS) {
    erros.push(fluxoGlobal('muitos-passos', 'Máximo de ' + FLUXO_MAX_PASSOS + ' passos'));
  }

  passos.forEach((passo, i) => {
    const indice = i + 1;
    const anterior = i > 0 ? passos[i - 1] : null;
    const enviando = passo.tipo === 'enviar';
    const despausando = passo.tipo === 'espera' && passo.modo === 'despausar';
    const pausando = passo.tipo === 'espera' && passo.modo === 'pausar';

    // indisponível no modo (Atender e Despausar não existem em 🆕/👥)
    if (!fluxoPassoDisponivel(paraQuem, passo)) {
      const atender = passo.tipo === 'atender';
      erros.push(
        fluxoErro(
          indice,
          'indisponivel',
          atender ? 'Atender não existe neste modo' : 'Despausar só existe em Aguardando',
          atender ? { dica: "Use 'Também puxar a fila' nos Ajustes" } : {}
        )
      );
    }

    // regra 2: depois de Enviar+Finalizar, Transferir ou Mover não sobra cliente (exceto Atender)
    if (estado.tickets === 'vazio' && passo.tipo !== 'atender') {
      erros.push(fluxoErro(indice, 2, 'Não sobra cliente na tela', { causa: rastro.esvaziou }));
    }

    // regra 3: Despausar só é bloqueado quando já se sabe que não há pausados
    if (despausando && estado.pausados === 'nenhum') {
      erros.push(fluxoErro(indice, 3, 'Não há cliente em espera para despausar', { causa: rastro.despausou }));
    }

    // regra 4: mesmo envio duas vezes nos mesmos tickets (qualquer Enviar; Atender no meio libera)
    if (enviando && rastro.enviou !== null) {
      erros.push(fluxoErro(indice, 4, 'Não duplique a mensagem para o mesmo cliente', { causa: rastro.enviou }));
    }

    // regra 1: Enviar com pausados (depois de Pausar, sem Despausar). Com `desconhecido` é permitido.
    if (enviando && (estado.pausados === 'todos' || estado.pausados === 'alguns')) {
      // regra 8: só sugere Despausar se não houve envio antes (senão a regra 4 também vale) e se ele existe no modo
      const sugestao =
        rastro.enviou === null && !porChat
          ? { acao: 'inserir', indice, passo: 'despausar', texto: 'Colocar Despausar antes do passo ' + indice }
          : undefined;
      erros.push(
        fluxoErro(indice, 1, 'Cliente em espera não recebe mensagem', {
          causa: rastro.pausou,
          ...(sugestao ? { sugestao } : {}),
        })
      );
    }

    // regra 5: Pausar→Pausar ou Despausar→Despausar em passos adjacentes
    if (
      anterior &&
      anterior.tipo === 'espera' &&
      passo.tipo === 'espera' &&
      anterior.modo === passo.modo
    ) {
      erros.push(fluxoErro(indice, 5, 'Sem efeito: repete o passo anterior', { causa: indice - 1 }));
    }

    // aplica o efeito (spec §6, coluna "Deixa") e atualiza os rastros
    if (passo.tipo === 'atender') {
      estado.tickets = 'ha'; // pausados não muda
      rastro.enviou = null; // tickets novos: o envio pode se repetir
      rastro.esvaziou = null;
    } else if (enviando) {
      rastro.enviou = indice;
      if (passo.modo === 'finalizar') {
        estado.tickets = 'vazio';
        rastro.esvaziou = indice;
      }
    } else if (pausando) {
      estado.pausados = 'todos';
      rastro.pausou = indice;
    } else if (despausando) {
      estado.pausados = 'nenhum';
      rastro.pausou = null;
      rastro.despausou = indice;
    } else {
      // mover | transferir
      estado.tickets = 'vazio';
      rastro.esvaziou = indice;
    }
  });

  return erros.length ? { ok: false, erros } : { ok: true };
}

// Regra 10: o modal mostra UM erro: o do primeiro passo com erro, escolhendo a regra nesta ordem.
const FLUXO_ORDEM_REGRAS = ['indisponivel', 2, 3, 4, 1, 5];

function erroDoModal(erros) {
  if (!erros || !erros.length) return null;
  const deIndice = erros.filter((e) => e.indice !== null && e.indice !== undefined);
  if (!deIndice.length) return erros[0]; // só erros globais
  const primeiro = Math.min.apply(null, deIndice.map((e) => e.indice));
  const doPasso = deIndice.filter((e) => e.indice === primeiro);
  doPasso.sort((a, b) => FLUXO_ORDEM_REGRAS.indexOf(a.regra) - FLUXO_ORDEM_REGRAS.indexOf(b.regra));
  return doPasso[0];
}

// Texto do modal (layout-M): { titulo, linha, detalhe }. `passos` é o fluxo validado.
function textoModal(erro, passos) {
  if (erro.indice === null || erro.indice === undefined) {
    const titulo = 'Esta ordem não é aceita';
    if (erro.regra === 'sem-para-quem') {
      return { titulo, linha: 'Escolha para quem o fluxo vale.', detalhe: 'Aguardando, Que vão cair ou Ambos.' };
    }
    if (erro.regra === 'fluxo-vazio') {
      return { titulo, linha: 'Adicione pelo menos um passo.', detalhe: 'Toque num ícone da paleta para começar.' };
    }
    return { titulo, linha: 'O fluxo tem mais de ' + FLUXO_MAX_PASSOS + ' passos.', detalhe: 'Remova algum passo.' };
  }
  const rot = (n) => n + ' · ' + fluxoRotulo(passos[n - 1]);
  const atual = rot(erro.indice);
  const remover = 'remova o passo ' + erro.indice;
  const titulo = 'Esta ordem não é aceita';
  let linha;
  let detalhe;
  switch (erro.regra) {
    case 1:
      linha = 'O passo ' + atual + ' vem depois de ' + rot(erro.causa) + '.';
      detalhe = erro.sugestao
        ? 'Cliente em espera não recebe mensagem. Para enviar, coloque Despausar antes ou ' + remover + '.'
        : 'Cliente em espera não recebe mensagem. Para enviar, ' + remover + '.';
      break;
    case 2:
      linha = 'O passo ' + atual + ' vem depois de ' + rot(erro.causa) + '.';
      detalhe = 'Não sobra cliente na tela. Para corrigir, ' + remover + '.';
      break;
    case 3:
      linha = 'O passo ' + atual + ' não tem cliente em espera para despausar.';
      detalhe = 'Só dá para despausar depois de Pausar. Coloque Pausar antes ou ' + remover + '.';
      break;
    case 4:
      linha = 'O passo ' + atual + ' repete o envio do passo ' + rot(erro.causa) + '.';
      detalhe = 'Enviar duas vezes para o mesmo cliente não é permitido. Para corrigir, ' + remover + '.';
      break;
    case 5:
      linha = 'O passo ' + atual + ' repete o passo ' + rot(erro.causa) + '.';
      detalhe = 'Repetir em seguida não tem efeito. Para corrigir, ' + remover + '.';
      break;
    default:
      linha = 'O passo ' + atual + ' não existe neste modo.';
      detalhe = erro.dica ? erro.dica + '. Ou ' + remover + '.' : remover.charAt(0).toUpperCase() + remover.slice(1) + '.';
  }
  return { titulo, linha, detalhe };
}
/* Campos obrigatórios dos passos (função pura, sem DOM). Spec §4.
 * Campo vazio (ou só com espaços) ⇒ campo em vermelho e Iniciar bloqueado. Nada é pulado em silêncio.
 *
 * validarCampos(passo) → [{ campo }]   (campo ∈ 'mensagem' | 'tag' | 'pasta' | 'atendente' | 'fila')
 * podeIniciar(fluxo)   → boolean       (precisa de validar-fluxo.js carregado antes)
 */

function campoVazio(valor) {
  return typeof valor !== 'string' || valor.trim() === '';
}

function validarCampos(passo) {
  const faltando = [];
  if (passo.tipo === 'enviar') {
    if (campoVazio(passo.mensagem)) faltando.push({ campo: 'mensagem' });
    if (passo.modo === 'finalizar' && campoVazio(passo.tag)) faltando.push({ campo: 'tag' });
  } else if (passo.tipo === 'mover') {
    if (campoVazio(passo.pasta)) faltando.push({ campo: 'pasta' });
  } else if (passo.tipo === 'transferir') {
    if (passo.para === 'fila') {
      if (campoVazio(passo.fila)) faltando.push({ campo: 'fila' });
    } else if (campoVazio(passo.atendente)) faltando.push({ campo: 'atendente' });
  }
  return faltando;
}

// Iniciar só libera com a ordem válida (inclui "Para quem?" e 1 a 8 passos) E todos os campos preenchidos.
function podeIniciar(fluxo) {
  if (!validarFluxo(fluxo).ok) return false;
  return fluxo.passos.every((passo) => validarCampos(passo).length === 0);
}
/* Motor do fluxo — ⏳ Aguardando (Tarefa 9), 🆕 Que vão cair e 👥 Ambos (Tarefa 10). Spec §5, §6 (regra 9), §7, §10.
 *
 * Puro: nada aqui toca o DOM. Tudo que mexe no Blip chega em deps.acoes (as funções reais no bookmarklet,
 * falsas nos testes). Precisa de velocidade.js, validar-fluxo.js e validar-campos.js carregados antes.
 *
 * executarFluxo(fluxo, deps) → Promise<{ status, ciclos, motivo?, totais }>
 *   fluxo: { paraQuem, passos, loopEscolha, pausaCiclos (s), velocidade }
 *   deps.acoes:
 *     contar() → { fila, naTela, pausados }          (null = desconhecido; só para o log inicial)
 *     filaAtual() → número | null                    (sentinela)
 *     atender() → { atendidos }                      (puxa até zerar)
 *     listarTickets() → [{ id | null, pausado: true | false | null }]
 *     enviar(id, { mensagem, modo, tag, abrirProximo }) · pausar(id) · despausar(id)
 *     mover(id, pasta) · transferir(id, nome, para)  → { ok, motivo?, nota?, pulado? }
 *       para: 'atendente' (padrão, passo sem `para`) ou 'fila'; nome = passo.atendente ou passo.fila
 *       pulado: ok mas nada foi feito (ex.: ticket em espera não recebe mensagem); não conta; em 🆕/👥 encerra o chat
 *       semEfeito: o ticket já estava no estado pedido (ex.: já em espera); não conta e o chat segue
 *     definirVelocidade(v)
 *     🆕/👥: novosChats() → [id] (chats que caíram desde a última leitura; o observador do Auto por baixo)
 *            entreChats() (pausa de ritmo AUTO_T.entreTickets) · memoria24h.{ tem(id), gravar(id) }
 *     Falha de ITEM: devolver { ok:false, motivo } (ou lançar um Error comum). Falha GERAL: lançar ErroGeral(motivo).
 *   deps.relogio.esperar(ms) · deps.controle.{ parado(), aguardar() → false se parou }
 *   deps.eventos.{ log(texto), passo(indice, 'aguardando'|'rodando'|'feito'|'falha', detalhe), ciclo(n) }
 *
 * Memória por ticket (§5):
 *   ⏳: só desta execução (zera a cada Iniciar). Um ticket recebe no máximo UM envio na execução inteira; cada
 *       passo age no máximo uma vez em cada ticket (por isso [P, D, P] funciona e o loop não repete).
 *   🆕: a de 24 h do Auto; o id é gravado ANTES do primeiro passo (nunca envia duas vezes).
 *   👥: o lote usa a da execução (ticket que já está nas 24 h é tratado de novo, com aviso); a vigia usa as 24 h e
 *       ignora os tratados no lote.
 *   🆕/👥: chats presentes ao ativar não são tratados pela vigia. Só um fluxo roda por vez.
 */

// Passo Transferir → [nome, para]. Passo antigo (sem `para`) é para atendente.
function destinoTransferir(passo) {
  return passo.para === 'fila' ? [passo.fila, 'fila'] : [passo.atendente, 'atendente'];
}

function ErroGeral(mensagem) {
  const e = new Error(mensagem);
  e.geral = true;
  return e;
}

const MOTOR_SENTINELA_MS = 1500;
const MOTOR_VIGIA_MS = 500; // leitura de chats novos quando não há nenhum na fila (não muda com a velocidade)
let motorOcupado = false;

function motorChavesResumo(passos) {
  const chaves = [];
  const add = (k) => { if (chaves.indexOf(k) === -1) chaves.push(k); };
  for (const p of passos) {
    if (p.tipo === 'atender') add('atendidos');
    else if (p.tipo === 'enviar') { add('enviados'); if (p.modo === 'finalizar') add('finalizados'); }
    else if (p.tipo === 'espera') add(p.modo === 'despausar' ? 'despausados' : 'pausados');
    else if (p.tipo === 'mover') add('movidos');
    else if (p.tipo === 'transferir') add('transferidos');
  }
  return chaves;
}

function motorRotuloPasso(passo) {
  return typeof fluxoRotulo === 'function' ? fluxoRotulo(passo) : passo.tipo;
}

// Executa um passo em lote nos tickets da tela. Devolve true se o usuário parou no meio.
async function motorPassoEmLote(passo, indice, ctx) {
  const { acoes, controle, log, memoria, tc } = ctx;
  const abrirProximo = ctx.abrirProximo !== false;
  if (passo.tipo === 'atender') {
    const r = await acoes.atender();
    tc.atendidos += (r && r.atendidos) || 0;
    return false;
  }

  let tickets = acoes.listarTickets() || [];
  const comNumero = tickets.filter((t) => t.id);
  const semNumero = tickets.length - comNumero.length;
  if (tickets.length && !comNumero.length) {
    throw ErroGeral('todos os ' + tickets.length + ' cards da tela estão sem número de ticket');
  }
  tc.semNumero = Math.max(tc.semNumero, semNumero);

  const feitosNestePasso = memoria.porPasso[indice];
  const pausando = passo.tipo === 'espera' && passo.modo === 'pausar';
  const despausando = passo.tipo === 'espera' && passo.modo === 'despausar';
  const rotulo = (indice + 1) + ' · ' + motorRotuloPasso(passo);
  const vistos = new Set(); // v10.1: a lista é relida a cada ticket (o Blip carrega mais ao rolar e tira os finalizados)
  let rolagens = 0;

  for (;;) {
    if (controle.parado() || !(await controle.aguardar())) return true;
    const t = tickets.find((x) => x.id && !vistos.has(x.id));
    if (!t) {
      if (!acoes.carregarMais || rolagens >= LOTE_ROLAGENS_FIM) break;
      rolagens++;
      await acoes.carregarMais();
      tickets = acoes.listarTickets() || [];
      continue;
    }
    rolagens = 0;
    vistos.add(t.id);
    if (feitosNestePasso.has(t.id)) continue;
    if (ctx.memoria24h && ctx.memoria24h.tem(t.id) && !memoria.avisados.has(t.id)) {
      memoria.avisados.add(t.id);
      log('ℹ️ #' + t.id + ' tratado de novo (execução anterior).');
    }
    if (passo.tipo === 'enviar') {
      if (memoria.enviados.has(t.id)) continue; // regra 9: ninguém recebe duas mensagens
      if (t.pausado === true) {
        log('⏭️ #' + t.id + ' em espera: não recebe mensagem.');
        feitosNestePasso.add(t.id);
        continue;
      }
    }
    if (pausando && t.pausado === true) {
      log('⏭️ #' + t.id + ' já estava em espera.');
      feitosNestePasso.add(t.id);
      continue;
    }
    if (despausando && t.pausado === false) continue;

    let r;
    try {
      if (passo.tipo === 'enviar') {
        r = await acoes.enviar(t.id, {
          mensagem: passo.mensagem, modo: passo.modo, tag: passo.tag, abrirProximo,
        });
      } else if (pausando) r = await acoes.pausar(t.id);
      else if (despausando) r = await acoes.despausar(t.id);
      else if (passo.tipo === 'mover') r = await acoes.mover(t.id, passo.pasta);
      else r = await acoes.transferir(t.id, ...destinoTransferir(passo));
    } catch (err) {
      if (err && err.geral) throw err;
      r = { ok: false, motivo: (err && err.message) || String(err) };
    }
    feitosNestePasso.add(t.id); // não tenta de novo nesta execução (evita repetir uma ação de resultado incerto)
    motorAvisarItem(ctx, t.id, rotulo, r);
    tickets = acoes.listarTickets() || [];

    if (!r || !r.ok) {
      tc.falhas++;
      log('⚠️ #' + t.id + ': ' + ((r && r.motivo) || 'falhou') + '. Pulado.');
      continue;
    }
    if (r.pulado || r.semEfeito) {
      log('⏭️ #' + t.id + ': ' + (r.nota || 'pulado') + '.');
      continue;
    }
    if (r.nota) log('ℹ️ #' + t.id + ': ' + r.nota + '.');
    if (passo.tipo === 'enviar') {
      memoria.enviados.add(t.id);
      tc.enviados++;
      if (passo.modo === 'finalizar') tc.finalizados++;
    } else if (pausando) tc.pausados++;
    else if (despausando) tc.despausados++;
    else if (passo.tipo === 'mover') tc.movidos++;
    else tc.transferidos++;
  }
  return false;
}

// v10.1: cada ticket tratado vira uma linha do relatório; LOTE_FALHAS_SEGUIDAS falhas seguidas pausam o fluxo.
function motorAvisarItem(ctx, id, rotulo, r) {
  const ok = !!(r && r.ok);
  const resultado = (r && r.resultado) || (!ok ? 'falha' : (r.pulado || r.semEfeito) ? 'pulado' : 'feito');
  const motivo = (r && (r.motivo || r.nota)) || '';
  if (ctx.eventos && ctx.eventos.item) ctx.eventos.item({ id, passo: rotulo, resultado, motivo });
  ctx.seguidas = ok ? 0 : (ctx.seguidas || 0) + 1;
  if (ctx.seguidas >= LOTE_FALHAS_SEGUIDAS && ctx.controle.pausar) {
    ctx.controle.pausar(ctx.seguidas);
    ctx.seguidas = 0;
  }
}

function motorContar(tc, passo, ok) {
  if (!ok) return;
  if (passo.tipo === 'enviar') {
    tc.enviados++;
    if (passo.modo === 'finalizar') tc.finalizados++;
  } else if (passo.tipo === 'espera') {
    if (passo.modo === 'despausar') tc.despausados++;
    else tc.pausados++;
  } else if (passo.tipo === 'mover') tc.movidos++;
  else if (passo.tipo === 'transferir') tc.transferidos++;
}

function motorContadores() {
  return { falhas: 0, semNumero: 0, atendidos: 0, enviados: 0, finalizados: 0, pausados: 0,
    despausados: 0, movidos: 0, transferidos: 0 };
}

function motorResumo(rotulo, tc, chaves) {
  return rotulo + ': ' + chaves.map((k) => tc[k] + ' ' + k).concat(tc.falhas + ' falhas').join(' · ');
}

// Só um fluxo por vez (§10). A trava é pega antes de qualquer await.
async function executarFluxo(fluxo, deps) {
  if (motorOcupado) return { status: 'recusado', ciclos: 0, motivo: 'Já há um fluxo rodando' };
  if (!podeIniciar(fluxo)) return { status: 'invalido', ciclos: 0, motivo: 'fluxo inválido ou com campo vazio' };
  motorOcupado = true;
  try {
    const eventos = deps.eventos || {};
    const log = (t) => { if (eventos.log) eventos.log(t); };
    if (deps.acoes.contar) {
      const c = deps.acoes.contar() || {};
      const v = (x) => (x === null || x === undefined ? '?' : x);
      log('Fila: ' + v(c.fila) + ' · Na tela: ' + v(c.naTela) + ' · Pausados: ' + v(c.pausados));
    }
    if (fluxo.paraQuem === 'aguardando') return await motorAguardando(fluxo, deps, log);
    return await motorPorChat(fluxo, deps, log);
  } finally {
    motorOcupado = false;
  }
}

// ⏳ Aguardando: em lote nos tickets da tela, com loop e sentinela.
async function motorAguardando(fluxo, deps, log) {
  const acoes = deps.acoes;
  const relogio = deps.relogio;
  const controle = deps.controle;
  const eventos = deps.eventos || {};
  const marcar = (i, s, d) => { if (eventos.passo) eventos.passo(i, s, d); };

  const passos = fluxo.passos;
  const loop = loopEfetivo(fluxo).efetivo;
  const chaves = motorChavesResumo(passos);
  const memoria = { enviados: new Set(), avisados: new Set(), porPasso: passos.map(() => new Set()) };
  const totais = { falhas: 0 };
  chaves.forEach((k) => { totais[k] = 0; });
  let ciclos = 0;
  let passoAtual = 0;
  const fim = (status, motivo) => ({ status, ciclos, motivo, totais });

  try {
    for (let n = 1; ; n++) {
      if (eventos.ciclo) eventos.ciclo(n);
      if (controle.parado()) return fim('parado');
      passos.forEach((_, i) => marcar(i + 1, 'aguardando'));

      if (loop) {
        let fila = acoes.filaAtual();
        if (fila === 0) {
          log('👁️ Sentinela: fila zerada (0). Vigiando até surgir cliente...');
          while (fila === 0) {
            if (controle.parado() || !(await controle.aguardar())) return fim('parado');
            await relogio.esperar(MOTOR_SENTINELA_MS);
            fila = acoes.filaAtual();
          }
        }
      }

      const tc = motorContadores();
      const ctx = { acoes, controle, log, memoria, tc, abrirProximo: true, eventos };
      for (let i = 0; i < passos.length; i++) {
        if (controle.parado() || !(await controle.aguardar())) return fim('parado');
        const passo = passos[i];
        passoAtual = i + 1;
        if (acoes.definirVelocidade) acoes.definirVelocidade(velocidadeDoPasso(passo, fluxo.velocidade));
        marcar(i + 1, 'rodando');
        const parou = await motorPassoEmLote(passo, i, ctx);
        if (parou) return fim('parado');
        marcar(i + 1, 'feito');
      }
      passoAtual = 0;

      ciclos = n;
      log(motorResumo('Ciclo #' + n, tc, chaves));
      if (tc.semNumero) log('⚠️ ' + tc.semNumero + ' card(s) sem número, pulado(s)');
      chaves.forEach((k) => { totais[k] += tc[k]; });
      totais.falhas += tc.falhas;

      if (!loop) return fim('concluido');
      if (controle.parado() || !(await controle.aguardar())) return fim('parado');
      await relogio.esperar(pausaEntreCiclos(fluxo.pausaCiclos === undefined ? 1 : fluxo.pausaCiclos));
    }
  } catch (err) {
    return motorFalhaGeral(err, passoAtual, passos, marcar, log, fim);
  }
}

function motorFalhaGeral(err, passoAtual, passos, marcar, log, fim) {
  const motivo = (err && err.message) || String(err);
  if (passoAtual) {
    marcar(passoAtual, 'falha', motivo);
    log('❌ Passo ' + passoAtual + ' · ' + motorRotuloPasso(passos[passoAtual - 1]) + ' falhou: ' + motivo + '. Fluxo parado.');
  } else {
    log('❌ ' + motivo + '. Fluxo parado.');
  }
  return fim('falha', motivo);
}

// Aplica todos os passos a UM chat, em ordem; cada passo só começa se o anterior deu certo (o adaptador só
// devolve ok depois de CONFIRMAR, ex.: envio confirmado antes de pausar). Devolve 'ok' | 'falhou' | 'parado'.
async function motorPassosNoChat(id, fluxo, ctx) {
  const { acoes, controle, log, tc, marcar } = ctx;
  const passos = fluxo.passos;
  passos.forEach((_, i) => marcar(i + 1, 'aguardando', '#' + id));
  for (let i = 0; i < passos.length; i++) {
    if (controle.parado() || !(await controle.aguardar())) return 'parado';
    const passo = passos[i];
    ctx.passoAtual = i + 1;
    if (acoes.definirVelocidade) acoes.definirVelocidade(velocidadeDoPasso(passo, fluxo.velocidade));
    marcar(i + 1, 'rodando', '#' + id);
    let r;
    try {
      if (passo.tipo === 'enviar') {
        r = await acoes.enviar(id, { mensagem: passo.mensagem, modo: passo.modo, tag: passo.tag, abrirProximo: false });
      } else if (passo.tipo === 'espera' && passo.modo === 'pausar') r = await acoes.pausar(id);
      else if (passo.tipo === 'espera') r = await acoes.despausar(id);
      else if (passo.tipo === 'mover') r = await acoes.mover(id, passo.pasta);
      else if (passo.tipo === 'transferir') r = await acoes.transferir(id, ...destinoTransferir(passo));
      else r = { ok: false, motivo: 'passo indisponível neste modo' };
    } catch (err) {
      if (err && err.geral) throw err;
      r = { ok: false, motivo: (err && err.message) || String(err) };
    }
    motorAvisarItem(ctx, id, (i + 1) + ' · ' + motorRotuloPasso(passo), r);
    if (!r || !r.ok) {
      tc.falhas++;
      marcar(i + 1, 'falha', '#' + id);
      log('⚠️ Chat #' + id + ' · passo ' + (i + 1) + ': ' + ((r && r.motivo) || 'falhou') +
        '. Os passos seguintes deste chat não rodam.');
      ctx.passoAtual = 0;
      return 'falhou';
    }
    if (r.pulado) {
      log('⏭️ Chat #' + id + ' · passo ' + (i + 1) + ': ' + (r.nota || 'pulado') + '. Os passos seguintes deste chat não rodam.');
      marcar(i + 1, 'feito', '#' + id);
      ctx.passoAtual = 0;
      return 'pulado';
    }
    if (r.semEfeito) {
      log('⏭️ Chat #' + id + ': ' + (r.nota || 'sem efeito') + '.');
      marcar(i + 1, 'feito', '#' + id);
      continue;
    }
    if (r.nota) log('ℹ️ #' + id + ': ' + r.nota + '.');
    motorContar(tc, passo, true);
    marcar(i + 1, 'feito', '#' + id);
  }
  ctx.passoAtual = 0;
  return 'ok';
}

// 🆕 Que vão cair / 👥 Ambos: (👥) uma passada em lote nos que aguardam; depois vigia, um chat por vez, até Parar.
async function motorPorChat(fluxo, deps, log) {
  const acoes = deps.acoes;
  const relogio = deps.relogio;
  const controle = deps.controle;
  const eventos = deps.eventos || {};
  const marcar = (i, s, d) => { if (eventos.passo) eventos.passo(i, s, d); };
  const passos = fluxo.passos;
  const chaves = motorChavesResumo(passos);
  const memoria = { enviados: new Set(), avisados: new Set(), porPasso: passos.map(() => new Set()) };
  const tc = motorContadores();
  const ctx = { acoes, controle, log, memoria, tc, marcar, passoAtual: 0, abrirProximo: false, eventos };
  const fim = (status, motivo) => {
    log(motorResumo('Resumo', tc, chaves));
    return { status, ciclos: 0, motivo, totais: tc };
  };

  const presentes = new Set((acoes.listarTickets() || []).map((t) => t.id).filter(Boolean));
  const tratados = new Set(); // memória da execução (lote + vigia)

  try {
    if (fluxo.paraQuem === 'ambos') {
      const lote = motorContadores();
      const ctxLote = { acoes, controle, log, memoria, tc: lote, abrirProximo: false, memoria24h: acoes.memoria24h, eventos };
      for (let i = 0; i < passos.length; i++) {
        if (controle.parado() || !(await controle.aguardar())) return fim('parado');
        ctx.passoAtual = i + 1;
        if (acoes.definirVelocidade) acoes.definirVelocidade(velocidadeDoPasso(passos[i], fluxo.velocidade));
        marcar(i + 1, 'rodando', 'lote');
        if (await motorPassoEmLote(passos[i], i, ctxLote)) return fim('parado');
        marcar(i + 1, 'feito', 'lote');
      }
      ctx.passoAtual = 0;
      memoria.porPasso.forEach((set) => set.forEach((id) => tratados.add(id)));
      log(motorResumo('Lote', lote, chaves));
      if (lote.semNumero) log('⚠️ ' + lote.semNumero + ' card(s) sem número, pulado(s)');
      Object.keys(tc).forEach((k) => { tc[k] += lote[k]; });
    }

    log('👁️ Vigiando chats que caírem' + (fluxo.puxarFila ? ' (e puxando a fila)' : '') + '...');
    const fila = [];
    const naFila = new Set();
    for (;;) {
      if (controle.parado() || !(await controle.aguardar())) return fim('parado');
      if (fluxo.puxarFila) {
        const f = acoes.filaAtual();
        if (f !== null && f > 0) {
          const r = await acoes.atender();
          tc.atendidos += (r && r.atendidos) || 0;
        }
      }
      for (const id of acoes.novosChats() || []) {
        if (!id || naFila.has(id) || presentes.has(id) || tratados.has(id)) continue;
        if (acoes.memoria24h && acoes.memoria24h.tem(id)) continue;
        naFila.add(id);
        fila.push(id);
      }
      if (!fila.length) {
        await relogio.esperar(MOTOR_VIGIA_MS);
        continue;
      }
      const id = fila.shift();
      tratados.add(id);
      if (acoes.memoria24h) acoes.memoria24h.gravar(id); // antes do 1º passo: nunca envia duas vezes
      const r = await motorPassosNoChat(id, fluxo, ctx);
      if (r === 'parado') return fim('parado');
      if (r === 'ok') log('✅ Chat #' + id + ': ' + passos.length + ' passo(s) feitos.');
      if (acoes.entreChats) await acoes.entreChats();
    }
  } catch (err) {
    return motorFalhaGeral(err, ctx.passoAtual, passos, marcar, log, fim);
  }
}
  /* ========================================================
     FLUXO MONTADO PELO USUÁRIO — ADAPTADORES DO MOTOR (Tarefa 11)
     Liga o motor puro (puro/motor.js) às funções reais do bot, uma ação POR TICKET.
     Reaproveita as funções antigas; o painel antigo continua funcionando igual.
     Por enquanto só é acionado pelo gancho de teste (window.__rodBotTeste === true).
     ======================================================== */

  // Chats novos entregues pelo observador do Auto (modo consumidor) para o motor 🆕/👥.
  const fluxoNovos = [];

  // Lê pelo menu do ticket se ele está em espera: 'pausado' | 'ativo' | null (não deu para ler).
  async function fluxoLerEspera(id) {
    const alvo = autoBotaoMenu(id);
    if (!alvo) return null;
    const wrap = alvo.closest('.ticket-menu') || alvo.parentElement;
    const card = autoCardDoTicket(alvo) || wrap;
    card?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    card?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    wrap?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await sleep(120);
    if (!menuEstaAberto(wrap)) clickUnico(alvo);
    // Primeiro o menu deste ticket: no Blip real menus de outros tickets podem ter ficado abertos, e a busca geral de
    // encontrarOpcaoMenu acharia a opção de um deles (um ticket pausado faria este parecer pausado).
    const doTicket = testId => menuEstaAberto(wrap) &&
      isAcaoMenuVisivel(wrap?.querySelector(`bds-menu-action[data-testid="${testId}"]`));
    const estado = await waitFor(() => {
      if (doTicket(AUTO_SEL.opcaoDespausar)) return 'pausado';
      if (doTicket(AUTO_SEL.opcaoPausar)) return 'ativo';
      if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar)) return 'pausado';
      if (encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar)) return 'ativo';
      return null;
    }, AUTO_T.menu, 100).catch(() => null);
    await fecharMenuTicket(wrap, alvo);
    return estado;
  }

  function fluxoListarTickets() {
    const leitura = autoColetarTickets();
    const lista = leitura.ids.map(id => ({ id, pausado: null }));
    for (let i = 0; i < leitura.semIdentidade; i++) lista.push({ id: null, pausado: null });
    return lista;
  }

  // Puxa a fila até zerar (mesma lógica do "Atender" antigo, sem mexer no estado global do painel).
  async function fluxoAtender() {
    let atendidos = 0;
    let desabilitadoDesde = 0;
    for (;;) {
      if (!(await aguardarPausaSeNecessario())) break;
      const antes = obterContagemFila();
      atualizarBadgeFila();
      if (antes !== null && antes <= 0) break;
      const btn = obterBotaoAtender();
      if (!btn || !btn.host) throw ErroGeral('botão "Atender" (#claim-ticket-button) não encontrado');
      if (btn.disabled) {
        desabilitadoDesde = desabilitadoDesde || Date.now();
        if (Date.now() - desabilitadoDesde > 10000) break; // contador ilegível e botão travado: segue o fluxo
        await sleep(250);
        continue;
      }
      desabilitadoDesde = 0;
      const alvoClique = btn.inner || btn.host;
      dispararCliqueReal(alvoClique);
      if (btn.host !== alvoClique) dispararCliqueReal(btn.host);
      atendidos++;
      const resta = obterContagemFila();
      log(`📥 [Atender #${atendidos}]${resta !== null ? ` Fila: ${resta}` : ''}`);
      if (resta !== null && resta <= 0) break;
      await pausaAcao(500);
    }
    atualizarBadgeFila();
    return { atendidos };
  }

  // Envia (e, em "Enviar + Finalizar", aplica a tag e finaliza) no chat do ticket `id`.
  // Só devolve ok depois de CONFIRMAR o envio na interface (campo vazio + texto novo na conversa).
  // Como o Auto antigo, abre o chat direto: o menu ⋮ só é aberto se o campo de mensagem não ficar disponível, para
  // saber se o ticket está em espera (no Blip real o menu aberto antes de enviar não fechava e travava o envio).
  // v10.1:
  // - memória de 24 h por ticket + mensagem, gravada ANTES do Enter: nunca reenvia (nem em outra execução);
  // - 🧪 Simular: abre o chat e preenche o texto, depois apaga; não envia, não põe tag e não finaliza;
  // - Enviar + Finalizar: se a tag/finalizar falhar, fecha o que ficou aberto e o ticket vira "enviado, NÃO finalizado";
  // - o rascunho do chat que o próprio bot abriu antes não bloqueia mais os próximos clientes.
  let fluxoSimulando = false;
  let fluxoUltimoAberto = null;
  async function fluxoEnviar(id, op) {
    const msg = (op.mensagem || '').trim();
    const chave = loteChaveEnvio(id, msg);
    if (loteJaRecebeu(loteLerMemoria(), chave)) {
      return { ok: true, pulado: true, nota: 'já recebeu esta mensagem antes (memória 24 h)', resultado: 'pulado' };
    }
    if (!autoBotaoMenu(id)) return { ok: false, motivo: 'o ticket saiu da lista; nada enviado' };
    const card = autoCardDoTicket(autoBotaoMenu(id));
    if (!card) return { ok: false, motivo: 'card do ticket não encontrado; nada enviado' };
    // Só o chat que você deixou aberto antes de Iniciar é protegido; os que o bot abriu têm o rascunho guardado pelo Blip.
    if (!fluxoUltimoAberto && autoTemRascunho(msg)) return { ok: false, motivo: 'há texto digitado no chat aberto; nada foi trocado' };

    card.scrollIntoView?.({ block: 'nearest' });
    if (autoIndicioChatAtivo(id) === null) clickUnico(card);
    const indicio = await waitFor(() => autoIndicioChatAtivo(id), AUTO_T.chatAtivo, 200).catch(() => null);
    if (!indicio) return { ok: false, motivo: 'não foi possível confirmar que o chat aberto é deste ticket; nada enviado' };
    fluxoUltimoAberto = id;
    const campoLivre = () => {
      const el = autoCampoTexto();
      return el && !el.disabled && isElementoVisivel(el) ? el : null;
    };
    let input = await waitFor(() => campoLivre() || (autoCampoTexto()?.disabled ? 'bloqueado' : null), AUTO_T.campo, 200)
      .catch(() => null);
    if (input === 'bloqueado' || !input) {
      if ((await fluxoLerEspera(id)) === 'pausado') return { ok: true, pulado: true, nota: 'em espera: não recebe mensagem' };
      input = input === 'bloqueado' ? await waitFor(campoLivre, AUTO_T.campo, 200).catch(() => null) : null;
    }
    if (!input) return { ok: false, motivo: 'campo de mensagem indisponível; nada enviado' };
    if (autoTemRascunho(msg)) return { ok: true, pulado: true, nota: 'o chat do cliente tem um rascunho; o texto não foi alterado', resultado: 'pulado' };

    if (input.value !== msg) await preencherCampoMensagem(input, msg);
    if (autoCampoTexto() !== input || autoIndicioChatAtivo(id) === null) {
      autoLimparSeNosso(input, msg);
      return { ok: false, motivo: 'o chat aberto mudou durante o preenchimento; nada enviado' };
    }
    if (input.value !== msg) return { ok: false, motivo: 'o texto do campo foi alterado manualmente; nada enviado' };
    if (fluxoSimulando) {
      autoLimparSeNosso(input, msg);
      return { ok: true, semEfeito: true, nota: '🧪 simulado: texto preenchido e apagado, nada enviado', resultado: 'simulado' };
    }

    loteGravarMemoria(chave, 'enviando'); // se tudo cair agora, este ticket nunca recebe de novo
    const antes = autoContarOcorrencias(msg);
    dispararEnvioEnter(input);
    const resultado = await autoConfirmarEnvio(input, msg, antes);
    if (resultado !== 'confirmado') {
      autoLimparSeNosso(input, msg);
      if (resultado === 'nao_enviado') {
        loteGravarMemoria(chave, 'nao_enviado');
        return { ok: false, motivo: 'o envio não ocorreu (texto permaneceu no campo)' };
      }
      loteGravarMemoria(chave, 'incerto');
      return { ok: false, motivo: 'envio sem confirmação na interface; confira (não será reenviado)', resultado: 'incerto' };
    }
    log(`✉️ #${id}: mensagem enviada e confirmada.`);
    if (op.modo !== 'finalizar') {
      loteGravarMemoria(chave, 'enviado');
      await pausaAcao(CONFIG.delayAcoes);
      return { ok: true, resultado: 'enviado' };
    }
    loteGravarMemoria(chave, 'parcial');
    try {
      await passo2_tag(op.tag);
      await passo3_finalizar();
      await passo4_confirmarModal();
    } catch (err) {
      await loteFecharSobras();
      return { ok: false, motivo: 'enviado, NÃO finalizado: ' + ((err && err.message) || err), resultado: 'parcial' };
    }
    // Deduzido: depois de finalizar, o ticket sai da lista (ou o chat dele deixa de estar aberto).
    const fechou = await waitFor(() => !autoBotaoMenu(id) || autoIndicioChatAtivo(id) === null, 8000, 250)
      .then(() => true).catch(() => false);
    if (!fechou) {
      await loteFecharSobras();
      return { ok: false, motivo: 'enviado, NÃO finalizado: cliquei em finalizar, mas o ticket continua aberto', resultado: 'parcial' };
    }
    loteGravarMemoria(chave, 'finalizado');
    log(`🏁 #${id}: finalizado.`);
    await pausaAcao(CONFIG.delayAcoes);
    return { ok: true, resultado: 'finalizado' };
  }

  // Rola a lista para o Blip carregar mais atendimentos (o motor relê a lista depois).
  async function fluxoCarregarMais() {
    const cards = document.querySelectorAll(AUTO_SEL.card);
    const ultimo = cards[cards.length - 1];
    const sc = ultimo ? encontrarContainerScroll(ultimo) : obterScrollContainerGeral();
    if (sc) {
      sc.scrollTop = sc.scrollHeight;
      sc.dispatchEvent(new Event('scroll', { bubbles: true }));
    }
    ultimo?.scrollIntoView?.({ block: 'end' });
    window.dispatchEvent(new Event('scroll'));
    log('⏳ Rolando a lista para carregar mais clientes...');
    await sleep(1500);
  }

  // Despausar pelo menu do ticket (o caminho inverso de autoTentarPausa).
  async function fluxoDespausar(id) {
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
      const t = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoDespausar);
      if (t) return { tipo: 'alvo', el: t };
      const o = encontrarOpcaoMenu(wrap, AUTO_SEL.opcaoPausar);
      if (o) return { tipo: 'oposto', el: o };
      return null;
    }, AUTO_T.menu, 100).catch(() => null);
    if (!acao) {
      await fecharMenuTicket(wrap, alvo);
      return { ok: false, motivo: 'opção de espera não apareceu no menu' };
    }
    if (acao.tipo === 'oposto') {
      await fecharMenuTicket(wrap, alvo);
      return { ok: true, semEfeito: true, nota: 'não estava em espera' };
    }
    const innerBtn = acao.el.shadowRoot?.querySelector('button.menuaction__button, button') || acao.el;
    await sleep(150);
    clickUnico(innerBtn);
    await sleep(550);
    await fecharAvisosPendentes();
    const verif = await fluxoLerEspera(id);
    if (verif === 'ativo') {
      await pausaAcao(CONFIG.delayAcoes);
      return { ok: true };
    }
    return { ok: false, motivo: 'não foi possível confirmar que saiu da espera' };
  }

  async function fluxoPausar(id) {
    const r = await autoTentarPausa(id);
    if (r.ok && r.nota === 'já estava em espera') return { ok: true, semEfeito: true, nota: r.nota };
    if (r.ok) await pausaAcao(CONFIG.delayAcoes);
    return r;
  }

  async function fluxoMover(id, pasta) {
    const alvo = autoBotaoMenu(id);
    if (!alvo) return { ok: false, motivo: 'ticket não encontrado na lista' };
    const r = await processarMoverTicket(alvo, pasta, normalizarTexto(pasta), `#${id}`, 0);
    if (r === 'alterado') {
      await pausaAcao(CONFIG.delayAcoes);
      return { ok: true };
    }
    return { ok: false, motivo: r === 'parado' ? 'interrompido' : `não foi possível mover para "${pasta}"` };
  }

  async function fluxoTransferir(id, nome, para = 'atendente') {
    try {
      await tTransferirTicket(id, nome, tNorm(nome), para === 'fila' ? 'fila' : 'atendente');
      return { ok: true };
    } catch (err) {
      if (err instanceof TransfInterrompido) return { ok: false, motivo: err.message };
      // TransfSuspenso no Transferir antigo suspende a transferência em massa: aqui é falha geral do passo
      throw ErroGeral(err.message);
    }
  }

  async function fluxoEntreChats() {
    await pausaAcao(AUTO_T.entreTickets);
  }

  const FLUXO_ACOES = {
    definirVelocidade: v => definirVelocidadeAtual(v),
    contar: () => {
      const leitura = autoColetarTickets();
      return { fila: obterContagemFila(), naTela: leitura.ids.length + leitura.semIdentidade, pausados: null };
    },
    filaAtual: () => obterContagemFila(),
    atender: fluxoAtender,
    listarTickets: fluxoListarTickets,
    enviar: fluxoEnviar,
    pausar: fluxoPausar,
    despausar: fluxoDespausar,
    mover: fluxoMover,
    transferir: fluxoTransferir,
    novosChats: () => fluxoNovos.splice(0, fluxoNovos.length),
    carregarMais: fluxoCarregarMais,
    entreChats: fluxoEntreChats,
    memoria24h: {
      tem: id => { const r = autoLerTickets()[id]; return !!(r && (r.fluxo || r.envio)); },
      gravar: id => autoGravarTicket(id, { contado: true, fluxo: true }),
    },
  };

  // 🧪 Simular: só o Enviar abre o chat (e apaga o texto); os outros passos não clicam em nada.
  const simuladoSemClique = { ok: true, semEfeito: true, nota: '🧪 simulado: passo não executado', resultado: 'simulado' };
  const FLUXO_ACOES_SIMULAR = Object.assign({}, FLUXO_ACOES, {
    atender: async () => { log('🧪 Simular: Atender não é clicado.'); return { atendidos: 0 }; },
    pausar: async () => simuladoSemClique,
    despausar: async () => simuladoSemClique,
    mover: async () => simuladoSemClique,
    transferir: async () => simuladoSemClique,
    memoria24h: { tem: FLUXO_ACOES.memoria24h.tem, gravar: () => {} }, // simulação não marca ninguém como tratado
  });

  const fluxoEventos = []; // [{ tipo:'inicio'|'ciclo'|'passo'|'fim', ... }] para o Acompanhar e os testes
  const fluxoOuvintes = []; // a tela Acompanhar se registra aqui (Tarefa 21)

  function fluxoAvisar(ev) {
    fluxoEventos.push(ev);
    for (const f of fluxoOuvintes) {
      try { f(ev); } catch (err) { /* um erro na tela nunca derruba o fluxo */ }
    }
  }

  async function fluxoIniciar(fluxo, opcoes = {}) {
    if (rodando || auto.atual || auto.ativo) return { status: 'recusado', ciclos: 0, motivo: 'Já há um fluxo rodando' };
    const porChat = fluxo && fluxo.paraQuem !== 'aguardando';
    rodando = true;
    pausado = false;
    modoAtual = 'fluxo';
    fluxoEventos.length = 0;
    fluxoNovos.length = 0;
    fluxoSimulando = !!opcoes.simular;
    fluxoUltimoAberto = null;
    loteRegistros = [];
    loteInicio = new Date().toLocaleString('pt-BR');
    let feitos = 0;
    atualizarBotoesEstado(true, fluxoSimulando ? '🧪 Simulando (nada é enviado)' : 'Fluxo em execução');
    cntEl.textContent = '0';
    log(`▶ ${fluxoSimulando ? '🧪 SIMULAÇÃO' : 'Fluxo'} "${opcoes.nome || 'Fluxo'}" iniciado (${LOTE_VERSAO}).`);
    await ativarWakeLock();
    fluxoAvisar({ tipo: 'inicio', nome: opcoes.nome || 'Fluxo', fluxo });
    if (porChat) autoAtivar(id => fluxoNovos.push(id));
    let status = 'falha';
    try {
      const r = await executarFluxo(fluxo, {
        acoes: fluxoSimulando ? FLUXO_ACOES_SIMULAR : FLUXO_ACOES,
        relogio: { esperar: ms => sleep(ms) },
        controle: {
          parado: () => !rodando || painelFechado,
          aguardar: aguardarPausaSeNecessario,
          pausar: n => {
            if (!rodando || pausado) return;
            pausado = true;
            btnPause.textContent = '▶ Retomar';
            log(`✋ ${n} clientes seguidos com problema: fluxo PAUSADO. Confira a tela do Blip e clique em Retomar (ou Parar).`);
          },
        },
        eventos: {
          log,
          item: it => {
            loteRegistrar(it.id, it.passo, it.resultado, it.motivo);
            if (['finalizado', 'enviado', 'feito', 'simulado'].includes(it.resultado)) cntEl.textContent = String(++feitos);
          },
          passo: (indice, st, detalhe) => fluxoAvisar({ tipo: 'passo', indice, status: st, detalhe }),
          ciclo: n => fluxoAvisar({ tipo: 'ciclo', n }),
        },
      });
      status = r.status;
      log(`🏁 Fluxo ${r.status}${r.motivo ? `: ${r.motivo}` : ''}.`);
      return r;
    } finally {
      if (porChat) autoDesativar();
      definirVelocidadeAtual(1);
      rodando = false;
      pausado = false;
      modoAtual = null;
      fluxoSimulando = false;
      await liberarWakeLock();
      atualizarBotoesEstado(false);
      log(`📊 Relatório: ${loteResumo(loteRegistros).texto}.`);
      const problemas = loteRegistros.filter(x => ['parcial', 'incerto', 'falha'].includes(x.resultado));
      for (const x of problemas.slice(0, 30)) log(`   #${x.id} (${x.passo}): ${LOTE_ESTADOS_TEXTO[x.resultado]}${x.motivo ? ` — ${x.motivo.replace(/^enviado, NÃO finalizado: /, '')}` : ''}`);
      if (problemas.length > 30) log(`   ... e mais ${problemas.length - 30}. Veja tudo em 📄 Relatório.`);
      logSalvarAgora();
      fluxoAvisar({ tipo: 'fim', status });
    }
  }

  // Gancho de teste (§12.4): só existe quando o teste define window.__rodBotTeste = true ANTES de injetar.
  if (window.__rodBotTeste === true) {
    window.__rodBot = {
      executarFluxo: (fluxo, opcoes) => fluxoIniciar(fluxo, opcoes),
      eventos: () => fluxoEventos.slice(),
      parar: () => pararExecucao(),
    };
  }

/* Fluxos salvos (função pura; o armazenamento é injetado). Spec §9.
 *
 * - Modelos fixos ⭐ Piloto clássico e ⭐ Auto clássico: não são gravados, não se apagam e não se sobrescrevem.
 *   Editar um modelo vale só em memória: listar() sempre devolve cópias novas do original.
 * - Até 10 fluxos do usuário (os modelos não contam), gravados em rf_rodbot_fluxos_v1; o último usado em
 *   rf_rodbot_fluxo_atual_v1. 💾 sempre cria um fluxo NOVO com nome.
 * - Mensagens dos modelos começam VAZIAS (nunca se preenche MENSAGEM_PADRAO sozinho).
 *
 * criarFluxosSalvos(armazenamento, { gerarId?, mensagemAuto? }) → { listar, atual, salvar, apagar, marcarAtual, novoVazio }
 *   mensagemAuto: a mensagem migrada do Auto antigo (Tarefa 14) para o Enviar do ⭐ Auto clássico; padrão ''.
 *   item: { id, nome, modelo, fluxo }
 */

const FLUXOS_CHAVE = 'rf_rodbot_fluxos_v1';
const FLUXO_ATUAL_CHAVE = 'rf_rodbot_fluxo_atual_v1';
const FLUXOS_MAX_USUARIO = 10;

function fluxoBase(paraQuem, passos) {
  return { paraQuem, loopEscolha: true, pausaCiclos: 1, velocidade: 1, puxarFila: false, passos };
}

function fluxosModelos(mensagemAuto) {
  return [
    {
      id: 'modelo:piloto', nome: '⭐ Piloto clássico', modelo: true,
      fluxo: fluxoBase('aguardando', [
        { tipo: 'atender', velocidade: null },
        { tipo: 'enviar', modo: 'so', mensagem: '', tag: '', velocidade: null },
        { tipo: 'espera', modo: 'pausar', velocidade: null },
        { tipo: 'mover', pasta: '', velocidade: null },
      ]),
    },
    {
      id: 'modelo:auto', nome: '⭐ Auto clássico', modelo: true,
      fluxo: fluxoBase('caindo', [
        { tipo: 'enviar', modo: 'so', mensagem: mensagemAuto || '', tag: '', velocidade: null },
        { tipo: 'espera', modo: 'pausar', velocidade: null },
      ]),
    },
  ];
}

function fluxoCopia(x) {
  return JSON.parse(JSON.stringify(x));
}

function fluxoNomeChave(nome) {
  return String(nome || '').replace(/⭐/g, '').trim().toLowerCase();
}

function temAlteracoes(editado, original) {
  return JSON.stringify(editado) !== JSON.stringify(original);
}

function criarFluxosSalvos(armazenamento, opcoes) {
  const mensagemAuto = (opcoes && opcoes.mensagemAuto) || '';
  const modelos = () => fluxosModelos(mensagemAuto);
  const gerarId = (opcoes && opcoes.gerarId) || (() => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));

  function lerUsuario() {
    try {
      const lista = JSON.parse(armazenamento.getItem(FLUXOS_CHAVE) || '[]');
      if (!Array.isArray(lista)) return [];
      return lista.filter((x) => x && typeof x.id === 'string' && typeof x.nome === 'string' && x.fluxo && Array.isArray(x.fluxo.passos));
    } catch (e) {
      return [];
    }
  }
  function gravarUsuario(lista) {
    try {
      armazenamento.setItem(FLUXOS_CHAVE, JSON.stringify(lista));
      return true;
    } catch (e) {
      return false;
    }
  }

  function listar() {
    return fluxoCopia(modelos().concat(lerUsuario().map((x) => ({ id: x.id, nome: x.nome, modelo: false, fluxo: x.fluxo }))));
  }

  function atual() {
    let id = null;
    try { id = armazenamento.getItem(FLUXO_ATUAL_CHAVE); } catch (e) { id = null; }
    const todos = listar();
    return todos.find((x) => x.id === id) || todos[0];
  }

  function marcarAtual(id) {
    try { armazenamento.setItem(FLUXO_ATUAL_CHAVE, id); } catch (e) { /* sem persistência: só não lembra */ }
  }

  function salvar(nome, fluxo) {
    const limpo = String(nome || '').trim();
    if (!limpo) return { ok: false, motivo: 'Dê um nome ao fluxo' };
    const chave = fluxoNomeChave(limpo);
    if (modelos().some((x) => fluxoNomeChave(x.nome) === chave)) {
      return { ok: false, motivo: 'Esse nome é de um modelo ⭐; escolha outro' };
    }
    const usuario = lerUsuario();
    if (usuario.some((x) => fluxoNomeChave(x.nome) === chave)) return { ok: false, motivo: 'Já existe um fluxo com esse nome' };
    if (usuario.length >= FLUXOS_MAX_USUARIO) return { ok: false, motivo: 'Limite de ' + FLUXOS_MAX_USUARIO + ' fluxos' };
    const id = gerarId();
    usuario.push({ id, nome: limpo, fluxo: fluxoCopia(fluxo) });
    if (!gravarUsuario(usuario)) return { ok: false, motivo: 'Não foi possível salvar neste navegador' };
    return { ok: true, id };
  }

  function apagar(id) {
    if (modelos().some((x) => x.id === id)) return { ok: false, motivo: 'Modelos ⭐ não podem ser apagados' };
    const usuario = lerUsuario();
    const resto = usuario.filter((x) => x.id !== id);
    if (resto.length === usuario.length) return { ok: false, motivo: 'Fluxo não encontrado' };
    if (!gravarUsuario(resto)) return { ok: false, motivo: 'Não foi possível apagar neste navegador' };
    return { ok: true };
  }

  function novoVazio() {
    return fluxoBase(null, []);
  }

  return { listar, atual, salvar, apagar, marcarAtual, novoVazio };
}
/* Migração na 1ª abertura do painel novo (função pura; armazenamento injetado). Spec §9.
 *
 * Fato lido no código antigo: só são gravados tema, aba, pastas recentes, mensagem do Auto, contador e tickets do Auto.
 * Mensagem e pasta do Piloto/Envio/Pastas NÃO são persistidas, então só a mensagem do Auto migra (para o Enviar do
 * ⭐ Auto clássico). Roda uma vez (marca rf_rodbot_migracao_v1, que guarda a mensagem migrada) e não apaga nem
 * altera nenhuma chave antiga (dá para voltar ao HTML anterior). Nunca preenche MENSAGEM_PADRAO sozinho.
 */

const MIGRACAO_CHAVE = 'rf_rodbot_migracao_v1';
const MIGRACAO_AUTO_MSG_CHAVE = 'rf_rodbot_auto_msg_v1';

function migracaoLer(armazenamento) {
  try {
    const bruto = armazenamento.getItem(MIGRACAO_CHAVE);
    if (!bruto) return null;
    const o = JSON.parse(bruto);
    return o && typeof o === 'object' ? o : null;
  } catch (e) {
    return null;
  }
}

function migrarPrimeiraAbertura(armazenamento) {
  const feita = migracaoLer(armazenamento);
  if (feita) return { jaMigrado: true, mensagemAuto: feita.mensagemAuto || '' };
  let mensagemAuto = '';
  try {
    const msg = armazenamento.getItem(MIGRACAO_AUTO_MSG_CHAVE);
    if (typeof msg === 'string' && msg.trim()) mensagemAuto = msg;
  } catch (e) {
    mensagemAuto = '';
  }
  try {
    armazenamento.setItem(MIGRACAO_CHAVE, JSON.stringify({ v: 1, mensagemAuto }));
  } catch (e) {
    /* sem armazenamento: roda de novo na próxima abertura, sem prejuízo */
  }
  return { jaMigrado: false, mensagemAuto };
}

function mensagemAutoMigrada(armazenamento) {
  const feita = migracaoLer(armazenamento);
  return (feita && typeof feita.mensagemAuto === 'string') ? feita.mensagemAuto : '';
}

// A aba antiga salva (piloto|pasta|mensagem|fila|auto) ou qualquer outro valor abre em Montar (§3/§9).
// Acompanhar só aparece sozinho quando um fluxo é iniciado.
// (a chave antiga rf_rodbot_tab_v1 nem precisa ser lida: o resultado é sempre o mesmo)
function abaInicial(/* armazenamento */) {
  return 'montar';
}
/* Textos e operações dos passos da tela Montar (puro). Spec §3/§4. */

const PASSO_INFO = {
  atender: { icone: '📥', nome: 'Atender', titulo: 'Atender fila' },
  enviar: { icone: '✉️', nome: 'Enviar', titulo: 'Enviar' },
  espera: { icone: '⏸️', nome: 'Espera', titulo: 'Pausar' },
  mover: { icone: '📁', nome: 'Mover', titulo: 'Mover' },
  transferir: { icone: '🔁', nome: 'Transf.', titulo: 'Transferir' },
};
const PASSO_ORDEM_PALETA = ['atender', 'enviar', 'espera', 'mover', 'transferir'];

function novoPasso(tipo) {
  if (tipo === 'enviar') return { tipo, modo: 'so', mensagem: '', tag: '', velocidade: null };
  if (tipo === 'espera') return { tipo, modo: 'pausar', velocidade: null };
  if (tipo === 'mover') return { tipo, pasta: '', velocidade: null };
  if (tipo === 'transferir') return { tipo, atendente: '', velocidade: null };
  return { tipo: 'atender', velocidade: null };
}

function tituloPasso(p) {
  if (p.tipo === 'enviar') return '✉️ Enviar · ' + (p.modo === 'finalizar' ? 'Enviar + Finalizar' : 'Só enviar');
  if (p.tipo === 'espera') return p.modo === 'despausar' ? '▶️ Despausar' : '⏸️ Pausar';
  if (p.tipo === 'mover') return '📁 Mover' + ((p.pasta || '').trim() ? ' → ' + p.pasta.trim() : '');
  if (p.tipo === 'transferir' && p.para === 'fila') return '🔁 Transferir' + ((p.fila || '').trim() ? ' → fila ' + p.fila.trim() : '');
  if (p.tipo === 'transferir') return '🔁 Transferir' + ((p.atendente || '').trim() ? ' → ' + p.atendente.trim() : '');
  return '📥 Atender fila';
}

function passoCurto(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > max * 0.5 ? corte.slice(0, espaco) : corte).replace(/[\s.,;:!?]+$/, '') + '…';
}

function resumoPasso(p) {
  if (p.tipo === 'atender') return 'Puxa até zerar · sentinela quando a fila esvaziar';
  if (p.tipo === 'enviar') {
    if (!(p.mensagem || '').trim()) return 'Mensagem vazia';
    const msg = '“' + passoCurto(p.mensagem, 36) + '”';
    return p.modo === 'finalizar' ? msg + ' · tag ' + ((p.tag || '').trim() || '(vazia)') : msg;
  }
  if (p.tipo === 'espera') return p.modo === 'despausar' ? 'Tira os clientes da espera' : 'Coloca os clientes em espera';
  if (p.tipo === 'mover') return (p.pasta || '').trim() ? 'Move para a pasta' : 'Escolha a pasta';
  if (p.para === 'fila') return (p.fila || '').trim() ? 'Transfere para a fila' : 'Escolha a fila (nome exato)';
  return (p.atendente || '').trim() ? 'Transfere para o atendente' : 'Escolha o atendente (nome exato)';
}

function moverPasso(passos, i, delta) {
  const lista = passos.slice();
  const j = i + delta;
  if (j < 0 || j >= lista.length) return lista;
  const t = lista[i];
  lista[i] = lista[j];
  lista[j] = t;
  return lista;
}

function removerPasso(passos, i) {
  return passos.filter((_, k) => k !== i);
}
/* Passo a passo do Acompanhar (puro). Spec §3: os passos do usuário, na ordem dele, com status
 * Aguardando / Rodando / Feito / Falha. Precisa de passos-tela.js (tituloPasso). */

const STEPPER_TEXTOS = { aguardando: 'Aguardando', rodando: 'Rodando', feito: 'Feito', falha: 'Falha' };

// execucao: { status: { [indice]: 'aguardando'|'rodando'|'feito'|'falha' }, detalhe: { [indice]: texto } } (índice base 1)
function montarStepper(passos, execucao) {
  const st = (execucao && execucao.status) || {};
  const det = (execucao && execucao.detalhe) || {};
  return passos.map((p, i) => {
    const indice = i + 1;
    const status = STEPPER_TEXTOS[st[indice]] ? st[indice] : 'aguardando';
    const statusTexto = STEPPER_TEXTOS[status];
    const detalhe = det[indice] || '';
    return { indice, rotulo: tituloPasso(p), status, statusTexto, detalhe,
      texto: detalhe && status !== 'aguardando' ? statusTexto + ' · ' + detalhe : statusTexto };
  });
}

function novaExecucao({ nome, paraQuem, passos }) {
  return { nome, paraQuem, passos: JSON.parse(JSON.stringify(passos)), ciclo: 0, status: {}, detalhe: {}, fim: null };
}

// Eventos do motor: { tipo:'ciclo', n } | { tipo:'passo', indice, status, detalhe } | { tipo:'fim', status }
function aplicarEventoStepper(ex, ev) {
  const novo = { ...ex, status: { ...ex.status }, detalhe: { ...ex.detalhe } };
  if (ev.tipo === 'ciclo') novo.ciclo = ev.n;
  else if (ev.tipo === 'passo') {
    novo.status[ev.indice] = ev.status;
    if (ev.detalhe !== undefined) novo.detalhe[ev.indice] = ev.detalhe;
    else if (ev.status === 'aguardando') delete novo.detalhe[ev.indice];
  } else if (ev.tipo === 'fim') novo.fim = ev.status;
  return novo;
}

function rotuloExecucao(ex) {
  if (!ex) return 'Parado';
  if (ex.fim) return { concluido: 'Concluído', falha: 'Falha', parado: 'Parado' }[ex.fim] || 'Parado';
  if (ex.paraQuem === 'aguardando') return ex.ciclo ? 'Ciclo #' + ex.ciclo : 'Iniciando';
  return 'Vigiando';
}
  /* ========================================================
     TELA NOVA — MONTAR | ACOMPANHAR (Tarefas 15–21)
     Layout escolhido pelo BM: opção 2 · compacta (docs/plano/layouts/opcao-montar-2.png); Acompanhar como o layout D.
     É a única tela do painel (o painel antigo de 5 abas foi removido na Tarefa 22).
     ======================================================== */

  styleEl.textContent += `
    #ba-win[data-ui="nova"][data-rb-aba="montar"] #ba-run-bar,
    #ba-win[data-ui="nova"][data-rb-aba="montar"] .ba-telemetry,
    #ba-win[data-ui="nova"][data-rb-aba="montar"] #ba-log { display: none !important; }
    .rb-abas { display: flex; gap: 4px; padding: 4px; border-radius: 12px; background: var(--rb-elevated); border: 1px solid var(--rb-border); }
    .rb-aba { flex: 1; padding: 8px 4px; border-radius: 9px; border: 1px solid transparent; background: transparent;
      color: var(--rb-muted); font-weight: 600; font-size: 13px; line-height: 1.2; font-family: inherit; cursor: pointer; }
    .rb-aba:hover { color: var(--rb-text); }
    .rb-aba.ativa { background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border); }
    .rb-vista { display: none; flex-direction: column; gap: 10px; }
    .rb-vista.ativa { display: flex; }
    .rb-linha { display: flex; align-items: center; gap: 8px; }
    .rb-sub { color: var(--rb-muted); font-size: 12px; }
    .rb-sel { flex: 1; min-width: 0; padding: 7px 9px; border-radius: 9px; background: var(--rb-elevated);
      color: var(--rb-text); border: 1px solid var(--rb-border); font-size: 13px; font-family: inherit; }
    .rb-ib { width: 32px; height: 32px; border-radius: 9px; background: var(--rb-elevated); color: var(--rb-text);
      border: 1px solid var(--rb-border); cursor: pointer; font-size: 14px; }
    .rb-pq { padding: 4px 9px; border-radius: 999px; border: 1px solid var(--rb-border); background: transparent;
      color: var(--rb-muted); font-weight: 600; font-size: 12px; font-family: inherit; cursor: pointer; }
    .rb-pq.on { color: var(--rb-accent); border-color: var(--rb-accent-border); background: var(--rb-accent-dim); }
    @keyframes rb-pisca { 0%, 100% { box-shadow: none; } 50% { box-shadow: 0 0 0 3px var(--rb-accent-glow); } }
    .rb-pq-linha.rb-pisca .rb-pq { animation: rb-pisca 0.4s ease-in-out 3; border-color: var(--rb-accent-border); }
    .rb-pal { display: flex; gap: 6px; }
    .rb-pal button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px; padding: 7px 4px;
      border-radius: 10px; border: 1px solid var(--rb-border); background: var(--rb-card); color: var(--rb-muted);
      font-size: 12px; font-family: inherit; cursor: pointer; }
    .rb-pal button:hover { color: var(--rb-text); border-color: var(--rb-border-strong); }
    .rb-pal.rb-destaque button { border-color: var(--rb-accent-border); color: var(--rb-text); box-shadow: 0 0 0 2px var(--rb-accent-dim); }
    .rb-pal.rb-off button { opacity: 0.4; }
    .rb-dica { color: var(--rb-muted); font-size: 11.5px; text-align: center; }
    .rb-dica:empty { display: none; }
    .rb-passos { display: flex; flex-direction: column; gap: 8px; }
    .rb-passo { border-radius: 11px; border: 1px solid var(--rb-border); background: var(--rb-card); padding: 9px 10px; }
    .rb-passo.aberto { border-color: var(--rb-accent-border); }
    .rb-passo.erro { border-color: #f26060; background: rgba(242, 96, 96, 0.10); }
    .rb-passo-topo { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
    .rb-num { width: 24px; height: 24px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: var(--rb-elevated); border: 1px solid var(--rb-border); font-size: 12px; font-weight: 700; }
    .rb-passo-txt { flex: 1; min-width: 0; }
    .rb-passo-tit { font-weight: 700; font-size: 13.5px; }
    .rb-passo-res { color: var(--rb-muted); font-size: 12px; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rb-passo-erro { color: #f6a3a3; font-size: 12px; margin-top: 3px; }
    .rb-passo-erro:empty { display: none; }
    .rb-ctl { display: flex; gap: 4px; }
    .rb-ctl button { width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--rb-border);
      background: var(--rb-elevated); color: var(--rb-muted); cursor: pointer; font-size: 11px; padding: 0; }
    .rb-ctl button:disabled { opacity: 0.35; cursor: default; }
    .rb-campos { display: none; flex-direction: column; gap: 7px; margin-top: 8px; padding-left: 34px; }
    .rb-passo.aberto .rb-campos { display: flex; }
    .rb-seg { display: flex; gap: 3px; padding: 3px; border-radius: 10px; background: var(--rb-elevated); border: 1px solid var(--rb-border); }
    .rb-seg button { flex: 1; padding: 7px 4px; border-radius: 8px; border: 1px solid transparent; background: transparent;
      color: var(--rb-muted); font-weight: 600; font-size: 12.5px; font-family: inherit; cursor: pointer; }
    .rb-seg button.on { background: var(--rb-accent-dim); color: var(--rb-accent); border-color: var(--rb-accent-border); }
    .rb-in { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 9px; background: var(--rb-elevated);
      color: var(--rb-text); border: 1px solid var(--rb-border); font-size: 13px; font-family: inherit; resize: vertical; }
    .rb-in.rb-vazio { border-color: #f26060; background: rgba(242, 96, 96, 0.10); }
    .rb-in-vel { width: 82px; flex: none; }
    .rb-sp { flex: 1; }
    .rb-aviso { color: #fbbf24; font-size: 11.5px; }
    .rb-aviso:empty { display: none; }
    .rb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rb-chip { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--rb-border); background: var(--rb-elevated);
      color: var(--rb-text); font-size: 12.5px; font-family: inherit; cursor: pointer; }
    .rb-selo { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; background: #2b2210;
      color: #f5b041; border: 1px solid #5d4517; }
    .rb-selo:empty { display: none; }
    .rb-modal-ancora { position: sticky; top: 0; height: 0; z-index: 60; overflow: visible; }
    .rb-modal-fundo { position: absolute; top: 0; left: 0; right: 0; display: grid; place-items: center; padding: 18px;
      background: rgba(0, 0, 0, 0.62); border-radius: inherit; }
    .rb-modal { width: 100%; box-sizing: border-box; padding: 16px; border-radius: 14px; background: #151b20;
      border: 1px solid #6b2b2b; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8); color: var(--rb-text); }
    .rb-modal h3 { margin: 0 0 8px; color: #ff8a8a; font-size: 16px; font-weight: 700; }
    .rb-modal-linha { font-size: 14px; margin: 0 0 8px; }
    .rb-modal-detalhe { color: var(--rb-muted); font-size: 13px; margin: 0 0 14px; line-height: 1.45; }
    .rb-modal-btns { display: flex; gap: 10px; flex-wrap: wrap; }
    .rb-modal-btns button { flex: 1; min-width: 120px; padding: 11px 8px; border-radius: 11px; font-weight: 700; font-size: 14px; cursor: pointer;
      border: 1px solid var(--rb-border-strong); background: var(--rb-elevated); color: var(--rb-text); font-family: inherit; }
    .rb-modal-btns button.rb-primario { background: var(--rb-accent); color: var(--rb-on-accent); border-color: transparent; }
    .rb-ajustes { border-radius: 12px; border: 1px solid var(--rb-border); background: var(--rb-card); }
    .rb-ajustes-topo { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: transparent;
      border: 0; color: var(--rb-text); cursor: pointer; text-align: left; font-family: inherit; }
    .rb-ajustes-tit { font-weight: 700; font-size: 13px; }
    #rb-ajustes-res { flex: 1; min-width: 0; text-align: right; }
    .rb-ajustes-corpo { display: flex; flex-direction: column; gap: 10px; padding: 0 12px 12px; }
    .rb-ajustes-corpo[hidden], .rb-bloco[hidden] { display: none; }
    .rb-bloco { display: flex; flex-direction: column; gap: 4px; }
    .rb-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
    .rb-toggle input:disabled + * , .rb-toggle:has(input:disabled) { opacity: 0.6; cursor: not-allowed; }
    .rb-modal-neutro { border-color: var(--rb-border-strong); }
    .rb-modal-neutro h3 { color: var(--rb-text); }
    .rb-modal-campo { margin: 0 0 8px; }
    .rb-modal-campo[hidden] { display: none; }
    .rb-modal-erro { color: #f6a3a3; font-size: 12.5px; margin: 0 0 10px; min-height: 0; }
    .rb-modal-erro:empty { display: none; }
    #rb-alterado[hidden], #rb-apagar[hidden] { display: none; }
    .rb-acomp-topo { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px;
      border: 1px solid var(--rb-border); background: var(--rb-card); }
    .rb-acomp-nome { flex: 1; font-weight: 700; font-size: 14px; }
    .rb-pill { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--rb-accent-dim);
      color: var(--rb-accent); border: 1px solid var(--rb-accent-border); }
    .rb-pill[data-estado="parado"], .rb-pill[data-estado="concluido"] { background: var(--rb-elevated); color: var(--rb-muted); border-color: var(--rb-border); }
    .rb-pill[data-estado="falha"] { background: rgba(242, 96, 96, 0.12); color: #f6a3a3; border-color: rgba(242, 96, 96, 0.5); }
    .rb-stepper { display: flex; flex-direction: column; gap: 8px; }
    .rb-etapa { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px;
      border: 1px solid var(--rb-border); background: var(--rb-card); }
    .rb-etapa-marca { width: 26px; height: 26px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: var(--rb-elevated); border: 1px solid var(--rb-border); font-size: 12px; font-weight: 800; }
    .rb-etapa-txt { flex: 1; min-width: 0; }
    .rb-etapa-tit { font-weight: 700; font-size: 13.5px; }
    .rb-etapa-sub { font-size: 12px; color: var(--rb-muted); margin-top: 2px; }
    .rb-etapa[data-status="aguardando"] { opacity: 0.7; }
    .rb-etapa[data-status="rodando"] { border-color: var(--rb-accent); box-shadow: 0 0 0 2px var(--rb-accent-dim); }
    .rb-etapa[data-status="rodando"] .rb-etapa-sub { color: var(--rb-accent); }
    .rb-etapa[data-status="feito"] .rb-etapa-marca { background: var(--rb-accent); color: var(--rb-on-accent); border-color: transparent; }
    .rb-etapa[data-status="falha"] { border-color: #f26060; background: rgba(242, 96, 96, 0.10); }
    .rb-etapa[data-status="falha"] .rb-etapa-marca { background: #f26060; color: #fff; border-color: transparent; }
    .rb-etapa[data-status="falha"] .rb-etapa-sub { color: #f6a3a3; }
    #rb-acomp-auto[hidden] { display: none; }
    .rb-cta.rb-bloqueado { opacity: 0.45; }
    .rb-cta { padding: 12px; border-radius: 12px; border: 0; background: var(--rb-accent); color: var(--rb-on-accent);
      font-weight: 800; font-size: 15px; font-family: inherit; cursor: pointer; }
    .rb-cta:disabled { opacity: 0.45; cursor: not-allowed; }
  `;

  const telaArmazenamento = { getItem: k => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) };
  const tela = { fluxos: null, item: null, fluxo: null, aberto: null, exec: null };
  const rbAbas = {};
  const rbVistas = {};

  function telaAplicarAba(aba) {
    win.setAttribute('data-rb-aba', aba);
    if (aba === 'acompanhar') telaRenderAcompanhar();
    Object.keys(rbAbas).forEach(k => {
      rbAbas[k].classList.toggle('ativa', k === aba);
      rbAbas[k].setAttribute('aria-selected', String(k === aba));
      rbVistas[k].classList.toggle('ativa', k === aba);
    });
  }

  function telaMontarCasca() {
    const corpo = win.querySelector('.ba-body');
    const antesDe = document.getElementById('ba-run-bar');
    const abas = document.createElement('div');
    abas.className = 'rb-abas';
    abas.id = 'rb-abas';
    abas.setAttribute('role', 'tablist');
    abas.innerHTML = `
      <button type="button" class="rb-aba" id="rb-aba-montar" role="tab" data-rb-aba="montar">🧩 Montar</button>
      <button type="button" class="rb-aba" id="rb-aba-acompanhar" role="tab" data-rb-aba="acompanhar">📊 Acompanhar</button>`;
    const montar = document.createElement('div');
    montar.className = 'rb-vista';
    montar.id = 'rb-montar';
    const acompanhar = document.createElement('div');
    acompanhar.className = 'rb-vista';
    acompanhar.id = 'rb-acompanhar';
    corpo.insertBefore(abas, antesDe);
    corpo.insertBefore(montar, antesDe);
    corpo.insertBefore(acompanhar, antesDe);
    rbAbas.montar = abas.querySelector('#rb-aba-montar');
    rbAbas.acompanhar = abas.querySelector('#rb-aba-acompanhar');
    rbVistas.montar = montar;
    rbVistas.acompanhar = acompanhar;
    abas.addEventListener('click', e => {
      const b = e.target.closest('[data-rb-aba]');
      if (b) telaAplicarAba(b.dataset.rbAba);
    });
    win.setAttribute('data-ui', 'nova');
    migrarPrimeiraAbertura(telaArmazenamento);
    tela.fluxos = criarFluxosSalvos(telaArmazenamento, { mensagemAuto: mensagemAutoMigrada(telaArmazenamento) });
    telaCarregar(tela.fluxos.atual());
    telaMontarMontar();
    telaMontarAcompanhar();
    telaAplicarAba(abaInicial());
  }

  // ───────── Iniciar: roda uma CÓPIA do fluxo (editar o Montar durante a execução não muda o que está rodando)
  async function telaIniciar() {
    if (rodando || !podeIniciar(tela.fluxo)) return;
    const copia = JSON.parse(JSON.stringify(tela.fluxo));
    const simular = !!rbVistas.montar.querySelector('#rb-simular')?.checked;
    if (simular) {
      copia.loopEscolha = false; // a simulação passa uma vez pela lista
    } else if (copia.passos.some(x => x.tipo !== 'atender')) {
      const naTela = autoColetarTickets().ids.length;
      const ok = confirm(`⚠️ ENVIO REAL — fluxo "${tela.item.nome}"\n\n` +
        `Os passos vão rodar de verdade nos clientes (${naTela} carregados na lista agora; o bot rola a lista para buscar o resto).\n\n` +
        `Dica: rode antes com "🧪 Simular" marcado.\n\nIniciar agora?`);
      if (!ok) { log('⚠️ Iniciar cancelado.'); return; }
    }
    telaAplicarAba('acompanhar'); // §3: ao clicar em Iniciar o painel pula sozinho para Acompanhar
    const r = await fluxoIniciar(copia, { nome: tela.item.nome, simular });
    if (r.status === 'recusado' || r.status === 'invalido') log(`⚠️ Não iniciou: ${r.motivo}.`);
  }

  // ───────── Acompanhar (layout D): nome + ciclo, passo a passo do usuário, contadores do Auto (🆕/👥), Pausar/Parar e log
  function telaMontarAcompanhar() {
    rbVistas.acompanhar.innerHTML = `
      <div class="rb-acomp-topo"><span id="rb-acomp-nome" class="rb-acomp-nome"></span><span id="rb-acomp-ciclo" class="rb-pill"></span></div>
      <div id="rb-stepper" class="rb-stepper"></div>
      <div id="rb-acomp-auto" hidden></div>`;
    // os contadores do Auto são os mesmos elementos de antes (autoRender continua atualizando por id)
    const cartaoAuto = document.getElementById('ba-auto-count')?.closest('.ba-card');
    if (cartaoAuto) rbVistas.acompanhar.querySelector('#rb-acomp-auto').appendChild(cartaoAuto);
    fluxoOuvintes.push(telaAoEventoFluxo);
    telaRenderAcompanhar();
  }

  function telaAoEventoFluxo(ev) {
    if (ev.tipo === 'inicio') {
      tela.exec = novaExecucao({ nome: ev.nome, paraQuem: ev.fluxo.paraQuem, passos: ev.fluxo.passos });
    } else if (tela.exec) {
      tela.exec = aplicarEventoStepper(tela.exec, ev);
    }
    telaRenderAcompanhar();
    if (ev.tipo === 'inicio' || ev.tipo === 'fim') telaAtualizarMontar(); // Iniciar bloqueia enquanto roda
  }

  function telaRenderAcompanhar() {
    const v = rbVistas.acompanhar;
    if (!v || !tela.fluxo || !v.querySelector('#rb-acomp-nome')) return; // ainda não montado
    const base = tela.exec || { nome: tela.item.nome, paraQuem: tela.fluxo.paraQuem, passos: tela.fluxo.passos };
    v.querySelector('#rb-acomp-nome').textContent = base.nome;
    const pill = v.querySelector('#rb-acomp-ciclo');
    pill.textContent = rotuloExecucao(tela.exec);
    pill.dataset.estado = tela.exec ? (tela.exec.fim || 'rodando') : 'parado';
    const lista = v.querySelector('#rb-stepper');
    lista.innerHTML = '';
    for (const item of montarStepper(base.passos, tela.exec)) {
      const el = document.createElement('div');
      el.className = 'rb-etapa';
      el.dataset.status = item.status;
      el.innerHTML = '<span class="rb-etapa-marca"></span><div class="rb-etapa-txt"><div class="rb-etapa-tit"></div><div class="rb-etapa-sub"></div></div>';
      el.querySelector('.rb-etapa-marca').textContent = item.status === 'feito' ? '✓' : item.status === 'falha' ? '✕' : String(item.indice);
      el.querySelector('.rb-etapa-tit').textContent = item.rotulo;
      el.querySelector('.rb-etapa-sub').textContent = item.texto;
      lista.appendChild(el);
    }
    v.querySelector('#rb-acomp-auto').hidden = !(base.paraQuem === 'caindo' || base.paraQuem === 'ambos');
  }

  function telaCarregar(item) {
    tela.item = item;
    tela.fluxo = JSON.parse(JSON.stringify(item.fluxo));
    tela.original = JSON.parse(JSON.stringify(item.fluxo)); // base para "alterações não salvas"
    tela.aberto = null;
  }

  function telaSujo() {
    return !!tela.original && temAlteracoes(tela.fluxo, tela.original);
  }

  // ───────── Montar (opção 2 · compacta)
  function telaMontarMontar() {
    rbVistas.montar.innerHTML = `
      <div class="rb-linha">
        <select id="rb-fluxo-sel" class="rb-sel" title="Fluxo salvo"></select>
        <button type="button" id="rb-salvar" class="rb-ib" title="Salvar como novo fluxo">💾</button>
        <button type="button" id="rb-apagar" class="rb-ib" title="Apagar este fluxo" hidden>🗑</button>
        <button type="button" id="rb-novo" class="rb-ib" title="Novo fluxo vazio">＋</button>
      </div>
      <div id="rb-alterado" class="rb-aviso" hidden>● Alterações não salvas (💾 salva como um fluxo novo)</div>
      <div class="rb-linha rb-pq-linha" id="rb-pq">
        <span class="rb-sub">Para quem?</span>
        <button type="button" class="rb-pq" data-pq="aguardando">⏳ Aguardando</button>
        <button type="button" class="rb-pq" data-pq="caindo">🆕 Que vão cair</button>
        <button type="button" class="rb-pq" data-pq="ambos">👥 Ambos</button>
      </div>
      <div class="rb-pal" id="rb-paleta">
        ${PASSO_ORDEM_PALETA.map(t => `<button type="button" data-tipo="${t}" title="Adicionar ${PASSO_INFO[t].titulo}"><span>${PASSO_INFO[t].icone}</span>${PASSO_INFO[t].nome}</button>`).join('')}
      </div>
      <div class="rb-dica" id="rb-pal-dica"></div>
      <div class="rb-passos" id="rb-passos"></div>
      <div class="rb-ajustes" id="rb-ajustes">
        <button type="button" id="rb-ajustes-topo" class="rb-ajustes-topo" aria-expanded="false">
          <span class="rb-ajustes-tit">⚙️ Ajustes</span><span id="rb-ajustes-res" class="rb-sub"></span><span class="rb-sub rb-seta">▾</span>
        </button>
        <div class="rb-ajustes-corpo" id="rb-ajustes-corpo" hidden>
          <div class="rb-linha"><label class="rb-sub" for="rb-vel">Velocidade</label><span class="rb-sp"></span>
            <input id="rb-vel" class="rb-in rb-in-vel" inputmode="decimal"><span id="rb-vel-aviso" class="rb-aviso"></span></div>
          <div class="rb-sub">De 0.5 a 2.0 · maior = mais rápido · vale para as pausas entre ações</div>
          <div id="rb-loop-bloco" class="rb-bloco">
            <label class="rb-toggle"><input type="checkbox" id="rb-loop"> Repetir em loop (sentinela)</label>
            <div id="rb-loop-motivo" class="rb-sub"></div>
          </div>
          <div id="rb-ciclo-bloco" class="rb-bloco">
            <div class="rb-linha"><label class="rb-sub" for="rb-ciclo">Pausa entre ciclos (s)</label><span class="rb-sp"></span>
              <input id="rb-ciclo" class="rb-in rb-in-vel" inputmode="decimal"><span id="rb-ciclo-aviso" class="rb-aviso"></span></div>
            <div class="rb-sub">De 0 a 60 s · não muda com a velocidade</div>
          </div>
          <div id="rb-puxar-bloco" class="rb-bloco" hidden>
            <label class="rb-toggle"><input type="checkbox" id="rb-puxar"> Também puxar a fila (Atender)</label>
            <div class="rb-sub">O bot clica em Atender e quem for puxado recebe o fluxo uma vez</div>
          </div>
        </div>
      </div>
      <label class="rb-toggle" title="Abre cada chat e preenche o texto, mas não envia, não finaliza, não pausa, não move e não transfere">
        <input type="checkbox" id="rb-simular" checked> 🧪 Simular (não envia nada; desmarque para o envio real)</label>
      <button type="button" id="rb-iniciar" class="rb-cta">⚡ Iniciar fluxo</button>
      <div class="rb-dica" id="rb-iniciar-dica"></div>`;
    const v = rbVistas.montar;
    v.querySelector('#rb-fluxo-sel').addEventListener('change', e => {
      const item = tela.fluxos.listar().find(x => x.id === e.target.value);
      if (!item) return;
      if (telaSujo()) e.target.value = tela.item.id || ''; // enquanto a pergunta está aberta, o seletor mostra o fluxo atual
      telaAntesDeTrocar(() => { telaCarregar(item); tela.fluxos.marcarAtual(item.id); telaRenderMontar(); });
    });
    v.querySelector('#rb-novo').addEventListener('click', () => {
      telaAntesDeTrocar(() => {
        telaCarregar({ id: null, nome: 'Novo fluxo', modelo: false, fluxo: tela.fluxos.novoVazio() });
        telaRenderMontar();
      });
    });
    v.querySelector('#rb-salvar').addEventListener('click', () => telaPedirNome(null));
    v.querySelector('#rb-apagar').addEventListener('click', telaConfirmarApagar);
    v.querySelector('#rb-pq').addEventListener('click', e => {
      const b = e.target.closest('[data-pq]');
      if (!b) return;
      tela.fluxo.paraQuem = b.dataset.pq;
      telaRenderMontar();
    });
    v.querySelector('#rb-paleta').addEventListener('click', e => {
      const b = e.target.closest('[data-tipo]');
      if (b) telaAdicionarPasso(b.dataset.tipo);
    });
    v.querySelector('#rb-passos').addEventListener('click', e => {
      const card = e.target.closest('.rb-passo');
      if (!card) return;
      const i = Number(card.dataset.i);
      const acao = e.target.closest('[data-acao]')?.dataset.acao;
      if (acao === 'subir' || acao === 'descer') {
        tela.fluxo.passos = moverPasso(tela.fluxo.passos, i, acao === 'subir' ? -1 : 1);
        if (tela.aberto === i) tela.aberto = i + (acao === 'subir' ? -1 : 1);
        else if (tela.aberto === i + (acao === 'subir' ? -1 : 1)) tela.aberto = i;
      } else if (acao === 'remover') {
        tela.fluxo.passos = removerPasso(tela.fluxo.passos, i);
        if (tela.aberto === i) tela.aberto = null;
        else if (tela.aberto !== null && tela.aberto > i) tela.aberto--;
      } else if (e.target.closest('.rb-passo-topo')) {
        tela.aberto = tela.aberto === i ? null : i; // só um cartão aberto por vez
      } else {
        return;
      }
      telaRenderMontar();
    });
    telaLigarCampos(v.querySelector('#rb-passos'));
    telaLigarAjustes(v);
    v.querySelector('#rb-iniciar').addEventListener('click', () => {
      if (!podeIniciar(tela.fluxo)) {
        // ordem inválida: o botão continua clicável para o modal explicar o motivo (§6)
        const erro = erroDoModal((validarFluxo(tela.fluxo).erros || []));
        if (erro && erro.indice) telaAbrirModal(erro);
        return;
      }
      telaIniciar();
    });
    telaRenderMontar();
  }

  function telaPiscarParaQuem() {
    const linha = document.getElementById('rb-pq');
    linha.classList.remove('rb-pisca');
    void linha.offsetWidth; // reinicia a animação
    linha.classList.add('rb-pisca');
    setTimeout(() => linha.classList.remove('rb-pisca'), 1300);
  }

  function telaAdicionarPasso(tipo) {
    const f = tela.fluxo;
    if (!f.paraQuem) { telaPiscarParaQuem(); return; }
    if (f.passos.length >= FLUXO_MAX_PASSOS) return;
    if (tipo === 'atender' && !disponibilidade(f.paraQuem).atender) return;
    f.passos.push(novoPasso(tipo));
    tela.aberto = f.passos.length - 1;
    telaRenderMontar();
    const doNovo = (validarFluxo(f).erros || []).filter(e => e.indice === f.passos.length);
    if (doNovo.length) telaAbrirModal(erroDoModal(doNovo));
  }

  // ───────── Diálogos dos fluxos salvos (mesmo visual do modal de ordem; textos só por textContent)
  function telaDialogo({ titulo, linha, detalhe, campo, botoes }) {
    telaFecharModal();
    const ancora = document.createElement('div');
    ancora.className = 'rb-modal-ancora';
    ancora.innerHTML = `
      <div class="rb-modal-fundo">
        <div class="rb-modal rb-modal-neutro" role="dialog" aria-modal="true" aria-labelledby="rb-modal-tit">
          <h3 id="rb-modal-tit"></h3>
          <p class="rb-modal-linha"></p>
          <p class="rb-modal-detalhe"></p>
          <input class="rb-in rb-modal-campo" hidden maxlength="40">
          <p class="rb-modal-erro" role="alert"></p>
          <div class="rb-modal-btns"></div>
        </div>
      </div>`;
    ancora.querySelector('h3').textContent = titulo;
    ancora.querySelector('.rb-modal-linha').textContent = linha || '';
    ancora.querySelector('.rb-modal-detalhe').textContent = detalhe || '';
    const input = ancora.querySelector('.rb-modal-campo');
    const erro = ancora.querySelector('.rb-modal-erro');
    if (campo) { input.hidden = false; input.placeholder = campo.placeholder || ''; input.value = campo.valor || ''; }
    const btns = ancora.querySelector('.rb-modal-btns');
    let primeiro = null;
    for (const b of botoes) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.texto;
      if (b.primario) el.className = 'rb-primario';
      // a ação pode devolver um texto de erro: o diálogo continua aberto e mostra o erro
      el.addEventListener('click', () => {
        const msg = b.acao ? b.acao(input.value) : null;
        if (typeof msg === 'string' && msg) { erro.textContent = msg; return; }
        telaFecharModal();
        if (b.depois) b.depois();
      });
      btns.appendChild(el);
      if (!primeiro) primeiro = el;
    }
    win.insertBefore(ancora, win.firstChild);
    ancora.querySelector('.rb-modal-fundo').style.height = win.clientHeight + 'px';
    (campo ? input : primeiro).focus();
    ancora.addEventListener('keydown', e => {
      if (e.key === 'Escape') { telaFecharModal(); telaRenderMontar(); }
      if (e.key === 'Enter' && campo) { e.preventDefault(); btns.querySelector('.rb-primario')?.click(); }
    });
    return ancora;
  }

  // 💾: sempre cria um fluxo NOVO com nome. `depois` roda se salvar (usado na troca de fluxo).
  function telaPedirNome(depois) {
    telaDialogo({
      titulo: '💾 Salvar como novo fluxo',
      linha: 'Dê um nome ao fluxo.',
      detalhe: 'Até 10 fluxos seus (os modelos ⭐ não contam). Modelos nunca são alterados.',
      campo: { placeholder: 'Ex.: Mensagem de atualização', valor: '' },
      botoes: [
        { texto: 'Cancelar', acao: () => null, depois: () => telaRenderMontar() },
        {
          texto: 'Salvar', primario: true,
          acao: nome => {
            const r = tela.fluxos.salvar(nome, tela.fluxo);
            if (!r.ok) return r.motivo;
            const salvo = tela.fluxos.listar().find(x => x.id === r.id);
            telaCarregar(salvo);
            tela.fluxos.marcarAtual(r.id);
            return null;
          },
          depois: () => { telaRenderMontar(); if (depois) depois(); },
        },
      ],
    });
  }

  // Trocar de fluxo (ou criar um vazio) com alterações pendentes pergunta o que fazer (§9).
  function telaAntesDeTrocar(seguir) {
    if (!telaSujo()) { seguir(); return; }
    telaDialogo({
      titulo: 'Alterações não salvas',
      linha: 'Você mexeu em "' + tela.item.nome + '".',
      detalhe: 'Salvar como novo guarda uma cópia com as alterações. Descartar volta o fluxo ao que estava salvo.',
      botoes: [
        { texto: 'Voltar', acao: () => null, depois: () => telaRenderMontar() },
        { texto: 'Descartar', acao: () => null, depois: seguir },
        { texto: 'Salvar como novo', primario: true, acao: () => null, depois: () => telaPedirNome(seguir) },
      ],
    });
  }

  function telaConfirmarApagar() {
    const id = tela.item.id;
    if (!id || tela.item.modelo) return;
    telaDialogo({
      titulo: 'Apagar fluxo',
      linha: 'Apagar "' + tela.item.nome + '"?',
      detalhe: 'Isso não pode ser desfeito.',
      botoes: [
        { texto: 'Cancelar', acao: () => null },
        {
          texto: 'Apagar', primario: true,
          acao: () => { const r = tela.fluxos.apagar(id); return r.ok ? null : r.motivo; },
          depois: () => { const atual = tela.fluxos.listar()[0]; telaCarregar(atual); tela.fluxos.marcarAtual(atual.id); telaRenderMontar(); },
        },
      ],
    });
  }

  // ───────── Modal de ordem inválida (layout-M)
  function telaFecharModal() {
    const m = win.querySelector('.rb-modal-ancora');
    if (m) m.remove();
  }

  function telaAbrirModal(erro) {
    telaFecharModal();
    const t = textoModal(erro, tela.fluxo.passos);
    const ancora = document.createElement('div');
    ancora.className = 'rb-modal-ancora';
    ancora.innerHTML = `
      <div class="rb-modal-fundo">
        <div class="rb-modal" role="dialog" aria-modal="true" aria-labelledby="rb-modal-tit">
          <h3 id="rb-modal-tit"></h3>
          <p class="rb-modal-linha"></p>
          <p class="rb-modal-detalhe"></p>
          <div class="rb-modal-btns"></div>
        </div>
      </div>`;
    ancora.querySelector('h3').textContent = '⛔ ' + t.titulo;
    ancora.querySelector('.rb-modal-linha').textContent = t.linha;
    ancora.querySelector('.rb-modal-detalhe').textContent = t.detalhe;
    const btns = ancora.querySelector('.rb-modal-btns');
    const botao = (texto, classe, acao) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      if (classe) b.className = classe;
      b.addEventListener('click', () => { telaFecharModal(); if (acao) acao(); });
      btns.appendChild(b);
      return b;
    };
    const entendi = botao('Entendi', '', null);
    if (erro.sugestao) {
      botao(erro.sugestao.texto, '', () => {
        tela.fluxo.passos.splice(erro.sugestao.indice - 1, 0, novoPasso('espera'));
        tela.fluxo.passos[erro.sugestao.indice - 1].modo = 'despausar';
        tela.aberto = null;
        telaRenderMontar();
      });
    }
    if (erro.correcao && erro.correcao.acao === 'remover') {
      botao(erro.correcao.texto, 'rb-primario', () => {
        tela.fluxo.passos = removerPasso(tela.fluxo.passos, erro.correcao.indice - 1);
        tela.aberto = null;
        telaRenderMontar();
      });
    }
    win.insertBefore(ancora, win.firstChild);
    ancora.querySelector('.rb-modal-fundo').style.height = win.clientHeight + 'px';
    entendi.focus();
    ancora.addEventListener('keydown', e => { if (e.key === 'Escape') telaFecharModal(); });
  }

  function telaRenderMontar() {
    const v = rbVistas.montar;
    const f = tela.fluxo;
    // seletor de fluxos
    const sel = v.querySelector('#rb-fluxo-sel');
    sel.innerHTML = '';
    const itens = tela.fluxos.listar();
    if (!tela.item.id) itens.unshift({ id: '', nome: tela.item.nome });
    for (const it of itens) {
      const o = document.createElement('option');
      o.value = it.id || '';
      o.textContent = it.nome;
      sel.appendChild(o);
    }
    sel.value = tela.item.id || '';
    v.querySelector('#rb-apagar').hidden = !tela.item.id || !!tela.item.modelo;
    telaAtualizarAlterado();
    // Para quem?
    v.querySelectorAll('.rb-pq').forEach(b => b.classList.toggle('on', b.dataset.pq === f.paraQuem));
    // paleta
    const pal = v.querySelector('#rb-paleta');
    const disp = disponibilidade(f.paraQuem);
    const cheio = f.passos.length >= FLUXO_MAX_PASSOS;
    pal.querySelector('[data-tipo="atender"]').hidden = !!f.paraQuem && !disp.atender;
    pal.classList.toggle('rb-off', !f.paraQuem || cheio);
    pal.classList.toggle('rb-destaque', !!f.paraQuem && f.passos.length === 0);
    v.querySelector('#rb-pal-dica').textContent = !f.paraQuem ? 'Escolha para quem primeiro'
      : cheio ? 'Máximo ' + FLUXO_MAX_PASSOS + ' passos'
        : f.passos.length === 0 ? 'Toque num ícone para adicionar um passo' : '';
    // passos (estrutura); o que muda ao digitar é atualizado por telaAtualizarMontar, sem perder o foco
    const lista = v.querySelector('#rb-passos');
    lista.innerHTML = '';
    f.passos.forEach((passo, i) => {
      const card = document.createElement('div');
      card.className = 'rb-passo' + (tela.aberto === i ? ' aberto' : '');
      card.dataset.i = String(i);
      card.innerHTML = `
        <div class="rb-passo-topo">
          <span class="rb-num"></span>
          <div class="rb-passo-txt"><div class="rb-passo-tit"><span class="rb-tit-txt"></span> <span class="rb-selo"></span></div>
            <div class="rb-passo-res"></div><div class="rb-passo-erro"></div></div>
          <div class="rb-ctl">
            <button type="button" data-acao="subir" title="Subir">▲</button>
            <button type="button" data-acao="descer" title="Descer">▼</button>
            <button type="button" data-acao="remover" title="Remover">✕</button>
          </div>
        </div>
        <div class="rb-campos"></div>`;
      card.querySelector('.rb-num').textContent = String(i + 1);
      card.querySelector('[data-acao="subir"]').disabled = i === 0;
      card.querySelector('[data-acao="descer"]').disabled = i === f.passos.length - 1;
      telaMontarCampos(card.querySelector('.rb-campos'), passo, f);
      lista.appendChild(card);
    });
    telaAtualizarMontar();
    telaAtualizarAjustes();
    if (!tela.exec) telaRenderAcompanhar();
  }

  // ───────── ⚙️ Ajustes (velocidade, loop, pausa entre ciclos, puxar a fila)
  function telaTextoSegundos(n) {
    return String(n).replace('.', ',');
  }

  function telaAtualizarAlterado() {
    rbVistas.montar.querySelector('#rb-alterado').hidden = !telaSujo();
  }

  function telaAtualizarAjustes() {
    telaAtualizarAlterado();
    const v = rbVistas.montar;
    const f = tela.fluxo;
    const porChat = f.paraQuem === 'caindo' || f.paraQuem === 'ambos';
    const loop = loopEfetivo(f);
    const partes = ['Velocidade ' + Number(f.velocidade).toFixed(1)];
    if (porChat) partes.push(f.puxarFila ? 'Puxa a fila' : 'Sem puxar a fila');
    else if (loop.efetivo) partes.push('🔁 Loop ligado', telaTextoSegundos(f.pausaCiclos) + ' s entre ciclos');
    else partes.push('🔁 Loop desligado');
    v.querySelector('#rb-ajustes-res').textContent = partes.join(' · ');
    v.querySelector('#rb-loop-bloco').hidden = porChat;
    v.querySelector('#rb-ciclo-bloco').hidden = porChat;
    v.querySelector('#rb-puxar-bloco').hidden = !porChat;
    const campo = (id, valor) => { const el = v.querySelector(id); if (document.activeElement !== el) el.value = valor; };
    campo('#rb-vel', Number(f.velocidade).toFixed(1));
    campo('#rb-ciclo', String(f.pausaCiclos));
    const caixaLoop = v.querySelector('#rb-loop');
    caixaLoop.checked = !!f.loopEscolha; // a escolha do usuário nunca se perde (§7)
    caixaLoop.disabled = !loop.habilitado;
    v.querySelector('#rb-loop-motivo').textContent = loop.habilitado ? '' : (loop.motivo || '');
    v.querySelector('#rb-puxar').checked = !!f.puxarFila;
  }

  function telaLigarAjustes(v) {
    const topo = v.querySelector('#rb-ajustes-topo');
    const corpo = v.querySelector('#rb-ajustes-corpo');
    topo.addEventListener('click', () => {
      corpo.hidden = !corpo.hidden;
      topo.setAttribute('aria-expanded', String(!corpo.hidden));
      v.querySelector('.rb-seta').textContent = corpo.hidden ? '▾' : '▴';
    });
    v.querySelector('#rb-vel').addEventListener('change', e => {
      const n = normalizarVelocidade(e.target.value);
      tela.fluxo.velocidade = n.valor;
      e.target.value = n.valor.toFixed(1);
      v.querySelector('#rb-vel-aviso').textContent = n.aviso || '';
      telaAtualizarAjustes();
    });
    v.querySelector('#rb-ciclo').addEventListener('change', e => {
      const n = normalizarPausaCiclos(e.target.value);
      tela.fluxo.pausaCiclos = n.valor;
      e.target.value = String(n.valor);
      v.querySelector('#rb-ciclo-aviso').textContent = n.aviso || '';
      telaAtualizarAjustes();
    });
    v.querySelector('#rb-loop').addEventListener('change', e => {
      tela.fluxo.loopEscolha = e.target.checked;
      telaAtualizarAjustes();
    });
    v.querySelector('#rb-puxar').addEventListener('change', e => {
      tela.fluxo.puxarFila = e.target.checked;
      telaAtualizarAjustes();
    });
  }

  function telaSeg(campo, opcoes, atual) {
    return `<div class="rb-seg" data-campo="${campo}">${opcoes.map(([v, rot, oculto]) =>
      `<button type="button" data-v="${v}" class="${v === atual ? 'on' : ''}"${oculto ? ' hidden' : ''}>${rot}</button>`).join('')}</div>`;
  }

  function telaChipsPastas() {
    const lista = [];
    for (const nome of [...DEFAULT_FOLDERS, ...getRecentFolders()]) {
      if (!lista.some(x => x.toLowerCase() === nome.toLowerCase())) lista.push(nome);
    }
    return lista.slice(0, 6);
  }

  // Campos de cada bloco (§4). Textos do usuário entram por .value / textContent, nunca por HTML.
  function telaMontarCampos(caixa, passo, f) {
    let html = '';
    if (passo.tipo === 'enviar') {
      html += telaSeg('modo', [['so', '🛡️ Só enviar'], ['finalizar', '⚡ Enviar + Finalizar']], passo.modo);
      html += '<textarea class="rb-in" data-campo="mensagem" rows="3" placeholder="Mensagem para o cliente"></textarea>';
      html += '<div class="rb-linha"><button type="button" class="rb-chip" data-acao-campo="padrao">📋 Usar padrão</button></div>';
      if (passo.modo === 'finalizar') html += '<input class="rb-in" data-campo="tag" placeholder="Tag (ex.: Resolvido)">';
    } else if (passo.tipo === 'espera') {
      const semDespausar = !disponibilidade(f.paraQuem).despausar && passo.modo !== 'despausar';
      html += telaSeg('modo', [['pausar', '⏸️ Pausar'], ['despausar', '▶️ Despausar', semDespausar]], passo.modo);
    } else if (passo.tipo === 'mover') {
      html += '<input class="rb-in" data-campo="pasta" placeholder="Nome da pasta">';
      html += `<div class="rb-chips">${telaChipsPastas().map(() => '<button type="button" class="rb-chip" data-pasta=""></button>').join('')}</div>`;
    } else if (passo.tipo === 'transferir') {
      const para = passo.para === 'fila' ? 'fila' : 'atendente';
      html += telaSeg('para', [['atendente', '👤 Atendente'], ['fila', '👥 Fila']], para);
      html += para === 'fila'
        ? '<input class="rb-in" data-campo="fila" placeholder="Nome da fila (exato, como no Blip)">'
        : '<input class="rb-in" data-campo="atendente" placeholder="Nome do atendente (exato, como no Blip)">';
    }
    html += `<div class="rb-linha rb-vel"><span class="rb-sub">Velocidade deste passo</span><span class="rb-sp"></span>
      <input class="rb-in rb-in-vel" data-campo="velocidade" placeholder="do fluxo" inputmode="decimal"><span class="rb-aviso"></span></div>`;
    caixa.innerHTML = html;
    for (const el of caixa.querySelectorAll('[data-campo="mensagem"], [data-campo="tag"], [data-campo="pasta"], [data-campo="atendente"], [data-campo="fila"]')) {
      el.value = passo[el.dataset.campo] || '';
    }
    if (passo.tipo === 'mover') {
      const chips = caixa.querySelectorAll('[data-pasta]');
      telaChipsPastas().forEach((nome, k) => { chips[k].dataset.pasta = nome; chips[k].textContent = nome; });
    }
    const vel = caixa.querySelector('[data-campo="velocidade"]');
    vel.value = passo.velocidade === null || passo.velocidade === undefined ? '' : Number(passo.velocidade).toFixed(1);
  }

  // Atualiza o que depende dos valores (títulos, selo, resumos, erros, campos vazios, Iniciar) sem recriar os campos.
  function telaAtualizarMontar() {
    telaAtualizarAlterado();
    const v = rbVistas.montar;
    const f = tela.fluxo;
    const validacao = validarFluxo(f);
    v.querySelectorAll('#rb-passos .rb-passo').forEach(card => {
      const i = Number(card.dataset.i);
      const passo = f.passos[i];
      const errosDoPasso = (validacao.erros || []).filter(e => e.indice === i + 1);
      const principal = errosDoPasso.length ? erroDoModal(errosDoPasso) : null;
      card.classList.toggle('erro', !!principal);
      card.querySelector('.rb-tit-txt').textContent = tituloPasso(passo);
      card.querySelector('.rb-selo').textContent = seloVelocidade(passo) || '';
      card.querySelector('.rb-passo-res').textContent = resumoPasso(passo);
      card.querySelector('.rb-passo-erro').textContent = principal
        ? (principal.dica ? principal.mensagem + ' · ' + principal.dica : principal.mensagem) : '';
      const faltando = validarCampos(passo).map(x => x.campo);
      card.querySelectorAll('[data-campo]').forEach(el => el.classList.toggle('rb-vazio', faltando.includes(el.dataset.campo)));
    });
    const pode = podeIniciar(f) && !rodando;
    const btnIniciar = v.querySelector('#rb-iniciar');
    btnIniciar.textContent = rodando ? '⏳ Fluxo rodando…' : '⚡ Iniciar fluxo';
    const temErroDePasso = (validacao.erros || []).some(e => e.indice);
    // bloqueado em qualquer caso; só fica "clicável" (aria-disabled) quando há erro de ordem, para abrir o modal
    btnIniciar.disabled = !pode && !temErroDePasso;
    btnIniciar.classList.toggle('rb-bloqueado', !pode);
    if (pode) btnIniciar.removeAttribute('aria-disabled');
    else btnIniciar.setAttribute('aria-disabled', 'true');
    const primeiro = erroDoModal(validacao.erros || []);
    const vazio = f.passos.findIndex(p => validarCampos(p).length);
    v.querySelector('#rb-iniciar-dica').textContent = pode ? ''
      : rodando ? 'Só um fluxo por vez: acompanhe ou pare em Acompanhar'
      : !f.paraQuem ? 'Escolha para quem primeiro'
        : !f.passos.length ? 'Toque num ícone da paleta para começar'
          : primeiro && primeiro.indice ? 'Corrija o passo ' + primeiro.indice
            : primeiro ? primeiro.mensagem
              : vazio >= 0 ? 'Preencha o passo ' + (vazio + 1) : '';
  }

  function telaLigarCampos(lista) {
    const passoDe = el => tela.fluxo.passos[Number(el.closest('.rb-passo').dataset.i)];
    lista.addEventListener('input', e => {
      const campo = e.target.dataset && e.target.dataset.campo;
      if (!campo || campo === 'velocidade') return;
      passoDe(e.target)[campo] = e.target.value;
      telaAtualizarMontar();
    });
    lista.addEventListener('change', e => {
      if (!e.target.dataset || e.target.dataset.campo !== 'velocidade') return;
      const passo = passoDe(e.target);
      const aviso = e.target.parentElement.querySelector('.rb-aviso');
      if (!e.target.value.trim()) {
        passo.velocidade = null;
        aviso.textContent = '';
      } else {
        const n = normalizarVelocidade(e.target.value);
        passo.velocidade = n.valor;
        e.target.value = n.valor.toFixed(1);
        aviso.textContent = n.aviso || '';
      }
      telaAtualizarMontar();
    });
    lista.addEventListener('click', e => {
      const seg = e.target.closest('.rb-seg [data-v]');
      const chip = e.target.closest('[data-pasta]');
      const padrao = e.target.closest('[data-acao-campo="padrao"]');
      if (!seg && !chip && !padrao) return;
      const passo = passoDe(e.target);
      if (seg) passo[seg.parentElement.dataset.campo] = seg.dataset.v;
      if (chip) passo.pasta = chip.dataset.pasta;
      if (padrao) passo.mensagem = MENSAGEM_PADRAO; // só quando o usuário toca (§9)
      telaRenderMontar();
    });
  }

  telaMontarCasca();

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
    if (window.__rodBot) delete window.__rodBot;
    if (window.__rodBotCleanup === fecharPainel) {
      delete window.__rodBotCleanup;
    }
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
    if (!regs.length) { log('ℹ️ Nenhuma execução registrada ainda.'); return; }
    baixarArquivo(`rodbot-relatorio_${carimboArquivo()}.csv`, loteCsv(regs), 'text/csv;charset=utf-8');
    log(`📄 Relatório baixado (execução de ${(dados && dados.inicio) || 'agora'}: ${loteResumo(regs).texto}).`);
  };
  btnClose.onclick = fecharPainel;
  window.__rodBotCleanup = fecharPainel;
  log(`🤖 rod bot ${LOTE_VERSAO} pronto! Monte o fluxo e toque em Iniciar.`);
  if (logLerSalvo().length > 1) log(`💾 Há log salvo de antes (${logLerSalvo().length} linhas): clique em "💾 Log" para baixar.`);
})();;void 0;