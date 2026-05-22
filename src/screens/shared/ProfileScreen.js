// src/screens/shared/ProfileScreen.js
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, Platform,
    Modal, TextInput, Image
} from 'react-native';
import { doc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { signOut, sendPasswordResetEmail } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
    const { user, role, logout } = useAuthStore();
    const [profile, setProfile] = useState(null);
    const [taskStats, setTaskStats] = useState({ total: 0, completed: 0, todayEarned: 0, monthEarned: 0, avgRating: 0 });
    const [loading, setLoading] = useState(true);

    // Modal & Feature States
    const [activeModal, setActiveModal] = useState(null); // 'edit' | 'privacy' | 'support' | 'terms' | null
    const [editName, setEditName] = useState('');
    const [uploading, setUploading] = useState(false);
    const [supportMsg, setSupportMsg] = useState('');
    const [supportLoading, setSupportLoading] = useState(false);
    const [faqOpen, setFaqOpen] = useState({});

    React.useEffect(() => {
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

    // --- Image Picker & Upload ---
    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                showAlert('Permission Required', 'We need access to your camera roll to change your profile picture.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                await handleUploadImage(result.assets[0].uri);
            }
        } catch (err) {
            showAlert('Error', 'Image Picker failed: ' + err.message);
        }
    };

    const handleUploadImage = async (localUri) => {
        setUploading(true);
        try {
            // Convert to Blob for Firebase JS SDK
            const response = await fetch(localUri);
            const blob = await response.blob();

            const storageRef = ref(storage, `avatars/${user.uid}`);
            await uploadBytes(storageRef, blob);

            const downloadUrl = await getDownloadURL(storageRef);
            await updateDoc(doc(db, 'users', user.uid), {
                photoURL: downloadUrl
            });
            showAlert('Success', 'Profile picture updated successfully!');
        } catch (err) {
            console.error(err);
            showAlert('Upload Failed', err.message || 'Something went wrong during upload.');
        } finally {
            setUploading(false);
        }
    };

    // --- Save Edit Profile Changes ---
    const handleSaveProfile = async () => {
        const nameTrimmed = editName.trim();
        if (!nameTrimmed) {
            showAlert('Error', 'Name cannot be empty.');
            return;
        }

        setLoading(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                name: nameTrimmed
            });
            setActiveModal(null);
            showAlert('Success', 'Profile updated successfully!');
        } catch (err) {
            showAlert('Error', 'Failed to update name: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Send Password Reset Email ---
    const handleSendResetEmail = async () => {
        try {
            await sendPasswordResetEmail(auth, profile.email);
            showAlert('Reset Link Sent', 'A secure link to reset your password has been sent to ' + profile.email);
        } catch (err) {
            showAlert('Error', 'Failed to send reset link: ' + err.message);
        }
    };

    // --- Submit Support Message ---
    const handleSendSupport = () => {
        const msg = supportMsg.trim();
        if (!msg) {
            showAlert('Empty Message', 'Please describe your request.');
            return;
        }
        setSupportLoading(true);
        // Simulate ticket submission
        setTimeout(() => {
            setSupportLoading(false);
            setSupportMsg('');
            showAlert('Ticket Submitted', 'Thank you! Our support team will respond to your email within 24 hours.');
        }, 1200);
    };

    const toggleFaq = (index) => {
        setFaqOpen(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const openEditModal = () => {
        setEditName(profile?.name || '');
        setActiveModal('edit');
    };

    if (loading && !profile) return <ActivityIndicator color={COLORS.primary} style={{ flex: 1, marginTop: 100 }} size="large" />;

    return (
        <View style={styles.flexContainer}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Avatar & Name */}
                <View style={styles.avatarSection}>
                    <View style={styles.avatar}>
                        {profile?.photoURL ? (
                            <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>
                                {profile?.name?.charAt(0).toUpperCase() || '?'}
                            </Text>
                        )}
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
                    <View style={role === 'runner' ? [styles.statItem, styles.statDivider] : styles.statItem}>
                        <Text style={styles.statNum}>{taskStats.completed}</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                    </View>
                    {role === 'runner' && (
                        <View style={styles.statItem}>
                            <Text style={styles.statNum}>⭐ {taskStats.avgRating > 0 ? taskStats.avgRating.toFixed(1) : 'N/A'}</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>
                    )}
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
                        { icon: '👤', label: 'Edit Profile', onPress: openEditModal },
                        { icon: '🔒', label: 'Privacy & Security', onPress: () => setActiveModal('privacy') },
                        { icon: '❓', label: 'Help & Support', onPress: () => setActiveModal('support') },
                        { icon: '📄', label: 'Terms & Privacy', onPress: () => setActiveModal('terms') },
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

            {/* --- MODAL OVERLAYS --- */}

            {/* 1. EDIT PROFILE MODAL */}
            <Modal visible={activeModal === 'edit'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody}>
                            {/* Editable Photo Section */}
                            <View style={styles.editPhotoSection}>
                                <TouchableOpacity style={styles.editAvatarWrapper} onPress={handlePickImage} disabled={uploading}>
                                    {profile?.photoURL ? (
                                        <Image source={{ uri: profile.photoURL }} style={styles.editAvatar} />
                                    ) : (
                                        <View style={[styles.editAvatar, styles.editAvatarPlaceholder]}>
                                            <Text style={styles.editAvatarText}>
                                                {profile?.name?.charAt(0).toUpperCase() || '?'}
                                            </Text>
                                        </View>
                                    )}
                                    <View style={styles.cameraIconBadge}>
                                        {uploading ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Ionicons name="camera" size={16} color="#fff" />
                                        )}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
                                    <Text style={styles.changePhotoText}>{uploading ? 'Uploading...' : 'Change Profile Picture'}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Name Input */}
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="Your Name"
                                value={editName}
                                onChangeText={setEditName}
                                placeholderTextColor={COLORS.textMuted}
                            />

                            {/* Email Display (Read-Only) */}
                            <Text style={styles.inputLabel}>Email Address</Text>
                            <View style={styles.readOnlyInput}>
                                <Text style={styles.readOnlyText}>{profile?.email}</Text>
                                <Ionicons name="lock-closed" size={16} color={COLORS.textMuted} style={{ marginLeft: 8 }} />
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
                                <Text style={styles.saveBtnText}>Save Changes</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 2. PRIVACY & SECURITY MODAL */}
            <Modal visible={activeModal === 'privacy'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Privacy & Security</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody}>
                            <Text style={styles.sectionHeader}>🔒 Authentication Settings</Text>
                            <Text style={styles.descText}>
                                Keep your account safe. Click the button below to receive an email link and securely change your login credentials.
                            </Text>

                            <TouchableOpacity style={styles.actionBtn} onPress={handleSendResetEmail}>
                                <Ionicons name="mail-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.actionBtnText}>Send Password Reset Email</Text>
                            </TouchableOpacity>

                            <View style={styles.modalDivider} />

                            <Text style={styles.sectionHeader}>📍 Location Privacy Controls</Text>
                            <Text style={styles.descText}>
                                TaskHub collects and shares your device location only when you are actively delivering a task as a Runner. Once the task status is marked as Completed, all active GPS tracking ends immediately to preserve your privacy and battery.
                            </Text>

                            <View style={styles.privacySettingCard}>
                                <Ionicons name="checkmark-circle" size={22} color={COLORS.success} style={{ marginRight: 10 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.settingTitle}>Task-Only Geolocation</Text>
                                    <Text style={styles.settingDesc}>GPS tracking is isolated exclusively to active, accepted tasks.</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 3. HELP & SUPPORT MODAL */}
            <Modal visible={activeModal === 'support'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Help & Support</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody}>
                            <Text style={styles.sectionHeader}>💡 Frequently Asked Questions</Text>

                            {[
                                {
                                    q: 'How do I earn money as a Runner?',
                                    a: 'When you accept and complete a task, the Task Poster approves the completion, which immediately releases the funds to your account.'
                                },
                                {
                                    q: 'How do I set task locations?',
                                    a: 'In the Task Posting form, proceed to Step 2. Tap anywhere on the map component to drop the task marker pin precisely.'
                                },
                                {
                                    q: 'What if a task is cancelled?',
                                    a: 'Posters may cancel tasks that are still open. Once accepted by a Runner, cancellation requires coordination. If issues arise, contact support below.'
                                }
                            ].map((faq, index) => (
                                <View key={index} style={styles.faqCard}>
                                    <TouchableOpacity style={styles.faqHeader} onPress={() => toggleFaq(index)}>
                                        <Text style={styles.faqQuestion}>{faq.q}</Text>
                                        <Ionicons name={faqOpen[index] ? "chevron-up" : "chevron-down"} size={18} color={COLORS.text} />
                                    </TouchableOpacity>
                                    {faqOpen[index] && (
                                        <Text style={styles.faqAnswer}>{faq.a}</Text>
                                    )}
                                </View>
                            ))}

                            <View style={styles.modalDivider} />

                            <Text style={styles.sectionHeader}>✉️ Submit a Ticket</Text>
                            <Text style={styles.descText}>Need additional support? Send us a description of your issue and our team will respond via email.</Text>

                            <TextInput
                                style={[styles.textInput, { height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                                placeholder="Describe your issue or provide feedback here..."
                                multiline
                                numberOfLines={4}
                                value={supportMsg}
                                onChangeText={setSupportMsg}
                                placeholderTextColor={COLORS.textMuted}
                            />

                            <TouchableOpacity 
                                style={[styles.saveBtn, supportLoading && { opacity: 0.7 }]} 
                                onPress={handleSendSupport}
                                disabled={supportLoading}
                            >
                                {supportLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveBtnText}>Send Message</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* 4. TERMS & PRIVACY MODAL */}
            <Modal visible={activeModal === 'terms'} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Terms & Privacy</Text>
                            <TouchableOpacity onPress={() => setActiveModal(null)}>
                                <Ionicons name="close" size={24} color={COLORS.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.modalBody}>
                            <Text style={styles.sectionHeader}>📋 Terms of Service</Text>
                            <Text style={styles.legalParagraph}>
                                Welcome to TaskHub. This application was built as a pair-programming project by students at BMS. By using our service, you agree to:
                                {'\n\n'}
                                1. Provide honest information regarding task requirements and pricing.
                                {'\n'}
                                2. Honor payment releases once tasks are fully completed to mutual satisfaction.
                                {'\n'}
                                3. Treat other posters and runners with courtesy and respect.
                            </Text>

                            <View style={styles.modalDivider} />

                            <Text style={styles.sectionHeader}>🛡️ Privacy Policy</Text>
                            <Text style={styles.legalParagraph}>
                                We are committed to securing your data. Here is what we collect and store:
                                {'\n\n'}
                                • **Authentication Data**: Emails, user IDs, and password metadata are encrypted and handled safely via Firebase Authentication.
                                {'\n'}
                                • **Profile Details**: Name and avatar URL are visible to posters and runners.
                                {'\n'}
                                • **Geolocation Data**: Real-time position tracking is used strictly to provide ETA tracking and navigation between the runner and the task location.
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    flexContainer: { flex: 1, backgroundColor: COLORS.background },
    container: { flex: 1 },
    content: { padding: 20, paddingTop: 60 },
    avatarSection: { alignItems: 'center', marginBottom: 24 },
    avatar: {
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
        marginBottom: 12, elevation: 4,
        overflow: 'hidden',
    },
    avatarImage: { width: 88, height: 88, borderRadius: 44 },
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

    // Modals styling
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '85%',
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    modalBody: {
        padding: 20,
    },
    editPhotoSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    editAvatarWrapper: {
        position: 'relative',
        marginBottom: 10,
    },
    editAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    editAvatarPlaceholder: {
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editAvatarText: {
        fontSize: 40,
        fontWeight: '800',
        color: '#fff',
    },
    cameraIconBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.primary,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.card,
    },
    changePhotoText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginBottom: 8,
    },
    textInput: {
        backgroundColor: COLORS.background,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: COLORS.text,
        marginBottom: 20,
    },
    readOnlyInput: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    readOnlyText: {
        fontSize: 15,
        color: COLORS.textMuted,
    },
    saveBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 10,
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    sectionHeader: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 10,
        marginTop: 10,
    },
    descText: {
        fontSize: 14,
        color: COLORS.textMuted,
        lineHeight: 20,
        marginBottom: 20,
    },
    actionBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    actionBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
    modalDivider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: 16,
    },
    privacySettingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    settingTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 2,
    },
    settingDesc: {
        fontSize: 12,
        color: COLORS.textMuted,
        lineHeight: 16,
    },
    faqCard: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 12,
        overflow: 'hidden',
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    faqQuestion: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
        marginRight: 10,
    },
    faqAnswer: {
        fontSize: 13,
        color: COLORS.textMuted,
        lineHeight: 18,
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 12,
        backgroundColor: COLORS.card,
    },
    legalParagraph: {
        fontSize: 14,
        color: COLORS.text,
        lineHeight: 22,
        marginBottom: 16,
    }
});
