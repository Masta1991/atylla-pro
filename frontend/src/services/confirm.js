import { Alert, Platform } from 'react-native';

// T11: wspólne potwierdzenia i komunikaty działające na web i mobile.
// react-native-web ma pustą implementację Alert.alert (callbacki nie wykonują
// się na PWA), więc każda ścieżka z wyborem MUSI iść przez ten helper.
// Bez przebudowy układu — tylko logika wywołań.

export function showMessage(title, message) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function showError(message) {
  showMessage('Błąd', message);
}

export function confirmAction(title, message, okLabel, onOk, cancelLabel = 'Anuluj') {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
    let full = `${title}\n\n${message}`;
    if (window.confirm(full) && onOk) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}
