// src/components/MapView.web.js - MapLibre GL (Open-source, Lifetime FREE)
import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const defaultCenter = [77.5946, 12.9716]; // [lng, lat]

const MapLibreComponent = ({ children, style, region, onPress, showsUserLocation, visible = true }) => {
    const mapContainer = React.useRef(null);
    const map = React.useRef(null);
    const markers = React.useRef(new Map());

    // Initialize map
    React.useEffect(() => {
        if (!visible || !mapContainer.current) return;

        // Only initialize once
        if (map.current) return;

        try {
            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: 'https://demotiles.maplibre.org/style.json', // Free OpenStreetMap style
                center: region ? [region.longitude, region.latitude] : defaultCenter,
                zoom: region?.latitudeDelta
                    ? Math.round(Math.log2(360 / region.latitudeDelta)) - 1
                    : 14,
            });

            // Add click handler
            map.current.on('click', (e) => {
                if (onPress) {
                    onPress({
                        nativeEvent: {
                            coordinate: {
                                latitude: e.lngLat.lat,
                                longitude: e.lngLat.lng,
                            }
                        }
                    });
                }
            });

            // Add navigation controls
            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
        } catch (e) {
            console.warn('Map initialization error:', e);
        }

        return () => {
            // Cleanup on unmount
            if (map.current) {
                try {
                    map.current.remove();
                    map.current = null;
                } catch (e) {
                    console.warn('Map cleanup error:', e);
                }
            }
        };
    }, [visible]);

    // Update region
    React.useEffect(() => {
        if (!map.current || !region) return;
        try {
            map.current.flyTo({
                center: [region.longitude, region.latitude],
                zoom: Math.max(10, Math.min(
                    Math.round(Math.log2(360 / region.latitudeDelta)) - 1,
                    18
                )),
            });
        } catch (e) {
            console.warn('Map pan error:', e);
        }
    }, [region?.latitude, region?.longitude]);

    // Handle children (markers)
    React.useEffect(() => {
        if (!React.Children.count(children) || !map.current) return;

        // Clear previous markers
        markers.current.forEach(marker => {
            try {
                marker.remove();
            } catch (e) {
                // ignore
            }
        });
        markers.current.clear();

        // Add new markers
        React.Children.forEach(children, (child) => {
            if (child && child.props) {
                const { coordinate, title, pinColor } = child.props;
                if (!coordinate) return;

                try {
                    const el = document.createElement('div');
                    const color = pinColor || '#4F46E5';

                    el.style.width = '32px';
                    el.style.height = '40px';
                    el.style.backgroundColor = color;
                    el.style.borderRadius = '50% 50% 50% 0';
                    el.style.border = '2px solid white';
                    el.style.display = 'flex';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';
                    el.style.cursor = 'pointer';
                    el.style.transform = 'rotate(-45deg)';
                    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    el.innerHTML = '<div style="transform: rotate(45deg); font-size: 16px; color: white;">📍</div>';

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([coordinate.longitude, coordinate.latitude])
                        .addTo(map.current);

                    markers.current.set(`${coordinate.latitude}-${coordinate.longitude}`, marker);
                } catch (e) {
                    console.warn('Marker error:', e);
                }
            }
        });
    }, [children]);

    return (
        <View style={[style, styles.container]}>
            <div
                ref={mapContainer}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 16,
                    overflow: 'hidden',
                }}
            />
        </View>
    );
};

// Marker wrapper to match react-native-maps API
export const Marker = ({ coordinate, title, description, pinColor, onCalloutPress }) => {
    return null; // Handled in parent MapLibreComponent
};

// Polyline wrapper to match react-native-maps API
export const Polyline = ({ coordinates, strokeColor, strokeWidth }) => {
    return null; // Simplified - markers show endpoints
};

export const PROVIDER_DEFAULT = 'maplibre';

export default MapLibreComponent;

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
});
