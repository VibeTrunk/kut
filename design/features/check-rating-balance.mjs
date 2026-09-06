// Design audit, not a change to the live rating engine. No production data.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url), ts=require('typescript');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const cache=new Map();
function load(file){
  if(cache.has(file))return cache.get(file);
  const compiled={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename:file})(name=>name.startsWith('@/')?load(path.join(root,'src',name.slice(2)+'.ts')):require(name),compiled,compiled.exports);
  cache.set(file,compiled.exports);return compiled.exports;
}
const live=load(path.join(root,'src/game/rating-engine.ts'));
const weights=[1,.75,.5,.25];
const goal=g=>g===0?0:g===1?1:g===2?1.25:1.5;
const form=inputs=>Math.min(8,inputs.slice(0,4).reduce((sum,x,i)=>sum+x*weights[i],0));
const categories=counts=>live.calculateKudosForm(counts.filter(n=>n>=2).length);
const rows=[];
for(const g of [0,1,2,3,4])rows.push({goals:g,oldWeeklyForm:live.calculateWeeklyPerformance(g),newGoalForm:goal(g),newGoalOvr:Math.round(goal(g)),shootingExtra:live.calculateAttributes(60,'all_rounder',g).sho-60});
assert.equal(form([3,3,3,3]),7.5);assert.equal(form([1.5,1.5,1.5,1.5]),3.75);
assert.equal(form([3,0,3,0]),4.5);assert.equal(categories([1,1,1]),0);assert.equal(categories([2,2,2]),1.5);
for(let g=0;g<=99;g++)for(let qualified=0;qualified<=3;qualified++){
  assert.ok(goal(g)+live.calculateKudosForm(qualified)<=3);
  for(const activity of [0,14,50,80,100])assert.ok(live.calculateLiveOvr(live.calculateActivityOvr(activity),form(Array(4).fill(goal(g)+live.calculateKudosForm(qualified))))<=83);
}
const isolated=Array.from({length:5},(_,age)=>({age,goalOrKudosForm:age<4?1.5*weights[age]:0,combinedForm:age<4?3*weights[age]:0}));
const oldDecay=Array.from({length:5},(_,age)=>Number((live.calculateWeeklyPerformance(3)*(.55**age)).toFixed(6)));
// Illustrative uniform nominations: everyone answers every category, each
// nominates three distinct teammates (or as many as exist), never themselves.
let seed=20260906;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const turnout=[];
for(const [attendees,voters] of [[3,3],[5,5],[20,5],[20,10],[20,20]]){
  let total=0,recognized=0,maxed=0;const runs=20000;
  for(let r=0;r<runs;r++){
    const tally=Array.from({length:attendees},()=>[0,0,0]);
    for(let v=0;v<voters;v++){
      const options=Array.from({length:attendees},(_,i)=>i).filter(i=>i!==v);
      for(let c=0;c<Math.min(3,attendees-1);c++){
        const pick=Math.floor(random()*options.length);tally[options.splice(pick,1)[0]][c]++;
      }
    }
    for(const t of tally){const f=voters>=3?categories(t):0;total+=f;recognized+=f>0?1:0;maxed+=f===1.5?1:0;}
  }
  turnout.push({attendees,voters,meanKudosForm:total/(runs*attendees),recognizedPercent:100*recognized/(runs*attendees),maxKudosPercent:100*maxed/(runs*attendees)});
}
const values=[0,1,2,3,4,8].map(boost=>({boost,ovr:60+boost,discard:live.calculateLiveDiscardValue(60+boost)}));
const out={source:'src/game/rating-engine.ts',seed:20260906,rows,isolated,oldHatTrickWeeklyDecay:oldDecay,turnout,values,steady:{oldThreeGoalsWeekly:8,newMaxGoalsEverySession:3.75,newMaxKudosEverySession:3.75,newBothEverySession:7.5,newBothAlternateSessionsAfterAppearance:4.5,newBothAlternateSessionsBetweenAppearances:3},coins:{attendance:250,completion:50,total:300,packPrice:175,packsPerReportingSession:300/175,increaseFromOriginalPercent:(300/175-1)*100}};
fs.mkdirSync(path.join(root,'docs/design/features'),{recursive:true});
fs.writeFileSync(path.join(root,'docs/design/features/rating-balance.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
