// Shared, themed dialogs on web and native. No browser/system alert fallback.
let queue = [];
const listeners = new Set();
const emit = () => listeners.forEach(fn => fn());
export const subscribeDialogs = fn => { listeners.add(fn); return () => listeners.delete(fn); };
export const getDialog = () => queue[0] || null;

export function openDialog(title, message, buttons, options = {}) {
  return new Promise(resolve => {
    queue = [...queue, { title, message: String(message ?? ''), buttons, options, resolve }];
    emit();
  });
}
export function closeDialog(button) {
  const active = queue[0];
  if (!active) return;
  queue = queue.slice(1);
  emit();
  active.resolve(button?.value ?? false);
  Promise.resolve().then(() => button?.onPress?.()).catch(error => showError(error.message));
}
export const AppAlert = {
  alert(title, message, buttons = [{text:'OK', value:true}], options) {
    return openDialog(title, message, buttons, options);
  }
};
export function showMessage(title, message) {
  return AppAlert.alert(title, message);
}
export function showError(message) {
  return showMessage('Nie udało się wykonać operacji', message);
}
export function askConfirmation(title, message, okLabel = 'OK', cancelLabel = 'Anuluj') {
  return openDialog(title, message, [
    {text:cancelLabel, style:'cancel', value:false},
    {text:okLabel, value:true},
  ]);
}
export function confirmAction(title, message, okLabel, onOk, cancelLabel = 'Anuluj') {
  return openDialog(title, message, [
    {text:cancelLabel, style:'cancel', value:false},
    {text:okLabel, value:true, onPress:onOk},
  ]);
}
