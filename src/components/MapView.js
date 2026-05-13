// src/components/MapView.js (Native version)
import React from 'react';
import Maps, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';

const MapView = (props) => {
    return <Maps {...props} />;
};

export default MapView;
export { Marker, Polyline, PROVIDER_DEFAULT };
