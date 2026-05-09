// src/utils/distance.js
/**
 * Shared logic for distance and ETA calculations.
 */

/**
 * Calculates Haversine distance between two coordinates.
 * Returns formatted string (e.g. "500m" or "2.5km").
 */
export function getDistance(loc1, loc2, raw = false) {
    if (!loc1 || !loc2) return null;
    const R = 6371; // Earth's radius in km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(loc1.latitude * Math.PI / 180) *
        Math.cos(loc2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    if (raw) return dist;
    return dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
}


/**
 * Calculates estimated time of arrival based on distance.
 */
export function calculateETA(distanceInKm) {
    if (!distanceInKm) return 'Calculating...';
    // Assume 30km/h average urban speed
    const timeInHours = distanceInKm / 30;
    const timeInMinutes = Math.round(timeInHours * 60);
    if (timeInMinutes < 1) return 'Arriving now';
    return `${timeInMinutes} min`;
}
