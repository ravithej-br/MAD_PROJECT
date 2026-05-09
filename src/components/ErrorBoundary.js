// src/components/ErrorBoundary.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS } from '../utils/theme';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('App Crash Log:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.emoji}>⚠️</Text>
                        <Text style={styles.title}>Oops! Something went wrong.</Text>
                        <Text style={styles.desc}>
                            The app encountered an unexpected error. We've logged the details and will fix it soon.
                        </Text>
                        
                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>
                                {this.state.error?.toString()}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.btn} onPress={this.handleReset}>
                            <Text style={styles.btnText}>Try to Restart App</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center' },
    content: { padding: 32, alignItems: 'center' },
    emoji: { fontSize: 64, marginBottom: 16 },
    title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
    desc: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    errorBox: {
        width: '100%', backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12,
        borderWidth: 1, borderColor: '#FECACA', marginBottom: 32,
    },
    errorText: { color: '#EF4444', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    btn: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 14 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default ErrorBoundary;
