# CLAUDE.md — como trabalhar comigo (Rodrigo)

Perfil montado a partir das minhas sessões no Claude Code (nov/2026). Vale para qualquer projeto meu.
Se um repositório tiver um CLAUDE.md próprio, as regras dele valem mais para aquele projeto.

## Quem sou

- Trabalho com **operação de atendimento ao cliente** (atendimento de banco via WhatsApp no **Blip Desk** e
  tickets do **Reclame Aqui** no **HugMe**). Não sou desenvolvedor de formação: tenho base em Python, Power BI,
  análise de dados e AWS (cursos DIO), e construo minhas próprias automações com o Claude.
- Meu produto principal é o **rod bot / RodBot**: **bookmarklets** (eu chamo de **"BM"**) que automatizam o Blip e o
  HugMe a partir de planilhas `.xlsx`. Também uso n8n, userscripts (Tampermonkey) e o Copilot do Teams.
- Estou estudando vender esse tipo de automação como **freelancer** (bots, extensões, WhatsApp, planilhas).
- Uso **Edge** no trabalho (Chrome às vezes). Acesso o Claude pela web, pelo app desktop e pelo celular.

## Como falar comigo

- **Sempre em português (pt-BR)**: conversa, código, textos da interface, comentários e commits.
- Escrevo rápido, curto e com erros de digitação. Entenda a intenção e não corrija meu português.
- **Linguagem simples, sem jargão.** Quando eu não entendo, respondo "não entendi". Evite termos internos
  inventados na hora (ex.: "card sem linha", "baseline", "absorvido"). Se precisar de um, explique com um exemplo
  concreto da minha tela ou da minha planilha.
- Respostas curtas e diretas: o que mudou, o que eu faço agora, em passos numerados.
- Se eu perguntar "isso tá certo?" ou "por que aconteceu isso?", responda primeiro com sim/não ou a causa,
  depois o detalhe.
- Quando eu pedir, diga se a tarefa pede **Opus ou Sonnet** (eu economizo tokens e uso `/advisor`).

## Como eu recebo as entregas

- **Sempre me entregue o arquivo final para download** no fim da tarefa, sem eu precisar pedir
  ("cadê o arquivo do bm novo?" não deveria acontecer).
- Bookmarklet = **página HTML instaladora** com:
  1. botão arrastável para a barra de favoritos;
  2. caixa com o código e botão "📋 Copiar código";
  3. instruções curtas de uso.
  O favorito arrastável e o "Copiar código" precisam entregar **exatamente a mesma versão** (confira).
- Mostre a **versão** no painel e no nome do arquivo (ex.: `RodBot-pedido-concluido-v1.1.5.html`).
- **Guarde a versão anterior** que funcionava (ex.: `rodbot-anterior.html`) para eu voltar se a nova der bug.
- Diga claramente **o que foi testado só em página falsa** e **o que eu preciso testar no site real**, com um
  checklist curto (ex.: "rode Simular com 2–3 clientes antes do envio real").

## Regras para automações (Blip, HugMe e parecidos)

### Segurança primeiro
- Toda automação que envia algo precisa de **modo teste / Simular / Ensaiar**, que faz tudo **menos** o clique final
  de envio. Envio real só com confirmação (ex.: contagem + segurar o botão 2 s).
- Nunca envie mensagens reais nos testes. Nunca reenvie automaticamente um item com envio **incerto**: marque
  como incerto e deixe eu conferir.
- Proteja contra envio duplicado (histórico/memória por ID, ex. 24 h no `localStorage`).
- Dados de clientes são sensíveis (banco, LGPD). Use só dados fictícios em testes e fixtures. Nunca copie nome,
  telefone ou id de mensagem de uma captura real para o código ou para os testes.

### O lote nunca pode travar por causa de um item
Este é o pedido que mais se repete. Quando um cliente dá problema (telefone inválido ou em branco, sem
especialista, "já está em atendimento", botão "Resposta privada" não aparece, contato recusado pelo Blip):
**pule esse item, registre o motivo no log/histórico e siga para o próximo**. Só pare o lote por falha geral
(página errada, coluna obrigatória ausente). No fim, mostre o resumo: enviados, pulados (com motivo), falhas.

### Seletores e DOM
- Eu coleto os caminhos com minha ferramenta **"Mapa JS"** e mando os **JS Paths**. **Preserve-os exatamente.**
- Se um seletor não bater com o site real, **peça o `outerHTML` do trecho**. Não invente seletor.
- O Blip usa web components `bds-*` com **Shadow DOM** e `slot`: leia o texto renderizado atravessando
  `shadowRoot` e `assignedNodes()`.
- Identifique avisos pelo texto específico (ex.: "já está em atendimento"), nunca só pelo ícone de erro genérico.
- Um único arquivo/módulo deve concentrar os seletores do site.
- Para cada elemento, use o **id** como seletor principal e o **nome que aparece na tela** (aria-label/texto,
  ex.: botão "Transferir") como **reserva** se o id não for encontrado. Registre no log quando a reserva for usada.
- **Mapear tela nova**: eu capturo a tela com o **BM Captura Blip** (repo `Claude.md`, pasta `bm-captura-blip/`),
  que salva a página com Shadow DOM e dados de clientes mascarados. Abra a captura no **agent-browser**
  (offline, `bm-captura-blip/ferramentas/mapear.sh`) e cruze o que ele lê com os ids. Uma captura por estado
  (modal aberto, lista aberta, aviso na tela). Eu não faço login do Blip na nuvem.

### Planilhas (.xlsx)
- A leitura acontece no navegador. Ache colunas **pelo nome do cabeçalho**, não pela letra. Deixe eu trocar a
  coluna no painel; a escolha fica salva e **precisa ser usada de verdade** na execução.
- Detecte a linha do cabeçalho; deixe eu ajustar se vier errado.
- Colunas comuns: `Id Origem`, `Nome`, `CPF/CNPJ`, `Telefones`, `Tags`, `Atribuído Para`, `Lote`, `Status`,
  `Retorno` (aba `AÇÃO`).
- **Telefones**: uma célula pode ter vários, separados por ` ; ` (ex.: `88993505390 ; 85996918465`). Números com
  10 ou 11 dígitos; compare pelos últimos 8 quando precisar casar.
- **Especialista**: vem de `Tags`. Uma tag = o especialista. Várias tags = usar a que bate com `Atribuído Para`.
  Sem correspondência = pedir no painel ou pular (com opção).
- Ao gravar resultado, **não altere o arquivo original**: gere uma cópia completa. Não mexa em colunas que não
  são do bot (ex.: `Status`).

### Painel do bookmarklet
- Painel flutuante **arrastável pela barra superior**, com minimizar e fechar. Clicar no BM 2× não abre 2 painéis.
- Log visível do que está acontecendo, contadores e histórico exportável (CSV/relatório copiável).
- Modelos de mensagem com marcadores (`[Nome do Cliente]`, `{Especialista}`, `{xx xxxx-xxxx}`); a prévia e o
  texto enviado devem ser idênticos. Não use gênero inferido ("Aqui é **a** Rodrigo" foi um bug).
- **Modais do Blip cancelam cliques fora deles** (ex.: "Transferir atendimento"): o painel aparece por cima mas não
  responde. Use o "escudo" do `bm-captura-blip/src/painel.js`: ouvir os eventos na `window` em fase de captura,
  parar a propagação quando o evento é no painel e executar a ação do botão (`ao(elemento, função)`).
  Confirmado no Blip real (v1.0.2 da captura).

## Mapa do Blip Desk (confirmado no site real em 25/11/2026)

Tirado das capturas reais com o agent-browser. Mapa completo e detalhes: `bm-captura-blip/docs/mapa-blip.md`
(repo `Claude.md`). Endereço: `https://<empresa>.desk.blip.ai/chat`. "→ sombra" = o elemento de verdade está
dentro do `shadowRoot` do componente.

**Tela de conversa**

| Elemento | Seletor principal | Reserva (nome na tela) |
|---|---|---|
| Atender | `#claim-ticket-button` (o `bds-button` tem `aria-hidden`; o botão clicável está → sombra) | "Atender" |
| Mensagem ativa | sem id: `bds-button` com texto "Mensagem ativa" | "Mensagem ativa" |
| Clientes aguardando | `#waiting-tickets-count` | — |
| Busca de conversas | `#search-input` → sombra → `input` | "Busque pelo nome ou telefone..." |
| Filtros | `#ticket-filter-dropdown` | "Todos (n)", "Não lidos (n)", "Em espera (n)", "Finalizados (n)" |
| Conversa na lista | `article[id$="-chat-list-item"]` | aria-label `Ticket <n> - <nome>` |
| Nome / nº do ticket / fila | `#customer-name` / `#ticket-sequential-id` / `#ticket-team` | — |
| Transferir | `#transfer-ticket-button` | "Transferir" |
| Finalizar | `#close-ticket-button` | "Finalizar" |
| Caixa de mensagem | `#text-input` (textarea, **fora** de sombra) | "Escreva uma mensagem..." |
| Resposta pronta / Anexar | `#custom-reply-btn` / `#send-file-btn` | "Enviar resposta pronta" / "Enviar arquivos…" |
| Comentário | `#comment-input` → sombra → `textarea` | "Escreva um comentário..." |
| Mensagens | `div[id]` = id da mensagem (`wamid.*`, `activecampaign:*`, `fwd:fwd:*`) | "<data> Agente diz:" / "Cliente diz:" |

**Modal "Transferir atendimento"** (`bds-modal`, não é `<dialog>`; cancela cliques fora dele)

| Passo | Seletor |
|---|---|
| Modal aberto | `#transfer-attendance` (título `#modal-title`) |
| Fila / Atendente | `bds-radio[label="Fila"]` (já vem marcado) / `bds-radio[label="Atendente"]` — não use o id `bds-radio-N` de dentro |
| Lista de filas | `#autocompleteTeam`; aberta quando → sombra tem `.select__options--open` |
| Opções | `#autocompleteTeam` → sombra → `bds-select-option` (texto = nome da fila). Já existem com a lista fechada |
| Filas como dados | atributo `options` do `#autocompleteTeam` (JSON `label`, `value`, `status: "25 Disponíveis"`): confira se a fila existe antes de abrir; se não existir, pule o item |
| Transferir ticket | `#confirm-transfer-btn` — `disabled` até escolher a fila. **É o clique final**: no Simular, clique em Cancelar |
| Cancelar | `#transfer-attendance bds-button[variant="secondary"]` com texto "Cancelar" |

Ainda não capturado: lista com "Atendente" marcado; se digitar no campo da lista filtra as filas (deduzido).

## Como desenvolver nos meus repositórios

- **Nunca edite o `javascript:` codificado nem o HTML final à mão.** Código em `src/`, `npm run build` gera o
  HTML instalador, e o HTML regerado vai no mesmo commit (um teste confere que está em sincronia com `src/`).
- Separe **funções puras** (testáveis no Node) do código que mexe no DOM.
- **Teste primeiro**: reproduza o bug num teste, veja falhar, corrija, veja passar.
- Testes de tela com **Playwright** contra uma **página falsa** do site (Blip/HugMe) montada a partir dos fatos
  reais que eu passei. Marque no código o que foi **deduzido** e não confirmado no site real.
- Commits em pt-BR no estilo `fix(fluxo): ...`, `feat(transferir): ...`, `docs: ...`.
- Quando eu disser "commita", "dá push" ou "cria o PR e faz o merge": pode fazer tudo, **inclusive o merge**,
  se os testes passarem. Eu às vezes não sei qual PR aprovar, então não deixe PR pendurado sem me avisar.

## Meu fluxo de projeto (para economizar tokens)

1. **Ideia → `/grill-me`** (perguntas em rodadas, com resposta recomendada em cada uma) até fechar as decisões.
2. **Spec e plano** em `docs/plano/` (`spec.md`, `plano.md`), com tarefas numeradas e testes de cada uma.
3. **Execução** em sessão nova com `superpowers:subagent-driven-development`, tarefa por tarefa
   ("siga para Tarefa 23"), parando para eu revisar quando o plano pedir.
4. Quando o contexto fica grande ou surge um bug, **abro outra sessão**. Nesse caso escreva um **documento de
   passagem** (`docs/plano/passagem-<assunto>.md`: situação, regras, comandos, caminho do código, suspeitos) e
   me dê o **prompt pronto para colar** na sessão nova.
5. Cada projeto tem um `CLAUDE.md` com objetivo, sites, colunas da planilha, regras e comandos. Ao mudar uma
   regra, atualize spec → plano → CLAUDE.md.

Ferramentas que eu uso: skills `grill-me`/`grilling` (mattpocock/skills), `obra/superpowers`, `n8n-mcp-skills`,
`oh-my-claudecode`, `/advisor`.

## Meus repositórios (GitHub: rodrigopinheiro1996)

| Repo | O que é |
|---|---|
| `rodbot-view-diagram` | rod bot principal do Blip (painel novo Montar/Acompanhar, fluxos, fila, transferir) |
| `rodbot-original` | versões originais dos BMs do Blip |
| `rodbot-acao-ativo` | BM de envio em massa no Blip a partir de planilha ("pedido concluído") |
| `projeto-preenche-plan` | BM que lê "Mensagens ativas" do Blip e preenche o status na planilha |
| `projeto2-hugme`, `Projeto-RA` | RodBot RA HugMe: resposta privada em lote no Reclame Aqui |
| `rodbot-pri` | ponte Blip ↔ Copilot do Teams (userscript, % de confiança) |
| `rod-facilidades` | painel com cards (Gestão de Macros etc.) |
| `Claude.md` | este perfil + `bm-captura-blip/` (BM de captura e mapa do Blip) + `fila-cpf/` (janela flutuante com fila de CPF) |

## Erros que já aconteceram (não repita)

- Entregar só o `.js` em vez do HTML instalador com botão arrastável.
- Trocar a coluna no painel e o bot continuar usando a antiga.
- Lote parar inteiro por causa de um cliente com problema.
- Nome do cliente configurado no painel e não preenchido na mensagem enviada.
- Versão nova com bug e sem a antiga à mão para eu voltar.
- Explicação cheia de termos que eu não conheço.
- Dizer que funciona quando só foi testado na página falsa.
- BM travado com o modal "Transferir" aberto (o modal cancela cliques fora dele; use o escudo).
- Dado de cliente escapando da captura: nome de uma palavra só e telefone escondido no id `wamid.*` da mensagem.
