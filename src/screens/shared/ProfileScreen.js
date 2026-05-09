// src/screens/shared/ProfileScreen.js
import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, Platform
} from 'react-native';
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { showAlert } from '../../utils/alert';

export default function ProfileScreen() {
    const { user, role, logout } = useAuthStore();
    const [profile, setProfile] = useState(null);
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, todayEarned: 0, monthEarned: 0, avgRating: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        setLoading(true);

        // Real-time listener for user profile
        const unsubProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
            if (snap.exists()) setProfile(snap.data());
        });

        // Real-time listener for tasks stats
        const field = role === 'poster' ? 'posterId' : 'runnerId';
        const q = query(collection(db, 'tasks'), where(field, '==', user.uid));
        const unsubTasks = onSnapshot(q, (taskSnap) => {
            const taskList = taskSnap.docs.map((d) => d.data());
            let todayEarned = 0;
            let monthEarned = 0;
            const now = new Date();

            if (role === 'runner') {
                taskList.forEach((t) => {
                    if (t.status === 'approved' && t.approvedAt) {
                        const date = t.approvedAt.toDate ? t.approvedAt.toDate() : new Date(t.approvedAt);
                        if (
                            date.getDate() === now.getDate() &&
                            date.getMonth() === now.getMonth() &&
                            date.getFullYear() === now.getFullYear()
                        ) {
                            todayEarned += Number(t.price) || 0;
                        }
                        if (
                            date.getMonth() === now.getMonth() &&
                            date.getFullYear() === now.getFullYear()
                        ) {
                            monthEarned += Number(t.price) || 0;
                        }
                    }
                });
            }

            const ratedTasks = taskList.filter(t => t.hasRated && t.ratingValue);
            const totalStars = ratedTasks.reduce((acc, t) => acc + t.ratingValue, 0);
            const avgRating = ratedTasks.length > 0 ? totalStars / ratedTasks.length : 0;

            setTaskStats({
                total: taskList.length,
                completed: taskList.filter((t) => t.status === 'completed' || t.status === 'approved').length,
                todayEarned,
                monthEarned,
                avgRating
            });
            setLoading(false);
        });

        // Cleanup listeners
        return () => {
            unsubProfile();
            unsubTasks();
        };
    }, [user, role]);

    const handleLogout = () => {
        showAlert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut(auth);
                        logout();
                    }
                }
            ]
        );
    };

    if (loading) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1, marginTop: 100 }} size="large" />;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Avatar & Name */}
            <View style={styles.avatarSection}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {profile?.name?.charAt(0).toUpperCase() || '?'}
                    </Text>
                </View>
                <Text style={styles.name}>{profile?.name || 'User'}</Text>
                <Text style={styles.email}>{profile?.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: role === 'poster' ? '#EEF2FF' : '#F0FFF4' }]}>
                    <Text style={[styles.roleText, { color: role === 'poster' ? COLORS.primary : COLORS.success }]}>
                        {role === 'poster' ? '📋 Task Poster' : '🏃 Task Runner'}
                    </Text>
                </View>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                    <Text style={styles.statNum}>{taskStats.total}</Text>
                    <Text style={styles.statLabel}>{role === 'poster' ? 'Tasks Posted' : 'Tasks Taken'}</Text>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                    <Text style={styles.statNum}>{taskStats.completed}</Text>
                    <Text style={styles.statLabel}>Completed</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statNum}>⭐ {taskStats.avgRating > 0 ? taskStats.avgRating.toFixed(1) : 'N/A'}</Text>
                    <Text style={styles.statLabel}>Rating</Text>
                </View>
            </View>

            {/* Runner Earnings */}
            {role === 'runner' && (
                <View style={[styles.statsGrid, { marginTop: -10, paddingTop: 16, paddingBottom: 16 }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statNum, { color: COLORS.success }]}>₹{taskStats.todayEarned}</Text>
                        <Text style={styles.statLabel}>Today's Earnings</Text>
                    </View>
                    <View style={[styles.statItem, styles.statDivider]}>
                        <Text style={[styles.statNum, { color: COLORS.success }]}>₹{taskStats.monthEarned}</Text>
                        <Text style={styles.statLabel}>Monthly Earnings</Text>
                    </View>
                </View>
            )}

            {/* Menu Items */}
            <View style={styles.menuCard}>
                {[
                    { icon: '👤', label: 'Edit Profile', onPress: () => showAlert('Coming Soon', 'Edit Profile settings will be available in the next update.') },
                    { icon: '🔔', label: 'Notifications', onPress: () => showAlert('Coming Soon', 'Notification settings will be available in the next update.') },
                    { icon: '🔒', label: 'Privacy & Security', onPress: () => showAlert('Coming Soon', 'Privacy settings will be available in the next update.') },
                    { icon: '❓', label: 'Help & Support', onPress: () => showAlert('Help & Support', 'Please contact support@taskhub.com for any assistance.') },
                    { icon: '📄', label: 'Terms & Privacy', onPress: () => showAlert('Terms & Privacy', 'Please visit taskhub.com/legal to view our terms.') },
                ].map((item, i) => (
                    <TouchableOpacity key={item.label} style={[styles.menuItem, i > 0 && styles.menuItemBorder]} onPress={item.onPress}>
                        <Text style={styles.menuIcon}>{item.icon}</Text>
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        <Text style={styles.menuArrow}>›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Text style={styles.logoutText}>🚪 Logout</Text>
            </TouchableOpacity>

            <Text style={styles.version}>TASK HUB v1.0.0 • Made with ❤️ at BMS</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: 20, paddingTop: 60 },
    avatarSection: { alignItems: 'center', marginBottom: 24 },
    avatar: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
        marginBottom: 12, elevation: 4,
    },
    avatarText: { fontSize: 36, fontWeight: '800', color: '#fff' },
    name: { fontSize: 22, fontWeight: '800', color: COLORS.text },
    email: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, marginBottom: 10 },
    roleBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
    roleText: { fontWeight: '700', fontSize: 13 },
    statsGrid: {
        flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 16,
        padding: 20, marginBottom: 20, elevation: 2,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statDivider: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: COLORS.border },
    statNum: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
    statLabel: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },
    menuCard: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    menuItemBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
    menuIcon: { fontSize: 20, marginRight: 14 },
    menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.text },
    menuArrow: { fontSize: 20, color: COLORS.textMuted },
    logoutBtn: {
        backgroundColor: '#FFF5F5', borderRadius: 14, padding: 16,
        alignItems: 'center', borderWidth: 1, borderColor: '#FED7D7', marginBottom: 24,
    },
    logoutText: { color: '#E53E3E', fontWeight: '700', fontSize: 16 },
    version: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginBottom: 20 },
});
