// src/components/MapView.web.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const MapView = ({ children, style, region }) => {
    const mapUrl = region ? `https://www.google.com/maps/search/?api=1&query=${region.latitude},${region.longitude}` : '#';
    return (
        <View style={[style, styles.webMap]}>
            <View style={styles.webMapOverlay}>
                <Text style={styles.webMapEmoji}>📍</Text>
                <Text style={styles.webMapText}>Interactive Map (Native Only)</Text>
                <Text style={styles.webMapSub}>To maintain performance, the interactive map is enabled in the mobile app.</Text>
                <TouchableOpacity 
                    style={styles.webMapBtn} 
                    onPress={() => window.open(mapUrl, '_blank')}
                >
                    <Text style={styles.webMapBtnText}>View Location on Google Maps ↗</Text>
                </TouchableOpacity>
            </View>
            {children}
        </View>
    );
};

const Marker = () => null;
const Polyline = () => null;
const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
    webMap: {
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    webMapOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    webMapEmoji: { fontSize: 32, marginBottom: 12 },
    webMapText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 8,
        textAlign: 'center'
    },
    webMapSub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
        maxWidth: 240,
    },
    webMapBtn: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    webMapBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    }
});

export default MapView;
export { Marker, Polyline, PROVIDER_DEFAULT };
