// Carrega src/puro-lote.js num contexto isolado e devolve as funções (o arquivo não usa module.exports).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function carregarPuro() {
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'src', 'puro-lote.js'), 'utf8');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(codigo + '\n;this.__x = { loteEscolherProximo, loteMemoriaLimpar, loteJaRecebeu, loteEscolherTag,' +
    ' loteBotaoConfirmaFinalizar, loteSalto, loteDuracao, loteResumo, loteCsv, loteLimitarLinhas, loteChaveEnvio, LOTE_VERSAO };', ctx);
  return ctx.__x;
};
