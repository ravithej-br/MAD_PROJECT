// src/config/firebase.js
// 🔥 TASK HUB — Firebase Configuration (taskhub-7048b)
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
    apiKey: "AIzaSyBWaCwJjyongwy4nu1tYj3pWD6q9N8CJ9s",
    authDomain: "taskhub-7048b.firebaseapp.com",
    projectId: "taskhub-7048b",
    storageBucket: "taskhub-7048b.firebasestorage.app",
    messagingSenderId: "659023753010",
    appId: "1:659023753010:web:6271ee175820447450b12b",
    measurementId: "G-Z79XD92TVW",
};

const app = initializeApp(firebaseConfig);

// ✅ React Native needs initializeAuth with AsyncStorage persistence
// Using getAuth() causes silent failures in React Native
export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
export default app;
