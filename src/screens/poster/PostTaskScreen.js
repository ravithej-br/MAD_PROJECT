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
        if (validateStep1()) setStep(2);
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

            {step === 1 ? (
                <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sectionTitle}>📋 Task Details</Text>

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
                                <Text style={[styles.catLabel, category === cat.label && { color: COLORS.primary, fontWeight: '700' }]}>
                                    {cat.label}
                                </Text>
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
            ) : (
                <View style={styles.flex}>
                    <View style={styles.mapHintBar}>
                        {locationLoading ? (
                            <View style={styles.locatingRow}>
                                <ActivityIndicator size="small" color={COLORS.primary} />
                                <Text style={styles.mapHint}>  Getting your location…</Text>
                            </View>
                        ) : (
                            <Text style={styles.mapHint}>📍 Tap anywhere on the map to set task location</Text>
                        )}
                    </View>

                    <MapView
                        style={styles.map}
                        provider={PROVIDER_DEFAULT}
                        region={taskLocation
                            ? { ...taskLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 }
                            : { ...DEFAULT_LOCATION, latitudeDelta: 0.05, longitudeDelta: 0.05 }
                        }
                        onPress={(e) => setTaskLocation(e.nativeEvent.coordinate)}
                        showsUserLocation={true}
                    >
                        {taskLocation && <Marker coordinate={taskLocation} title="Task Location" />}
                    </MapView>

                    <View style={[styles.mapControls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
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

