// src/components/TaskCard.js
/**
 * Shared Task Card component.
 * Refactored to use shared distance utilities.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS } from '../utils/theme';
import { getDistance } from '../utils/distance';

const STATUS_CONFIG = {
    open: { color: COLORS.success, label: '● Open' },
    'in-progress': { color: COLORS.warning, label: '● In Progress' },
    completed: { color: COLORS.textMuted, label: '✓ Pending Approval' },
    approved: { color: '#3B82F6', label: '🏆 Approved' },
    cancelled: { color: '#EF4444', label: '● Cancelled' }
};

const CATEGORY_ICONS = {
    'Assembly': '🛋️', 'Dog Walk': '🐕', 'Delivery': '📦',
    'Cleaning': '🧹', 'Shopping': '🛒', 'Repairs': '🔧',
    'Photography': '📸', 'Tech Help': '💻',
};

export default function TaskCard({ task, onPress, showDistance, location }) {
    const st = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
    const icon = CATEGORY_ICONS[task.category] || '📌';
    const distance = showDistance && location && task.location
        ? getDistance(location, task.location)
        : null;

    const ratingStars = Array.from({ length: 5 }, (_, i) =>
        i < (task.ratingValue || 0) ? '⭐' : '☆'
    ).join('');

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
            {/* Top Row */}
            <View style={styles.topRow}>
                <View style={styles.iconContainer}>
                    <Text style={styles.icon}>{icon}</Text>
                </View>
                <View style={styles.titleSection}>
                    <Text style={styles.category}>{task.category}</Text>
                    <Text style={styles.title} numberOfLines={1}>{task.title}</Text>
                </View>
                <View style={styles.priceTag}>
                    <Text style={styles.price}>₹{task.price}</Text>
                </View>
            </View>

            {/* Description */}
            <Text style={styles.desc} numberOfLines={2}>{task.description}</Text>

            {/* Bottom Row */}
            <View style={styles.bottomRow}>
                <Text style={[styles.status, { color: st.color }]}>{st.label}</Text>

                {task.status === 'open' && task.onCancel && (
                    <TouchableOpacity
                        style={styles.cancelLink}
                        onPress={(e) => {
                            e.stopPropagation();
                            task.onCancel(task);
                        }}
                    >
                        <Text style={styles.cancelLinkText}>Cancel</Text>
                    </TouchableOpacity>
                )}

                {distance && (
                    <View style={styles.distanceBadge}>
                        <Text style={styles.distanceText}>📍 {distance} away</Text>
                    </View>
                )}
                <Text style={styles.time}>
                    {task.createdAt?.toDate
                        ? task.createdAt.toDate().toLocaleDateString()
                        : 'Just now'}
                </Text>
            </View>

            {/* Rating Section for Runner/Poster View */}
            {task.hasRated && (
                <View style={styles.ratingSection}>
                    <View style={styles.ratingBadge}>
                        <Text style={styles.ratingText}>{ratingStars}</Text>
                    </View>
                    {task.feedback ? (
                        <Text style={styles.feedbackText} numberOfLines={1}>
                            "{task.feedback}"
                        </Text>
                    ) : null}
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.card,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    iconContainer: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
        marginRight: 12,
    },
    icon: { fontSize: 22 },
    titleSection: { flex: 1 },
    category: { fontSize: 11, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
    title: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginTop: 2 },
    priceTag: {
        backgroundColor: '#F0F4FF', borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    price: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
    desc: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18, marginBottom: 12 },
    bottomRow: { flexDirection: 'row', alignItems: 'center' },
    status: { fontSize: 12, fontWeight: '700', flex: 1 },
    distanceBadge: {
        backgroundColor: '#FFF8E7', borderRadius: 10,
        paddingHorizontal: 8, paddingVertical: 3, marginRight: 8,
    },
    distanceText: { fontSize: 11, color: COLORS.warning, fontWeight: '600' },
    time: { fontSize: 11, color: COLORS.textMuted },
    cancelLink: {
        paddingHorizontal: 8, paddingVertical: 4,
        marginRight: 8, borderRadius: 6,
        backgroundColor: '#FEF2F2',
    },
    cancelLinkText: {
        fontSize: 11, fontWeight: '700', color: '#EF4444',
    },
    ratingSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        gap: 10,
    },
    ratingBadge: {
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#B45309',
    },
    feedbackText: {
        fontSize: 12,
        color: COLORS.textMuted,
        fontStyle: 'italic',
        flex: 1,
    },
});

