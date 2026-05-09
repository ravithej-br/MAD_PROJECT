// src/navigation/tabOptions.js
/**
 * Shared Tab Navigation configuration.
 * Consolidates look and feel for both Poster and Runner tabs.
 */
import React from 'react';
import { Text } from 'react-native';
import { COLORS } from '../utils/theme';

export const getTabBarOptions = (insets) => ({
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
});

export const TabIcon = (emoji) => ({ color }) => (
    <Text style={{ fontSize: 22, color }}>{emoji}</Text>
);
