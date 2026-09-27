// Serialize writes and keep the newest complete draft while a request is pending.
// A failed request stops automatic writes: its commit outcome may be unknown.
export function createWorkoutSaveQueue(write, onChange = () => {}) {
  let latest = null, saved = null, running = null, failed = false, stopped = false;
  const snapshot = payload => payload == null ? null : { key: JSON.stringify(payload), payload: JSON.parse(JSON.stringify(payload)) };
  const pending = () => !!latest && latest.key !== saved;
  const status = () => running ? 'saving' : failed && pending() ? 'error' : pending() ? 'pending' : 'saved';
  const notify = () => { if (!stopped) onChange(status()); };
  return {
    pending, busy: () => !!running, status,
    reset(payload, alreadySaved = true) {
      if (running) throw new Error('Poczekaj na zakończenie zapisu.');
      latest = snapshot(payload); saved = alreadySaved ? latest?.key ?? null : null; failed = false; notify();
    },
    stage(payload) { if (!stopped) { latest = snapshot(payload); notify(); } },
    flush(manual = false) {
      if (running) return running;
      if (stopped || (failed && !manual)) return Promise.resolve(false);
      if (!pending()) return Promise.resolve(true);
      failed = false;
      running = Promise.resolve().then(async () => {
        while (!stopped && pending()) {
          const task = latest;
          if (await write(task.payload) === false) return false;
          saved = task.key;
        }
        return !stopped;
      }).catch(error => {
        // The server may have committed before the response failed. Even a draft
        // reverted to the old baseline now needs explicit confirmation.
        saved = null; failed = true; throw error;
      }).finally(() => { running = null; notify(); });
      notify();
      return running;
    },
    activate() { stopped = false; },
    dispose() { stopped = true; latest = null; },
  };
}
