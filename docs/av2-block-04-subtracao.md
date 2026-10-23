# Bloco 04 — Subtração com reagrupamento

Atividade independente da AV2 Matemática, baseada em `main` após o merge do PR #8 (Bloco 03). A seleção inclui **Subtração com reagrupamento**, com 12 perguntas embaralhadas: duas de cada categoria SUB-01 a SUB-04, duas de termos e duas de contexto. Inclui contas de dois e três algarismos, teclado numérico, validação, dicas progressivas, feedback personalizado, TTS da questão e explicação, progresso próprio, estrelas e desenho para colorir. Permite reiniciar e voltar à seleção AV2.

## Arquitetura e limites

- `src/av2/subtraction.js`: cálculo puro, eventos ordenados, geração, apresentação textual, validação de candidatos/respostas e contrato da rodada. Cada evento registra origem, destino, estado anterior/posterior e dez unidades da ordem inferior. A validação recalcula a referência e compara o trace completo, categoria, resultado, alternativas, dicas e feedback.
- `src/av2/subtraction-layout.js`: consome candidatos validados e mostra o histórico de cada coluna, inclusive uma dezena alterada duas vezes. O resultado começa vazio. Cada dica revela somente os eventos alcançados. O tamanho do campo segue o minuendo, evitando antecipar quantos algarismos tem a resposta.
- `src/av2/cdu-layout.js`: extensão mínima e opcional `markerMode: 'borrow'` permite anotar unidades e históricos de trocas; o modo padrão de adição é preservado. A grade C/D/U, legenda e teclado existentes são reutilizados.
- `app.js`, `progress.js`, `styles.css`: registro, entrada, correção, navegação, progresso e apresentação. Chave exclusiva: `av2-matematica.block-04.subtracao.progress.v1`.
- `server.js`: publica os módulos novos e corrige a autorização das dependências de produtos já importadas pelo aplicativo, cuja ausência bloqueava a inicialização no servidor local.

Operandos inteiros de 10 a 999, subtraendo no máximo igual ao minuendo; as rodadas preferem diferenças positivas. SUB-01 não tem troca; SUB-02 troca apenas D → U; SUB-03 apenas C → D; SUB-04 exige as duas trocas e operandos de três algarismos. O algoritmo puro calcula também pontes por zero, mas o validador curricular rejeita essas questões antes da exibição (`602 − 185`). Zeros na resposta são permitidos. Geração limitada a 256 tentativas, seguida de busca finita de fallback validado, sem operações repetidas na rodada.

Termos: minuendo, subtraendo, resto ou diferença, nome do resultado e número retirado. Operações completas aparecem nessas questões de terminologia. Contextos de livros, brinquedos e figurinhas usam uma única subtração e explicam a retirada. Não há exercício misto de duas etapas, moeda decimal ou alteração em `src/game.js` e nos limites da revisão anterior.

## Referências verificadas

| Conta | Resultado | Trocas |
|---|---:|---|
| 46 − 33 | 13 | nenhuma |
| 71 − 39 | 32 | (0C, 7D, 1U) → (0C, 6D, 11U) |
| 50 − 23 | 27 | D → U |
| 52 − 27 | 25 | D → U |
| 351 − 147 | 204 | (3C, 5D, 1U) → (3C, 4D, 11U); resposta 2C, 0D, 4U |
| 564 − 228 | 336 | D → U |
| 862 − 695 | 167 | (8C, 6D, 2U) → (8C, 5D, 12U) → (7C, 15D, 12U) |
| 563 − 271 | 292 | somente C → D |

## Verificação executada

- Baseline atual: `npm test`, 12 arquivos aprovados; `npm run build`, aprovado.
- Implementação: `npm test`, 13 arquivos aprovados; `npm run build`, aprovado; `git diff --check`, aprovado.
- 2.000 rodadas reproduzíveis, 24.000 questões: cobertura exata, invariantes, unicidade, limites, cinco papéis de terminologia, contextos e explicações. Candidatos deliberadamente malformados são rejeitados. RNG constante, fora da faixa e NaN exercitam o fallback.
- DOM simulado: rodada completa, teclado, tentativa vazia/incorreta, dicas, duas trocas, termos, feedback, TTS, conclusão, reinício, nome, progresso isolado e recompensa. Os testes existentes de adição, dinheiro, equivalências, revisão original, perfil e desenhos continuam aprovados.
- Chromium/Playwright real: rodadas completas de 12 perguntas em 320, 390 e 768 px; dicas e duas trocas, entrada, correção e recompensa, sem erro JavaScript ou overflow horizontal. Captura de 320 px inspecionada visualmente.
- Handler estático: módulos de subtração/C-D-U e dependências de produtos retornam HTTP 200.

## Checklist no Vercel Preview

- Abrir AV2 → Subtração com reagrupamento em celular/tablet e completar a rodada.
- Conferir alinhamento, valores riscados e históricos com duas trocas; nenhuma resposta ou anotação completa deve aparecer inicialmente.
- Conferir zero em resultados como 204; testar teclado físico (incluindo Enter) e de toque, dicas, erro, correção, termos, reinício e retorno às atividades.
- Ouvir pergunta e explicação em pt-BR com o provedor TTS configurado e conferir rótulos com leitor de tela.
- Confirmar persistência do nome, progresso independente, impressão/recompensa e atividades anteriores.

O Preview implantado, o áudio real e leitor de tela físico não foram verificados nesta execução. O ambiente local não tem as variáveis do provedor TTS; os testes do cliente/provedor usam respostas controladas. Fotos externas de moedas/cédulas tiveram falhas de rede no ambiente local; o Bloco 04 não depende dessas imagens. Nenhum merge ou deploy direto em produção foi realizado.

## Minuendo editável e zeros no resultado

Cada algarismo do próprio minuendo é um campo editável, inicialmente preenchido com o valor original. A linha separada de trocas foi removida. Em `42 − 38`, a criança pode substituir 4 por 3 e 2 por 12 diretamente na conta. Teclado físico e teclado da tela aceitam até dois algarismos por coluna; o botão Limpar restaura o minuendo original. Se houver alteração no minuendo, a conferência valida todos os valores finais com o trace. Resolver sem alterar o minuendo continua permitido. As dicas preservam o histórico das mudanças junto à coluna.

Resultados completos mantêm zeros à esquerda nas colunas usadas: `365 − 331` aparece como `034` e `42 − 38` como `04`. Os testes cobrem os valores iniciais, ausência da linha de trocas, edição, conferência, teclado e zeros visíveis.
