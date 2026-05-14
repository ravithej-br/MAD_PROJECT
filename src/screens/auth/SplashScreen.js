// src/screens/auth/SplashScreen.js
import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS, FONTS } from '../../utils/theme';

export default function SplashScreen() {
    const scale = new Animated.Value(0.5);
    const opacity = new Animated.Value(0);

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(scale, {
                toValue: 1,
                duration: 900,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View style={{ transform: [{ scale }], opacity }}>
                <View style={styles.logoBox}>
                    <Text style={styles.logoIcon}>⚡</Text>
                </View>
                <Text style={styles.title}>TASK HUB</Text>
                <Text style={styles.subtitle}>Tasks. Near You. Right Now.</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoBox: {
        width: 100,
        height: 100,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 20,
    },
    logoIcon: {
        fontSize: 52,
    },
    title: {
        fontSize: 38,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.75)',
        textAlign: 'center',
        marginTop: 8,
        letterSpacing: 1,
    },
});
