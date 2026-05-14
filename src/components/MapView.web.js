// src/components/MapView.web.js
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker as LeafletMarker, Polyline as LeafletPolyline, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon not appearing in bundled environments
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Component to handle map clicks and sync region
function MapController({ onPress, region }) {
    const map = useMap();
    
    useEffect(() => {
        if (region) {
            map.setView([region.latitude, region.longitude], map.getZoom());
        }
    }, [region?.latitude, region?.longitude]);

    useMapEvents({
        click(e) {
            if (onPress) {
                onPress({
                    nativeEvent: {
                        coordinate: {
                            latitude: e.latlng.lat,
                            longitude: e.latlng.lng,
                        }
                    }
                });
            }
        },
    });
    return null;
}

const MapView = ({ children, style, region, onPress, showsUserLocation }) => {
    const center = region ? [region.latitude, region.longitude] : [12.9716, 77.5946];

    return (
        <View style={[style, styles.container]}>
            <MapContainer 
                center={center} 
                zoom={14} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                />
                <MapController onPress={onPress} region={region} />
                {children}
            </MapContainer>
        </View>
    );
};

// Wrapper for Marker to match react-native-maps API
export const Marker = ({ coordinate, title, pinColor }) => {
    if (!coordinate) return null;
    return (
        <LeafletMarker position={[coordinate.latitude, coordinate.longitude]}>
            {/* Tooltip could be added here if needed */}
        </LeafletMarker>
    );
};

// Wrapper for Polyline to match react-native-maps API
export const Polyline = ({ coordinates, strokeColor, strokeWidth }) => {
    if (!coordinates || coordinates.length < 2) return null;
    const positions = coordinates.map(c => [c.latitude, c.longitude]);
    return <LeafletPolyline positions={positions} color={strokeColor} weight={strokeWidth} />;
};

export const PROVIDER_DEFAULT = 'default';

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    }
});

export default MapView;
