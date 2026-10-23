export const AV2_SEQUENCES_ACTIVITY_ID = 'av2-sequences';
export const AV2_SEQUENCES_PROGRESS_STORAGE_KEY = 'av2-matematica.block-05.sequencias.progress.v1';
export const NUMBER_WORD_VALUES = Object.freeze([...Array(251).keys(), 300, 400]);
const units = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove'];
const teens = ['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
const tens = ['', '', 'vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
function under100(n) { return n < 10 ? units[n] : n < 20 ? teens[n-10] : n%10 ? `${tens[Math.floor(n/10)]} e ${units[n%10]}` : tens[n/10]; }
export function numberToWordsPtBr(n) {
 if (!Number.isInteger(n) || !(n >= 0 && n <= 250 || n === 300 || n === 400)) throw new RangeError('Número fora do conteúdo desta atividade.');
 if (n < 100) return under100(n);
 if (n === 100) return 'cem'; if(n===300)return 'trezentos';if(n===400)return 'quatrocentos';
 const h=Math.floor(n/100),r=n%100, hundred=h===1?'cento':'duzentos';
 return r===0? (h===1?'cem':'duzentos') : `${hundred} e ${under100(r)}`;
}
export function normalizeWordAnswer(value) { return String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' '); }
function revealsWrittenAnswer(text,answer){const tokens=normalizeWordAnswer(text).split(/[^a-záàâãéêíóôõúüç]+/u).filter(Boolean),target=normalizeWordAnswer(answer).split(' ');return tokens.some((_,i)=>tokens.slice(i,i+target.length).join(' ')===target.join(' '));}
export function validateWordAnswer(expected,value) { return normalizeWordAnswer(value) === normalizeWordAnswer(numberToWordsPtBr(expected)); }
const rnd=(random,max)=>Math.floor(random()*max);
const pick=(random,values)=>values[rnd(random,values.length)];
function question(base) { return Object.freeze({...base,activityId:AV2_SEQUENCES_ACTIVITY_ID,feedback:{correct:'Muito bem! Você conseguiu!',retry:'Quase! Observe os números e tente de novo.'}}); }
export function createSequenceQuestion(direction='increasing',random=Math.random,{start=null,gap=null,length=5}={}) {
 const step=direction==='increasing'?1:-1;if(!['increasing','decreasing'].includes(direction))throw new RangeError('Sequência inválida');
 let s=start;
 if(s===null){const candidates=Array.from({length:251},(_,i)=>i).filter(x=>direction==='increasing'?x+length-1<=250:x-(length-1)>=0);s=pick(random,candidates);}
 const values=Array.from({length},(_,i)=>s+i*step);if(values.some(v=>v<0||v>250))throw new RangeError('Sequência fora do limite');
 const blank=gap===null?rnd(random,length):gap;if(!Number.isInteger(blank)||blank<0||blank>=length)throw new RangeError('Espaço inválido');
 return question({type:'sequence',category:direction==='increasing'?'NUM-01':'NUM-02',direction,values,blank,correctAnswer:values[blank],prompt:direction==='increasing'?'Complete a sequência. Os números aumentam de um em um.':'Complete a sequência. Os números diminuem de um em um.',speech:`${direction==='increasing'?'Complete a sequência crescente':'Complete a sequência decrescente'}. ${values.map((v,i)=>i===blank?'espaço vazio':String(v)).join(', ')}.`,hint:direction==='increasing'?'Depois deste número vem o próximo número.':'Antes deste número vem o número anterior.',explanation:direction==='increasing'?`Os números aumentam de um em um. Depois de ${values[blank]-1} vem ${values[blank]}.`:`Os números diminuem de um em um. Antes de ${values[blank]+1} vem ${values[blank]}.`});
}
export function createNeighborQuestion(kind='predecessor',random=Math.random,{target=null}={}) { if(!['predecessor','successor'].includes(kind))throw new RangeError('Tipo inválido');target ??=kind==='predecessor'?1+rnd(random,250):rnd(random,250);if(!Number.isInteger(target)||target<0||target>250||kind==='predecessor'&&target===0||kind==='successor'&&target===250)throw new RangeError('Alvo inválido');const answer=target+(kind==='predecessor'?-1:1);return question({type:'number-choice',category:'NUM-03',kind,target,correctAnswer:answer,options:uniqueOptions(answer,random),prompt:`Qual é o ${kind==='predecessor'?'antecessor':'sucessor'} de ${target}?`,speech:`Qual é o ${kind==='predecessor'?'antecessor':'sucessor'} de ${numberToWordsPtBr(target)}?`,hint:kind==='predecessor'?'O antecessor é o número que vem imediatamente antes.':'O sucessor é o número que vem imediatamente depois.',explanation:kind==='predecessor'?`O antecessor é o número que vem imediatamente antes. Antes de ${target} vem ${answer}.`:`O sucessor é o número que vem imediatamente depois. Depois de ${target} vem ${answer}.`}); }
function uniqueOptions(answer,random,limit=250){const set=new Set([answer]);for(let tries=0;set.size<4&&tries<40;tries++){let v=Math.max(0,Math.min(limit,answer+pick(random,[-20,-10,-2,-1,1,2,10,20])));if(v!==answer)set.add(v);}for(let v=0;set.size<4&&v<=limit;v++)if(v!==answer)set.add(v);if(set.size!==4)throw new Error('Não foi possível montar alternativas distintas.');return shuffle([...set],random);}
function shuffle(a,random){for(let i=a.length-1;i>0;i--){const j=rnd(random,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function createNumberTableQuestion(random=Math.random,{start=200,length=40,columns=10,blankCount=4}={}) {const values=Array.from({length},(_,i)=>start+i);if(start<0||start+length-1>250||length<2||columns<1)throw new RangeError('Tabela inválida');const indices=shuffle(values.map((_,i)=>i),random).slice(0,Math.min(blankCount,length)).sort((a,b)=>a-b);return question({type:'number-table',category:'NUM-04',values,columns,gaps:indices,answers:indices.map(i=>values[i]),prompt:'Complete os espaços vazios da tabela.',speech:`Complete a tabela dos números de ${start} até ${start+length-1}.`,hint:'Leia a tabela da esquerda para a direita e de cima para baixo.',explanation:'Cada casa segue a contagem de um em um.'}); }
export function createRecognitionQuestion(random=Math.random,{value=null}={}) { value ??= pick(random,NUMBER_WORD_VALUES);const word=numberToWordsPtBr(value);return question({type:'number-choice',category:'NUM-05',value,correctAnswer:value,options:uniqueOptions(value,random,250),prompt:'Qual número está escrito abaixo?',displayWord:word,speech:`Qual número está escrito abaixo? ${word}.`,hint:'Observe as centenas, dezenas e unidades.',explanation:`${word} representa o número ${value}.`}); }
export function createWritingQuestion(random=Math.random,{value=null}={}) {value ??=pick(random,NUMBER_WORD_VALUES);return question({type:'word-input',category:'NUM-06',value,correctAnswer:numberToWordsPtBr(value),prompt:`Escreva por extenso o número ${value}.`,speech:'Escreva por extenso o número mostrado na tela.',hint:'Pense nas centenas, dezenas e unidades. Revise cada palavra antes de conferir.',explanation:`${value} se escreve ${numberToWordsPtBr(value)}.`});}
export function validateSequenceQuestion(q){return !!q&&q.type==='sequence'&&['increasing','decreasing'].includes(q.direction)&&Number.isInteger(q.blank)&&q.category===(q.direction==='increasing'?'NUM-01':'NUM-02')&&q.values?.length>=2&&q.values.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=250&&(i===0||n-q.values[i-1]===(q.direction==='increasing'?1:-1)))&&q.blank>=0&&q.blank<q.values.length&&q.correctAnswer===q.values[q.blank];}
export function validateNumberTable(q,answers={}){if(!q||q.type!=='number-table'||q.values.some((n,i)=>n<0||n>250||i&&n!==q.values[i-1]+1))return false;return q.gaps.every((i)=>Number.isInteger(Number(answers[i]))&&Number(answers[i])===q.values[i]);}
export function createAv2SequencesRound(random=Math.random){
 const unique=(factory,key)=>{let candidate;for(let attempt=0;attempt<16;attempt++){candidate=factory();const signature=key(candidate);if(!signatures.has(signature)){signatures.add(signature);return candidate;}}throw new Error('Não foi possível gerar uma rodada variada.');};
 const signatures=new Set();const qs=[unique(()=>createSequenceQuestion('increasing',random),q=>`${q.category}:${q.values.join(',')}:${q.blank}`),unique(()=>createSequenceQuestion('increasing',random),q=>`${q.category}:${q.values.join(',')}:${q.blank}`),unique(()=>createSequenceQuestion('decreasing',random),q=>`${q.category}:${q.values.join(',')}:${q.blank}`),unique(()=>createSequenceQuestion('decreasing',random),q=>`${q.category}:${q.values.join(',')}:${q.blank}`),createNeighborQuestion('predecessor',random),createNeighborQuestion('successor',random),createNumberTableQuestion(random,{length:20,columns:5,blankCount:3}),createNumberTableQuestion(random,{length:40,columns:10,blankCount:4}),unique(()=>createRecognitionQuestion(random),q=>`NUM-05:${q.value}`),unique(()=>createRecognitionQuestion(random),q=>`NUM-05:${q.value}`),unique(()=>createWritingQuestion(random),q=>`NUM-06:${q.value}`),unique(()=>createWritingQuestion(random),q=>`NUM-06:${q.value}`)];
 const round=shuffle(qs,random);if(!validateAv2SequencesRound(round))throw new Error(`A rodada gerada não passou pela validação pedagógica: ${round.filter(q=>!validateAv2SequencesQuestion(q)).map(q=>q.category+':'+q.type).join(',')}`);return round;
}
export function validateAv2SequencesAnswer(q,answer){
 if(q.type==='word-input')return validateWordAnswer(q.value,answer);
 if(q.type==='number-table')return validateNumberTable(q,answer);
 if(typeof answer==='string'&&!/^\d+$/.test(answer.trim()))return false;
 return Number.isInteger(Number(answer))&&Number(answer)===q.correctAnswer;
}

export function validateAv2SequencesQuestion(q){
 if(!q||q.activityId!==AV2_SEQUENCES_ACTIVITY_ID||!q.feedback?.correct||!q.feedback?.retry)return false;
 if(q.type==='sequence')return validateSequenceQuestion(q)&&q.hint&&q.explanation&&!q.speech.split(/\\D+/).includes(String(q.correctAnswer));
 if(q.type==='number-table')return q.category==='NUM-04'&&q.values.length>=2&&Number.isInteger(q.columns)&&q.columns>0&&q.values.every((n,i)=>Number.isInteger(n)&&n>=0&&n<=250&&(!i||n===q.values[i-1]+1))&&new Set(q.gaps).size===q.gaps.length&&q.gaps.length>0&&q.gaps.every(i=>Number.isInteger(i)&&i>=0&&i<q.values.length)&&q.answers.length===q.gaps.length&&q.gaps.every((i,index)=>q.answers[index]===q.values[i]);
 if(q.type==='word-input')return q.category==='NUM-06'&&NUMBER_WORD_VALUES.includes(q.value)&&q.correctAnswer===numberToWordsPtBr(q.value)&&!revealsWrittenAnswer(q.speech,q.correctAnswer)&&!revealsWrittenAnswer(q.hint,q.correctAnswer);
 if(q.type==='number-choice'){
   const options=q.options;if(!Array.isArray(options)||options.length!==4||new Set(options).size!==4||options.filter(x=>x===q.correctAnswer).length!==1||options.some(x=>!Number.isInteger(x)||x<0||x>250&&!(x===q.correctAnswer&&NUMBER_WORD_VALUES.includes(x))))return false;
   if(q.category==='NUM-03')return ['predecessor','successor'].includes(q.kind)&&Number.isInteger(q.target)&&q.target>=0&&q.target<=250&&!(q.kind==='predecessor'&&q.target===0)&&!(q.kind==='successor'&&q.target===250)&&q.correctAnswer===q.target+(q.kind==='predecessor'?-1:1);
   return q.category==='NUM-05'&&NUMBER_WORD_VALUES.includes(q.value)&&q.correctAnswer===q.value&&q.displayWord===numberToWordsPtBr(q.value)&&q.prompt==='Qual número está escrito abaixo?';
 }
 return false;
}
export function validateAv2SequencesRound(round){return Array.isArray(round)&&round.length===12&&round.every(validateAv2SequencesQuestion)&&['NUM-01','NUM-02','NUM-03','NUM-04','NUM-05','NUM-06'].every(c=>round.filter(q=>q.category===c).length===2)&&round.filter(q=>q.category==='NUM-03').some(q=>q.kind==='predecessor')&&round.filter(q=>q.category==='NUM-03').some(q=>q.kind==='successor');}
