// src/screens/runner/RunnerMyJobsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import TaskCard from '../../components/TaskCard';

export default function RunnerMyJobsScreen({ navigation }) {
    const { user } = useAuthStore();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'tasks'),
            where('runnerId', '==', user.uid)
        );
        const unsub = onSnapshot(q, (snap) => {
            let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => {
                const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });
            setTasks(list);
            setLoading(false);
            setRefreshing(false);
        }, (err) => {
            console.error("Firebase fetch error in RunnerMyJobsScreen:", err);
            setLoading(false);
            setRefreshing(false);
        });
        return () => unsub();
    }, [user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 2000);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Jobs</Text>
            </View>
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
            ) : tasks.length === 0 ? (
                <View style={styles.center}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>💼</Text>
                    <Text style={styles.emptyTitle}>No Jobs Yet</Text>
                    <Text style={styles.emptyText}>Accept a task to see it here.</Text>
                </View>
            ) : (
                <FlatList
                    data={tasks}
                    keyExtractor={(t) => t.id}
                    renderItem={({ item }) => (
                        <TaskCard task={item} onPress={() => navigation.navigate('TaskDetail', { task: item })} />
                    )}
                    contentContainerStyle={{ padding: 16 }}
                    showsVerticalScrollIndicator={false}
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
        backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border
    },
    headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
    emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
