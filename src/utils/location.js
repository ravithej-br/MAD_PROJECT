// src/utils/location.js
/**
 * useUserLocation custom hook.
 * Extracts location logic with race-condition handling and timeouts.
 */
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

const DEFAULT_LOCATION = { latitude: 12.9716, longitude: 77.5946 }; // Bengaluru Fallback

export function useUserLocation() {
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);

    useEffect(() => {
        let isCancelled = false;

        const fetchLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (!isCancelled) {
                        setLocation(DEFAULT_LOCATION);
                        setLocationLoading(false);
                    }
                    return;
                }

                // Race current position against a timeout to prevent infinite hanging
                const loc = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
                ]);

                if (!isCancelled) {
                    setLocation({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    });
                }
            } catch (err) {
                // Fallback to default on timeout or error
                if (!isCancelled) setLocation(DEFAULT_LOCATION);
            } finally {
                if (!isCancelled) setLocationLoading(false);
            }
        };

        fetchLocation();
        return () => { isCancelled = true; };
    }, []);

    return { location, locationLoading };
}
