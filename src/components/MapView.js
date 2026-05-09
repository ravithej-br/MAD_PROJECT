// src/components/MapView.js
import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';

let MapView, Marker, Polyline, PROVIDER_DEFAULT;

if (Platform.OS !== 'web') {
    // Native: Use react-native-maps
    const Maps = require('react-native-maps');
    MapView = Maps.default;
    Marker = Maps.Marker;
    Polyline = Maps.Polyline;
    PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
} else {
    // Web Fallback: react-native-maps is not supported on web directly.
    // We show a placeholder to prevent crashing.
    MapView = ({ children, style, region }) => (
        <View style={[style, styles.webMap]}>
            <Text style={styles.webMapText}>🗺️ Map View (Native Only)</Text>
            <Text style={styles.webMapSub}>Web support requires Google Maps JS API integration.</Text>
            {children}
        </View>
    );
    Marker = () => null;
    Polyline = () => null;
    PROVIDER_DEFAULT = 'default';
}

const styles = StyleSheet.create({
    webMap: {
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
    },
    webMapText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 4,
    },
    webMapSub: {
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center',
        paddingHorizontal: 20,
    }
});

export default MapView;
export { Marker, Polyline, PROVIDER_DEFAULT };
