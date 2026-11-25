const test = require('node:test');
const assert = require('node:assert');
const P = require('./carregar-puro')();

test('escolhe o primeiro ticket ainda não tentado', () => {
  assert.strictEqual(P.loteEscolherProximo(['1', '2', '3'], new Set(['1'])), '2');
  assert.strictEqual(P.loteEscolherProximo(['1'], new Set(['1'])), null);
  assert.strictEqual(P.loteEscolherProximo([], new Set()), null);
});

test('memória: tira o que passou de 24 h e corta pelo máximo', () => {
  const agora = 100 * 3600 * 1000;
  const m = { a: { estado: 'finalizado', ts: agora - 25 * 3600 * 1000 }, b: { estado: 'parcial', ts: agora - 1000 },
    c: { estado: 'finalizado', ts: agora - 500 }, d: { estado: 'finalizado', ts: agora } };
  assert.deepStrictEqual(Object.keys(P.loteMemoriaLimpar(m, agora)).sort(), ['b', 'c', 'd']);
  assert.deepStrictEqual(Object.keys(P.loteMemoriaLimpar(m, agora, 24 * 3600 * 1000, 2)).sort(), ['c', 'd']);
});

test('quem já recebeu (ou pode ter recebido) nunca recebe de novo', () => {
  const m = { a: { estado: 'parcial' }, b: { estado: 'incerto' }, c: { estado: 'nao_enviado' }, d: { estado: 'enviando' } };
  assert.strictEqual(P.loteJaRecebeu(m, 'a'), true);
  assert.strictEqual(P.loteJaRecebeu(m, 'b'), true);
  assert.strictEqual(P.loteJaRecebeu(m, 'd'), true);
  assert.strictEqual(P.loteJaRecebeu(m, 'c'), false);
  assert.strictEqual(P.loteJaRecebeu(m, 'z'), false);
});

test('tag: prefere a igual, depois a que contém, e nunca "a primeira da lista"', () => {
  assert.strictEqual(P.loteEscolherTag(['Revisão cobrança', 'Revisão'], 'revisao'), 1);
  assert.strictEqual(P.loteEscolherTag(['Cobrança', 'Revisão app'], 'revi'), 1);
  assert.strictEqual(P.loteEscolherTag(['Cobrança', 'Outra'], 'revi'), -1);
  assert.strictEqual(P.loteEscolherTag(['Cobrança'], ''), -1);
});

test('botão do modal: só "Finalizar"/"Confirmar", nunca "Cancelar"', () => {
  assert.strictEqual(P.loteBotaoConfirmaFinalizar('Confirmar'), true);
  assert.strictEqual(P.loteBotaoConfirmaFinalizar('Finalizar ticket'), true);
  assert.strictEqual(P.loteBotaoConfirmaFinalizar('Finalizar'), true);
  assert.strictEqual(P.loteBotaoConfirmaFinalizar('Cancelar'), false);
  assert.strictEqual(P.loteBotaoConfirmaFinalizar(''), false);
  assert.strictEqual(P.loteBotaoConfirmaFinalizar('Salvar'), false);
});

test('detecta quando o navegador ficou parado (tela bloqueada)', () => {
  assert.strictEqual(P.loteSalto(0, 5000, 5000), 0);
  assert.strictEqual(P.loteSalto(0, 20000, 5000), 0);
  assert.strictEqual(P.loteSalto(0, 125000, 5000), 120000);
  assert.strictEqual(P.loteDuracao(120000), '2 min');
  assert.strictEqual(P.loteDuracao(45000), '45 s');
  assert.strictEqual(P.loteDuracao(3720000), '1 h 2 min');
});

test('resumo e CSV do relatório', () => {
  const regs = [
    { id: '10', passo: '1 · Enviar + Finalizar', resultado: 'finalizado', motivo: '', hora: '10:00:00' },
    { id: '11', passo: '1 · Enviar + Finalizar', resultado: 'parcial', motivo: 'tag "x" não encontrada', hora: '10:00:10' },
    { id: '12', passo: '1 · Enviar + Finalizar', resultado: 'pulado', motivo: 'campo; indisponível', hora: '10:00:20' },
  ];
  const r = P.loteResumo(regs);
  assert.strictEqual(r.contagem.finalizado, 1);
  assert.strictEqual(r.texto, '1 enviados e finalizados · 1 enviados SEM finalizar · 1 pulados · 0 falhas');
  const csv = P.loteCsv(regs);
  assert.ok(csv.startsWith('\uFEFFTicket;Passo;Resultado;Motivo;Hora\r\n'));
  assert.ok(csv.includes('11;1 · Enviar + Finalizar;enviado, NÃO finalizado;"tag ""x"" não encontrada";10:00:10'));
  assert.ok(csv.includes('12;1 · Enviar + Finalizar;pulado;"campo; indisponível";10:00:20'));
});

test('memória de envio: mesma mensagem = mesma chave; outra mensagem = outra chave', () => {
  const a = P.loteChaveEnvio('10', 'Olá,  tudo bem?');
  assert.strictEqual(a, P.loteChaveEnvio('10', 'Olá, tudo bem? '));
  assert.notStrictEqual(a, P.loteChaveEnvio('10', 'Outra mensagem'));
  assert.notStrictEqual(a, P.loteChaveEnvio('11', 'Olá, tudo bem?'));
  assert.ok(a.startsWith('10|'));
});

test('limita linhas do log', () => {
  assert.deepStrictEqual([...P.loteLimitarLinhas([1, 2, 3, 4], 2)], [3, 4]);
  assert.deepStrictEqual([...P.loteLimitarLinhas([1], 2)], [1]);
});
