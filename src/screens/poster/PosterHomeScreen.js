// src/screens/poster/PosterHomeScreen.js
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    FlatList, ActivityIndicator, RefreshControl, Platform, Alert
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import TaskCard from '../../components/TaskCard';

// Default fallback region (Bengaluru center)
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
    const [myTasks, setMyTasks] = useState([]);
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [mapView, setMapView] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');
    const mapRef = useRef(null);

    // ✅ Location fetch with timeout so app never hangs
    useEffect(() => {
        let cancelled = false;
        const fetchLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') { setLocationLoading(false); return; }

                // Use low accuracy for speed; timeout after 8 seconds
                const loc = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
                ]);
                if (!cancelled) setLocation(loc.coords);
            } catch {
                // silently fail — fallback region will be used
            } finally {
                if (!cancelled) setLocationLoading(false);
            }
        };
        fetchLocation();
        return () => { cancelled = true; };
    }, []);

    // ✅ Firestore real-time listener
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'tasks'),
            where('posterId', '==', user.uid)
        );
        const unsub = onSnapshot(q, (snap) => {
            let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Manual sort to avoid needing Firebase composite index for (posterId + createdAt desc)
            list.sort((a, b) => {
                const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });
            setMyTasks(list);
            setLoading(false);
            setRefreshing(false);
        }, () => {
            setLoading(false);
            setRefreshing(false);
        });
        return () => unsub();
    }, [user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        // The onSnapshot listener will auto-fire; set timeout as safety
        setTimeout(() => setRefreshing(false), 3000);
    }, []);

    const getStatusColor = (status) => {
        if (status === 'open') return COLORS.success;
        if (status === 'in-progress') return COLORS.warning;
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
        Alert.alert(
            'Cancel Task?',
            'Are you sure you want to cancel and remove this task?',
            [
                { text: 'No, Keep it', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'tasks', task.id));
                        } catch (err) {
                            Alert.alert('Error', err.message);
                        }
                    }
                }
            ]
        );
    };

    // Map region: real location if available, else fallback
    const mapRegion = location
        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }
        : DEFAULT_REGION;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getDynamicGreeting()}</Text>
                    <Text style={styles.headerTitle}>My Tasks</Text>
                </View>
                <TouchableOpacity
                    style={styles.mapToggle}
                    onPress={() => setMapView(!mapView)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.mapToggleText}>{mapView ? '📋 List' : '🗺️ Map'}</Text>
                </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <TouchableOpacity
                    style={[styles.statBox, { borderColor: COLORS.success }, filterStatus === 'open' && { backgroundColor: COLORS.success + '1A' }]}
                    onPress={() => setFilterStatus(filterStatus === 'open' ? 'all' : 'open')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.statNum, { color: COLORS.success }]}>{stats.open}</Text>
                    <Text style={styles.statLabel}>Open</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.statBox, { borderColor: COLORS.warning }, filterStatus === 'in-progress' && { backgroundColor: COLORS.warning + '1A' }]}
                    onPress={() => setFilterStatus(filterStatus === 'in-progress' ? 'all' : 'in-progress')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.statNum, { color: COLORS.warning }]}>{stats.inProgress}</Text>
                    <Text style={styles.statLabel}>In Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.statBox, { borderColor: COLORS.primary }, filterStatus === 'completed' && { backgroundColor: COLORS.primary + '1A' }]}
                    onPress={() => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.statNum, { color: COLORS.primary }]}>{stats.completed}</Text>
                    <Text style={styles.statLabel}>Done</Text>
                </TouchableOpacity>
            </View>

            {/* Map or List View */}
            {mapView ? (
                // ✅ Map always shows — uses fallback region if GPS not ready
                <View style={styles.mapWrapper}>
                    {locationLoading && (
                        <View style={styles.locationBanner}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.locationBannerText}>  Getting your location…</Text>
                        </View>
                    )}
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        provider={PROVIDER_DEFAULT}
                        region={mapRegion}
                        showsUserLocation={!!location}
                        showsMyLocationButton={!!location}
                    >
                        {displayedTasks.filter(t => t.location).map((task) => (
                            <Marker
                                key={task.id}
                                coordinate={{
                                    latitude: task.location.latitude,
                                    longitude: task.location.longitude,
                                }}
                                title={task.title}
                                description={`₹${task.price} • ${task.status}`}
                                pinColor={getStatusColor(task.status)}
                                onCalloutPress={() => navigation.navigate('TaskDetail', { task })}
                            />
                        ))}
                    </MapView>
                    {displayedTasks.filter(t => t.location).length === 0 && !loading && (
                        <View style={styles.mapEmptyOverlay}>
                            <Text style={styles.mapEmptyText}>📍 No tasks with locations yet</Text>
                        </View>
                    )}
                </View>
            ) : loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                    <Text style={styles.loadingText}>Loading your tasks…</Text>
                </View>
            ) : displayedTasks.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>📭</Text>
                    <Text style={styles.emptyTitle}>{filterStatus === 'all' ? 'No tasks yet!' : 'No tasks match this filter'}</Text>
                    <Text style={styles.emptyDesc}>Post your first task and get help fast.</Text>
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
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                    }
                />
            )}

            {/* FAB */}
            {!mapView && (
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('PostTask')}
                    activeOpacity={0.85}
                >
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
    locationBanner: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#EEF2FF', paddingVertical: 8,
    },
    locationBannerText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    map: { flex: 1 },
    mapEmptyOverlay: {
        position: 'absolute', bottom: 24, left: 0, right: 0, alignItems: 'center',
    },
    mapEmptyText: {
        backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 20, fontSize: 13, color: COLORS.textMuted, fontWeight: '600',
    },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.textMuted, fontSize: 14 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
    emptyDesc: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
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
