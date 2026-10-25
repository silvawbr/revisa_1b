Warning: truncated output (original token count: 3021)
Total output lines: 262

# Revisão de Matemática | 1º ano Vita

Aplicação web infantil, responsiva e em português do Brasil para revisar
conteúdos de Matemática do 1º ano Vita. A tela inicial oferece a revisão
original, com seis atividades, e a revisão independente AV2 Matemática. O
Bloco 01 da AV2 ensina a reconhecer moedas e cédulas brasileiras, comparar
seus valores e formar equivalências. O Bloco 02 pratica compras, dinheiro
disponível, soma de preços e troco em rodadas próprias de dez questões. O
Bloco 03 pratica adições de dois e três algarismos, reagrupamento em C/D/U,
termos da adição e problemas curtos em rodadas próprias de doze questões.
O Bloco 06 oferece desafios interativos para formar quantias, comparar
equivalências e criar duas combinações diferentes em uma rodada de doze
desafios.

As regras de conteúdo e geração para a avaliação estão documentadas no
[Contrato Pedagógico da AV2 Matemática](docs/av2-matematica-contrato-pedagogico.md).

Ao concluir a rodada, a criança recebe uma página de colorir real do Wikimedia
Commons, escolhida de um catálogo de imagens com licenças abertas. As imagens
são carregadas pela internet; autor, fonte e licença aparecem junto ao desenho
e na impressão. Na tela da recompensa, também pode pedir um desenho novo ao
OpenRouter. A chamada é feita pelo servidor; a chave não vai para o navegador.

## Requisitos

- Node.js 18 ou superior
- npm

Não há dependências externas para instalar: o projeto usa apenas APIs nativas
do Node.js.

## Executar localmente

Requer Node.js 18+ disponível no computador. Para configurar a leitura:

```bash
cp example.env .env
```

Edite `.env`, mantendo a chave somente nesse arquivo privado e preenchendo as
cinco variáveis de voz abaixo. Para habilitar também a geração de desenhos,
preencha `OPENROUTER_IMAGE_MODEL` com um modelo de imagem disponível na sua
conta. O arquivo `.env` não é servido pela aplicação e os
nomes de arquivos de ambiente local estão ignorados pelo Git.

| Variável | Obrigatória | Valor de exemplo | Sensível |
| --- | ---: | --- | ---: |
| `api_url` | Sim | `https://openrouter.ai/api/v1/audio/speech` | Não |
| `api_key` | Sim | `sk-or-v1-...` | Sim |
| `tts_model` | Sim | `google/gemini-3.1-flash-tts-preview` | Não |
| `tts_voice` | Sim | `Zephyr` | Não |
| `tts_response_format` | Sim | `pcm` | Não |
| `OPENROUTER_IMAGE_MODEL` | Para gerar desenhos | `provedor/modelo-de-imagem` | Não |

Em hospedagem, configure essas variáveis no painel do provedor. Alterações nas
variáveis de ambiente podem exigir um novo deploy. A leitura e a geração são
opcionais: sem configuração válida, as atividades e o catálogo de páginas do
Commons continuam disponíveis quando há internet.

Para iniciar localmente:

```bash
npm start
```

Para desenvolvimento, `npm run dev` encerra qualquer processo que esteja
ocupando a porta configurada e inicia o servidor novamente:

```bash
npm run dev
```

Depois, abra <http://127.0.0.1:4173>. A porta padrão é `4173`; para alterá-la:

```bash
PORT=8080 npm start
```

Para rodar os testes:

```bash
npm test
```

Para gerar o pacote estático que será publicado:

```bash
npm run build
```

O build limpa somente `dist/` e recria uma árvore publicável com:

- `dist/index.html`, `dist/styles.css` e `dist/app.js`;
- `dist/src/`, com os módulos ES usados pelo frontend;
- `dist/public/`, com os assets legados e os registros de atribuição.

Arquivos de ambiente, código do servidor, funções, testes, scripts e
configurações privadas não são copiados para `dist/`. A pasta `dist/` continua
ignorada pelo Git.

## Estrutura

- `index.html`: entrada da aplicação.
- `styles.css`: interface responsiva, formas CSS e regras de impressão A4.
- `app.js`: fluxo da experiência, eventos, acessibilidade e telas.
- `src/game.js`: geração, validação e conversão de números para português.
- `src/av2/money.js`: catálogo de moedas e cédulas em centavos inteiros,
  geradores e validadores pedagógicos dos Blocos 01 e 02 da AV2.
- `src/av2/money-composition.js`: desafios, busca limitada de soluções e
  validação de combinações para o Bloco 06; reutiliza o catálogo de dinheiro.
- `src/av2/addition.js`: trilha C/D/U, geradores e validação pedagógica do
  Bloco 03, com regras próprias para cada padrão de reagrupamento.
- `src/av2/cdu-layout.js`: estrutura visual alinhada de centena, dezena e
  unidade para reutilização por atividades futuras.
- `src/av2/progress.js`: progresso separado dos Blocos 01 a 06 da AV2.
- `src/figures.js`: renderização das figuras espaciais em SVG.
- `src/data/coloringPages.js`: seleção aleatória e histórico das páginas de
  colorir da recompensa.
- `src/data/searchColoringPages.js`: catálogo de imagens do Wikimedia Commons,
  com URLs, autores, fontes e licenças.
- `src/data/officialColoringPages.js`: catálogo separado de páginas oficiais
  externas; ele contém somente URLs HTTPS, sem cópias locais ou `iframe`.
- `src/child-profile.js`: validação, normalização e persistência local do nome
  da criança, além da separação entre mensagens visuais e textos neutros de
  voz.
- `src/tts-client.js`: cliente do endpoint interno de voz, com cache de sessão.
- `public/coloring-pages/*.svg`: acervo vetorial legado, fora do catálogo ativo
  de recompensas.
- `public/coloring-pages/ATTRIBUTIONS.md`: fontes, autores e licenças das
  imagens ativas, além do histórico dos desenhos antigos.
- `server.js`: servidor HTTP local para os arquivos estáticos e os endpoints
  `POST /api/tts` e `POST /api/coloring`.
- `api/tts.js`: entrypoint da função Node serverless da Vercel para
  `POST /api/tts`.
- `api/coloring.js`: entrypoint da função Node serverless da Vercel para
  `POST /api/coloring`.
- `server/tts-handler.js`: handler HTTP compartilhado pelo servidor local e
  pela função da Vercel.
- `server/tts-provider.js`: adaptador do OpenRouter com Bearer, áudio binário,
  cache server-side, timeout, validação e tratamento seguro de erros.
- `server/coloring-handler.js`: geração sob demanda com tema e instruções
  fixos, validação da imagem e limites por cliente, sem expor a chave.
- `server/pcm-to-wav.js`: encapsulamento determinístico de PCM em WAV, sem
  alterar os samples e sem processo externo de áudio.
- `tests/game.test.mjs`: testes automatizados da lógica pedagógica.
- `tests/av2-money.test.mjs` e `tests/av2-ui.test.mjs`: testes de denominações,
  geração de questões, isolamento de progresso e jornada infantil da AV2.
- `tests/figures.test.mjs`: testes das figuras espaciais em SVG.
- `tests/coloring-pages.test.mjs`: testes do catálogo remoto, fallback, seleção,
  atribuição e impressão A4.
- `tests/child-profile.test.mjs`: testes do perfil local, personalização e
  privacidade do texto enviado ao TTS.
- `tests/tts.test.mjs`: testes do contrato HTTP, segurança e cache de voz.
- `tests/vercel.test.mjs`: testes do build estático, função Vercel, assets e
  ausência de segredos em `dist/`.

Tudo funciona sem cadastro ou perfil remoto. As páginas de colorir são
carregadas do Wikimedia Commons durante o uso. A criança também pode pedir uma
imagem nova ao OpenRouter, que não é salva no servidor nem no catálogo. O
perfil guarda o nome da criança somente no
dispositivo, em `localStorage`, na chave versionada
`revisao-matematica.childName.v1`. Em dispositivos compartilhados, a ação
“Trocar criança” remove somente esse nome e volta à tela de identificação.
Os Blocos 01 e 02 da AV2 guardam somente a quantidade de rodadas concluídas em
chaves versionadas próprias (`av2-matematica.block-01.dinheiro.progress.v1` e
`av2-matematica.block-02.compras.progress.v1`); esses dados não incluem o nome
da criança nem alteram o progresso ou os históricos da revisão original.
O Bloco 06 usa a chave independente
`av2-matematica.block-06.formar-quantias.progress.v1`.
As páginas do catálogo precisam de internet; o botão “Gerar desenho novo”
continua disponível e recebe uma imagem pelo endpoint sem salvá-la no servidor
nem adicioná-la ao catálogo. A seleção mantém apenas os IDs recentes em
`localStorage`, com fallback em memória quando o armazenamento não estiver
disponível.

Na tela final, “Abrir desenho oficial surpresa ↗” só abre uma página externa
depois de um clique explícito. O destino é escolhido do manifesto oficial, abre
em nova aba com `noopener,noreferrer` e recebe um link acessível de fallback se
o navegador bloquear pop-ups. O botão e suas mensagens ficam ocultos na
impressão; a impressão contém somente a página selecionada e seus créditos.
As origens e licenças estão registradas em
`public/coloring-pages/ATTRIBUTIONS.md`. O botão de geração abre um popup com um campo para o nome de um animal em português e
10 sugestões sorteadas de `src/data/coloringAnimals.js`. O navegador envia
`{ animal, source }` a `/api/coloring`: sugestões usam o mapa `ANIMAL_DETAILS`
no servidor; nomes digitados pedem ao modelo um habitat natural apropriado.
O estilo infantil em preto e branco e as configurações de impressão são fixos.
O nome do animal é enviado ao provedor; o nome da criança não é enviado. A geração
requer `OPENROUTER_IMAGE_MODEL` configurada no servidor.

Mensagens personalizadas ficam apenas na interface. A versão enviada ao
`/api/tts` é sempre um texto pedagógico neutro, sem o nome da criança, e o
frontend continua enviando somente a propriedade `text`.

## Segurança da configuração

O arquivo `.env` é ignorado pelo Git e deve permanecer privado. Nunca inclua
uma chave real no repositório, no HTML, no JavaScript público, em logs ou em
relatórios. O navegador envia somente `{ "text": "..." }` para `/api/tts` e
`{}` para `/api/coloring`; as demais configurações permanecem no servidor.

## Contrato do TTS

O navegador chama somente `POST /api/tts` com `{ "text": "..." }`. O servidor
normaliza e valida o texto, então chama `api_url` com `Authorization: Bearer
api_key` e o payload `{ "model": tts_model, "input": texto, "voice":
tts_voice, "response_format": tts_response_format }`. A configuração ativa
solicita `pcm` ao modelo `google/gemini-3.1-flash-tts-preview` com a voz
`Zephyr`. O OpenRouter entrega PCM mono de 24 kHz e 16 bits; o servidor apenas
acrescenta um cabeçalho WAV, sem alterar os samples, e devolve `audio/wav` ao
navegador. Portanto, `tts_response_format=pcm` é o formato solicitado ao
provedor, enquanto o formato entregue ao navegador é WAV.

| Item | Valor |
| --- | --- |
| `api_url` | `https://openrouter.ai/api/v1/audio/speech` |
| `tts_model` | `google/gemini-3.1-flash-tts-preview` |
| `tts_voice` | `Zephyr` |
| `tts_response_format` | `pcm` |
| formato interno recebido | PCM 24 kHz, 16 bits, mono |
| formato entregue ao navegador | WAV |
| content type entregue | `audio/wav` |

A chave nunca entra no HTML, JavaScript público ou source map. O cache inclui a
configuração de voz, os parâmetros PCM/WAV e a versão das instruções de estilo,
por isso resultados produzidos por uma configuração anterior não são
reutilizados como se fossem o áudio atual.

Os testes usam mocks e não consomem créditos do OpenRouter. Para uma validação
manual, preencha `api_key` somente no `.env` local privado ou nas variáveis da
hospedagem; nunca registre essa chave em logs ou relatórios.

## Publicar na Vercel

O repositório usa o preset `Other` e a configuração versionada em
`vercel.json`. O build publica somente o conteúdo de `dist/`; as funções
`api/tts.js` e `api/coloring.js` são descobertas automaticamente pela Vercel e
continuam disponíveis em `/api/tts` e `/api/coloring`. Não é necessário iniciar
`server.js` na Vercel e não há rewrite para `index.html`.

No painel do projeto, mantenha:

| Configuração | Valor |
| --- | --- |
| Framework Preset | `Other` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | automático |

Como o projeto não possui dependências externas, o Install Command deve
continuar automático; não use `npm run dev` como comando de instalação.

Configure na Vercel as cinco variáveis obrigatórias de voz e, se quiser
habilitar a geração de desenhos, `OPENROUTER_IMAGE_MODEL`. Mantenha tudo no
ambiente de deployment correto, sem colocar segredos no Git ou no frontend:

```env
api_url=https://openrouter.ai/api/v1/audio/speech
api_key=
tts_model=google/gemini-3.1-flash-tts-preview
tts_voice=Zephyr
tts_response_format=pcm
OPENROUTER_IMAGE_MODEL=provedor/modelo-de-imagem
```

`api_key` deve receber o valor real somente no painel da Vercel. O navegador
envia somente texto pedagógico para `/api/tts` e uma solicitação vazia para
`/api/coloring`; as duas chamadas ao OpenRouter são montadas no servidor.
Alterações nas variáveis de ambiente só entram em vigor após um novo
deployment.

Após o deployment, valide sem expor a chave:

```text
GET /              → 200 e index.html
GET /styles.css    → 200 e text/css
GET /app.js        → 200 e JavaScript
GET /api/tts       → 405 e Allow: POST
GET /api/coloring  → 405 e Allow: POST
POST /api/tts      → 200 audio/wav com configuração válida
```

Para o teste real de voz, use uma frase curta como `Olá, criança!`, confirme
antes que as cinco variáveis estão configuradas e verifique que a resposta
binária começa com `RIFF` e contém `WAVE`. Os testes automatizados usam apenas
mocks e nunca consomem créditos da OpenRouter.

### AV2 — Bloco 04

A atividade **Subtração com reagrupamento** oferece rodadas de 12 questões com contas de dois e três algarismos, trocas D → U e C → D, trocas sucessivas, termos e problemas de retirada. Veja [arquitetura, limites e verificação do Bloco 04](docs/av2-block-04-subtracao.md).

### AV2 — Bloco 05

A atividade **Sequências e números por extenso** pratica contagem de um em um até 250, tabela 200–239, antecessor e sucessor, reconhecimento de números por extenso e escolha da grafia ou do numeral correspondente. Respostas por extenso são sempre selecionadas; centenas exatas 300 e 400 aparecem somente nessas questões. Siga o [contrato permanente de interação infantil da AV2](docs/av2-child-interaction-contract.md) e veja [arquitetura, limites e verificação do Bloco 05](docs/av2-block-05-sequencias.md).

### AV2 — Bloco 06

A atividade **Formar quantias** usa moedas e cédulas para formar valores em reais e centavos, reconhecer equivalências, encontrar duas combinações distintas e respeitar uma quantidade exata de cédulas. A busca limitada confirma a viabilidade dos desafios antes de apresentá-los. Cada seleção pode ser ajustada item por item, e o total é calculado em centavos inteiros.
