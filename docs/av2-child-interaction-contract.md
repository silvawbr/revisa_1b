# AV2 Child Interaction Contract

This contract applies to every child-facing Mathematics question in the AV2 revision and to the original revision wherever the same interaction rules apply. It governs the answer interaction, including generated exercises and all paths that reuse their generators.

## Normative rules

### AV2-UX-001 — No alphabetic typing

No child-facing Mathematics question may require alphabetic keyboard input. Children must not type letters, words, or sentences to answer Mathematics questions. The child-name field on the initial screen is allowed. Clearly separate parent or administrator configuration fields are outside this contract.

### AV2-UX-002 — Number-word questions

All questions involving numbers written in Portuguese must use selectable answers. This includes both directions: choosing the written form for a displayed number and choosing the numeral for a displayed written form.

### AV2-UX-003 — All entry points

These rules apply to individual activities, Block 05, Block 07 Simulado AV2, complete-revision presets, customized rounds, reinforcement rounds, and any future activity that reuses the same question generators. They also apply to the original revision wherever the same interaction contract applies.

### AV2-UX-004 — No unsupported fallback

Generate each question, validate its interaction contract, and only then render it. If a question cannot provide valid selectable alternatives, reject it and generate another valid candidate. Never fall back to free-text input.

### AV2-UX-005 — Numeric input exception

Numeric-only input remains permitted for arithmetic and numerical sequence or table tasks. This exception never authorizes alphabetic input.

### AV2-UX-006 — Regression protection

Automated tests must verify both question-generation contracts and rendered UI behavior. These tests run through the project's standard `npm test` command; a change that violates them must fail standard verification.

### AV2-UX-007 — Curriculum versus interaction

School materials may contain handwritten-answer exercises. The application may adapt those exercises into recognition questions with selectable alternatives. This adaptation changes the assessed skill from written production to recognition; the two interactions must not be described as testing exactly the same competency. A worksheet's handwriting requirement does not authorize alphabetic typing in the application.

### AV2-UX-008 — Precedence

These child-interaction rules supersede older implementation prompts and project documents that required typing numbers in words. Future Codex implementations must follow this contract unless the product owner explicitly changes it.

## Interaction modes

AV2 question types resolve to an explicit answer mode: `single-choice`, `multiple-choice`, `matching`, `numeric-input`, `money-selection`, `numeric-table`, or `composite`. The central interaction contract rejects unknown modes and rejects the legacy `alphabetic-input` mode. Number-word categories may use only `single-choice` or `matching`.

The runtime follows **Generate → Validate contract → Render**. Simulado candidates carry their resolved `answerMode`; Block 05 number-word candidates carry `single-choice`. Legacy `simulado-word-write` questions are converted to validated multiple-choice questions before rendering when their numeric value is supported. Invalid legacy questions are regenerated for their subject. No renderer contains a free-text fallback.

## Verification coverage

`tests/av2-simulado.test.mjs` exercises both number-word directions, the exact 246 scenario, legacy conversion, custom and full-revision configurations, reinforcement rounds, and 1,000 reproducibly seeded Simulado rounds. It also checks 1,000 seeds of Block 05 number-word generation. `tests/av2-ui.test.mjs` inspects rendered answer controls, selectable behavior, accessible labels, confirmation, feedback, and the absence of writable answer fields for the 246 question.
