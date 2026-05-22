// src/screens/auth/SignupScreen.js
/**
 * Signup Screen with role selection and shared utilities.
 * Refactored: Uses showAlert utility and better validation handling.
 */
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, ActivityIndicator,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '../../utils/alert';
import { Ionicons } from '@expo/vector-icons';

export default function SignupScreen({ navigation }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [loading, setLoading] = useState(false);
    const { setUser, setRole } = useAuthStore();
    const insets = useSafeAreaInsets();
    const emailInputRef = React.useRef(null);
    const passwordInputRef = React.useRef(null);

    const handleSignup = async () => {
        if (!name.trim() || !email.trim() || !password || !selectedRole) {
            showAlert('Error', 'Please fill all fields and select a role.');
            return;
        }
        setLoading(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            await setDoc(doc(db, 'users', cred.user.uid), {
                uid: cred.user.uid,
                name: name.trim(),
                email: email.trim(),
                role: selectedRole,
                rating: 0,
                totalStars: 0,
                reviewCount: 0,
                tasksCompleted: 0,
                createdAt: serverTimestamp(),
            });
            setRole(selectedRole);
            setUser(cred.user);
        } catch (err) {
            showAlert('Signup Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.flex} 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 80}
        >
            <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.logo}>⚡ TASK HUB</Text>
                    <Text style={styles.tagline}>Join thousands getting things done.</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Create Account</Text>

                    <Text style={styles.label}>Full Name</Text>
                    <TextInput 
                        style={styles.input} 
                        placeholder="John Doe" 
                        placeholderTextColor={COLORS.textMuted} 
                        value={name} 
                        onChangeText={setName} 
                        returnKeyType="next"
                        onSubmitEditing={() => emailInputRef.current?.focus()}
                        blurOnSubmit={false}
                    />

                    <Text style={styles.label}>Email</Text>
                    <TextInput 
                        ref={emailInputRef}
                        style={styles.input} 
                        placeholder="you@email.com" 
                        placeholderTextColor={COLORS.textMuted} 
                        keyboardType="email-address" 
                        autoCapitalize="none" 
                        value={email} 
                        onChangeText={setEmail} 
                        returnKeyType="next"
                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                        blurOnSubmit={false}
                    />

                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            ref={passwordInputRef}
                            style={styles.inputPassword}
                            placeholder="Min. 6 characters"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                            returnKeyType="done"
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                            <Ionicons 
                                name={showPassword ? "eye" : "eye-off"} 
                                size={22} 
                                color={COLORS.textMuted} 
                            />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>I want to...</Text>
                    <View style={styles.roleRow}>
                        <TouchableOpacity
                            style={[styles.roleBtn, selectedRole === 'poster' && styles.roleBtnActive]}
                            onPress={() => setSelectedRole('poster')}
                        >
                            <Text style={styles.roleEmoji}>📋</Text>
                            <Text style={[styles.roleText, selectedRole === 'poster' && styles.roleTextActive]}>Post Tasks</Text>
                            <Text style={styles.roleDesc}>I need help</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.roleBtn, selectedRole === 'runner' && styles.roleBtnActive]}
                            onPress={() => setSelectedRole('runner')}
                        >
                            <Text style={styles.roleEmoji}>🏃</Text>
                            <Text style={[styles.roleText, selectedRole === 'runner' && styles.roleTextActive]}>Run Tasks</Text>
                            <Text style={styles.roleDesc}>I want to earn</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.7 }]}
                        onPress={handleSignup}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Create Account →</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                        <Text style={styles.switchText}>
                            Already have an account? <Text style={styles.switchLink}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1, backgroundColor: COLORS.background },
    container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
    header: { alignItems: 'center', marginBottom: 28 },
    logo: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
    tagline: { fontSize: 14, color: COLORS.textMuted, marginTop: 6 },
    card: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, elevation: 4 },
    cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
    input: {
        backgroundColor: COLORS.background, borderRadius: 12, padding: 14,
        fontSize: 15, color: COLORS.text, marginBottom: 16,
        borderWidth: 1, borderColor: COLORS.border,
    },
    passwordContainer: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
        borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
    },
    inputPassword: {
        flex: 1, padding: 14, fontSize: 15, color: COLORS.text,
    },
    eyeBtn: { padding: 14 },
    eyeText: { fontSize: 18 },
    roleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    roleBtn: {
        flex: 1, borderRadius: 14, padding: 16, alignItems: 'center',
        backgroundColor: COLORS.background, borderWidth: 2, borderColor: COLORS.border,
    },
    roleBtnActive: { borderColor: COLORS.primary, backgroundColor: '#F0F4FF' },
    roleEmoji: { fontSize: 28, marginBottom: 6 },
    roleText: { fontWeight: '700', fontSize: 14, color: COLORS.text },
    roleTextActive: { color: COLORS.primary },
    roleDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    btn: {
        backgroundColor: COLORS.primary, borderRadius: 12,
        padding: 16, alignItems: 'center', marginBottom: 16,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    switchText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 14 },
    switchLink: { color: COLORS.primary, fontWeight: '700' },
});

