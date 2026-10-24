# Bloco 07 — Simulado AV2

O Simulado AV2 mantém dois caminhos: **Revisão completa AV2**, que cobre todas as famílias de exercícios demonstradas na revisão oficial do Colégio VITA, e a configuração personalizada, que mantém seleção de assuntos e de 1 a 5 questões por assunto. Uma rodada curta personalizada não promete cobrir a prova inteira. A ordem das questões e dos grupos da revisão completa é embaralhada.

## Cobertura da revisão oficial

| Folha | Experiência no simulado | Implementação e validação |
|---|---|---|
| 1 — moedas e cédula equivalente | Mostra moedas e permite selecionar a cédula equivalente. | Reusa `createCurrencyEquivalenceQuestion`, valores em centavos e o validador do Bloco 01. Rejeita grupos sem uma correspondência exata. |
| 2 — cédulas e brinquedos | Associa quatro grupos de cédulas a brinquedos com preços iguais, tocando primeiro no grupo e depois no brinquedo. | Pareamento completo, editável antes do envio, sem arrastar; cada preço e soma tem uma correspondência única. |
| 3 — dinheiro de Rael | Um cenário conectado mostra as cédulas de 24 reais e os brinquedos: calcula o total, marca todos os produtos compráveis e calcula o troco do caminhão. | A seleção múltipla exige o conjunto exato caminhão + dinossauro. Os 24 reais e preços reaparecem nas etapas relevantes. |
| 4 — quantidade de moedas | Usa desafios de composição do Block 06 para formar 5 reais com cinco moedas de 1 real e 1 real com duas moedas de 50 centavos. | Reutiliza a mesma paleta, estado e validador; a equivalência de 100 centavos é permitida. |
| 5 — preços de material escolar | Um quadro com cinco produtos suporta os extremos de preço e as duas somas pedidas. | As somas exigem digitar o total e selecionar conceitualmente os produtos citados no quadro; o total não é impresso no quadro. |
| 6 — tabela numérica | Tabela crescente de 200 a 239, com várias lacunas e oito valores de referência visíveis. | Reusa o gerador/validador de tabela do Block 05; cada lacuna é verificada. Em telefone, a tabela se reorganiza em cinco colunas mantendo a ordem. |
| 7 — escrita por extenso | Duas respostas digitadas: 208 e 215. | Campo de texto real, caixa e espaços normalizados, tentativa editável e sem resposta na pergunta, fala ou dica inicial. |
| 8 e 8.1 — biblioteca | Uma questão em quatro etapas: C/D/U de 156 + 195, identificação das parcelas/soma, C/D/U de 351 − 147 e identificação dos termos da subtração. | Reutiliza os componentes e traces validados dos Blocks 03/04. A segunda operação só abre depois da adição conferida e usa o 351 validado. O cartão só conclui após todas as etapas. |

Os cartões de associação, seleção múltipla, tabela e problema da biblioteca só contam como resolvidos quando o conjunto ou todas as etapas estão completos. As falhas contam como tentativas e entram na revisão de erros. O problema da biblioteca conta uma vez como cartão, com uma unidade de resultado para cada assunto de operação.

## Rodada personalizada e compatibilidade

- Cada assunto pode ser habilitado ou desabilitado e receber 1–5 questões. As rodadas curtas distribuem variações existentes sem prometer cobertura completa.
- Quando os dois assuntos de operação estão habilitados, o problema da biblioteca pode ocupar uma vaga de adição e uma de subtração, mantendo uma única questão visual encadeada.
- Escrita por extenso, reconhecimento e associação continuam disponíveis como formatos distintos. O modo personalizado não troca toda escrita por escolha múltipla.
- Tabelas e sequências permanecem no intervalo de 0 a 250. 300 e 400 só podem aparecer em exercícios de números por extenso.
- Ao concluir, a criança vai direto ao desenho, sem relatório por assunto. A recompensa mantém como opção praticar os erros em uma nova rodada.
- Progressão por assunto, erros, tentativas e histórico ficam no dispositivo. O desenho local continua disponível; a recompensa também mantém a geração opcional sob demanda via `/api/coloring`, que não envia o nome da criança. Não há analytics remoto. O foco nos erros preserva o tipo de exercício quando existe um equivalente apropriado.

## Verificação

`tests/av2-simulado.test.mjs` cobre REV-01 a REV-08, invariantes do preset e 256 sementes reproduzíveis. `tests/av2-ui.test.mjs` cobre o percurso da revisão completa, valida uma tentativa incorreta com dica/reenvio, inicia a rodada focada, abre a recompensa e retorna à tela inicial. Os testes de Blocos 01–06 continuam cobrindo suas atividades independentes.
