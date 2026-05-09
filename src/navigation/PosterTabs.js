// src/navigation/PosterTabs.js
/**
 * Bottom Tabs for the Poster role.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTabBarOptions, TabIcon } from './tabOptions';

import PosterHomeScreen from '../screens/poster/PosterHomeScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function PosterTabs() {
    const insets = useSafeAreaInsets();
    return (
        <Tab.Navigator screenOptions={getTabBarOptions(insets)}>
            <Tab.Screen
                name="Home"
                component={PosterHomeScreen}
                options={{ tabBarLabel: 'My Tasks', tabBarIcon: TabIcon('📋') }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile', tabBarIcon: TabIcon('👤') }}
            />
        </Tab.Navigator>
    );
}
