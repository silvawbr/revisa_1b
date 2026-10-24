# Bloco 07 — Simulado AV2

O Simulado AV2 mantém dois caminhos: **Revisão completa AV2**, que cobre todas as famílias de exercícios demonstradas na revisão oficial do Colégio VITA, e a configuração personalizada, que mantém seleção de assuntos e de 1 a 5 questões por assunto. Uma rodada curta personalizada não promete cobrir a prova inteira. A revisão completa mantém os formatos e a cobertura oficial, sorteando novos valores, produtos, opções e respostas em cada rodada.

## Cobertura da revisão oficial

| Folha | Experiência no simulado | Implementação e validação |
|---|---|---|
| 1 — moedas e cédula equivalente | Mostra moedas e permite selecionar a cédula equivalente. | Reusa `createCurrencyEquivalenceQuestion`, sorteia grupos de moedas que somam cédulas de valores diferentes e valida a equivalência exata. |
| 2 — cédulas e brinquedos | Associa quatro grupos de cédulas a brinquedos com preços iguais, tocando primeiro no grupo e depois no brinquedo. | Os valores dos grupos e os preços dos brinquedos variam. Cada par correto trava o grupo e o brinquedo com uma cor exclusiva; a conferência final só habilita depois dos quatro pares corretos. |
| 3 — dinheiro de Rael | Um cenário conectado sorteia o dinheiro disponível e os preços dos brinquedos: calcula o total, marca todos os produtos compráveis e calcula o troco de uma compra possível. | A seleção múltipla exige o conjunto exato dos produtos que cabem no dinheiro sorteado; a resposta de troco acompanha o preço sorteado. |
| 4 — quantidade de moedas | Usa dois desafios de equivalência do Block 06 com cédulas ou moedas de valores variados. | Reutiliza a mesma paleta, estado e validador; os alvos e as quantidades corretas variam entre desafios aprovados. |
| 5 — preços de material escolar | Um quadro com cinco produtos e preços sorteados suporta perguntas sobre os extremos de preço e duas somas de itens escolhidos. | As somas exigem digitar o total. Os produtos pedidos, as opções e os valores mudam; o total não é impresso no quadro. |
| 6 — tabela numérica | Tabela crescente de 40 números entre 200 e 250, com lacunas e referências visíveis. | Reusa o gerador/validador de tabela do Block 05; o início da sequência e as lacunas variam. Em telefone, a tabela se reorganiza em cinco colunas mantendo a ordem. |
| 7 — escrita por extenso | Duas respostas digitadas para números sorteados entre 200 e 250, 300 e 400. | Campo de texto real, caixa e espaços normalizados, tentativa editável e sem resposta na pergunta, fala ou dica inicial. |
| 8 e 8.1 — biblioteca | Uma questão em quatro etapas: C/D/U de uma adição sorteada, identificação das parcelas/soma, C/D/U da subtração correspondente e identificação dos termos. | Reutiliza os componentes e traces validados dos Blocks 03/04. A segunda operação só abre depois da adição conferida e usa o resultado calculado. O cartão só conclui após todas as etapas. |

Os cartões de associação, seleção múltipla, tabela e problema da biblioteca só contam como resolvidos quando o conjunto ou todas as etapas estão completos. As falhas contam como tentativas e entram na revisão de erros. O problema da biblioteca conta uma vez como cartão, com uma unidade de resultado para cada assunto de operação.

## Rodada personalizada e compatibilidade

- Cada assunto pode ser habilitado ou desabilitado e receber 1–5 questões. As rodadas curtas distribuem variações existentes sem prometer cobertura completa.
- Quando os dois assuntos de operação estão habilitados, o problema da biblioteca pode ocupar uma vaga de adição e uma de subtração, mantendo uma única questão visual encadeada.
- Na configuração personalizada e na revisão completa, os valores do problema da biblioteca são sorteados a cada rodada.
- Escrita por extenso, reconhecimento e associação continuam disponíveis como formatos distintos. O modo personalizado não troca toda escrita por escolha múltipla.
- Tabelas e sequências permanecem no intervalo de 0 a 250. 300 e 400 só podem aparecer em exercícios de números por extenso.
- Ao concluir, a criança vai direto ao desenho, sem relatório por assunto. A recompensa mantém como opção praticar os erros em uma nova rodada.
- Progressão por assunto, erros, tentativas e histórico ficam no dispositivo. O desenho local continua disponível; a recompensa também mantém a geração opcional sob demanda via `/api/coloring`, que não envia o nome da criança. Não há analytics remoto. O foco nos erros preserva o tipo de exercício quando existe um equivalente apropriado.

## Verificação

`tests/av2-simulado.test.mjs` verifica os invariantes dos formatos com os valores sorteados e 256 sementes reproduzíveis. `tests/av2-ui.test.mjs` percorre a revisão completa usando os dados calculados da rodada. Os testes de Blocos 01–06 continuam cobrindo suas atividades independentes.
