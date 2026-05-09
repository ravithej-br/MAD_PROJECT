// src/navigation/AppNavigator.js
/**
 * Main App Navigator.
 * Refactored: Extracted tabs into separate files, added auth safety, and simplified structure.
 */
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { View } from 'react-native';

import { auth, db } from '../config/firebase';
import useAuthStore from '../store/useAuthStore';
import { COLORS } from '../utils/theme';
import { showAlert } from '../utils/alert';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Role-based Navigators
import PosterTabs from './PosterTabs';
import RunnerTabs from './RunnerTabs';

// Shared Main Screens
import PostTaskScreen from '../screens/poster/PostTaskScreen';
import TaskDetailScreen from '../screens/shared/TaskDetailScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const { user, role, isLoading, setUser, setRole, setLoading } = useAuthStore();

    useEffect(() => {
        // Auth Listener
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (snap.exists()) {
                        setRole(snap.data().role);
                        setUser(firebaseUser);
                    } else {
                        // Handle case where auth exists but doc doesn't (rare)
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }
            } catch (err) {
                showAlert('Auth Error', err.message);
                setUser(null);
            } finally {
                setLoading(false);
            }
        });
        
        return () => unsub();
    }, [setUser, setRole, setLoading]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
                <SplashScreen />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    // Auth Stack
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Signup" component={SignupScreen} />
                    </>
                ) : (
                    // Main App Stack
                    <>
                        <Stack.Screen
                            name="Main"
                            component={role === 'poster' ? PosterTabs : RunnerTabs}
                        />
                        <Stack.Screen name="PostTask" component={PostTaskScreen} />
                        <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

