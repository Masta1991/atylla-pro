const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../../frontend/src/services/workoutNotes.js'),'utf8');
 const {workoutNoteText,calendarNotes,applyNoteRead}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const tests=[];const test=(name,fn)=>{fn();tests.push({name,status:'PASS'});};
 test('billing_metadata_is_not_a_user_note',()=>{assert.equal(workoutNoteText(' [BILLING:KONIEC_PAKIETU]\n '),'');assert.equal(workoutNoteText('[BILLING:X]\nPamiętaj'),'Pamiętaj');});
 const old={id:'old',note:'Pamiętaj',event_date:'2026-09-18',event_hour:9}, own={id:'new',note:'Dzisiaj',pending_notes:[old]};
 test('unread_prior_note_is_shown_before_current_note',()=>{assert.deepEqual(calendarNotes(own).map(n=>n.id),['old','new']);});
 test('read_hides_own_and_previous_reminders_but_preserves_source_text',()=>{const read={note_acknowledged_at:'2026-09-26'};assert.equal(applyNoteRead(own,old,read).pending_notes.length,0);const original=applyNoteRead(old,old,read);assert.equal(original.note,old.note);assert.equal(calendarNotes(original).length,0);assert.equal(original.note_acknowledged_at,read.note_acknowledged_at);});
 test('late_ack_does_not_hide_newer_text',()=>{const changed={...old,note:'Nowa treść'};assert.equal(applyNoteRead({...own,pending_notes:[changed]},old,{}).pending_notes.length,1);assert.equal(applyNoteRead(changed,old,{}).note_acknowledged_at,undefined);});
 test('empty_and_duplicate_self_reminders_are_ignored',()=>{assert.deepEqual(calendarNotes(null),[]);assert.equal(calendarNotes({...own,pending_notes:[own,{id:'empty',note:' '}]}).length,1);});
 console.log(JSON.stringify({tests,scope:'actual note helpers; no network'}));
})().catch(e=>{console.error(e);process.exitCode=1;});
