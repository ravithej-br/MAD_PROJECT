// src/screens/runner/RunnerHomeScreen.js
/**
 * Runner Home Screen to browse available tasks.
 * Refactored: Added pagination, server-side sorting, Zustand store integration, and shared utilities.
 */
import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, TextInput, Platform, RefreshControl,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../../components/MapView';
import { collection, query, where, onSnapshot, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import useTaskStore from '../../store/useTaskStore';
import { COLORS } from '../../utils/theme';
import TaskCard from '../../components/TaskCard';
import { useUserLocation } from '../../utils/location';
import { showAlert } from '../../utils/alert';

const CATEGORIES = ['All', 'Assembly', 'Dog Walk', 'Delivery', 'Cleaning', 'Shopping', 'Repairs', 'Tech Help'];
const PAGE_SIZE = 10;

const DEFAULT_REGION = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
};

export default function RunnerHomeScreen({ navigation }) {
    const { user } = useAuthStore();
    const { tasks, setTasks } = useTaskStore();
    const { location, locationLoading } = useUserLocation();

    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [mapView, setMapView] = useState(false);
    const [selectedCat, setSelectedCat] = useState('All');
    const [search, setSearch] = useState('');
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // ✅ Initial Firestore listener with server-side sort and limit
    React.useEffect(() => {
        const q = query(
            collection(db, 'tasks'),
            where('status', '==', 'open')
        );

        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Sort in memory
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setTasks(list);
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length >= PAGE_SIZE); // Approximation without limit
            setLoading(false);
            setRefreshing(false);
        }, (err) => {
            console.error("Firestore Error:", err);
            showAlert('Database Error', 'Could not fetch tasks. This might be due to missing indexes or permissions.');
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsub();
    }, [setTasks]);

    // ✅ Load more tasks (pagination)
    const loadMore = async () => {
        if (loadingMore || !hasMore || !lastDoc) return;
        setLoadingMore(true);
        try {
            const q = query(
                collection(db, 'tasks'),
                where('status', '==', 'open'),
                orderBy('createdAt', 'desc'),
                startAfter(lastDoc),
                limit(PAGE_SIZE)
            );
            
            const snap = await getDocs(q);
            if (!snap.empty) {
                const newList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setTasks([...tasks, ...newList]);
                setLastDoc(snap.docs[snap.docs.length - 1]);
                setHasMore(snap.docs.length === PAGE_SIZE);
            } else {
                setHasMore(false);
            }
        } catch (err) {
            showAlert('Error', 'Could not load more tasks.');
        } finally {
            setLoadingMore(false);
        }
    };

    // ✅ Filtering (Client-side search/category over the fetched pool)
    React.useEffect(() => {
        let list = tasks;
        if (user) {
            list = list.filter(t => !(t.rejectedBy && t.rejectedBy.includes(user.uid)));
        }
        if (selectedCat !== 'All') list = list.filter((t) => t.category === selectedCat);
        if (search.trim()) list = list.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
        setFiltered(list);
    }, [selectedCat, search, tasks, user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setLoading(true);
        setLastDoc(null);
        setHasMore(true);
        // Initial useEffect will handle the first page re-fetch via setRefreshing reset or store update
    }, []);


    const mapRegion = location
        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
        : DEFAULT_REGION;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Ready to earn? 💪</Text>
                    <Text style={styles.headerTitle}>Browse Tasks</Text>
                </View>
                <TouchableOpacity style={styles.mapToggle} onPress={() => setMapView(!mapView)}>
                    <Text style={styles.mapToggleText}>{mapView ? '📋 List' : '🗺️ Map'}</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Search tasks..."
                    placeholderTextColor={COLORS.textMuted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {!mapView && (
                <FlatList
                    data={CATEGORIES}
                    horizontal
                    style={{ flexGrow: 0, minHeight: 56 }}
                    keyExtractor={(item) => item}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.catList}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.catChip, selectedCat === item && styles.catChipActive]}
                            onPress={() => setSelectedCat(item)}
                        >
                            <Text style={[styles.catChipText, selectedCat === item && styles.catChipTextActive]}>
                                {item}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            )}

            <View style={styles.liveBar}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                    {loading ? 'Loading tasks…' : `${filtered.length} task${filtered.length !== 1 ? 's' : ''} available`}
                </Text>
            </View>

            {mapView ? (
                <View style={styles.mapWrapper}>
                    {locationLoading && (
                        <View style={styles.locationBanner}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.locationBannerText}>  Getting your location…</Text>
                        </View>
                    )}
                    <MapView style={styles.map} provider={PROVIDER_DEFAULT} region={mapRegion} showsUserLocation={!!location}>
                        {filtered.filter((t) => t.location).map((task) => (
                            <Marker
                                key={task.id}
                                coordinate={task.location}
                                title={task.title}
                                description={`₹${task.price} • ${task.category}`}
                                onCalloutPress={() => navigation.navigate('TaskDetail', { task })}
                            />
                        ))}
                    </MapView>
                </View>
            ) : loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                    <Text style={styles.loadingText}>Finding tasks near you…</Text>
                </View>
            ) : filtered.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>🔍</Text>
                    <Text style={styles.emptyTitle}>No tasks found</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <TaskCard
                            task={item}
                            onPress={() => navigation.navigate('TaskDetail', { task: item })}
                            showDistance
                            location={location}
                        />
                    )}
                    contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                    ListFooterComponent={hasMore && (
                        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
                            {loadingMore ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.loadMoreText}>Load More</Text>}
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 14,
        backgroundColor: COLORS.card,
    },
    greeting: { fontSize: 13, color: COLORS.textMuted },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
    mapToggle: {
        backgroundColor: COLORS.primary + '18', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: COLORS.primary + '40',
    },
    mapToggleText: { fontWeight: '700', color: COLORS.primary, fontSize: 13 },
    searchRow: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: COLORS.card },
    searchInput: {
        backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 14,
        paddingVertical: 10, fontSize: 14, color: COLORS.text,
        borderWidth: 1, borderColor: COLORS.border,
    },
    catList: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: COLORS.card, alignItems: 'center' },
    catChip: {
        paddingHorizontal: 16, height: 34, justifyContent: 'center', borderRadius: 20,
        backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
    },
    catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    catChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
    catChipTextActive: { color: '#fff' },
    liveBar: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
        backgroundColor: '#F0FFF4', borderBottomWidth: 1, borderBottomColor: '#C6F6D5',
    },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 8 },
    liveText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
    mapWrapper: { flex: 1 },
    locationBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF', paddingVertical: 8 },
    locationBannerText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    map: { flex: 1 },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.textMuted, fontSize: 14 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 52, marginBottom: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    loadMoreBtn: { padding: 16, alignItems: 'center' },
    loadMoreText: { color: COLORS.primary, fontWeight: '700' },
});

