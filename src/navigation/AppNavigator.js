// src/navigation/AppNavigator.js
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Text, ActivityIndicator, View, Platform } from 'react-native';

import { auth, db } from '../config/firebase';
import useAuthStore from '../store/useAuthStore';
import { COLORS } from '../utils/theme';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

// Poster Screens
import PosterHomeScreen from '../screens/poster/PosterHomeScreen';
import PostTaskScreen from '../screens/poster/PostTaskScreen';

// Runner Screens
import RunnerHomeScreen from '../screens/runner/RunnerHomeScreen';
import RunnerMyJobsScreen from '../screens/runner/RunnerMyJobsScreen';

// Shared Screens
import TaskDetailScreen from '../screens/shared/TaskDetailScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- Poster Bottom Tabs ---
function PosterTabs() {
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.card,
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                    paddingBottom: Math.max(insets.bottom, 10),
                    height: 60 + Math.max(insets.bottom, 10),
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen
                name="Home"
                component={PosterHomeScreen}
                options={{ tabBarLabel: 'My Tasks', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📋</Text> }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text> }}
            />
        </Tab.Navigator>
    );
}

// --- Runner Bottom Tabs ---
function RunnerTabs() {
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: COLORS.card,
                    borderTopColor: COLORS.border,
                    borderTopWidth: 1,
                    paddingBottom: Math.max(insets.bottom, 10),
                    height: 60 + Math.max(insets.bottom, 10),
                },
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen
                name="Home"
                component={RunnerHomeScreen}
                options={{ tabBarLabel: 'Browse Tasks', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🗺️</Text> }}
            />
            <Tab.Screen
                name="MyJobs"
                component={RunnerMyJobsScreen}
                options={{ tabBarLabel: 'My Jobs', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>💼</Text> }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile', tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text> }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator() {
    const { user, role, isLoading, setUser, setRole, setLoading } = useAuthStore();

    useEffect(() => {
        // Safety timeout — if Firebase takes too long, stop loading anyway
        const timeout = setTimeout(() => setLoading(false), 5000);

        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            try {
                if (firebaseUser) {
                    const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
                    if (snap.exists()) setRole(snap.data().role);
                    setUser(firebaseUser);
                } else {
                    setUser(null);
                }
            } catch (err) {
                console.log('Auth error:', err.message);
                setUser(null);
            } finally {
                clearTimeout(timeout);
                setLoading(false);
            }
        });
        return () => { unsub(); clearTimeout(timeout); };
    }, []);

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
