const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const frontend=path.resolve(__dirname,'../../../frontend');
const babel=require(require.resolve('@babel/core',{paths:[frontend]}));
const plugin=require.resolve('@babel/plugin-transform-modules-commonjs',{paths:[frontend]});
const code=babel.transformSync(fs.readFileSync(path.join(frontend,'src/services/billingHistory.js'),'utf8'),{plugins:[plugin],configFile:false,babelrc:false}).code;
const context={exports:{}};vm.runInNewContext(code,context);
const run=context.exports.packageTrainingRows;
const ev=(id,hour,status='active',cid='a',paid=false)=>({id,event_date:'2026-09-10',event_hour:hour,status,client_id:cid,is_settled:paid});
const p={id:'p',client_id:'a',start_training_id:'s',end_training_id:'e',shared_client_ids:[]};
const results=[];
function test(name,fn){fn();results.push({name,status:'PASS'});}
test('same_day_hour_boundaries_exclude_neighbors',()=>{
 const r=run(p,true,[ev('before',8),ev('s',10),ev('e',12),ev('after',15)],[],()=>true);
 assert.equal(r.done,2);assert.equal(r.rows.length,2);
});
test('deleted_and_cancelled_paid_free_and_whole_day_marker_are_not_double_counted',()=>{
 const r=run(p,true,[ev('s',10,'deleted'),ev('paid',11,'cancelled','a',true),ev('e',12)],
   [{id:'abs',client_id:'a',absence_date:'2026-09-10',absence_hour:10},{client_id:'a',absence_date:'2026-09-10',absence_hour:null}],()=>false);
 assert.equal(r.cFree,1);assert.equal(r.cSettled,1);assert.equal(r.done,0);assert.equal(r.rows.length,3);
});
test('historical_package_does_not_include_future_shared_members',()=>{
 const r=run(p,true,[ev('s',10),ev('outsider',11,'active','b'),ev('e',12)],[],()=>true);
 assert.equal(r.done,2);
});
test('missing_history_anchor_is_incomplete_not_all_time_history',()=>{
 const r=run(p,true,[ev('unknown',10)],[],()=>true);
 assert.equal(r.incomplete,true);assert.equal(r.rows.length,0);
});
test('history_uses_warsaw_timezone_at_exact_slot_end',()=>{
 assert.equal(context.exports.slotHasEnded('2026-09-10',11,new Date('2026-09-10T09:59:59Z')),false);
 assert.equal(context.exports.slotHasEnded('2026-09-10',11,new Date('2026-09-10T10:00:00Z')),true);
 assert.equal(context.exports.slotHasEnded('2026-12-10',11,new Date('2026-12-10T11:00:00Z')),true);
});
console.log(JSON.stringify({scope:'actual frontend billing history function; synthetic data',tests:results}));
