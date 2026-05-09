// src/utils/alert.js
/**
 * Cross-platform alert utility.
 * Automatically branches between window.alert (Web) and Alert.alert (Native).
 */
import { Alert, Platform } from 'react-native';

export const showAlert = (title, message, buttons = []) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
        // Simple callback support for web
        if (buttons.length > 0) {
            const primaryBtn = buttons.find(b => b.style !== 'cancel') || buttons[0];
            if (primaryBtn && primaryBtn.onPress) primaryBtn.onPress();
        }
    } else {
        Alert.alert(title, message, buttons);
    }
};
