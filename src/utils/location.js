// src/utils/location.js
/**
 * useUserLocation custom hook.
 * Returns the user's real GPS location (or null if unavailable/denied).
 * ✅ Fix 3: No hardcoded city — components must handle null location gracefully.
 */
import { useState } from 'react';
import React from 'react';
import * as Location from 'expo-location';

export function useUserLocation() {
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);

    React.useEffect(() => {
        let isCancelled = false;

        const fetchLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    // Permission denied — leave location as null (no city hardcoding)
                    if (!isCancelled) setLocationLoading(false);
                    return;
                }

                // Race current position against a timeout to prevent infinite hanging
                const loc = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 8000)
                    ),
                ]);

                if (!isCancelled) {
                    setLocation({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                    });
                }
            } catch (err) {
                // Timeout or error — set null so UI shows country-level map or prompts user
                if (!isCancelled) setLocation(null);
            } finally {
                if (!isCancelled) setLocationLoading(false);
            }
        };

        fetchLocation();
        return () => { isCancelled = true; };
    }, []);

    return { location, locationLoading };
}
