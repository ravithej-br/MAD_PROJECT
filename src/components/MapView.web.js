// Web stub for react-native-maps
// Metro automatically picks this file over MapView.js when bundling for web
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PROVIDER_DEFAULT = null;
export const PROVIDER_GOOGLE = null;

export function Marker({ title, description }) {
    return null;
}

export default function MapView({ style, children }) {
    return (
        <View style={[styles.placeholder, style]}>
            <Text style={styles.icon}>🗺️</Text>
            <Text style={styles.title}>Map View</Text>
            <Text style={styles.sub}>Map is available on the mobile app</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    placeholder: {
        flex: 1,
        backgroundColor: '#e8f0f7',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cdd8e3',
        borderStyle: 'dashed',
    },
    icon: { fontSize: 48, marginBottom: 12 },
    title: { fontSize: 18, fontWeight: '700', color: '#4a5568', marginBottom: 6 },
    sub: { fontSize: 13, color: '#718096', textAlign: 'center', paddingHorizontal: 24 },
});
