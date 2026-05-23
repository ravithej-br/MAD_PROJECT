// src/components/MapView.web.js - Google Maps for web (Vercel)
import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GoogleMap, LoadScript, Marker as GoogleMarker, InfoWindow, Polyline as GooglePolyline } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const mapContainerStyle = {
    width: '100%',
    height: '100%',
};

const defaultCenter = {
    lat: 12.9716,
    lng: 77.5946,
};

const mapOptions = {
    zoom: 14,
    gestureHandling: 'greedy',
    zoomControl: true,
};

const GoogleMapComponent = ({ children, style, region, onPress, showsUserLocation, visible = true }) => {
    const [map, setMap] = React.useState(null);
    const mapRef = React.useRef(null);

    const center = region
        ? { lat: region.latitude, lng: region.longitude }
        : defaultCenter;

    const zoom = region?.latitudeDelta
        ? Math.round(Math.log2(360 / region.latitudeDelta)) - 1
        : 14;

    const handleMapClick = (event) => {
        if (onPress) {
            onPress({
                nativeEvent: {
                    coordinate: {
                        latitude: event.latLng.lat(),
                        longitude: event.latLng.lng(),
                    }
                }
            });
        }
    };

    const handleMapLoad = (map) => {
        setMap(map);
        mapRef.current = map;
    };

    React.useEffect(() => {
        if (map && region) {
            map.panTo({
                lat: region.latitude,
                lng: region.longitude,
            });
            map.setZoom(Math.max(10, Math.min(zoom, 18)));
        }
    }, [region?.latitude, region?.longitude, map, zoom]);

    if (!GOOGLE_MAPS_API_KEY) {
        return (
            <View style={[style, styles.container]}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>
                        Google Maps API key not configured. Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[style, styles.container]}>
            <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    center={center}
                    zoom={Math.max(10, Math.min(zoom, 18))}
                    options={mapOptions}
                    onClick={handleMapClick}
                    onLoad={handleMapLoad}
                >
                    {children}
                </GoogleMap>
            </LoadScript>
        </View>
    );
};

// Marker wrapper to match react-native-maps API
export const Marker = ({ coordinate, title, description, pinColor, onCalloutPress }) => {
    if (!coordinate) return null;

    const [infoOpen, setInfoOpen] = React.useState(false);
    const markerColor = pinColor ? pinColor.replace('#', '') : '4F46E5';

    return (
        <GoogleMarker
            position={{ lat: coordinate.latitude, lng: coordinate.longitude }}
            title={title}
            onClick={() => setInfoOpen(true)}
            icon={{
                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                fillColor: `#${markerColor}`,
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 1.5,
            }}
        >
            {infoOpen && (
                <InfoWindow onCloseClick={() => setInfoOpen(false)}>
                    <div style={{ padding: '8px', minWidth: '150px', fontFamily: 'system-ui' }}>
                        {title && <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1E293B' }}>{title}</div>}
                        {description && <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>{description}</div>}
                        {onCalloutPress && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCalloutPress();
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px 10px',
                                    backgroundColor: '#4F46E5',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                }}
                            >
                                View Details
                            </button>
                        )}
                    </div>
                </InfoWindow>
            )}
        </GoogleMarker>
    );
};

// Polyline wrapper to match react-native-maps API
export const Polyline = ({ coordinates, strokeColor, strokeWidth }) => {
    if (!coordinates || coordinates.length < 2) return null;
    const positions = coordinates.map(c => ({
        lat: c.latitude,
        lng: c.longitude,
    }));
    return (
        <GooglePolyline
            path={positions}
            options={{
                strokeColor: strokeColor || '#4F46E5',
                strokeWeight: strokeWidth || 3,
                geodesic: true,
            }}
        />
    );
};

export const PROVIDER_DEFAULT = 'google';

export default GoogleMapComponent;

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FEF2F2',
    },
    errorText: {
        color: '#EF4444',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
});
