import assert from 'node:assert/strict';
import {occursOn,isOverdue,stats,late,Task} from '../src/planner';
import {merge} from '../src/store';

// --- planner rules (from the original test-suite) ---
const task:any={date:'2026-10-22',endDate:'2026-10-26',completionMode:'once',status:'todo'};
assert.equal(occursOn(task,'2026-10-24'),true);
assert.equal(occursOn(task,'2026-10-27'),false);
assert.equal(isOverdue(task,'2026-10-24'),false);
assert.equal(isOverdue(task,'2026-10-27'),true);
assert.equal(isOverdue(task,'2026-10-31'),false);
assert.equal(isOverdue({...task,completionMode:'daily'},'2026-10-23'),true);
assert.equal(isOverdue({...task,completionMode:'daily'},'2026-10-24'),false);
assert.equal(stats([task],'2026-10-22').percent,0);
assert.equal(late({...task,status:'done',completedAt:'2026-10-24T12:00:00Z'}),false);
assert.equal(late({...task,status:'done',completedAt:'2026-10-27T12:00:00Z'}),true);

// --- sync merge ---
const now=new Date().toISOString(),later=new Date(Date.now()+1000).toISOString();
const mk=(id:string,o:Partial<Task>={}):Task=>({id,groupId:id,title:id,note:'',date:'2026-10-29',status:'todo',completedAt:null,reminder:'',createdAt:now,updatedAt:now,version:1,completionMode:'daily',endDate:null,...o});
// laptop and phone each added a task -> both kept
let m=merge({tasks:[mk('a')],deleted:{}},{tasks:[mk('b')],deleted:{}});
assert.deepEqual(m.tasks.map(t=>t.id).sort(),['a','b']);
// newer status change wins, from either side
m=merge({tasks:[mk('a',{status:'done',updatedAt:later,version:2})],deleted:{}},{tasks:[mk('a')],deleted:{}});
assert.equal(m.tasks[0].status,'done');
m=merge({tasks:[mk('a')],deleted:{}},{tasks:[mk('a',{status:'doing',updatedAt:later,version:2})],deleted:{}});
assert.equal(m.tasks[0].status,'doing');
// delete on one device removes it everywhere
m=merge({tasks:[mk('a'),mk('b')],deleted:{}},{tasks:[mk('b')],deleted:{a:later}});
assert.deepEqual(m.tasks.map(t=>t.id),['b']);
assert.ok(m.deleted.a);
// merge is order-independent
const A={tasks:[mk('x',{status:'done',updatedAt:later})],deleted:{y:later}},B={tasks:[mk('x'),mk('y')],deleted:{}};
assert.deepEqual(merge(A,B),merge(B,A));
console.log('PASS: planner rules + sync merge (add, update, delete, symmetry)');
