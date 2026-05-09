// src/screens/shared/TaskDetailScreen.js
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Alert, ActivityIndicator, Platform, Linking, TextInput
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../../components/MapView';
import * as Location from 'expo-location';
import { doc, updateDoc, deleteDoc, serverTimestamp, arrayUnion, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_CONFIG = {
    open: { color: COLORS.success, bg: '#F0FFF4', label: '🟢 Open' },
    'in-progress': { color: COLORS.warning, bg: '#FFFBEB', label: '🟡 On The Way' },
    completed: { color: '#6B7280', bg: '#F7FAFC', label: '✅ Pending Approval' },
    approved: { color: '#3B82F6', bg: '#EFF6FF', label: '🏆 Approved & Paid' },
    cancelled: { color: '#EF4444', bg: '#FEE2E2', label: '❌ Cancelled' }
};

const CATEGORY_ICONS = {
    'Assembly': '🛋️', 'Dog Walk': '🐕', 'Delivery': '📦',
    'Cleaning': '🧹', 'Shopping': '🛒', 'Repairs': '🔧',
    'Photography': '📸', 'Tech Help': '💻',
};

// Calculate distance and ETA (assuming 40km/h average city speed)
function calculateETA(loc1, loc2) {
    if (!loc1 || !loc2) return null;
    const R = 6371; // km
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLon = (loc2.longitude - loc1.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(loc1.latitude * Math.PI / 180) *
        Math.cos(loc2.latitude * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Average city speed 40km/h => 0.66 km/min
    const minutes = Math.ceil(dist / 0.66);
    return {
        dist: dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`,
        mins: minutes < 1 ? 'Arriving now' : `${minutes} min`
    };
}

export default function TaskDetailScreen({ route, navigation }) {
    const { task: initialTask } = route.params;
    const { user, role } = useAuthStore();
    const [task, setTask] = useState(initialTask);
    const [loading, setLoading] = useState(false);
    const [etaInfo, setEtaInfo] = useState(null);
    const [ratingSelected, setRatingSelected] = useState(0);
    const [feedbackText, setFeedbackText] = useState('');
    const insets = useSafeAreaInsets();

    const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
    const icon = CATEGORY_ICONS[task.category] || '📌';

    // 1. Real-time Firebase Listener for exact Uber-like fast response
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'tasks', task.id), (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() };
                setTask(data);

                // If there's a runner location and poster is viewing, calculate ETA
                if (data.status === 'in-progress' && data.location && data.runnerLocation) {
                    setEtaInfo(calculateETA(data.runnerLocation, data.location));
                }
            } else {
                // Task was deleted
                Alert.alert('Task Removed', 'This task no longer exists.');
                navigation.goBack();
            }
        });
        return () => unsub();
    }, [task.id]);

    // 2. Runner Live Location Tracking
    useEffect(() => {
        let locationSub = null;

        const trackRunner = async () => {
            if (role === 'runner' && task.status === 'in-progress' && task.runnerId === user?.uid) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                locationSub = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
                    async (loc) => {
                        const runnerLoc = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                        // Push to Firebase so Poster can see live ETA!
                        try {
                            await updateDoc(doc(db, 'tasks', task.id), { runnerLocation: runnerLoc });

                            // Runner sees their own ETA too
                            if (task.location) {
                                setEtaInfo(calculateETA(runnerLoc, task.location));
                            }
                        } catch (e) {
                            console.log('Location update failed', e);
                        }
                    }
                );
            }
        };

        trackRunner();
        return () => { if (locationSub) locationSub.remove(); };
    }, [role, task.status, task.runnerId, user]);


    const updateStatus = async (newStatus) => {
        setLoading(true);
        try {
            const updates = { status: newStatus };
            if (newStatus === 'in-progress') updates.runnerId = user.uid;
            if (newStatus === 'completed') updates.completedAt = serverTimestamp();
            if (newStatus === 'approved') updates.approvedAt = serverTimestamp();

            await updateDoc(doc(db, 'tasks', task.id), updates);
            if (newStatus !== 'approved' && newStatus !== 'in-progress') {
                Alert.alert('✅ Updated!', `Task is now ${newStatus}.`);
            } else if (newStatus === 'approved') {
                Alert.alert('🎉 Approved!', 'Payment processed to the runner.');
            } else if (newStatus === 'in-progress') {
                Alert.alert('🚴 On The Way!', 'Get to the location. Your ETA is live.');
            }
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const rejectTask = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'tasks', task.id), {
                rejectedBy: arrayUnion(user.uid)
            });
            Alert.alert('Task Rejected', 'You have rejected this task. It will no longer appear on your map or list.');
            navigation.goBack();
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const submitRating = async () => {
        if (ratingSelected === 0) return Alert.alert('Error', 'Please select a rating first.');
        setLoading(true);
        try {
            await updateDoc(doc(db, 'tasks', task.id), { 
                hasRated: true, 
                ratingValue: ratingSelected,
                feedback: feedbackText.trim()
            });

            if (task.runnerId) {
                const runnerRef = doc(db, 'users', task.runnerId);
                const runnerSnap = await getDoc(runnerRef);
                if (runnerSnap.exists()) {
                    const runnerData = runnerSnap.data();
                    const currentTotalStars = runnerData.totalStars || 0;
                    const currentReviewCount = runnerData.reviewCount || 0;

                    await updateDoc(runnerRef, {
                        totalStars: currentTotalStars + ratingSelected,
                        reviewCount: currentReviewCount + 1,
                        rating: (currentTotalStars + ratingSelected) / (currentReviewCount + 1)
                    });
                }
            }
            Alert.alert('Thank You!', 'Your feedback has been saved.');
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const cancelTask = () => {
        Alert.alert(
            'Cancel Task?',
            'Are you sure you want to cancel and remove this task?',
            [
                { text: 'No, Keep it', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            await updateDoc(doc(db, 'tasks', task.id), { status: 'cancelled' });
                            // Alert/GoBack will be handled by the onSnapshot listener safely
                        } catch (err) {
                            Alert.alert('Error', err.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const canAccept = role === 'runner' && task.status === 'open' && task.posterId !== user?.uid;
    const canComplete = role === 'runner' && task.status === 'in-progress' && task.runnerId === user?.uid;
    const isPoster = task.posterId === user?.uid;
    const canCancel = isPoster && task.status === 'open';
    const canApprove = isPoster && task.status === 'completed';

    // Map bounds logic if both locations exist
    const mapRegion = task.location ? {
        latitude: task.location.latitude,
        longitude: task.location.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
    } : null;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.backBtn}>
                    <Text style={styles.back}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Task Detail</Text>
                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>

                {/* 🚨 THE UBER ETA BANNER 🚨 */}
                {task.status === 'in-progress' && etaInfo && (
                    <View style={styles.etaBanner}>
                        <View style={styles.etaIconRow}>
                            <Text style={styles.etaEmoji}>{role === 'runner' ? '🚴' : '📍'}</Text>
                            <View>
                                <Text style={styles.etaTitle}>
                                    {role === 'runner' ? 'You are arriving in' : 'Runner is arriving in'}
                                </Text>
                                <Text style={styles.etaTime}>{etaInfo.mins}</Text>
                            </View>
                        </View>
                        <View style={styles.etaDistancePill}>
                            <Text style={styles.etaDistanceText}>{etaInfo.dist} away</Text>
                        </View>
                    </View>
                )}

                {/* Category + Title Card */}
                <View style={styles.card}>
                    <View style={styles.categoryRow}>
                        <View style={styles.iconBox}>
                            <Text style={styles.iconText}>{icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.category}>{task.category}</Text>
                            <Text style={styles.title}>{task.title}</Text>
                        </View>
                        <View style={[styles.pricePill]}>
                            <Text style={styles.priceLabel}>Pay</Text>
                            <Text style={styles.price}>₹{task.price}</Text>
                        </View>
                    </View>

                    <Text style={styles.description}>{task.description}</Text>

                    {isPoster && (
                        <View style={styles.posterBadge}>
                            <Text style={styles.posterBadgeText}>👤 Posted by you</Text>
                        </View>
                    )}
                </View>

                {/* Info Row */}
                <View style={styles.infoRow}>
                    <View style={styles.infoItem}>
                        <Text style={styles.infoEmoji}>🗓️</Text>
                        <Text style={styles.infoText}>
                            {task.createdAt?.toDate ? task.createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Today'}
                        </Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoItem}>
                        <Text style={styles.infoEmoji}>💼</Text>
                        <Text style={styles.infoText}>{task.category}</Text>
                    </View>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoItem}>
                        <Text style={styles.infoEmoji}>💰</Text>
                        <Text style={styles.infoText}>₹{task.price}</Text>
                    </View>
                </View>

                {/* Map */}
                {task.location && (
                    <TouchableOpacity
                        style={styles.mapContainer}
                        activeOpacity={0.8}
                        onPress={() => {
                            const scheme = Platform.select({ ios: 'maps://0,0?q=', android: 'geo:0,0?q=' });
                            const latLng = `${task.location.latitude},${task.location.longitude}`;
                            const label = task.title || 'Task Location';
                            const url = Platform.select({
                                ios: `${scheme}${label}@${latLng}`,
                                android: `${scheme}${latLng}(${label})`
                            });
                            Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open map.'));
                        }}
                    >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>📍 Locations</Text>
                            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: '600' }}>Tap for directions ↗</Text>
                        </View>
                        <MapView
                            style={styles.map}
                            provider={PROVIDER_DEFAULT}
                            region={mapRegion}
                            scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false} pointerEvents="none"
                        >
                            <Marker coordinate={task.location} title="Task Area" pinColor={COLORS.primary} />

                            {/* Show runner live blip if on the way */}
                            {task.status === 'in-progress' && task.runnerLocation && (
                                <Marker coordinate={task.runnerLocation} title="Runner" pinColor={COLORS.warning} />
                            )}
                        </MapView>
                    </TouchableOpacity>
                )}

                {/* Rating Block for Poster */}
                {isPoster && task.status === 'approved' && !task.hasRated && (
                    <View style={styles.ratingCard}>
                        <Text style={styles.ratingTitle}>Rate your Runner</Text>
                        <Text style={styles.ratingDesc}>How was your experience?</Text>
                        <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity key={star} onPress={() => setRatingSelected(star)}>
                                    <Text style={[styles.starIcon, ratingSelected >= star && styles.starSelected]}>
                                        {ratingSelected >= star ? '⭐' : '☆'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput
                            style={styles.feedbackInput}
                            placeholder="Add your comments or feedback (optional)"
                            placeholderTextColor={COLORS.textMuted}
                            value={feedbackText}
                            onChangeText={setFeedbackText}
                            multiline
                            numberOfLines={3}
                        />

                        <TouchableOpacity style={[styles.btnRating, loading && { opacity: 0.7 }]} onPress={submitRating} disabled={loading}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnRatingText}>Submit Feedback</Text>}
                        </TouchableOpacity>
                    </View>
                )}
                {isPoster && task.status === 'approved' && task.hasRated && (
                    <View style={styles.ratingCard}>
                        <Text style={styles.ratingTitle}>You rated this {task.ratingValue} ⭐</Text>
                        <Text style={styles.ratingDesc}>Thank you for your feedback!</Text>
                        {task.feedback ? (
                            <View style={styles.feedbackDisplay}>
                                <Text style={styles.feedbackDisplayText}>"{task.feedback}"</Text>
                            </View>
                        ) : null}
                    </View>
                )}

                <View style={{ height: 24 + (!(canAccept || canComplete || canCancel || canApprove) ? insets.bottom : 0) }} />
            </ScrollView>

            {/* Action Buttons */}
            {(canAccept || canComplete || canCancel || canApprove) && (
                <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    {canAccept && (
                        <View style={{ gap: 10 }}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => updateStatus('in-progress')} disabled={loading} activeOpacity={0.85}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>✅ Accept Task — Earn ₹{task.price}</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2', borderWidth: 0 }]} onPress={rejectTask} disabled={loading} activeOpacity={0.85}>
                                {loading ? <ActivityIndicator color="#EF4444" /> : <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>❌ Reject Task</Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                    {canComplete && (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primary }]} onPress={() => updateStatus('completed')} disabled={loading} activeOpacity={0.85}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>🏁 Mark as Complete</Text>}
                        </TouchableOpacity>
                    )}
                    {canApprove && (
                        <View style={{ gap: 10 }}>
                            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.success }]} onPress={() => updateStatus('approved')} disabled={loading} activeOpacity={0.85}>
                                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>🏆 Approve & Release Payment</Text>}
                            </TouchableOpacity>
                            <Text style={{ textAlign: 'center', fontSize: 12, color: COLORS.textMuted }}>Runner has marked this job as finished.</Text>
                        </View>
                    )}
                    {canCancel && (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FEE2E2', borderWidth: 0 }]} onPress={cancelTask} disabled={loading} activeOpacity={0.85}>
                            {loading ? <ActivityIndicator color="#EF4444" /> : <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>🗑️ Cancel & Remove Task</Text>}
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 16,
        backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { minWidth: 60 },
    back: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
    statusText: { fontWeight: '700', fontSize: 12 },
    content: { padding: 16 },

    etaBanner: {
        backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 2, borderColor: COLORS.warning,
        shadowColor: COLORS.warning, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
    },
    etaIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    etaEmoji: { fontSize: 32 },
    etaTitle: { fontSize: 12, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    etaTime: { fontSize: 24, fontWeight: '900', color: COLORS.text },
    etaDistancePill: { backgroundColor: '#FFFBEB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    etaDistanceText: { color: COLORS.warning, fontWeight: '800', fontSize: 13 },

    card: {
        backgroundColor: COLORS.card, borderRadius: 16, padding: 18,
        marginBottom: 14, borderWidth: 1, borderColor: COLORS.border,
    },
    categoryRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 12 },
    iconBox: {
        width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.background,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    iconText: { fontSize: 24 },
    category: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    title: { fontSize: 20, fontWeight: '800', color: COLORS.text },
    pricePill: {
        alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8, flexShrink: 0,
    },
    priceLabel: { fontSize: 10, color: COLORS.primary, fontWeight: '600', marginBottom: 2 },
    price: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
    description: { fontSize: 15, color: COLORS.textMuted, lineHeight: 23, marginBottom: 12 },
    posterBadge: {
        alignSelf: 'flex-start', backgroundColor: '#EEF2FF', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 5,
    },
    posterBadgeText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
    infoRow: {
        flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 14,
        padding: 16, marginBottom: 14, alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.border,
    },
    infoItem: { flex: 1, alignItems: 'center', gap: 4 },
    infoDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
    infoEmoji: { fontSize: 20 },
    infoText: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', fontWeight: '600' },
    mapContainer: { marginBottom: 14 },
    sectionLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 10 },
    map: { height: 180, borderRadius: 16, overflow: 'hidden' },
    expandMapBtn: {
        alignSelf: 'flex-end', marginTop: 8,
        backgroundColor: COLORS.primary + '18', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 6,
    },
    expandMapText: { color: COLORS.primary, fontWeight: '600', fontSize: 12 },
    ratingCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
    ratingTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
    ratingDesc: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16 },
    starsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    starIcon: { fontSize: 32, color: COLORS.text },
    starSelected: { color: '#FBBF24' },
    feedbackInput: {
        width: '100%',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 20,
        textAlignVertical: 'top',
        minHeight: 80,
    },
    feedbackDisplay: {
        width: '100%',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 14,
        marginTop: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    feedbackDisplayText: {
        fontSize: 14,
        color: COLORS.text,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    btnRating: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, width: '100%', alignItems: 'center' },
    btnRatingText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    actionBar: {
        padding: 16, backgroundColor: COLORS.card,
        borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10,
    },
    actionBtn: { borderRadius: 14, padding: 18, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
