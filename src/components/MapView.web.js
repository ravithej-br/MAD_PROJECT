// src/components/MapView.web.js
import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
    MapContainer, TileLayer,
    Marker as LeafletMarker, Polyline as LeafletPolyline,
    Popup as LeafletPopup, useMapEvents, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet icon not appearing in bundled environments by using dynamic SVG data URIs
const getSvgIconUrl = (color) => {
    const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}"/>
        </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
};

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: getSvgIconUrl('#4F46E5'),
    iconRetinaUrl: getSvgIconUrl('#4F46E5'),
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
    shadowUrl: null,
    shadowSize: null,
});

// Inner component: handles map clicks and syncs region changes safely
function MapController({ onPress, region, visible }) {
    const map = useMap();

    // Invalidate size whenever the map becomes visible (fixes blank/broken map on conditional display)
    React.useEffect(() => {
        if (!visible) return;
        map.whenReady(() => {
            try {
                map.invalidateSize();
            } catch (e) {
                // ignore
            }
        });
    }, [visible, map]);

    // Sync map center when region prop changes
    React.useEffect(() => {
        if (!region) return;
        try {
            const currentCenter = map.getCenter();
            const lat = region.latitude;
            const lng = region.longitude;
            // Only pan if there's a meaningful difference (avoids jitter)
            if (
                Math.abs(currentCenter.lat - lat) > 0.0001 ||
                Math.abs(currentCenter.lng - lng) > 0.0001
            ) {
                map.setView([lat, lng], map.getZoom(), { animate: true, duration: 0.5 });
            }
        } catch (e) {
            // Map container may have been removed; ignore
        }
    }, [region?.latitude, region?.longitude]);

    useMapEvents({
        click(e) {
            if (onPress) {
                try {
                    onPress({
                        nativeEvent: {
                            coordinate: {
                                latitude: e.latlng.lat,
                                longitude: e.latlng.lng,
                            }
                        }
                    });
                } catch (e) {
                    // ignore
                }
            }
        },
    });

    return null;
}

const MapView = ({ children, style, region, onPress, showsUserLocation, visible = true }) => {
    const center = region
        ? [region.latitude, region.longitude]
        : [12.9716, 77.5946];

    const zoom = region?.latitudeDelta
        ? Math.round(Math.log2(360 / region.latitudeDelta)) - 1
        : 14;

    return (
        <View style={[style, styles.container]}>
            <MapContainer
                center={center}
                zoom={Math.max(10, Math.min(zoom, 18))}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
                // Stable key prevents re-creation; we rely on invalidateSize for reflow instead
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    maxZoom={19}
                    keepBuffer={4}
                />
                <MapController onPress={onPress} region={region} visible={visible} />
                {children}
            </MapContainer>
        </View>
    );
};

// Wrapper for Marker to match react-native-maps API
export const Marker = ({ coordinate, title, description, pinColor, onCalloutPress }) => {
    if (!coordinate) return null;

    const icon = pinColor ? L.icon({
        iconUrl: getSvgIconUrl(pinColor),
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
    }) : undefined;

    return (
        <LeafletMarker position={[coordinate.latitude, coordinate.longitude]} icon={icon}>
            {(title || description) && (
                <LeafletPopup>
                    <div style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', padding: '2px', minWidth: '150px' }}>
                        {title && <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#1E293B' }}>{title}</div>}
                        {description && <div style={{ fontSize: '12px', color: '#64748B', marginBottom: onCalloutPress ? '8px' : '0' }}>{description}</div>}
                        {onCalloutPress && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onCalloutPress) onCalloutPress();
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    backgroundColor: '#4F46E5',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    textAlign: 'center',
                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                }}
                            >
                                View Details
                            </button>
                        )}
                    </div>
                </LeafletPopup>
            )}
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
