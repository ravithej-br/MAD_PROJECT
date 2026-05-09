// src/screens/auth/LoginScreen.js
import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import useAuthStore from '../../store/useAuthStore';
import { COLORS } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { setUser, setRole } = useAuthStore();
    const insets = useSafeAreaInsets();

    const handleLogin = async () => {
        if (!email || !password) {
            if (Platform.OS === 'web') window.alert('Please fill in all fields.');
            else Alert.alert('Error', 'Please fill in all fields.');
            return;
        }
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            const snap = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (snap.exists()) {
                setRole(snap.data().role);
                setUser(userCredential.user);
            } else {
                if (Platform.OS === 'web') window.alert('User data not found.');
                else Alert.alert('Error', 'User data not found.');
            }
        } catch (err) {
            if (Platform.OS === 'web') window.alert(err.message);
            else Alert.alert('Login Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            if (Platform.OS === 'web') window.alert('Please enter your email address to reset your password.');
            else Alert.alert('Email Required', 'Please enter your email address to reset your password.');
            return;
        }
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            if (Platform.OS === 'web') window.alert('Password reset email sent! Please check your inbox.');
            else Alert.alert('Success', 'Password reset email sent! Please check your inbox.');
        } catch (err) {
            if (Platform.OS === 'web') window.alert(err.message);
            else Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(insets.bottom, 24) }]} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={styles.logo}>⚡ TASK HUB</Text>
                    <Text style={styles.tagline}>Welcome back! Let's get things done.</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sign In</Text>

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="you@email.com"
                        placeholderTextColor={COLORS.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.inputPassword}
                            placeholder="••••••••"
                            placeholderTextColor={COLORS.textMuted}
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.7 }]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.btnText}>Login →</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                        <Text style={styles.switchText}>
                            Don't have an account? <Text style={styles.switchLink}>Sign Up</Text>
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
    header: { alignItems: 'center', marginBottom: 32 },
    logo: { fontSize: 30, fontWeight: '800', color: COLORS.primary, letterSpacing: 2 },
    tagline: { fontSize: 14, color: COLORS.textMuted, marginTop: 6 },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    cardTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted, marginBottom: 6 },
    input: {
        backgroundColor: COLORS.background,
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: COLORS.text,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 8,
    },
    inputPassword: {
        flex: 1,
        padding: 14,
        fontSize: 15,
        color: COLORS.text,
    },
    eyeBtn: { padding: 14 },
    eyeText: { fontSize: 18 },
    forgotBtn: { alignSelf: 'flex-end', marginBottom: 16 },
    forgotText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
    btn: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 16,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    switchText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 14 },
    switchLink: { color: COLORS.primary, fontWeight: '700' },
});
