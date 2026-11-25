// Teste de tela do lote Enviar + Finalizar contra a página FALSA do Blip (tests/blip-falso.html).
// Os tempos do bot são acelerados (setTimeout ÷ 10) só no teste.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');
const { montarCodigo } = require('../scripts/build');

const PAGINA = 'file://' + path.join(__dirname, 'blip-falso.html');
const MSG = 'Olá! Sua solicitação foi atualizada. Qualquer dúvida, fale com a gente.';
const BM = montarCodigo();

async function abrir(browser, contexto) {
  const page = await (contexto || browser).newPage();
  await page.addInitScript(() => {
    const original = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => original(fn, Math.max(0, (ms || 0) / 10), ...a);
  });
  page.on('dialog', (d) => d.accept());
  await page.goto(PAGINA);
  await page.evaluate(BM);
  return page;
}

async function rodarLote(page, { simular }) {
  await page.evaluate(({ msg, simular }) => {
    document.getElementById('ba-clear-log').click(); // o "Automação parada" da rodada anterior não vale
    document.getElementById('ba-tab-mensagem').click();
    document.getElementById('ba-msg').value = msg;
    document.getElementById('ba-mode-finalizar').click();
    document.getElementById('ba-tag').value = 'revi';
    document.getElementById('ba-simular').checked = simular;
    document.getElementById('ba-play').click();
  }, { msg: MSG, simular });
  await page.waitForFunction(() => /Automação parada/.test(document.getElementById('ba-log').textContent),
    null, { timeout: 120000 });
  return page.evaluate(() => ({
    blip: JSON.parse(JSON.stringify(window.__blip)),
    relatorio: JSON.parse(localStorage.getItem('rf_rodbot_lote_relatorio_v1')),
    log: document.getElementById('ba-log').textContent,
  }));
}

const porId = (regs) => Object.fromEntries(regs.map((r) => [r.id, r.resultado]));

test('lote Enviar + Finalizar na página falsa', async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const contexto = await browser.newContext();

  await t.test('Simular: abre todos (inclusive os carregados ao rolar) e não envia nada', async () => {
    const page = await abrir(browser);
    const r = await rodarLote(page, { simular: true });
    assert.strictEqual(r.blip.envios.length, 0);
    assert.strictEqual(r.blip.finalizados.length, 0);
    const res = porId(r.relatorio.registros);
    assert.strictEqual(Object.keys(res).length, 12, 'deveria ter passado pelos 12 tickets');
    assert.strictEqual(res['1003'], 'pulado'); // em espera
    assert.strictEqual(res['1005'], 'pulado'); // rascunho
    assert.strictEqual(res['1012'], 'simulado');
    assert.strictEqual(await page.inputValue('#text-input'), '', 'o texto simulado tem que ser apagado');
    assert.match(r.log, /Anti-bloqueio/, 'o log tem que dizer se o anti-bloqueio ligou ou não');
    await page.close();
  });

  await t.test('Envio real: um cliente com problema não trava o lote e ninguém recebe duas vezes', async () => {
    const page = await abrir(browser, contexto);
    const r = await rodarLote(page, { simular: false });
    const res = porId(r.relatorio.registros);
    assert.strictEqual(Object.keys(res).length, 12);
    assert.strictEqual(res['1003'], 'pulado');
    assert.strictEqual(res['1005'], 'pulado');
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
    assert.match(r.log, /Resumo: 9 enviados e finalizados · 1 enviados SEM finalizar · 2 pulados · 0 falhas/);
    assert.strictEqual(r.blip.rascunhos['1005'], 'texto que o atendente digitou', 'rascunho não pode ser trocado');

    // Rodar de novo no mesmo navegador: o 1008 (ainda aberto) não recebe de novo.
    await page.evaluate(() => { window.__blip.envios.length = 0; });
    const r2 = await rodarLote(page, { simular: false });
    assert.strictEqual(r2.blip.envios.length, 0, 'reenviou para quem já tinha recebido');
    assert.strictEqual(porId(r2.relatorio.registros)['1008'], 'pulado');
    await page.close();
  });

  await t.test('o log fica salvo no navegador (sobrevive a fechar a página)', async () => {
    const page = await contexto.newPage();
    await page.goto(PAGINA);
    const salvo = await page.evaluate(() => JSON.parse(localStorage.getItem('rf_rodbot_log_v1') || '[]'));
    assert.ok(salvo.some((l) => l.includes('Resumo:')), 'log não foi salvo');
    await page.close();
  });
});
