// src/screens/poster/PosterHomeScreen.js
/**
 * Poster Home Screen to manage posted tasks.
 * Refactored: Added server-side sorting, Zustand store integration, and shared utilities.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, RefreshControl, Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../../components/MapView';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import useTaskStore from '../../store/useTaskStore';
import { COLORS } from '../../utils/theme';
import TaskCard from '../../components/TaskCard';
import { useUserLocation } from '../../utils/location';
import { showAlert } from '../../utils/alert';

const DEFAULT_REGION = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
};

function getDynamicGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning ☀️';
    if (hour < 17) return 'Good Afternoon 🌤️';
    if (hour < 21) return 'Good Evening 🌆';
    return 'Good Night 🌙';
}

export default function PosterHomeScreen({ navigation }) {
    const { user } = useAuthStore();
    const { myTasks, setMyTasks } = useTaskStore();
    const { location, locationLoading } = useUserLocation();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [mapView, setMapView] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const mapRef = useRef(null);

    // ✅ Real-time listener with server-side sort
    React.useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'tasks'),
            where('posterId', '==', user.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Sort in memory to avoid index requirements
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setMyTasks(list);
            setLoading(false);
            setRefreshing(false);
        }, (err) => {
            console.error("Firestore Error:", err);
            showAlert('Database Error', 'Could not fetch your tasks. Check your internet or database permissions.');
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsub();
    }, [user, setMyTasks]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
    }, []);

    const getStatusColor = (status) => {
        if (status === 'open') return COLORS.success;
        if (status === 'in-progress') return COLORS.warning;
        if (status === 'cancelled') return '#EF4444';
        return COLORS.textMuted;
    };

    const stats = {
        open: myTasks.filter((t) => t.status === 'open').length,
        inProgress: myTasks.filter((t) => t.status === 'in-progress').length,
        completed: myTasks.filter((t) => t.status === 'completed' || t.status === 'approved').length,
    };

    const displayedTasks = myTasks.filter(t => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'completed') return t.status === 'completed' || t.status === 'approved';
        return t.status === filterStatus;
    });

    const handleCancelTask = (task) => {
        showAlert(
            'Cancel Task?',
            'Are you sure you want to cancel this task?',
            [
                { text: 'No, Keep it', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await updateDoc(doc(db, 'tasks', task.id), { status: 'cancelled' });
                        } catch (err) {
                            showAlert('Error', err.message);
                        }
                    }
                }
            ]
        );
    };

    const mapRegion = location
        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
        : DEFAULT_REGION;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getDynamicGreeting()}</Text>
                    <Text style={styles.headerTitle}>My Tasks</Text>
                </View>
                <TouchableOpacity style={styles.mapToggle} onPress={() => setMapView(!mapView)}>
                    <Text style={styles.mapToggleText}>{mapView ? '📋 List' : '🗺️ Map'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
                {['open', 'in-progress', 'completed'].map(status => (
                    <TouchableOpacity
                        key={status}
                        style={[
                            styles.statBox, 
                            { borderColor: status === 'open' ? COLORS.success : status === 'in-progress' ? COLORS.warning : COLORS.primary },
                            filterStatus === status && { backgroundColor: (status === 'open' ? COLORS.success : status === 'in-progress' ? COLORS.warning : COLORS.primary) + '1A' }
                        ]}
                        onPress={() => setFilterStatus(filterStatus === status ? 'all' : status)}
                    >
                        <Text style={[styles.statNum, { color: status === 'open' ? COLORS.success : status === 'in-progress' ? COLORS.warning : COLORS.primary }]}>
                            {stats[status === 'in-progress' ? 'inProgress' : status]}
                        </Text>
                        <Text style={styles.statLabel}>{status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {mapView ? (
                <View style={styles.mapWrapper}>
                    {locationLoading && (
                        <View style={styles.locationBanner}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.locationBannerText}>  Getting your location…</Text>
                        </View>
                    )}
                    <MapView ref={mapRef} style={styles.map} provider={PROVIDER_DEFAULT} region={mapRegion} showsUserLocation={!!location}>
                        {displayedTasks.filter(t => t.location).map((task) => (
                            <Marker
                                key={task.id}
                                coordinate={task.location}
                                title={task.title}
                                description={`₹${task.price} • ${task.status}`}
                                pinColor={getStatusColor(task.status)}
                                onCalloutPress={() => navigation.navigate('TaskDetail', { task })}
                            />
                        ))}
                    </MapView>
                </View>
            ) : loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                    <Text style={styles.loadingText}>Loading your tasks…</Text>
                </View>
            ) : displayedTasks.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>📭</Text>
                    <Text style={styles.emptyTitle}>No tasks yet!</Text>
                    <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('PostTask')}>
                        <Text style={styles.emptyBtnText}>+ Post Your First Task</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={displayedTasks}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TaskCard
                            task={{ ...item, onCancel: handleCancelTask }}
                            onPress={() => navigation.navigate('TaskDetail', { task: item })}
                        />
                    )}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                />
            )}

            {!mapView && (
                <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('PostTask')}>
                    <Text style={styles.fabText}>+ Post Task</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 16,
        backgroundColor: COLORS.card,
    },
    greeting: { fontSize: 13, color: COLORS.textMuted },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
    mapToggle: {
        backgroundColor: COLORS.primary + '18', borderRadius: 20, paddingHorizontal: 14,
        paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.primary + '40',
    },
    mapToggleText: { fontWeight: '700', color: COLORS.primary, fontSize: 13 },
    statsRow: {
        flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    statBox: {
        flex: 1, alignItems: 'center', paddingVertical: 10,
        backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 2,
    },
    statNum: { fontSize: 22, fontWeight: '800' },
    statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
    mapWrapper: { flex: 1 },
    locationBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF', paddingVertical: 8 },
    locationBannerText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    map: { flex: 1 },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.textMuted, fontSize: 14 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
    emptyBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    fab: {
        position: 'absolute', bottom: 28, right: 20,
        backgroundColor: COLORS.primary, borderRadius: 28,
        paddingHorizontal: 24, paddingVertical: 16,
        elevation: 8, shadowColor: COLORS.primary, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    },
    fabText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

