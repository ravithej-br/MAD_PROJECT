// src/screens/runner/RunnerMyJobsScreen.js
/**
 * Screen showing tasks accepted by the current runner.
 * Refactored: Added in-memory sorting to avoid index requirements, Zustand store integration.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform, RefreshControl } from 'react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import useTaskStore from '../../store/useTaskStore';
import { COLORS } from '../../utils/theme';
import TaskCard from '../../components/TaskCard';
import { useUserLocation } from '../../utils/location';

export default function RunnerMyJobsScreen({ navigation }) {
    const { user } = useAuthStore();
    const { myTasks, setMyTasks } = useTaskStore();
    const { location } = useUserLocation();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ✅ Real-time listener (Sorted in memory to avoid missing index errors)
    React.useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'tasks'),
            where('runnerId', '==', user.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // Sort in memory (newest first)
            list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setMyTasks(list);
            setLoading(false);
            setRefreshing(false);
        }, (err) => {
            console.error("Firestore Error:", err);
            setLoading(false);
            setRefreshing(false);
        });

        return () => unsub();
    }, [user, setMyTasks]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Jobs</Text>
            </View>

            {loading ? (
                <View style={styles.loadingState}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                    <Text style={styles.loadingText}>Loading your jobs…</Text>
                </View>
            ) : myTasks.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>💼</Text>
                    <Text style={styles.emptyTitle}>No jobs yet</Text>
                    <Text style={styles.emptyDesc}>Accept a task from the home screen to get started.</Text>
                </View>
            ) : (
                <FlatList
                    data={myTasks}
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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 48, paddingBottom: 16,
        backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
    loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { color: COLORS.textMuted, fontSize: 14 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 8 },
    emptyDesc: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
});
