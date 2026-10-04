const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'), frontend=path.join(root,'frontend');
const babel=require(require.resolve('@babel/core',{paths:[frontend]}));
const plugin=require.resolve('@babel/plugin-transform-modules-commonjs',{paths:[frontend]});
const facts=require(path.join(frontend,'src/data/dailyFacts.json'));
const code=babel.transformSync(fs.readFileSync(path.join(frontend,'src/services/dailyFacts.js'),'utf8'),{plugins:[plugin],configFile:false,babelrc:false}).code;
const context={exports:{},require:name=>{assert.equal(name,'../data/dailyFacts.json');return facts;}};
vm.runInNewContext(code,context);
const {getDailyFact,warsawDateKey,millisecondsUntilNextFactDay}=context.exports;
const tests=[];
function test(name,fn){fn();tests.push({name,status:'PASS'});}
test('all_313_source_dates_and_exact_unicode_text',()=>{
 for(const row of facts)assert.equal(getDailyFact(new Date(row.date+'T12:00:00Z')).text,row.text);
});
test('before_start_and_sundays_are_empty',()=>{
 for(const day of ['2026-10-03','2026-09-27','2026-10-11','2027-10-10','2030-01-06'])assert.equal(getDailyFact(new Date(day+'T12:00:00Z')),null);
});
test('one_day_preview_is_limited_to_4_October_2026_in_Warsaw',()=>{
 assert.equal(getDailyFact(new Date('2026-10-03T21:59:59.999Z')),null);
 assert.equal(getDailyFact(new Date('2026-10-03T22:00:00Z')),facts[1]);
 assert.equal(getDailyFact(new Date('2026-10-04T21:59:59.999Z')),facts[1]);
 assert.equal(getDailyFact(new Date('2026-10-04T22:00:00Z')),facts[0]);
 assert.equal(getDailyFact(new Date('2026-10-06T12:00:00Z')),facts[1]);
});
test('saturday_monday_and_repeat_start',()=>{
 assert.equal(getDailyFact(new Date('2026-10-10T12:00Z')),facts[5]);
 assert.equal(getDailyFact(new Date('2026-10-12T12:00Z')),facts[6]);
 assert.equal(getDailyFact(new Date('2027-10-04T12:00Z')),facts.at(-1));
 assert.equal(getDailyFact(new Date('2027-10-05T12:00Z')),facts[0]);
 assert.equal(getDailyFact(new Date('2027-10-11T12:00Z')),facts[5]);
});
test('eight_years_match_independent_day_by_day_cycle_including_leap_days',()=>{
 let index=0;
 for(let day=new Date('2026-10-05T12:00:00Z');day<new Date('2034-10-05T12:00:00Z');day.setUTCDate(day.getUTCDate()+1)){
  if(day.getUTCDay()===0)assert.equal(getDailyFact(day),null);
  else {assert.equal(getDailyFact(day).text,facts[index%313].text,day.toISOString());index++;}
 }
});
test('Warsaw_midnight_in_summer_and_winter',()=>{
 assert.equal(warsawDateKey(new Date('2026-10-04T21:59:59Z')),'2026-10-04');
 assert.equal(getDailyFact(new Date('2026-10-04T22:00:00Z')),facts[0]);
 assert.equal(warsawDateKey(new Date('2026-12-10T22:59:59Z')),'2026-12-10');
 assert.equal(warsawDateKey(new Date('2026-12-10T23:00:00Z')),'2026-12-11');
});
test('next_day_timer_handles_23_24_and_25_hour_days',()=>{
 for(const [iso,hours] of [['2027-03-27T23:00:00Z',23],['2026-10-24T22:00:00Z',25],['2026-10-05T22:00:00Z',24]])
  assert.equal(millisecondsUntilNextFactDay(new Date(iso)),hours*3600000);
 assert.equal(millisecondsUntilNextFactDay(new Date('2026-10-04T21:59:59.900Z')),100);
});
console.log(JSON.stringify({scope:'actual daily facts selector; local bundled data; eight calendar years',tests}));
