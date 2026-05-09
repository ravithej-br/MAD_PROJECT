// src/screens/shared/TaskDetailScreen.js
/**
 * Detailed view of a task.
 * Fixed: Robust Toast notification and permission handling.
 */
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Platform, TextInput
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from '../../components/MapView';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction, arrayUnion } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import useTaskStore from '../../store/useTaskStore';
import { COLORS, SHADOWS } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../utils/alert';
import { getDistance, calculateETA } from '../../utils/distance';

const STATUS_CONFIG = {
    open: { color: COLORS.success, label: 'OPEN', desc: 'Available for runners' },
    'in-progress': { color: COLORS.warning, label: 'IN PROGRESS', desc: 'Runner is on the way' },
    completed: { color: COLORS.textMuted, label: 'COMPLETED', desc: 'Pending your approval' },
    approved: { color: '#3B82F6', label: 'APPROVED', desc: 'Task finished successfully' },
    cancelled: { color: '#EF4444', label: 'CANCELLED', desc: 'Task was cancelled' }
};

export default function TaskDetailScreen({ route, navigation }) {
    const { task: initialTask } = route.params;
    const { user, role } = useAuthStore();
    const { updateTask } = useTaskStore();
    const insets = useSafeAreaInsets();

    const [task, setTask] = useState(initialTask);
    const [loading, setLoading] = useState(false);
    const [ratingSelected, setRatingSelected] = useState(5);
    const [feedback, setFeedback] = useState('');
    const [toast, setToast] = useState(null);

    // ✅ Toast Auto-Dismiss
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // ✅ Subscribe to live task updates
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'tasks', initialTask.id), (snap) => {
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() };
                setTask(data);
                updateTask(snap.id, data);
            } else {
                showAlert('Task Deleted', 'This task is no longer available.');
                navigation.goBack();
            }
        });
        return () => unsub();
    }, [initialTask.id, updateTask]);

    // Live Runner Tracking (if poster)
    useEffect(() => {
        if (role !== 'poster' || task.status !== 'in-progress' || !task.runnerId) return;
        const locUnsub = onSnapshot(doc(db, 'users', task.runnerId), (snap) => {
            if (snap.exists() && snap.data().location) {
                setTask(prev => ({ ...prev, runnerLocation: snap.data().location }));
            }
        });
        return () => locUnsub();
    }, [role, task.status, task.runnerId]);

    // ✅ Live Location Tracking for Runner (when task is in-progress)
    useEffect(() => {
        let subscription;
        const isMyTask = role === 'runner' && task.status === 'in-progress' && task.runnerId === user.uid;
        if (!isMyTask) return;

        const startTracking = async () => {
            try {
                subscription = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 15000 },
                    (loc) => {
                        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                        updateDoc(doc(db, 'tasks', task.id), { runnerLocation: coords });
                        updateDoc(doc(db, 'users', user.uid), { location: coords });
                    }
                );
            } catch (err) {
                console.warn("Tracking error:", err);
            }
        };

        startTracking();
        return () => { if (subscription) subscription.remove(); };
    }, [role, task.status, task.id, user.uid, task.runnerId]);

    const updateStatus = async (newStatus) => {
        if (newStatus === 'in-progress') {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Location Denied', 'You must allow location access to accept tasks.');
                return;
            }
        }

        setLoading(true);
        try {
            const updates = { status: newStatus };
            if (newStatus === 'in-progress') {
                updates.runnerId = user.uid;
                updates.acceptedAt = serverTimestamp();
            }
            if (newStatus === 'completed') updates.completedAt = serverTimestamp();
            if (newStatus === 'approved') updates.approvedAt = serverTimestamp();

            await updateDoc(doc(db, 'tasks', task.id), updates);
            setLoading(false);

            let msg = `Task is now ${newStatus}.`;
            if (newStatus === 'approved') msg = 'Payment processed to the runner.';
            if (newStatus === 'in-progress') msg = 'Live location shared with poster.';
            setToast(msg);
        } catch (err) {
            setLoading(false);
            showAlert('Error', err.message);
        }
    };

    const submitRating = async () => {
        setLoading(true);
        try {
            const taskRef = doc(db, 'tasks', task.id);
            const runnerRef = doc(db, 'users', task.runnerId);

            await runTransaction(db, async (transaction) => {
                const runnerDoc = await transaction.get(runnerRef);
                if (!runnerDoc.exists()) throw "Runner profile not found!";
                const runnerData = runnerDoc.data();
                transaction.update(runnerRef, {
                    totalStars: (runnerData.totalStars || 0) + ratingSelected,
                    reviewCount: (runnerData.reviewCount || 0) + 1,
                    rating: ((runnerData.totalStars || 0) + ratingSelected) / ((runnerData.reviewCount || 0) + 1),
                    tasksCompleted: (runnerData.tasksCompleted || 0) + 1
                });
                transaction.update(taskRef, {
                    hasRated: true, ratingValue: ratingSelected, feedback: feedback.trim()
                });
            });

            setLoading(false);
            setToast('Feedback submitted! Thanks.');
        } catch (err) {
            setLoading(false);
            showAlert('Error', err.message);
        }
    };

    const rejectTask = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'tasks', task.id), { rejectedBy: arrayUnion(user.uid) });
            setLoading(false);
            navigation.goBack();
        } catch (err) {
            setLoading(false);
            showAlert('Error', err.message);
        }
    };

    const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
    const rawDist = task.runnerLocation && task.location ? getDistance(task.runnerLocation, task.location, true) : null;
    const formattedDist = task.runnerLocation && task.location ? getDistance(task.runnerLocation, task.location) : null;

    return (
        <View style={styles.flex}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>← Back</Text></TouchableOpacity>
                <Text style={styles.headerTitle}>Task Details</Text>
                <View style={[styles.statusBadge, { backgroundColor: st.color + '15' }]}><Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text></View>
            </View>

            {/* Non-blocking Toast at bottom */}
            {toast && (
                <View style={styles.toastContainer} pointerEvents="none">
                    <Text style={styles.toastText}>{toast}</Text>
                </View>
            )}

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.mapCard}>
                    <MapView style={styles.map} provider={PROVIDER_DEFAULT} initialRegion={{ ...task.location, latitudeDelta: 0.02, longitudeDelta: 0.02 }} scrollEnabled={false}>
                        <Marker coordinate={task.location} title="Task Goal" pinColor={COLORS.primary} />
                        {task.runnerLocation && (
                            <>
                                <Marker coordinate={task.runnerLocation} title="Runner" pinColor={COLORS.warning} />
                                <Polyline coordinates={[task.runnerLocation, task.location]} strokeWidth={3} strokeColor={COLORS.warning} lineDashPattern={[5, 5]} />
                            </>
                        )}
                    </MapView>
                    {task.status === 'in-progress' && rawDist && (
                        <View style={styles.etaBadge}><Text style={styles.etaText}>📍 Runner: {formattedDist} away ({calculateETA(rawDist)})</Text></View>
                    )}
                </View>

                <View style={styles.infoSection}>
                    <View style={styles.topLine}>
                        <Text style={styles.category}>{task.category}</Text>
                        <Text style={styles.price}>₹{task.price}</Text>
                    </View>
                    <Text style={styles.title}>{task.title}</Text>
                    <Text style={styles.desc}>{task.description}</Text>
                    <View style={styles.divider} /><Text style={styles.statusDesc}>{st.desc}</Text>
                </View>

                <View style={styles.actions}>
                    {loading ? <ActivityIndicator color={COLORS.primary} size="large" /> : (
                        <>
                            {role === 'runner' && task.status === 'open' && (
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity style={styles.rejectBtn} onPress={rejectTask}><Text style={styles.rejectBtnText}>Not interested</Text></TouchableOpacity>
                                    <TouchableOpacity style={styles.acceptBtn} onPress={() => updateStatus('in-progress')}><Text style={styles.acceptBtnText}>Accept Task ⚡</Text></TouchableOpacity>
                                </View>
                            )}
                            {role === 'runner' && task.status === 'in-progress' && task.runnerId === user.uid && (
                                <TouchableOpacity style={styles.completeBtn} onPress={() => updateStatus('completed')}><Text style={styles.completeBtnText}>Mark as Completed ✓</Text></TouchableOpacity>
                            )}
                            {role === 'poster' && task.status === 'completed' && (
                                <TouchableOpacity style={styles.approveBtn} onPress={() => updateStatus('approved')}><Text style={styles.approveBtnText}>Approve & Release Payment 💰</Text></TouchableOpacity>
                            )}
                            {role === 'poster' && task.status === 'approved' && !task.hasRated && (
                                <View style={styles.ratingCard}>
                                    <Text style={styles.ratingTitle}>Rate the Runner</Text>
                                    <View style={styles.stars}>
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <TouchableOpacity key={s} onPress={() => setRatingSelected(s)}><Text style={{ fontSize: 32 }}>{s <= ratingSelected ? '⭐' : '☆'}</Text></TouchableOpacity>
                                        ))}
                                    </View>
                                    <TextInput style={styles.ratingInput} placeholder="Add a comment..." multiline value={feedback} onChangeText={setFeedback} />
                                    <TouchableOpacity style={styles.submitRatingBtn} onPress={submitRating}><Text style={styles.submitRatingText}>Submit Feedback</Text></TouchableOpacity>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: COLORS.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 16, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    back: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '800' },
    content: { padding: 20 },
    mapCard: { height: 220, borderRadius: 20, overflow: 'hidden', ...SHADOWS.card, marginBottom: 20 },
    map: { flex: 1 },
    etaBadge: { position: 'absolute', bottom: 12, left: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.warning },
    etaText: { fontSize: 13, fontWeight: '700', color: COLORS.warning },
    infoSection: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, ...SHADOWS.card },
    topLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    category: { fontSize: 12, fontWeight: '800', color: COLORS.primary, textTransform: 'uppercase' },
    price: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
    title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
    desc: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 20 },
    divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },
    statusDesc: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' },
    actions: { marginTop: 24 },
    buttonRow: { flexDirection: 'row', gap: 12 },
    acceptBtn: { flex: 2, backgroundColor: COLORS.primary, padding: 18, borderRadius: 16, alignItems: 'center' },
    acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    rejectBtn: { flex: 1, backgroundColor: '#FEF2F2', padding: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' },
    rejectBtnText: { color: '#EF4444', fontWeight: '700' },
    completeBtn: { backgroundColor: COLORS.success, padding: 18, borderRadius: 16, alignItems: 'center' },
    completeBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    approveBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 16, alignItems: 'center' },
    approveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    ratingCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, ...SHADOWS.card, alignItems: 'center' },
    ratingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
    stars: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    ratingInput: { width: '100%', height: 80, backgroundColor: COLORS.background, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, textAlignVertical: 'top' },
    submitRatingBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 12 },
    submitRatingText: { color: '#fff', fontWeight: '700' },
    toastContainer: {
        position: 'absolute', bottom: 40, left: 20, right: 20, zIndex: 9999,
        backgroundColor: '#333', padding: 16, borderRadius: 12, elevation: 5,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
    },
    toastText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 14 },
});
