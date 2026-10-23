import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSubtractionTrace, createSubtractionQuestion, createAv2SubtractionRound, createAv2SubtractionQuestion, validateAv2SubtractionQuestionCandidate, validateAv2SubtractionAnswer, validateAv2SubtractionRound, subtractionCategory } from '../src/av2/subtraction.js';
import { renderSubtractionQuestion } from '../src/av2/subtraction-layout.js';
import { renderCduLayout } from '../src/av2/cdu-layout.js';
const refs = [[46,33,13,'SUB-01'],[71,39,32,'SUB-02'],[50,23,27,'SUB-02'],[52,27,25,'SUB-02'],[351,147,204,'SUB-02'],[564,228,336,'SUB-02'],[862,695,167,'SUB-04'],[563,271,292,'SUB-03']];
const value = (s) => s.hundreds*100+s.tens*10+s.units;
function rng(seed) { return () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }

test('mandatory references preserve every exchange and calculate adjusted digits', () => {
  for (const [a,b,result,category] of refs) {
    const t = calculateSubtractionTrace(a,b);
    assert.equal(t.result,result); assert.equal(subtractionCategory(t),category);
    assert.equal(value(Object.fromEntries(Object.entries(t.columns).map(([c,x])=>[c,x.resultDigit]))),result);
    for (const e of t.events) {
      assert.equal(value(e.stateBefore),a); assert.equal(value(e.stateAfter),a);
      assert.ok(e.stateBefore[e.fromColumn]>0);
      assert.equal(e.stateAfter[e.fromColumn],e.stateBefore[e.fromColumn]-1);
      assert.equal(e.stateAfter[e.toColumn],e.stateBefore[e.toColumn]+10);
      assert.ok(Object.values(e.stateAfter).every(n=>n>=0));
    }
    const q=createSubtractionQuestion({a,b});
    assert.ok(validateAv2SubtractionAnswer(q,String(result)));
    assert.equal(validateAv2SubtractionAnswer(q,result+1),false);
  }
  const single=calculateSubtractionTrace(71,39);
  assert.deepEqual(single.original,{hundreds:0,tens:7,units:1});
  assert.deepEqual(single.adjusted,{hundreds:0,tens:6,units:11});
  assert.equal(single.events.length,1);
  const zero=calculateSubtractionTrace(351,147);
  assert.deepEqual(zero.adjusted,{hundreds:3,tens:4,units:11});
  assert.deepEqual(Object.values(zero.columns).map(c=>c.resultDigit),[4,0,2]);
  const both=calculateSubtractionTrace(862,695);
  assert.deepEqual(both.events.map(e=>e.stateAfter),[{hundreds:8,tens:5,units:12},{hundreds:7,tens:15,units:12}]);
  assert.deepEqual(both.events[1].stateBefore,both.events[0].stateAfter);
  assert.deepEqual(calculateSubtractionTrace(563,271).events.map(e=>[e.fromColumn,e.toColumn]),[['hundreds','tens']]);
});

test('seeded rounds: 24,000 validated questions, exact coverage, no repeated operations, all term roles', () => {
  const roles=new Set(); const signatures=new Set();
  for(let seed=1;seed<=2000;seed++) {
    const round=createAv2SubtractionRound(rng(seed));
    assert.ok(validateAv2SubtractionRound(round));
    assert.equal(new Set(round.map(q=>`${q.data.a}-${q.data.b}`)).size,12);
    signatures.add(round.map(q=>q.questionId).join('|'));
    for(const q of round) {
      const {trace,a,b}=q.data;
      assert.ok(validateAv2SubtractionQuestionCandidate(q));
      assert.equal(trace.result,a-b); assert.ok(a>b); assert.equal(trace.zeroBridge,false);
      assert.equal(new Set(q.options).size,4);
      for(const e of trace.events) {assert.equal(value(e.stateBefore),a);assert.equal(value(e.stateAfter),a);}
      if(q.type==='terms') roles.add(q.data.term);
      if(q.type==='context') {assert.match(q.explanation,/quantidade foi retirada/);assert.ok(q.prompt.includes(String(a))&&q.prompt.includes(String(b)));}
      assert.equal(q.hints[0].revealedEvents,0);
      assert.equal(q.hints[0].text.includes(`= ${trace.result}`),false);
      if(q.type !== 'terms') assert.equal((q.explanation.match(/Troque uma/g)||[]).length,trace.events.length);
    }
  }
  assert.equal(signatures.size,2000);assert.equal(roles.size,5);
  assert.deepEqual(createAv2SubtractionRound(rng(52)),createAv2SubtractionRound(rng(52)));
});

test('bounded generation works with constant RNG and category APIs enforce digit counts', () => {
  for(const random of [()=>0,()=>1,()=>NaN]) assert.ok(validateAv2SubtractionRound(createAv2SubtractionRound(random)));
  for(const category of ['SUB-01','SUB-02','SUB-03','SUB-04']) {
    const q=createAv2SubtractionQuestion({category,digitCount:3,random:rng(45)});
    assert.equal(q.pedagogicalCategory,category);
  }
  assert.throws(()=>createAv2SubtractionQuestion({category:'SUB-04',digitCount:2}));
  assert.throws(()=>createAv2SubtractionQuestion({category:'oops'}));
});

test('validator rejects malformed arithmetic, category, trace, speech, feedback, hints and options', () => {
  const q=createSubtractionQuestion({a:862,b:695});
  const mutations=[
    c=>c.data.a=1000,c=>c.data.b=900,c=>c.data.result++,c=>c.correctAnswer++,c=>c.pedagogicalCategory='SUB-02',
    c=>c.data.pattern='SUB-02',c=>c.data.trace.events[1].stateBefore.tens=6,
    c=>c.data.trace.events.push(c.data.trace.events[0]),c=>c.data.trace.adjusted.tens=16,
    c=>c.options[0]=c.options[1],c=>c.hints[0].revealedEvents=2,c=>c.hints[1].text='Troque duas dezenas.',
    c=>c.speech='A resposta é 167.',c=>c.feedback.retry='',c=>c.explanation='A resposta é 167.',c=>c.data.trace.columns.units.resultDigit=8,
  ];
  for(const mutate of mutations) {const c=structuredClone(q);mutate(c);assert.equal(validateAv2SubtractionQuestionCandidate(c),false);assert.throws(()=>renderSubtractionQuestion(c));}
  assert.equal(calculateSubtractionTrace(602,185).zeroBridge,true);
  assert.throws(()=>createSubtractionQuestion({a:602,b:185}));
  assert.throws(()=>calculateSubtractionTrace(10,20));
  assert.throws(()=>calculateSubtractionTrace(1.5,1));
  const terms=createSubtractionQuestion({a:351,b:147,type:'terms',term:'minuend'});
  const broken=structuredClone(terms);broken.correctAnswer=147;
  assert.equal(validateAv2SubtractionQuestionCandidate(broken),false);
});

test('C/D/U rendering reveals sequential histories, preserves zero, never leaks the initial answer', () => {
  const q=createSubtractionQuestion({a:862,b:695});
  const initial=renderSubtractionQuestion(q);
  assert.doesNotMatch(initial,/subtraction-history|igual a 167|value="167"/);
  assert.match(initial,/data-av2-add-field="hundreds"/);
  assert.match(initial,/aria-label="menos"/);
  const first=renderSubtractionQuestion(q,{hintIndex:1});
  assert.match(first,/6 depois 5/);assert.match(first,/2 depois 12/);assert.doesNotMatch(first,/depois 15/);
  const second=renderSubtractionQuestion(q,{hintIndex:3});
  assert.match(second,/6 depois 5 depois 15/);assert.match(second,/8 depois 7/);
  assert.match(second,/Temos 5 dezenas/);
  assert.match(renderSubtractionQuestion(createSubtractionQuestion({a:351,b:147}),{correct:true}),/role="cell">0<\/span>/);
  assert.doesNotMatch(renderSubtractionQuestion(createSubtractionQuestion({a:46,b:33}),{hintIndex:1}),/subtraction-history/);
  for(const [term,answer] of [['minuend',351],['subtrahend',147],['difference',204],['name','Resto ou diferença'],['removed',147]]) {
    const t=createSubtractionQuestion({a:351,b:147,type:'terms',term});
    assert.equal(t.correctAnswer,answer);assert.match(renderSubtractionQuestion(t),/igual a 204/);
  }
  const before=renderCduLayout({firstOperand:156,secondOperand:195,resultCells:['','',''],ariaLabel:'adição'});
  assert.match(before,/não há casa de reserva nas unidades/);
  assert.match(before,/aria-label="mais"/);
});

test('local static handler serves subtraction modules and the existing product dependencies', async () => {
  const { serveStatic } = await import('../server.js');
  for(const url of ['/src/av2/subtraction.js','/src/av2/subtraction-layout.js','/src/av2/cdu-layout.js','/src/av2/product-illustrations.js','/public/av2-products/book.svg']) {
    const response={status:null,writeHead(status){this.status=status;},end(){}};
    await serveStatic({method:'HEAD',url},response);assert.equal(response.status,200,url);
  }
});
