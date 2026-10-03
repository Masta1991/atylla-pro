// In-memory PostgreSQL/PGlite, synthetic users only; no production configuration.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { PGlite } = require(path.join(root, '.tmp/billing-qa/node_modules/@electric-sql/pglite'));
const db = new PGlite(), tests = [];
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002';
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const test = async (name, fn) => { await fn(); tests.push({ name, status: 'PASS' }); };
const as = async (uid, role = 'authenticated') => {
  await db.exec('RESET ROLE; SET ROLE ' + role);
  await q("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
};
const migration = () => db.exec(fs.readFileSync(path.join(root, 'database/migrations/013_trainer_monthly_history.sql'), 'utf8'));
const save = async (year, month, count, expected = null) => (await q('SELECT public.save_trainer_month_v1($1,$2,$3,$4) result', [year, month, count, expected]))[0].result;
const remove = async (year, month, expected) => (await q('SELECT public.delete_trainer_month_v1($1,$2,$3) result', [year, month, expected]))[0].result;
const rows = () => q('SELECT to_jsonb(h) row FROM public.trainer_monthly_history h ORDER BY trainer_id,year,month');
const rejectsCode = (promise, code) => assert.rejects(promise, e => e.code === code);

(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,anon;
    INSERT INTO auth.users VALUES ('${A}'),('${B}');`);
  await migration();
  let original, updated;
  await as(A);
  await test('explicit_zero_is_persisted_with_owner_and_version', async () => {
    original = await save(2020, 1, 0);
    assert.equal(original.trainer_id, A); assert.equal(original.training_count, 0);
    assert(original.updated_at); assert.deepEqual((await rows())[0].row, original);
  });
  await test('repeatable_migration_preserves_existing_history', async () => {
    await db.exec('RESET ROLE'); await migration(); await migration(); await as(A);
    assert.deepEqual((await rows())[0].row, original);
  });
  await test('create_conflict_and_stale_update_leave_value_unchanged', async () => {
    await assert.rejects(save(2020, 1, 7), e => e.code === 'P0001' && /Dane zmieniły się/.test(e.message));
    updated = await save(2020, 1, 14, original.updated_at);
    assert.equal(updated.training_count, 14); assert.notEqual(updated.updated_at, original.updated_at);
    await assert.rejects(save(2020, 1, 88, original.updated_at), /Dane zmieniły się/);
    assert.deepEqual((await rows())[0].row, updated);
  });
  await test('zero_update_and_version_checked_delete', async () => {
    const zero = await save(2020, 1, 0, updated.updated_at);
    await assert.rejects(remove(2020, 1, updated.updated_at), /Dane zmieniły się/);
    await assert.rejects(remove(2020, 1, null), /Dane zmieniły się/);
    assert.deepEqual((await rows())[0].row, zero);
    assert.deepEqual(await remove(2020, 1, zero.updated_at), { deleted: true });
    assert.equal((await rows()).length, 0);
    await assert.rejects(remove(2020, 1, zero.updated_at), /Dane zmieniły się/);
  });
  await test('same_month_isolated_between_trainers_and_foreign_version_rejected', async () => {
    const own = await save(2020, 2, 10);
    await as(B); assert.equal((await rows()).length, 0);
    await assert.rejects(save(2020, 2, 99, own.updated_at), /Dane zmieniły się/);
    await assert.rejects(remove(2020, 2, own.updated_at), /Dane zmieniły się/);
    const other = await save(2020, 2, 20);
    assert.equal(other.trainer_id, B); assert.deepEqual((await rows()).map(r => r.row), [other]);
    await as(A); assert.deepEqual((await rows()).map(r => r.row), [own]);
  });
  await test('authenticated_direct_table_writes_are_denied', async () => {
    const before = await rows();
    await rejectsCode(q('INSERT INTO trainer_monthly_history(trainer_id,year,month,training_count) VALUES($1,2020,3,30)', [A]), '42501');
    await rejectsCode(q('UPDATE trainer_monthly_history SET training_count=999'), '42501');
    await rejectsCode(q('DELETE FROM trainer_monthly_history'), '42501');
    assert.deepEqual(await rows(), before);
  });
  await test('anonymous_cannot_read_or_execute_mutations', async () => {
    await as(A, 'anon');
    await rejectsCode(rows(), '42501'); await rejectsCode(save(2020, 3, 3), '42501');
    await rejectsCode(remove(2020, 2, original.updated_at), '42501'); await as(A);
  });
  await test('missing_actor_and_nonexistent_user_are_rejected', async () => {
    await as(''); await rejectsCode(save(2020, 3, 3), '42501');
    await rejectsCode(remove(2020, 2, original.updated_at), '42501');
    await as('00000000-0000-4000-8000-000000000099');
    await rejectsCode(save(2020, 3, 3), '23503'); await as(A);
  });
  await test('invalid_values_and_current_future_months_cannot_mutate_history', async () => {
    const before = await rows();
    for (const values of [[1999,1,1],[2101,1,1],[2020,0,1],[2020,13,1],[2020,3,-1],[2020,3,10001],[null,3,1],[2020,null,1],[2020,3,null]]) {
      await assert.rejects(save(...values), /Nieprawidłowe dane/);
    }
    const periods = await q("SELECT extract(year FROM p)::int AS year_number,extract(month FROM p)::int AS month_number FROM (SELECT date_trunc('month',now() AT TIME ZONE 'Europe/Warsaw') p UNION ALL SELECT date_trunc('month',now() AT TIME ZONE 'Europe/Warsaw') + interval '1 month') x");
    for (const p of periods) {
      await assert.rejects(save(p.year_number,p.month_number,1), /zakończony miesiąc/);
      await assert.rejects(remove(p.year_number,p.month_number,original.updated_at), /zakończony miesiąc/);
    }
    assert.deepEqual(await rows(), before);
  });
  await test('conflict_rolls_back_the_entire_transaction', async () => {
    const before = await rows();
    await db.exec('BEGIN');
    try {
      await save(2020, 4, 40);
      await assert.rejects(save(2020, 2, 999), /Dane zmieniły się/);
    } finally { await db.exec('ROLLBACK'); }
    assert.deepEqual(await rows(), before);
  });
  await test('user_foreign_key_cascades_only_its_own_history', async () => {
    await db.exec('RESET ROLE');
    await q('DELETE FROM auth.users WHERE id=$1', [B]);
    const remaining = await rows(); assert.equal(remaining.length, 1); assert.equal(remaining[0].row.trainer_id, A);
    await as(A); assert.equal((await rows()).length, 1);
  });
  console.log(JSON.stringify({ engine: 'PGlite SQL', tests }));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.close());
