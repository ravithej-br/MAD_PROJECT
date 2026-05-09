// src/screens/runner/RunnerHomeScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    TouchableOpacity, ActivityIndicator, TextInput, Platform, RefreshControl,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from '../../components/MapView';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import TaskCard from '../../components/TaskCard';

const CATEGORIES = ['All', 'Assembly', 'Dog Walk', 'Delivery', 'Cleaning', 'Shopping', 'Repairs', 'Tech Help'];

const DEFAULT_REGION = {
    latitude: 12.9716,
    longitude: 77.5946,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
};

export default function RunnerHomeScreen({ navigation }) {
    const { user } = useAuthStore();
    const [tasks, setTasks] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [location, setLocation] = useState(null);
    const [locationLoading, setLocationLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [mapView, setMapView] = useState(false);
    const [selectedCat, setSelectedCat] = useState('All');
    const [search, setSearch] = useState('');

    // ✅ Location with timeout — no more hanging
    useEffect(() => {
        let cancelled = false;
        const fetchLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') { setLocationLoading(false); return; }

                const loc = await Promise.race([
                    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
                ]);
                if (!cancelled) setLocation(loc.coords);
            } catch {
                // silently fail — fallback region used
            } finally {
                if (!cancelled) setLocationLoading(false);
            }
        };
        fetchLocation();
        return () => { cancelled = true; };
    }, []);

    // ✅ Firestore listener
    useEffect(() => {
        const q = query(
            collection(db, 'tasks'),
            where('status', '==', 'open')
        );
        const unsub = onSnapshot(q, (snap) => {
            let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
                const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });
            setTasks(list);
            setFiltered(list);
            setLoading(false);
            setRefreshing(false);
        }, () => {
            setLoading(false);
            setRefreshing(false);
        });
        return () => unsub();
    }, []);

    // ✅ Filtering
    useEffect(() => {
        let list = tasks;

        // Exclude tasks rejected by this user
        if (user) {
            list = list.filter(t => !(t.rejectedBy && t.rejectedBy.includes(user.uid)));
        }

        if (selectedCat !== 'All') list = list.filter((t) => t.category === selectedCat);
        if (search.trim()) list = list.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()));
        setFiltered(list);
    }, [selectedCat, search, tasks, user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 3000);
    }, []);

    const mapRegion = location
        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }
        : DEFAULT_REGION;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Ready to earn? 💪</Text>
                    <Text style={styles.headerTitle}>Browse Tasks</Text>
                </View>
                <TouchableOpacity
                    style={styles.mapToggle}
                    onPress={() => setMapView(!mapView)}
                    activeOpacity={0.8}
                >
                    <Text style={styles.mapToggleText}>{mapView ? '📋 List' : '🗺️ Map'}</Text>
                </TouchableOpacity>
            </View>

            {/* Search — always visible */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Search tasks..."
                    placeholderTextColor={COLORS.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
            </View>

            {/* Filter Categories — only in list mode */}
            {!mapView && (
                <>

                    <FlatList
                        data={CATEGORIES}
                        horizontal
                        style={{ flexGrow: 0, minHeight: 56, maxHeight: 56 }}
                        keyExtractor={(item) => item}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.catList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.catChip, selectedCat === item && styles.catChipActive]}
                                onPress={() => setSelectedCat(item)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.catChipText, selectedCat === item && styles.catChipTextActive]}>
                                    {item}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </>
            )}

            {/* Live indicator */}
            <View style={styles.liveBar}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                    {loading ? 'Loading tasks…' : `${filtered.length} task${filtered.length !== 1 ? 's' : ''} available near you`}
                </Text>
            </View>

            {/* Map or List */}
            {mapView ? (
                <View style={styles.mapWrapper}>
                    {locationLoading && (
                        <View style={styles.locationBanner}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <Text style={styles.locationBannerText}>  Getting your location…</Text>
                        </View>
                    )}
                    <MapView
                        style={styles.map}
                        provider={PROVIDER_DEFAULT}
                        region={mapRegion}
                        showsUserLocation={!!location}
                        showsMyLocationButton={!!location}
                    >
                        {filtered.filter((t) => t.location).map((task) => (
                            <Marker
                                key={task.id}
                                coordinate={{ latitude: task.location.latitude, longitude: task.location.longitude }}
                                title={task.title}
                                description={`₹${task.price} • ${task.category}`}
                                onPress={() => navigation.navigate('TaskDetail', { task })}
                                onCalloutPress={() => navigation.navigate('TaskDetail', { task })}
                            />
                        ))}
                    </MapView>
                    {filtered.filter(t => t.location).length === 0 && !loading && (
                        <View style={styles.mapEmptyOverlay}>
                            <Text style={styles.mapEmptyText}>📍 No tasks with locations pin</Text>
                        </View>
                    )}
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
                    <Text style={styles.emptyDesc}>Try a different category or search term.</Text>
                    {(selectedCat !== 'All' || search) && (
                        <TouchableOpacity style={styles.resetBtn} onPress={() => { setSelectedCat('All'); setSearch(''); }}>
                            <Text style={styles.resetBtnText}>Clear Filters</Text>
                        </TouchableOpacity>
                    )}
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
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} tintColor={COLORS.primary} />
                    }
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
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 52, marginBottom: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    emptyDesc: { fontSize: 14, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },
    resetBtn: { marginTop: 16, backgroundColor: COLORS.primary + '20', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
    resetBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});
