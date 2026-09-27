const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
(async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/services/workoutSaveQueue.js'), 'utf8');
  const { createWorkoutSaveQueue } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const tests = [], test = async (name, fn) => { await fn(); tests.push({ name, status: 'PASS' }); };
  await test('edit_during_slow_write_is_saved_next_with_latest_revision', async () => {
    const first = deferred(), calls = []; let revision = 0;
    const q = createWorkoutSaveQueue(async payload => { calls.push({ note: payload.note, revision }); if (calls.length === 1) await first.promise; revision++; });
    q.reset({ note: 'initial' }); q.stage({ note: 'A' }); const saving = q.flush(); await Promise.resolve();
    q.stage({ note: 'B' }); q.stage({ note: 'C' }); assert(q.busy()); assert(q.pending());
    assert.equal(q.flush(true), saving); first.resolve(); await saving;
    assert.deepEqual(calls, [{ note: 'A', revision: 0 }, { note: 'C', revision: 1 }]); assert(!q.pending());
  });
  await test('failed_write_stops_automatic_retries_even_after_more_edits', async () => {
    const first = deferred(); let calls = 0;
    const q = createWorkoutSaveQueue(async () => { calls++; if (calls === 1) await first.promise; });
    q.reset({ note: 'initial' }); q.stage({ note: 'A' }); const saving = q.flush(); await Promise.resolve();
    q.stage({ note: 'B' }); first.reject(new Error('Outcome unknown')); await assert.rejects(saving, /unknown/);
    q.stage({ note: 'C' }); assert.equal(await q.flush(), false); assert.equal(calls, 1); assert.equal(q.status(), 'error');
    await q.flush(true); assert.equal(calls, 2); assert(!q.pending());
  });
  await test('reverting_to_baseline_while_write_runs_is_not_lost', async () => {
    const gate = deferred(), calls = [];
    const q = createWorkoutSaveQueue(async p => { calls.push(p.note); if (calls.length === 1) await gate.promise; });
    q.reset({ note: 'initial' }); q.stage({ note: 'A' }); const saving = q.flush(); await Promise.resolve();
    q.stage({ note: 'initial' }); assert(q.busy()); gate.resolve(); await saving;
    assert.deepEqual(calls, ['A', 'initial']);
  });
  await test('baseline_is_not_written_but_immediate_first_edit_is', async () => {
    const calls = [], q = createWorkoutSaveQueue(async p => calls.push(p.note));
    q.reset({ note: 'initial' }); await q.flush(); assert.equal(calls.length, 0);
    q.stage({ note: 'quick edit' }); await q.flush(); assert.deepEqual(calls, ['quick edit']);
  });
  await test('new_session_remains_pending_until_confirmed_and_cancel_keeps_draft', async () => {
    const q = createWorkoutSaveQueue(async () => false);
    q.reset({ note: 'new' }, false); assert(q.pending()); assert.equal(await q.flush(true), false); assert(q.pending());
  });
  await test('snapshot_cannot_be_changed_by_mutating_form_objects', async () => {
    let saved; const q = createWorkoutSaveQueue(async p => { saved = p; });
    const form = { exercises: [{ reps: 5 }] }; q.stage(form); form.exercises[0].reps = 99; await q.flush();
    assert.equal(saved.exercises[0].reps, 5);
  });
  await test('uncertain_commit_cannot_mark_a_reverted_draft_as_saved', async () => {
    const gate = deferred(); let calls = 0;
    const q = createWorkoutSaveQueue(async () => { calls++; if (calls === 1) await gate.promise; });
    q.reset({ note: 'A' }); q.stage({ note: 'B' }); const saving = q.flush(); await Promise.resolve();
    q.stage({ note: 'A' }); gate.reject(new Error('Response lost after possible commit'));
    await assert.rejects(saving, /Response lost/); assert(q.pending()); assert.equal(q.status(), 'error');
    assert.equal(await q.flush(), false); assert.equal(calls, 1);
    await q.flush(true); assert.equal(calls, 2); assert(!q.pending());
  });
  await test('session_reset_is_rejected_until_inflight_request_finishes', async () => {
    const gate = deferred(), q = createWorkoutSaveQueue(async () => gate.promise);
    q.stage({ note: 'A' }); const saving = q.flush(); assert.throws(() => q.reset({ note: 'other' }), /Poczekaj/);
    gate.resolve(); await saving; q.reset({ note: 'other' }); assert(!q.pending());
  });
  await test('unmount_does_not_start_another_queued_write', async () => {
    const gate = deferred(); let calls = 0;
    const q = createWorkoutSaveQueue(async () => { calls++; await gate.promise; });
    q.stage({ note: 'A' }); const saving = q.flush(); await Promise.resolve(); q.stage({ note: 'B' }); q.dispose(); gate.resolve(); await saving;
    assert.equal(calls, 1);
  });
  console.log(JSON.stringify({ scope: 'actual workout queue; synthetic writes, no network', tests }));
})().catch(e => { console.error(e); process.exitCode = 1; });
