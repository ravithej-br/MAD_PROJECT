// src/navigation/RunnerTabs.js
/**
 * Bottom Tabs for the Runner role.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarOptions, TabIcon } from './tabOptions';

import RunnerHomeScreen from '../screens/runner/RunnerHomeScreen';
import RunnerMyJobsScreen from '../screens/runner/RunnerMyJobsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function RunnerTabs() {
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator screenOptions={getTabBarOptions(insets)}>
            <Tab.Screen
                name="Home"
                component={RunnerHomeScreen}
                options={{ tabBarLabel: 'Browse Tasks', tabBarIcon: TabIcon('🗺️') }}
            />
            <Tab.Screen
                name="MyJobs"
                component={RunnerMyJobsScreen}
                options={{ tabBarLabel: 'My Jobs', tabBarIcon: TabIcon('💼') }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile', tabBarIcon: TabIcon('👤') }}
            />
        </Tab.Navigator>
    );
}
