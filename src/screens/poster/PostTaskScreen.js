// src/screens/poster/PostTaskScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [category, setCategory] = useState(null);
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1=Details, 2=Location
    const insets = useSafeAreaInsets();

    // ✅ Location fetch with timeout — prevents app freeze
    useEffect(() => {
        let cancelled = false;
        const fetchLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    if (!cancelled) setLocation(DEFAULT_LOCATION);
                    setLocationLoading(false);
                    return;
                }
                const loc = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
                ]);
                if (!cancelled) setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            } catch {
                if (!cancelled) setLocation(DEFAULT_LOCATION); // fallback to Bengaluru center
            } finally {
                if (!cancelled) setLocationLoading(false);
            }
        };
        fetchLocation();
        return () => { cancelled = true; };
    }, []);

    const validateStep1 = () => {
        if (!title.trim()) { Alert.alert('Missing Title', 'Please enter a task title.'); return false; }
        if (!description.trim()) { Alert.alert('Missing Description', 'Please describe what you need.'); return false; }
        if (!category) { Alert.alert('Missing Category', 'Please select a category.'); return false; }
        if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
            Alert.alert('Invalid Budget', 'Please enter a valid budget amount.');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (validateStep1()) setStep(2);
    };

    const handlePost = async () => {
        if (!location) { Alert.alert('No Location', 'Please wait for your location or tap the map to set one.'); return; }
        setLoading(true);
        try {
            await addDoc(collection(db, 'tasks'), {
                title: title.trim(),
                description: description.trim(),
                price: parseFloat(price),
                category,
                location,
                status: 'open',
                posterId: user.uid,
                runnerId: null,
                createdAt: serverTimestamp(),
            });
            Alert.alert('🎉 Task Posted!', 'Your task is live. Runners near you will see it.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => step === 1 ? navigation.goBack() : setStep(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.back}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Post a Task</Text>
                <View style={styles.stepBadge}>
                    <Text style={styles.stepText}>Step {step}/2</Text>
                </View>
            </View>

            {/* Step Indicator */}
            <View style={styles.stepBar}>
                <View style={[styles.stepLine, { flex: 1, backgroundColor: COLORS.primary }]} />
                <View style={[styles.stepLine, { flex: 1, backgroundColor: step === 2 ? COLORS.primary : COLORS.border }]} />
            </View>

            {step === 1 ? (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sectionTitle}>📋 Task Details</Text>

                    <Text style={styles.label}>Title *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Assemble IKEA shelf"
                        placeholderTextColor={COLORS.textMuted}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={60}
                        returnKeyType="next"
                    />

                    <Text style={styles.label}>Description *</Text>
                    <TextInput
                        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                        placeholder="Describe what you need..."
                        placeholderTextColor={COLORS.textMuted}
                        multiline
                        value={description}
                        onChangeText={setDescription}
                    />

                    <Text style={styles.label}>Category *</Text>
                    <View style={styles.categoryGrid}>
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat.label}
                                style={[styles.catBtn, category === cat.label && styles.catBtnActive]}
                                onPress={() => setCategory(cat.label)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.catEmoji}>{cat.icon}</Text>
                                <Text style={[styles.catLabel, category === cat.label && { color: COLORS.primary, fontWeight: '700' }]}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.label}>Your Budget (₹) *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 500"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="numeric"
                        value={price}
                        onChangeText={setPrice}
                        returnKeyType="done"
                    />

                    <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
                        <Text style={styles.nextBtnText}>Next: Set Location →</Text>
                    </TouchableOpacity>
                </ScrollView>
            ) : (
                <View style={styles.flex}>
                    <View style={styles.mapHintBar}>
                        {locationLoading ? (
                            <View style={styles.locatingRow}>
                                <ActivityIndicator size="small" color={COLORS.primary} />
                                <Text style={styles.mapHint}>  Getting your location…  (or tap map to set pin)</Text>
                            </View>
                        ) : (
                            <Text style={styles.mapHint}>📍 Tap anywhere on the map to set task location</Text>
                        )}
                    </View>

                    {/* ✅ Map always shows — uses default/fetched location */}
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_DEFAULT}
                        region={location
                            ? { ...location, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                            : { ...DEFAULT_LOCATION, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                        }
                        onPress={(e) => setLocation(e.nativeEvent.coordinate)}
                        showsUserLocation={true}
                    >
                        {location && <Marker coordinate={location} title="Task Location" />}
                    </MapView>

                    <View style={[styles.mapControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)} activeOpacity={0.8}>
                            <Text style={styles.backBtnText}>← Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.postBtn, (loading || !location) && { opacity: 0.7 }]}
                            onPress={handlePost}
                            disabled={loading || !location}
                            activeOpacity={0.85}
                        >
                            {loading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.postBtnText}>🚀 Post Task</Text>
                            }
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
        fontSize: 15, color: COLORS.text, marginBottom: 16,
        borderWidth: 1, borderColor: COLORS.border,
    },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    catBtn: {
        width: '22%', alignItems: 'center', padding: 12, borderRadius: 12,
        backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border,
    },
    catBtnActive: { borderColor: COLORS.primary, backgroundColor: '#F0F4FF' },
    catEmoji: { fontSize: 24, marginBottom: 4 },
    catLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
    nextBtn: {
        backgroundColor: COLORS.primary, borderRadius: 14,
        padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 32,
        elevation: 4, shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8,
    },
    nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    mapHintBar: {
        backgroundColor: COLORS.card, paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    locatingRow: { flexDirection: 'row', alignItems: 'center' },
    mapHint: { fontSize: 13, color: COLORS.textMuted },
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
    postBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
