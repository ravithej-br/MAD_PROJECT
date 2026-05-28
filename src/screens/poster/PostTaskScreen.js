// src/screens/poster/PostTaskScreen.js
/**
 * Screen to post a new task.
 * Refactored: Added inline validation, useUserLocation hook, and showAlert utility.
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../../components/MapView';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserLocation } from '../../utils/location';
import { showAlert } from '../../utils/alert';

// Geocode address using Nominatim (free, no API key needed)
const geocodeAddress = async (address) => {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Bangalore, India")}&format=json&limit=5`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data && data.length > 0) {
            return data.map(result => ({
                name: result.display_name.split(',')[0], // Extract just the main name
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                display_name: result.display_name,
            }));
        }
        return [];
    } catch (error) {
        console.log('Geocoding error:', error);
        return [];
    }
};

const promiseTimeout = async (promise, ms, timeoutMessage) => {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutHandle);
    }
};

const reverseGeocodeLocation = async (latitude, longitude) => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`;
        const response = await promiseTimeout(
            fetch(url, {
                headers: { 'Accept-Language': 'en', 'User-Agent': 'TaskHub/1.0' },
            }),
            8000,
            'Reverse geocoding request timed out'
        );
        const data = await response.json();
        if (!data || !data.address) return null;

        const address = data.address;
        return address.neighbourhood || address.suburb || address.city_district || address.city || address.town || address.village || data.display_name || null;
    } catch (error) {
        console.log('Reverse geocoding error:', error);
        return null;
    }
};

// Popular Bangalore areas with coordinates
const BANGALORE_LOCATIONS = [
    { name: 'Basavangudi', lat: 12.9352, lng: 77.5808 },
    { name: 'Bommasandra', lat: 12.7391, lng: 77.5733 },
    { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
    { name: 'Indiranagar', lat: 12.9716, lng: 77.6412 },
    { name: 'Whitefield', lat: 12.9698, lng: 77.7499 },
    { name: 'Jayanagar', lat: 12.9352, lng: 77.5946 },
    { name: 'Bannerghatta', lat: 12.8599, lng: 77.6245 },
    { name: 'Marathahalli', lat: 12.9695, lng: 77.7076 },
    { name: 'Sarjapur', lat: 12.7639, lng: 77.6704 },
    { name: 'Electronic City', lat: 12.8389, lng: 77.6660 },
    { name: 'Silk Board', lat: 12.9451, lng: 77.6245 },
    { name: 'HSR Layout', lat: 12.9352, lng: 77.6245 },
    { name: 'Vivek Nagar', lat: 12.9352, lng: 77.5946 },
    { name: 'Yeshwantpur', lat: 13.0368, lng: 77.5737 },
    { name: 'Rajajinagar', lat: 13.0012, lng: 77.5735 },
    { name: 'Malleswaram', lat: 13.0012, lng: 77.5900 },
    { name: 'Frazer Town', lat: 13.0012, lng: 77.6012 },
    { name: 'Shivajinagar', lat: 13.0012, lng: 77.5946 },
    { name: 'Vijayanagar', lat: 13.0100, lng: 77.5500 },
    { name: 'Cantonment', lat: 12.9716, lng: 77.5946 },
    { name: 'JP Nagar', lat: 12.8844, lng: 77.5989 },
    { name: 'Magadi Road', lat: 12.8844, lng: 77.5500 },
    { name: 'Banasavakya', lat: 12.8500, lng: 77.5500 },
    { name: 'Kengeri', lat: 12.8844, lng: 77.4500 },
    { name: 'Andrahalli', lat: 12.8844, lng: 77.5989 },
];

const BANGALORE_BOUNDS = {
    minLat: 12.75,
    maxLat: 13.20,
    minLng: 77.40,
    maxLng: 77.80,
};

const isWithinBangalore = (lat, lng) => {
    return lat >= BANGALORE_BOUNDS.minLat && lat <= BANGALORE_BOUNDS.maxLat &&
           lng >= BANGALORE_BOUNDS.minLng && lng <= BANGALORE_BOUNDS.maxLng;
};

const CATEGORIES = [
    { icon: '🛋️', label: 'Assembly' },
    { icon: '🐕', label: 'Dog Walk' },
    { icon: '📦', label: 'Delivery' },
    { icon: '🧹', label: 'Cleaning' },
    { icon: '🛒', label: 'Shopping' },
    { icon: '🔧', label: 'Repairs' },
    { icon: '📸', label: 'Photography' },
    { icon: '💻', label: 'Tech Help' },
];

const DEFAULT_LOCATION = { latitude: 12.9716, longitude: 77.5946 };

export default function PostTaskScreen({ navigation }) {
    const { user } = useAuthStore();
    const { location: userLoc, locationLoading } = useUserLocation();
    const insets = useSafeAreaInsets();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState(null);
    const [taskLocation, setTaskLocation] = useState(null);
    const [locationName, setLocationName] = useState('');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [locationError, setLocationError] = useState('');

    // Validation Errors
    const [errors, setErrors] = useState({});

    // Initialize taskLocation when userLoc is fetched
    React.useEffect(() => {
        if (userLoc && !taskLocation) setTaskLocation(userLoc);
    }, [userLoc]);

    const validateStep1 = () => {
        let newErrors = {};

        // Title validation: 5-60 chars, no special chars only
        const titleTrimmed = title.trim();
        if (titleTrimmed.length < 5 || titleTrimmed.length > 60) {
            newErrors.title = 'Title must be between 5 and 60 characters.';
        } else if (/^[^a-zA-Z0-9]+$/.test(titleTrimmed)) {
            newErrors.title = 'Title cannot contain only special characters.';
        }

        // Description validation: 20-500 chars
        const descTrimmed = description.trim();
        if (!descTrimmed) {
            newErrors.description = 'Please enter a description.';
        }

        // Price validation: positive number, max 99,999
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            newErrors.price = 'Please enter a valid positive price.';
        } else if (priceNum > 99999) {
            newErrors.price = 'Maximum price is ₹99,999.';
        }

        if (!category) {
            newErrors.category = 'Please select a category.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateStep1()) {
            setStep(2);
        }
    };

    const handleLocationTap = async (coordinate) => {
        const { latitude, longitude } = coordinate;
        if (!isWithinBangalore(latitude, longitude)) {
            setLocationError('Location must be within Bangalore metro area');
            return;
        }
        setLocationError('');
        setTaskLocation(coordinate);
        setLocationName('Fetching address...');

        const address = await reverseGeocodeLocation(latitude, longitude);
        if (address) {
            setLocationName(address);
        } else {
            setLocationName('Bangalore location');
        }
    };


    const handlePost = async () => {
        if (!taskLocation) {
            showAlert('No Location', 'Please set a location on the map.');
            return;
        }
        if (!user?.uid) {
            showAlert('Sign in required', 'Please log in before posting tasks.');
            return;
        }

        setLoading(true);
        try {
            let imageURL = null;
            
            const taskPayload = {
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price),
                category,
                location: taskLocation,
                locationName: locationName || 'Bangalore location',
                status: 'open',
                posterId: user.uid,
                runnerId: null,
                createdAt: serverTimestamp(),
            };

            console.log('Posting task with data:', taskPayload);
            await promiseTimeout(
                addDoc(collection(db, 'tasks'), taskPayload),
                15000,
                'Task posting timed out. Please check your network connection and try again.'
            );

            showAlert('🎉 Task Posted!', 'Your task is live. Runners near you will see it.', [
                { text: 'OK', onPress: () => {
                    setTitle('');
                    setDescription('');
                    setPrice('');
                    setCategory(null);
                    setTaskLocation(null);
                    setLocationName('');
                    setTaskImage(null);
                    setStep(1);
                    navigation.goBack();
                }},
            ]);
        } catch (err) {
            console.error('Post error:', err);
            showAlert('Error Posting Task', err.message || 'Failed to post task. Check internet connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 30}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep(1)}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Post a Task</Text>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step {step}/2</Text>
          </View>
        </View>

        <View style={styles.stepBar}>
          <View style={[styles.stepLine, { flex: 1, backgroundColor: COLORS.primary }]} />
          <View style={[styles.stepLine, { flex: 1, backgroundColor: step === 2 ? COLORS.primary : COLORS.border }]} />
        </View>

        {step === 1 && (
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Title *</Text>
                <TextInput
                    style={[styles.input, errors.title && styles.inputError]}
                    placeholder="e.g. Assemble IKEA shelf"
                    placeholderTextColor={COLORS.textMuted}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                />
                {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

                <Text style={styles.label}>Description *</Text>
                <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }, errors.description && styles.inputError]}
                    placeholder="Describe what you need..."
                    placeholderTextColor={COLORS.textMuted}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                />
                {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

                <Text style={styles.label}>Category *</Text>
                <View style={styles.categoryGrid}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.label}
                      style={[styles.catBtn, category === cat.label && styles.catBtnActive, errors.category && { borderColor: '#FECACA' }]}
                      onPress={() => setCategory(cat.label)}
                    >
                      <Text style={styles.catEmoji}>{cat.icon}</Text>
                      <Text style={[styles.catLabel, category === cat.label && { color: COLORS.primary, fontWeight: '700' }]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

                <Text style={styles.label}>Your Budget (₹) *</Text>
                <TextInput
                    style={[styles.input, errors.price && styles.inputError]}
                    placeholder="e.g. 500"
                    placeholderTextColor={COLORS.textMuted}
                    keyboardType="numeric"
                    value={price}
                    onChangeText={setPrice}
                />
                {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}

                <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                    <Text style={styles.nextBtnText}>Next: Set Location →</Text>
                </TouchableOpacity>
            </ScrollView>
        )}

        {step === 2 && (
          <View style={styles.flex}>
            <View style={styles.mapHintBar}>
              <Text style={styles.label}>📍 Set Task Location</Text>
              <Text style={styles.instructionText}>👆 Tap anywhere on map to mark location</Text>
            </View>

            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              region={
                taskLocation
                  ? { ...taskLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                  : { ...DEFAULT_LOCATION, latitudeDelta: 0.05, longitudeDelta: 0.05 }
              }
              onPress={(e) => handleLocationTap(e.nativeEvent.coordinate)}
              showsUserLocation={true}
              visible={step === 2}
            >
              {taskLocation && <Marker coordinate={taskLocation} title="📍 Task Location" pinColor="#10B981" />}
            </MapView>

            <View style={styles.locationInfoBox}>
              {taskLocation ? (
                <>
                  <Text style={styles.locationInfoLabel}>Selected location</Text>
                  <Text style={styles.locationInfoText}>
                    {locationName || `${taskLocation.latitude.toFixed(5)}, ${taskLocation.longitude.toFixed(5)}`}
                  </Text>
                  {locationName ? (
                    <Text style={styles.locationCoordinateText}>
                      {taskLocation.latitude.toFixed(5)}, {taskLocation.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.locationInfoPlaceholder}>Tap anywhere on the map to mark the task location.</Text>
              )}
            </View>

            {locationError && <View style={styles.errorBox}><Text style={styles.errorBarText}>{locationError}</Text></View>}
            {taskLocation && <View style={styles.successBox}><Text style={styles.successText}>✅ Location set! Ready to post.</Text></View>}

            <View style={[styles.mapControls, { paddingBottom: Math.max(insets.bottom, 16) }] }>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postBtn, (loading || !taskLocation) && { opacity: 0.7 }]}
                onPress={handlePost}
                disabled={loading || !taskLocation}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>🚀 Post Task</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 16,
        backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    back: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    stepBadge: { backgroundColor: COLORS.primary + '20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    stepText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
    stepBar: { flexDirection: 'row', height: 4, gap: 2, backgroundColor: COLORS.card },
    stepLine: { height: 4 },
    content: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 8 },
    input: {
        backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
        fontSize: 15, color: COLORS.text, marginBottom: 12,
        borderWidth: 1, borderColor: COLORS.border,
    },
    inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
    errorText: { color: '#EF4444', fontSize: 12, marginBottom: 12, marginLeft: 4, fontWeight: '500' },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
    catBtn: {
        width: '22%', alignItems: 'center', padding: 12, borderRadius: 12,
        backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border,
    },
    catBtnActive: { borderColor: COLORS.primary, backgroundColor: '#F0F4FF' },
    catEmoji: { fontSize: 24, marginBottom: 4 },
    catLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
    nextBtn: {
        backgroundColor: COLORS.primary, borderRadius: 14,
        padding: 16, alignItems: 'center', marginTop: 12, marginBottom: 32,
    },
    nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    mapHintBar: {
        backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    instructionText: {
        fontSize: 13, color: COLORS.textMuted, marginTop: 8, fontStyle: 'italic',
    },
    instructionBar: {
        backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    locatingRow: { flexDirection: 'row', alignItems: 'center' },
    mapHint: { fontSize: 13, color: COLORS.textMuted },
    errorBar: { fontSize: 12, color: '#EF4444', marginTop: 8, fontWeight: '500' },
    map: { flex: 1 },
    locationInfoBox: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    locationInfoLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    locationInfoText: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    locationCoordinateText: {
        marginTop: 4,
        fontSize: 12,
        color: COLORS.textMuted,
    },
    locationInfoPlaceholder: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    mapControls: {
        flexDirection: 'row', padding: 16, gap: 12,
        backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    backBtn: {
        flex: 1, borderRadius: 12, padding: 16, alignItems: 'center',
        backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    },
    backBtnText: { fontWeight: '600', color: COLORS.text },
    postBtn: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    imageUploadBtn: {
        backgroundColor: COLORS.card, borderRadius: 12, padding: 16,
        borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed',
        alignItems: 'center', marginBottom: 12,
    },
   
    errorBarText: { 
        color: '#EF4444', 
        fontWeight: '600', 
        fontSize: 13 
    },
    successBox: { 
        backgroundColor: '#DCFCE7', 
        padding: 12, 
        borderRadius: 8, 
        marginHorizontal: 16, 
        marginTop: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#10B981',
    },
    successText: { 
        color: '#10B981', 
        fontWeight: '600', 
        fontSize: 13 
    },
    hidden: { display: 'none' },
});
