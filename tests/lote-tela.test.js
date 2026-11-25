// Teste de tela do fluxo "Enviar + Finalizar" (painel de fluxos da V10) contra a página FALSA do Blip
// (tests/blip-falso.html). Os tempos do bot são acelerados (setTimeout ÷ 10) só no teste.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');
const { montarCodigo } = require('../scripts/build');

const PAGINA = 'file://' + path.join(__dirname, 'blip-falso.html');
const MSG = 'Olá! Sua solicitação foi atualizada. Qualquer dúvida, fale com a gente.';
const BM = montarCodigo();
const FLUXO = {
  paraQuem: 'aguardando', loopEscolha: false, pausaCiclos: 1, velocidade: 1, puxarFila: false,
  passos: [{ tipo: 'enviar', modo: 'finalizar', mensagem: MSG, tag: 'revi', velocidade: null }],
};

async function abrir(alvo) {
  const page = await alvo.newPage();
  await page.addInitScript(() => {
    window.__rodBotTeste = true; // gancho de teste da V10 (window.__rodBot.executarFluxo)
    const original = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => original(fn, Math.max(0, (ms || 0) / 10), ...a);
  });
  page.on('dialog', (d) => d.accept());
  await page.goto(PAGINA);
  await page.evaluate(BM);
  return page;
}

async function rodar(page, simular) {
  const r = await page.evaluate(({ fluxo, simular }) => window.__rodBot.executarFluxo(fluxo, { nome: 'Teste', simular }),
    { fluxo: FLUXO, simular });
  return page.evaluate((status) => ({
    status,
    blip: JSON.parse(JSON.stringify(window.__blip)),
    relatorio: JSON.parse(localStorage.getItem('rf_rodbot_lote_relatorio_v1')),
    log: document.getElementById('ba-log').textContent,
  }), r.status);
}

const porId = (regs) => Object.fromEntries(regs.map((r) => [r.id, r.resultado]));

test('fluxo Enviar + Finalizar na página falsa', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const contexto = await browser.newContext();

  await t.test('painel da V10 com Simular marcado e versão no topo', async () => {
    const page = await abrir(browser);
    assert.strictEqual(await page.isChecked('#rb-simular'), true);
    assert.match(await page.textContent('#ba-hdr'), /v10\.1/);
    assert.ok(await page.$('#rb-aba-montar'), 'painel de fluxos (Montar) não apareceu');
    await page.close();
  });

  await t.test('Simular: passa por todos (inclusive os carregados ao rolar) e não envia nada', async () => {
    const page = await abrir(browser);
    const r = await rodar(page, true);
    assert.strictEqual(r.status, 'concluido');
    assert.strictEqual(r.blip.envios.length, 0);
    assert.strictEqual(r.blip.finalizados.length, 0);
    const res = porId(r.relatorio.registros);
    assert.strictEqual(Object.keys(res).length, 12, 'deveria ter passado pelos 12 tickets');
    assert.strictEqual(res['1005'], 'pulado'); // rascunho
    assert.strictEqual(res['1012'], 'simulado');
    assert.strictEqual(await page.inputValue('#text-input'), '', 'o texto simulado tem que ser apagado');
    assert.match(r.log, /Anti-bloqueio/, 'o log tem que dizer se o anti-bloqueio ligou ou não');
    await page.close();
  });

  await t.test('Envio real: cliente com problema não trava e ninguém recebe duas vezes', async () => {
    const page = await abrir(contexto);
    const r = await rodar(page, false);
    const res = porId(r.relatorio.registros);
    assert.strictEqual(Object.keys(res).length, 12);
    assert.strictEqual(res['1003'], 'falha'); // em espera: campo bloqueado
    assert.strictEqual(res['1005'], 'pulado'); // rascunho
    assert.strictEqual(res['1008'], 'parcial', 'tag inexistente = enviado, NÃO finalizado');
    for (const id of ['1001', '1002', '1004', '1006', '1007', '1009', '1010', '1011', '1012']) {
      assert.strictEqual(res[id], 'finalizado', 'ticket ' + id);
    }
    const ids = r.blip.envios.map((e) => e.id);
    assert.strictEqual(ids.length, new Set(ids).size, 'alguém recebeu duas vezes');
    assert.strictEqual(ids.length, 10);
    assert.ok(r.blip.envios.every((e) => e.texto === MSG));
    assert.ok(!r.blip.finalizados.includes('1008'));
    assert.ok(r.blip.tags['1001'].includes('Revisão app'));
    assert.strictEqual(r.blip.rascunhos['1005'], 'texto que o atendente digitou', 'rascunho não pode ser trocado');
    assert.match(r.log, /Relatório: 9 enviados e finalizados · 1 enviados SEM finalizar · 1 pulados · 1 falhas/);

    // Rodar de novo (outra execução, mesmo navegador): quem já recebeu não recebe de novo.
    await page.evaluate(() => { window.__blip.envios.length = 0; });
    const r2 = await rodar(page, false);
    assert.strictEqual(r2.blip.envios.length, 0, 'reenviou para quem já tinha recebido');
    assert.strictEqual(porId(r2.relatorio.registros)['1008'], 'pulado');
    await page.close();
  });

  await t.test('o log fica salvo no navegador (sobrevive a fechar a página)', async () => {
    const page = await contexto.newPage();
    await page.goto(PAGINA);
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('rf_rodbot_log_v1') || '[]'));
    assert.ok(salvo.some((l) => l.includes('Relatório:')), 'log não foi salvo');
    await page.close();
  });
});
