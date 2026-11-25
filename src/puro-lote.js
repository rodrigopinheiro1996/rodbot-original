/* Funções puras do lote "Enviar + Finalizar" (v10.1). Nada aqui toca o DOM: são testadas no Node
 * (tests/puro-lote.test.js) e o build cola este arquivo dentro do bookmarklet no marcador PURO-LOTE.
 */

const LOTE_VERSAO = 'v10.1';
const LOTE_MEMORIA_CHAVE = 'rf_rodbot_lote_envios_v1'; // quem já recebeu a mensagem do lote (24 h)
const LOTE_RELATORIO_CHAVE = 'rf_rodbot_lote_relatorio_v1'; // resultado do último lote (sobrevive a reinício)
const LOTE_LOG_CHAVE = 'rf_rodbot_log_v1'; // log salvo (sobrevive a reinício do PC)
const LOTE_MEMORIA_TTL = 24 * 60 * 60 * 1000;
const LOTE_MEMORIA_MAX = 3000;
const LOTE_LOG_MAX_SALVO = 4000; // linhas guardadas no navegador
const LOTE_LOG_MAX_TELA = 1500; // linhas mostradas no painel (mais que isso deixa a página lenta)
const LOTE_FALHAS_SEGUIDAS = 8; // tantas falhas seguidas = problema geral: o lote pausa e espera você
const LOTE_ROLAGENS_FIM = 6; // quantas vezes rola a lista procurando mais clientes antes de terminar
const LOTE_SALTO_MS = 30000; // relógio pulou mais que isso = o navegador ficou parado (tela bloqueada/suspensão)

// Estados gravados na memória do lote. Qualquer estado diferente de 'nao_enviado' bloqueia novo envio.
const LOTE_ESTADOS_TEXTO = {
  finalizado: 'enviado e finalizado',
  parcial: 'enviado, NÃO finalizado',
  incerto: 'envio incerto (confira)',
  enviando: 'envio interrompido (confira)',
  pulado: 'pulado',
  falha: 'falha (nada enviado)',
  simulado: 'simulado (nada enviado)',
};

// Próximo ticket da lista que ainda não foi tentado nesta execução. null = acabou o que está na tela.
function loteEscolherProximo(ids, tentados) {
  for (const id of ids || []) {
    if (id && !tentados.has(id)) return id;
  }
  return null;
}

// Tira da memória o que passou de 24 h e corta os mais antigos se passar do máximo.
function loteMemoriaLimpar(memoria, agora, ttl = LOTE_MEMORIA_TTL, max = LOTE_MEMORIA_MAX) {
  const o = {};
  for (const k of Object.keys(memoria || {})) {
    const r = memoria[k];
    if (r && typeof r === 'object' && agora - (r.ts || 0) <= ttl) o[k] = r;
  }
  const chaves = Object.keys(o).sort((a, b) => (o[a].ts || 0) - (o[b].ts || 0));
  while (chaves.length > max) delete o[chaves.shift()];
  return o;
}

// true = este ticket já recebeu (ou pode ter recebido) a mensagem: NUNCA enviar de novo.
function loteJaRecebeu(memoria, id) {
  const r = memoria && memoria[id];
  return !!(r && r.estado && r.estado !== 'nao_enviado');
}

// Escolhe a opção de tag: primeiro a igual ao texto digitado, depois a que contém o texto.
// Sem nenhuma = -1 (o bot NÃO clica na primeira opção da lista; pula o cliente).
function loteEscolherTag(textos, termo) {
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').toUpperCase().trim();
  const alvo = norm(termo);
  if (!alvo) return -1;
  const lista = (textos || []).map(norm);
  const igual = lista.indexOf(alvo);
  if (igual !== -1) return igual;
  return lista.findIndex((t) => t.includes(alvo));
}

// Reserva do modal de finalizar: só aceita botão que diz "Finalizar" ou "Confirmar"; nunca Cancelar/Voltar/Fechar.
function loteBotaoConfirmaFinalizar(texto) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  if (!t || t.includes('cancelar') || t.includes('voltar') || t.includes('fechar')) return false;
  return t.includes('finalizar') || t.includes('confirmar');
}

// Quanto tempo o navegador ficou parado entre duas batidas do relógio (0 = normal).
function loteSalto(antes, agora, intervalo, limite = LOTE_SALTO_MS) {
  const atraso = agora - antes - intervalo;
  return atraso > limite ? atraso : 0;
}

function loteDuracao(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return s + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');
  return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}

// Resumo do lote a partir dos registros [{ id, resultado, motivo, hora }].
function loteResumo(registros) {
  const c = { finalizado: 0, parcial: 0, incerto: 0, pulado: 0, falha: 0, simulado: 0 };
  for (const r of registros || []) {
    if (c[r.resultado] !== undefined) c[r.resultado]++;
  }
  const partes = [];
  if (c.simulado) partes.push(c.simulado + ' simulados');
  partes.push(c.finalizado + ' enviados e finalizados');
  if (c.parcial) partes.push(c.parcial + ' enviados SEM finalizar');
  if (c.incerto) partes.push(c.incerto + ' com envio incerto');
  partes.push(c.pulado + ' pulados');
  partes.push(c.falha + ' falhas');
  return { contagem: c, texto: partes.join(' · ') };
}

// Relatório CSV (separador ; para abrir direto no Excel). Só id do ticket, nada da conversa.
function loteCsv(registros) {
  const esc = (v) => {
    const s = String(v === undefined || v === null ? '' : v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const linhas = ['Ticket;Resultado;Motivo;Hora'];
  for (const r of registros || []) {
    linhas.push([r.id, LOTE_ESTADOS_TEXTO[r.resultado] || r.resultado, r.motivo, r.hora].map(esc).join(';'));
  }
  return '﻿' + linhas.join('\r\n') + '\r\n';
}

// Mantém só as últimas `max` linhas.
function loteLimitarLinhas(linhas, max) {
  return linhas.length > max ? linhas.slice(linhas.length - max) : linhas;
}
