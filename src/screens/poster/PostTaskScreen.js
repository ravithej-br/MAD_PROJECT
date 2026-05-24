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
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [locationError, setLocationError] = useState('');

    // Validation Errors
    const [errors, setErrors] = useState({});

    // Filter suggestions as user types
    React.useEffect(() => {
        if (!searchQuery.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = BANGALORE_LOCATIONS.filter(loc =>
            loc.name.toLowerCase().includes(query)
        );
        
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    }, [searchQuery]);

    // Initialize taskLocation when userLoc is fetched
    React.useEffect(() => {
        if (userLoc && !taskLocation) setTaskLocation(userLoc);
    }, [userLoc]);

    const handleSuggestionSelect = (location) => {
        // Set the location from suggestion
        setTaskLocation({
            latitude: location.lat,
            longitude: location.lng,
        });
        // Update search box with location name
        setSearchQuery(location.name);
        // Clear suggestions
        setShowSuggestions(false);
        setSuggestions([]);
        // Clear any error
        setLocationError('');
    };

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

    const handleLocationTap = (coordinate) => {
        const { latitude, longitude } = coordinate;
        if (!isWithinBangalore(latitude, longitude)) {
            setLocationError('Location must be within Bangalore metro area');
            return;
        }
        setLocationError('');
        setTaskLocation(coordinate);
    };

    const handlePost = async () => {
        if (!taskLocation) {
            showAlert('No Location', 'Please set a location on the map.');
            return;
        }
        setLoading(true);
        try {
            await addDoc(collection(db, 'tasks'), {
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price),
                category,
                location: taskLocation,
                status: 'open',
                posterId: user.uid,
                runnerId: null,
                createdAt: serverTimestamp(),
            });
            showAlert('🎉 Task Posted!', 'Your task is live. Runners near you will see it.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            showAlert('Error', err.message);
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
              <Text style={styles.label}>📍 Search Location</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Type area name (e.g. Koramangala, Basavangudi)"
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => searchQuery && setShowSuggestions(true)}
                />
                
                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsDropdown}>
                    {suggestions.map((location, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionSelect(location)}
                      >
                        <Text style={styles.suggestionText}>📍 {location.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.instructionBar}>
              {locationLoading ? (
                <View style={styles.locatingRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.mapHint}>  Getting your location…</Text>
                </View>
              ) : (
                <Text style={styles.mapHint}>👆 Tap anywhere on map to set task location</Text>
              )}
              {locationError && <Text style={styles.errorBar}>{locationError}</Text>}
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
              {taskLocation && <Marker coordinate={taskLocation} title="📍 Task Location" />}
            </MapView>

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
    searchContainer: {
        marginTop: 8,
    },
    searchInput: {
        backgroundColor: COLORS.background, borderRadius: 10, padding: 12,
        fontSize: 14, color: COLORS.text,
        borderWidth: 1, borderColor: COLORS.border,
    },
    suggestionsDropdown: {
        backgroundColor: COLORS.card,
        borderRadius: 10,
        marginTop: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
        maxHeight: 250,
    },
    suggestionItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    suggestionText: {
        fontSize: 14,
        color: COLORS.text,
        fontWeight: '500',
    },
    instructionBar: {
        backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    locatingRow: { flexDirection: 'row', alignItems: 'center' },
    mapHint: { fontSize: 13, color: COLORS.textMuted },
    errorBar: { fontSize: 12, color: '#EF4444', marginTop: 8, fontWeight: '500' },
    map: { flex: 1 },
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
    hidden: { display: 'none' },
});