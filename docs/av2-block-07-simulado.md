# Bloco 07 — Simulado AV2

## Rodada

- Os assuntos podem ser habilitados separadamente, com 1 a 5 questões por assunto. O padrão usa todos os cinco assuntos com três questões cada.
- A ordem final é embaralhada a cada rodada.
- Dinheiro reúne reconhecimento, comparação, equivalência e compras; quando há duas ou mais questões, a seleção inclui uma questão de compras com múltiplas respostas e um desafio validado de Formar quantias com uma solução.
- Adição e subtração usam os geradores e validadores dos blocos existentes. Sem os dois assuntos juntos, cada gerador reserva uma questão contextualizada.
- Sequências avançam de um em um, dentro da faixa até 250. Números por extenso incluem associação entre três números e suas escritas, além de questões de seleção.

## Problema composto

Quando adição e subtração estão habilitadas, a referência oficial da biblioteca ocupa uma vaga de cada assunto e aparece como um único cartão com duas etapas:

1. `156 + 195 = 351` — a etapa seguinte fica bloqueada até esta operação estar correta.
2. `351 − 147 = 204` — usa o resultado intermediário validado na primeira etapa.

Cada etapa registra acertos e tentativas no assunto da operação correspondente. Uma resposta errada na etapa 1 gera reforço de adição; um erro na etapa 2 gera reforço de subtração.

## Resultados e revisão

- A tabela por assunto mostra acertos na primeira tentativa, questões resolvidas e respostas enviadas.
- Cada questão que teve erro pode gerar uma nova questão do mesmo assunto para uma rodada focada.
- O progresso do Bloco 07 usa chave própria no armazenamento local. Não depende de autenticação, banco de dados ou analytics remoto.
- O simulado reutiliza TTS, feedback, indicador de progresso e a recompensa de colorir já usada pela AV2.

## Validação

Os candidatos de dinheiro, adição e subtração passam pelos validadores dos próprios blocos. As questões de sequência, escrita por extenso, associação e duas etapas possuem validadores próprios. A associação exige o conjunto completo de pares sem repetição; questões de múltiplas respostas preservam a validação exata do gerador de compras.
