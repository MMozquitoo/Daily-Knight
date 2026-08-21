// Debe ejecutarse ANTES de que se importe 'expo/AppEntry' — react-native
// evalúa su propio bootstrap (InitializeCore) como efecto secundario de
// esa importación, y es justo ahí donde falta el global DOMException.
import './src/polyfills';
import 'expo/AppEntry';
