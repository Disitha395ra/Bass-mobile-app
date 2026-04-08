import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter your email and password.');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Navigation is handled automatically by onAuthStateChanged in AuthContext
        } catch (error) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.headerContainer}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.icon}>🔧</Text>
                    </View>
                    <Text style={styles.title}>Technician Portal</Text>
                    <Text style={styles.subtitle}>Manage your services & jobs</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Welcome Back!</Text>

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="your@email.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor="#888"
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholderTextColor="#888"
                    />

                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>or</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity style={styles.registerButton} onPress={() => navigation.navigate('Register')}>
                        <Text style={styles.registerButtonText}>Create New Account</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', padding: 20 },
    headerContainer: { alignItems: 'center', paddingBottom: 32 },
    iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1e1e3a', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#6c63ff' },
    icon: { fontSize: 36 },
    title: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    subtitle: { fontSize: 14, color: '#a0a0b8', marginTop: 6 },
    card: { backgroundColor: '#1a1a2e', borderRadius: 24, padding: 24, shadowColor: '#6c63ff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
    cardTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: '#a0a0b8', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: '#12122a', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a50' },
    button: { backgroundColor: '#6c63ff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a50' },
    dividerText: { color: '#a0a0b8', paddingHorizontal: 12, fontSize: 13 },
    registerButton: { borderWidth: 1.5, borderColor: '#6c63ff', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    registerButtonText: { color: '#6c63ff', fontSize: 15, fontWeight: '700' },
});
