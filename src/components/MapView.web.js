// src/components/MapView.web.js - MapLibre GL (Open-source, Lifetime FREE)
import React from 'react';
import { View, StyleSheet } from 'react-native';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ✅ Fix 1: Reliable OSM raster tile style (no API key, no domain restrictions)
const MAP_STYLE = {
    version: 8,
    sources: {
        'osm': {
            type: 'raster',
            tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
            maxzoom: 19,
        },
    },
    layers: [
        {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
        },
    ],
};

// ✅ Fix 3: No hardcoded default — center is driven by region prop (GPS) or a neutral world view
const FALLBACK_CENTER = [78.9629, 20.5937]; // Center of India — only used if no GPS at all
const FALLBACK_ZOOM = 4;

const MapLibreComponent = ({
    children,
    style,
    region,
    onPress,
    showsUserLocation,
    visible = true,
    searchQuery,  // ✅ Fix 2: new prop for location search
}) => {
    const mapContainer = React.useRef(null);
    const map = React.useRef(null);
    const markers = React.useRef(new Map());
    const userMarker = React.useRef(null);
    const initialRegionSet = React.useRef(false);

    // ─── Initialize map ───────────────────────────────────────────────────────
    React.useEffect(() => {
        if (!visible || !mapContainer.current) return;
        if (map.current) return; // init only once

        try {
            const center = region
                ? [region.longitude, region.latitude]
                : FALLBACK_CENTER;
            const zoom = region?.latitudeDelta
                ? Math.round(Math.log2(360 / region.latitudeDelta)) - 1
                : (region ? 14 : FALLBACK_ZOOM);

            map.current = new maplibregl.Map({
                container: mapContainer.current,
                style: MAP_STYLE,
                center,
                zoom,
            });

            // Click handler
            map.current.on('click', (e) => {
                if (onPress) {
                    onPress({
                        nativeEvent: {
                            coordinate: {
                                latitude: e.lngLat.lat,
                                longitude: e.lngLat.lng,
                            },
                        },
                    });
                }
            });

            // Navigation controls (zoom +/-)
            map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
        } catch (e) {
            console.warn('Map initialization error:', e);
        }

        return () => {
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

    // ─── Fly to region when it changes ────────────────────────────────────────
    React.useEffect(() => {
        if (!map.current || !region) return;
        try {
            const zoom = Math.max(
                10,
                Math.min(Math.round(Math.log2(360 / region.latitudeDelta)) - 1, 18)
            );
            map.current.flyTo({
                center: [region.longitude, region.latitude],
                zoom,
                duration: 800,
            });
        } catch (e) {
            console.warn('Map pan error:', e);
        }
    }, [region?.latitude, region?.longitude]);

    // ─── Fix 2: Geocode searchQuery → fly to location ─────────────────────────
    React.useEffect(() => {
        if (!searchQuery || !searchQuery.trim()) return;

        const geocode = async () => {
            try {
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery.trim())}&format=json&limit=1`;
                const res = await fetch(url, {
                    headers: { 'Accept-Language': 'en', 'User-Agent': 'TaskHub/1.0' },
                });
                const data = await res.json();
                if (data && data.length > 0 && map.current) {
                    const { lon, lat } = data[0];
                    map.current.flyTo({
                        center: [parseFloat(lon), parseFloat(lat)],
                        zoom: 14,
                        duration: 1000,
                    });
                }
            } catch (e) {
                console.warn('Geocoding error:', e);
            }
        };

        // Wait for map to be ready
        if (map.current) {
            if (map.current.loaded()) {
                geocode();
            } else {
                map.current.once('load', geocode);
            }
        }
    }, [searchQuery]);

    // ─── Show user location dot ───────────────────────────────────────────────
    React.useEffect(() => {
        if (!showsUserLocation) return;

        const addUserDot = () => {
            if (!map.current || !navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (!map.current) return;
                    if (userMarker.current) userMarker.current.remove();

                    const el = document.createElement('div');
                    el.style.cssText = [
                        'width:16px', 'height:16px', 'border-radius:50%',
                        'background:#4F46E5', 'border:3px solid white',
                        'box-shadow:0 0 0 5px rgba(79,70,229,0.25)',
                    ].join(';');

                    userMarker.current = new maplibregl.Marker({ element: el })
                        .setLngLat([pos.coords.longitude, pos.coords.latitude])
                        .addTo(map.current);
                },
                () => {},
                { timeout: 8000 }
            );
        };

        if (map.current) {
            map.current.loaded() ? addUserDot() : map.current.once('load', addUserDot);
        }
    }, [showsUserLocation]);

    // ─── Render markers from children ─────────────────────────────────────────
    React.useEffect(() => {
        if (!map.current) return;

        // Clear old markers
        markers.current.forEach(m => { try { m.remove(); } catch (_) {} });
        markers.current.clear();

        if (!React.Children.count(children)) return;

        const addMarkers = () => {
            React.Children.forEach(children, (child) => {
                if (!child || !child.props) return;
                const { coordinate, title, description, pinColor } = child.props;
                if (!coordinate) return;

                try {
                    const color = pinColor || '#4F46E5';
                    const el = document.createElement('div');
                    el.style.cssText = [
                        'width:32px', 'height:40px',
                        `background-color:${color}`,
                        'border-radius:50% 50% 50% 0',
                        'border:2px solid white',
                        'display:flex', 'align-items:center', 'justify-content:center',
                        'cursor:pointer', 'transform:rotate(-45deg)',
                        'box-shadow:0 3px 6px rgba(0,0,0,0.3)',
                        'transition:transform 0.15s ease',
                    ].join(';');
                    el.innerHTML = '<div style="transform:rotate(45deg);font-size:14px;color:white">📍</div>';

                    el.addEventListener('mouseenter', () => {
                        el.style.transform = 'rotate(-45deg) scale(1.2)';
                    });
                    el.addEventListener('mouseleave', () => {
                        el.style.transform = 'rotate(-45deg) scale(1)';
                    });

                    const popup = new maplibregl.Popup({
                        offset: 28,
                        closeButton: false,
                        closeOnClick: false,
                    }).setHTML(
                        `<div style="font-family:sans-serif;padding:2px 4px">` +
                        `<strong style="font-size:13px">${title || ''}</strong>` +
                        (description ? `<br/><span style="font-size:12px;color:#666">${description}</span>` : '') +
                        `</div>`
                    );

                    const marker = new maplibregl.Marker({ element: el })
                        .setLngLat([coordinate.longitude, coordinate.latitude])
                        .setPopup(popup)
                        .addTo(map.current);

                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        marker.togglePopup();
                    });

                    markers.current.set(`${coordinate.latitude}-${coordinate.longitude}`, marker);
                } catch (e) {
                    console.warn('Marker error:', e);
                }
            });
        };

        map.current.loaded() ? addMarkers() : map.current.once('load', addMarkers);
    }, [children]);

    return (
        <View style={[style, styles.container]}>
            <div
                ref={mapContainer}
                style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}
            />
        </View>
    );
};

// ─── Sub-component stubs (props handled by parent) ────────────────────────────
export const Marker = ({ coordinate, title, description, pinColor, onCalloutPress }) => null;
export const Polyline = ({ coordinates, strokeColor, strokeWidth }) => null;
export const PROVIDER_DEFAULT = 'maplibre';

export default MapLibreComponent;

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#E2E8F0',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
});
