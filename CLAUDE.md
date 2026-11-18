# RodBot — contexto do projeto

Bookmarklets (JS + HTML + CSS num único favorito) que automatizam o atendimento no **Blip Desk**.
Autor: Rodrigo Facilidades. Idioma de código, UI e conversa: **português (pt-BR)**.

## Arquivos

| Arquivo | O que é |
|---|---|
| `rodbot-final.html` | Página de instalação do **rod bot** (automação do Blip Desk: fila, pastas, envio, transferência, resposta automática). ~580 KB |
| `RodBot-antigo hugme melhorado p qualquer planilha.html` | Página de instalação do **RodBot · Pedido concluído** (`RodBot-ra-blip` v1.1.5): lê planilha XLSX do HugMe e envia o modelo `acao_reclameaqui` pelo Blip. ~395 KB |

Cada HTML é só a página de instalação (arrastar o botão para a barra de favoritos, ou copiar o código). **O bookmarklet inteiro está dentro do HTML**, em `href="javascript:..."` e em `<input id="bm-code" value="javascript:...">` (final) / bloco de instalação manual (antigo), **codificado em URL (percent-encoded)**.

### Como editar (importante para economizar tokens)
1. Não leia o HTML inteiro. Decodifique o `javascript:` com `urllib.parse.unquote` para um arquivo temporário (scratchpad), edite/leia só o trecho necessário.
2. Ao salvar, recodifique (`urllib.parse.quote`) e atualize **os dois lugares** (href e campo de cópia) de forma idêntica.
3. Use `grep -n` por nome de função/comentário em vez de ler o arquivo todo (o JS decodificado tem ~3.900 linhas no final e ~1.160 no antigo).
4. Suba a versão (comentário de topo / `ORIGIN_LABEL` / `version`) quando mudar comportamento.

## Sites

- **Blip Desk** (onde os bookmarklets rodam). O antigo só roda em `https://mentorebank.desk.blip.ai`, na tela **Mensagens ativas** (`/activeMessage`); fora dela dá alerta e não abre. O final roda na tela de atendimento do Desk (lista de chats + chat aberto).
- **HugMe** é a origem da planilha (colunas "Status Hugme", "Id HugMe"). Os bookmarklets **não rodam no HugMe**; só leem a planilha exportada de lá.
- Sem rede: nada é enviado para servidor próprio; XLSX é lido offline no navegador.

## rod bot — `rodbot-final.html` (painel `#blip-auto-panel`)

Painel arrastável, 5 temas (verde, azul, rosa, vermelho, LGTV), abas:
- **⚡ Piloto** — fluxo de 4 etapas, em loop: 1) puxar fila até zerar (modo "sentinela" se vazia) → 2) enviar mensagem em todos os chats ativos → 3) pausar todos (standby) → 4) mover todos para a pasta configurada.
- **📁 Pastas** — mover tickets para pasta (padrões `nv2`, `default`; recentes guardadas).
- **✉️ Envio** — mensagem a enviar (`MENSAGEM_PADRAO` se vazia), só enviar sem finalizar.
- **📥 Fila** — puxar/atender fila, contador de fila.
- **💬 Auto** — resposta automática a **novos chats**: detecta chat que chega depois da ativação, envia a mensagem, **confirma o envio pela interface** (campo esvaziado + nova ocorrência do texto) e só então pausa o cliente. Um worker, um chat por vez.
- Também há **Transferir ticket para atendente** (modal com autocomplete).
- Estado em `localStorage` (`rf_widget_theme_v1`, `rf_rodbot_tab_v1`, `rf_rodbot_recent_folders_v1`, `rf_rodbot_auto_*_v1`).

Detalhes técnicos relevantes:
- Blip usa **Shadow DOM** (`bds-*`): observers precisam ser colocados em cada shadow root; busca de texto/elementos atravessa shadow roots e slots (`coletarElementosProfundos`, `autoRaizesTexto`).
- Seletores centralizados em `AUTO_SEL` (verificados na interface em 18/11/2026): `#sidenav-div`, `article.chat-list-item`, `#text-input`, `#pane-chat-div [id="ticket-sequential-id"]`, `button.ticket-info-options[id^="menu-"]`, `bds-dropdown#ticket-filter-dropdown`, opções `option-setStandbyMode` / `option-unsetStandbyMode`. Se o Blip mudar a interface, ajustar aqui primeiro.
- Campo de texto é preenchido com setter nativo + eventos `input`/`change`; cliques usam clique real (`dispararCliqueReal`) porque modais do Blip interrompem propagação.
- Mover para pasta: menu 3 pontinhos → "Mover para" → hover abre submenu → `div.folder-submenu-container > span.custom-submenu-item`.
- Usa Wake Lock para a aba não dormir. Pausar/Parar tratados na fase de captura da `window`.

## RodBot · Pedido concluído — `RodBot-antigo hugme ...html` (`RodBot-ra-blip` v1.1.5)

Painel em **shadow DOM isolado** (`#rodbot-ra-blip`). Fluxo: importar XLSX → conferir prévia/destinatários → **Simular primeiro lote** → **Enviar** (segurar o botão 2 s e confirmar).

### Planilha (XLSX)
- Leitor XLSX próprio, offline (ZIP + `DecompressionStream`; sem fórmulas; limites contra ZIP64/partes grandes). Exige `.xlsx` (Pasta de Trabalho do Excel). Requer Chrome/Edge atual.
- **Linha de cabeçalho padrão: 4** (`headerRow`). Linhas abaixo são dados.
- Colunas padrão (por letra, mudam no painel): **Status = E**, **Nome = Q**, **Telefone = W**, **ID/Protocolo = A**.
- Cada coluna pode ser indicada por **letra** (A, Q, AQ) ou **texto do cabeçalho** (sem acento/caixa). Aliases reconhecidos: Status → "Status Hugme", "Status", "Situação"; Nome → "Nome", "Nome do Cliente", "Nome Completo", "Cliente"; Telefone → "Telefones", "Telefone", "Celular", "WhatsApp"; ID → "Id HugMe", "ID", "Protocolo".
- Conflito letra × cabeçalho dá erro (nunca escolhe em silêncio); `$C` força a letra C.
- Telefones, nome, ID e status devem ser colunas **distintas**; coluna vazia/ausente = erro; status é opcional.

### Regras de negócio
- Só entra na fila a linha cujo **Status == `Novo`** (`statusValue`, comparação normalizada). Outras são "Ignorado" (com motivo).
- **Telefone**: só dígitos; remove `55` se tiver 12–13 dígitos; precisa ter 10–11 dígitos (DDD + número) e não começar com 0; senão "Telefone inválido ou sem DDD". Vários números na célula: separador **`;`** ou quebra de linha; outro separador = ambíguo = erro.
- **Mensagem**: modelo fixo `acao_reclameaqui`, **sem variáveis** — nenhum nome/ID entra no texto (config `nameMode`/`maps` existem mas `maps` está vazio nesta versão). Formatos de variável, se usados: `nome`, `especialista` (2 nomes), `inteiro`, `texto`; `nameMode`: `dois` (partículas não contam) ou `completo`.
- **Lotes**: máximo **100** contatos por envio no Blip (`BLIP_MAX`). Modo **Acumular** = um envio por lote; modo **1a1** = um contato por envio.
- **Simular nunca clica em Enviar** e não grava estado de envio (só o registro do lote, marcado SIMULAÇÃO); prepara só o primeiro lote. Qualquer erro **para tudo**.
- **Histórico não bloqueia reenvio** nesta versão (v1.1.5): só registra. Estados: pendente, enviado (Submetido), incerto (Conferir envio), ignorado. Existe leitura do histórico legado `rodbot-ra:v1`; se ilegível, bloqueia por segurança.
- Envio só conta como **ENVIADO depois da confirmação do Blip**. Resultado de cada cliente é gravado **antes** de seguir para o próximo.
- Etapa 3 do Blip (editar modelo por contato): modo `rapido` (padrão) preenche com contatos fechados e abre só o 1º e o último; `completo` abre/preenche/recolhe cada um. Telefone que casa com mais de um destino = erro, nada é preenchido.
- Ritmo: ações 1,5–2,5 s, envio 5–8 s, timeout 25 s, som ligado.
- Registro do lote exportável em **CSV** (colunas: Data e hora, Lote, Modo, Envio, Posição, Linha da planilha, Protocolo/ID, Nome, Telefone, Status, Aviso do Blip, Ação tomada, Detalhe, Modelo). Telefone é mascarado nas telas (`final XXXX`).
- Persistência: `localStorage` chave `rodbot-ra-concluido:v1` (config + histórico), trava `rodbot-ra-execution` (uma execução por vez), últimas execuções guardadas.
- Existe um favorito **separado** v1.1.4 (campanha com variáveis); este não o substitui e tem histórico próprio.

## Regras gerais para mexer neste código

1. **Segurança operacional primeiro**: nunca enviar mensagem sem confirmação; erro ambíguo = parar, não adivinhar; não duplicar envio.
2. Mudou algo que depende do Blip? Peça ao usuário o **outerHTML** do trecho (inclui shadow roots) em vez de supor seletor.
3. Teste em página simulada (Playwright já instalado no ambiente) e diga claramente que **não foi testado no Blip real**.
4. Não colocar dados de clientes, tokens ou telefones reais no repositório.
5. Responder em português, direto, sem reler arquivos grandes sem necessidade.
