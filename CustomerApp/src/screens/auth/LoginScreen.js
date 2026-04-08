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
                        <Text style={styles.icon}>🏠</Text>
                    </View>
                    <Text style={styles.title}>Bass Services</Text>
                    <Text style={styles.subtitle}>Find trusted professionals near you</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Sign In</Text>

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="your@email.com"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor="#556"
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        placeholderTextColor="#556"
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
    container: { flexGrow: 1, backgroundColor: '#0a1628', justifyContent: 'center', padding: 20 },
    headerContainer: { alignItems: 'center', paddingBottom: 36 },
    iconContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#0d2040', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#00b4d8' },
    icon: { fontSize: 40 },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    subtitle: { fontSize: 14, color: '#8892a4', marginTop: 6, textAlign: 'center' },
    card: { backgroundColor: '#111d33', borderRadius: 24, padding: 24, shadowColor: '#00b4d8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 10 },
    cardTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: '#8892a4', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: '#0a1628', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#1e3050' },
    button: { backgroundColor: '#00b4d8', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#1e3050' },
    dividerText: { color: '#8892a4', paddingHorizontal: 12, fontSize: 13 },
    registerButton: { borderWidth: 1.5, borderColor: '#00b4d8', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    registerButtonText: { color: '#00b4d8', fontSize: 15, fontWeight: '700' },
});
