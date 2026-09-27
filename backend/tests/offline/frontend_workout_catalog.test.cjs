const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../../frontend/src/services/workoutCatalog.js'),'utf8');
 const {workoutCatalog,workoutShareText,planSetText,supersetLabels}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const catalog=workoutCatalog([{id:'same',name:'A'}],[{id:'same',name:'Plecy'}],{Plecy:[{id:'row',name:'Wiosłowanie',unit:'KG'}]});
 assert.equal(new Set(catalog.map(e=>e.key)).size,2);
 const group=catalog.find(e=>e.type==='group');assert.equal(group.exercises[0].exercise_id,'row');
 const plan={name:'Cardio',exercises:[{exercise_id:'run',exercises:{name:'Bieg',unit:'KM'},sets_data:[{reps:'1',weight:'2.5'}]}]};
 const text=workoutShareText([group,plan]);assert(text.includes('*Plecy*'));assert(text.includes('Wiosłowanie'));assert(text.includes('1 × 2.5 km'));assert(text.indexOf('*Plecy*')<text.indexOf('*Cardio*'));
 assert.equal(planSetText({reps:0,weight:0},'KG'),'0 × 0 kg');assert.equal(planSetText({reps:'',weight:'30'},'SEK'),'— × 30 sek');
 const linked=[{exercise_id:'a',superset_id:'first'},{exercise_id:'b',superset_id:null},{exercise_id:'c',superset_id:'second'},{exercise_id:'d',superset_id:'first'},{exercise_id:'e',superset_id:'second'},{exercise_id:'f',superset_id:'orphan'}];
 assert.deepEqual(supersetLabels(linked),['Superseria 1','','Superseria 2','Superseria 1','Superseria 2','']);
 const linkedText=workoutShareText([{name:'Superserie',exercises:linked}]);
 assert(linkedText.includes('1. a [Superseria 1]')); assert(linkedText.includes('4. d [Superseria 1]')); assert(!linkedText.includes('6. f [Superseria'));
 assert.equal((linkedText.match(/Superseria 2/g)||[]).length,2);
 console.log(JSON.stringify({status:'PASS',checks:['namespaced_catalog','group_exercises','mixed_share_order_and_units','zero_and_missing_values','nonadjacent_superset_membership_and_singletons','superset_labels_in_shared_text'],network:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
