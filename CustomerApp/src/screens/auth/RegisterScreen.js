import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import MapView, { Marker } from '../../components/MapWrapper';
import * as Location from 'expo-location';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function RegisterScreen({ navigation }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [address, setAddress] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const [coords, setCoords] = useState(null); // { latitude, longitude }
    const [loading, setLoading] = useState(false);

    // Geocode address string → coordinates
    const handleSearchAddress = async () => {
        if (!address.trim()) {
            Alert.alert('Enter Address', 'Please type your address first.');
            return;
        }
        setGeocoding(true);
        try {
            const results = await Location.geocodeAsync(address.trim());
            if (results && results.length > 0) {
                const { latitude, longitude } = results[0];
                setCoords({ latitude, longitude });
            } else {
                Alert.alert('Not Found', 'Could not find this address. Please try a more specific address.');
            }
        } catch (e) {
            Alert.alert('Error', 'Address lookup failed. Check your internet connection.');
        } finally {
            setGeocoding(false);
        }
    };

    // Use device GPS as location
    const handleUseMyLocation = async () => {
        setGeocoding(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please allow location access.');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            // Reverse geocode to fill address field
            const rev = await Location.reverseGeocodeAsync(loc.coords);
            if (rev && rev[0]) {
                const r = rev[0];
                setAddress([r.name, r.street, r.city, r.region, r.country].filter(Boolean).join(', '));
            }
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setGeocoding(false);
        }
    };

    const handleRegister = async () => {
        if (!name || !email || !phone || !password) {
            Alert.alert('Validation Error', 'Please fill in all required fields.');
            return;
        }
        if (!coords) {
            Alert.alert('Location Required', 'Please set your home location using the address search or GPS button.');
            return;
        }
        setLoading(true);
        try {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', user.uid), {
                uid: user.uid,
                name,
                email,
                phone,
                homeAddress: address,
                location: { latitude: coords.latitude, longitude: coords.longitude },
                photoURL: '',
                fcmToken: '',
                createdAt: serverTimestamp(),
            });
        } catch (error) {
            Alert.alert('Registration Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.headerContainer}>
                    <Text style={styles.emoji}>👤</Text>
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Find services near you</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput style={styles.input} placeholder="Your full name" value={name} onChangeText={setName} placeholderTextColor="#3d5080" />

                    <Text style={styles.label}>Email *</Text>
                    <TextInput style={styles.input} placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#3d5080" />

                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput style={styles.input} placeholder="+94 77 123 4567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#3d5080" />

                    <Text style={styles.label}>Password *</Text>
                    <TextInput style={styles.input} placeholder="Min 6 characters" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#3d5080" />

                    {/* ── Location Section ────────────────────────────── */}
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>📍 Your Home Location</Text>
                    <Text style={styles.locationHint}>
                        This helps customers find you and sets your distance radius base.
                    </Text>

                    <View style={styles.addressRow}>
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="e.g. Colombo 03, Sri Lanka"
                            value={address}
                            onChangeText={setAddress}
                            placeholderTextColor="#3d5080"
                            returnKeyType="search"
                            onSubmitEditing={handleSearchAddress}
                        />
                    </View>

                    <View style={styles.locationBtnRow}>
                        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchAddress} disabled={geocoding}>
                            {geocoding
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={styles.searchBtnText}>🔍 Search</Text>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.gpsBtn} onPress={handleUseMyLocation} disabled={geocoding}>
                            <Text style={styles.gpsBtnText}>📡 Use GPS</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Map preview */}
                    {coords ? (
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                region={{
                                    latitude: coords.latitude,
                                    longitude: coords.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                                scrollEnabled={false}
                                zoomEnabled={false}
                            >
                                <Marker
                                    coordinate={coords}
                                    title="Your Location"
                                    pinColor="#7c3aed"
                                />
                            </MapView>
                            <View style={styles.mapBadge}>
                                <Text style={styles.mapBadgeText}>📍 Location confirmed</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.mapPlaceholder}>
                            <Text style={styles.mapPlaceholderText}>
                                🗺️ Search address or use GPS to pin your location
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.button, (!coords || loading) && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading || !coords}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
                        <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
                    </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: '#080f1e', padding: 20 },
    headerContainer: { alignItems: 'center', paddingTop: 60, paddingBottom: 30 },
    emoji: { fontSize: 48, marginBottom: 12 },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    subtitle: { fontSize: 14, color: '#6b7a99', marginTop: 6 },
    card: { backgroundColor: '#0d1b35', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#1a2d50' },
    sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 6 },
    locationHint: { color: '#6b7a99', fontSize: 12, marginBottom: 12, lineHeight: 18 },
    label: { fontSize: 13, fontWeight: '600', color: '#6b7a99', marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: '#080f1e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#1a2d50' },
    addressRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    locationBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    searchBtn: { flex: 1, backgroundColor: '#7c3aed', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    gpsBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#00b4d8', backgroundColor: '#00b4d815' },
    gpsBtnText: { color: '#00b4d8', fontWeight: '700', fontSize: 13 },
    mapContainer: { borderRadius: 16, overflow: 'hidden', height: 180, marginBottom: 20, position: 'relative' },
    map: { width: '100%', height: '100%' },
    mapBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: '#00c88a', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
    mapBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    mapPlaceholder: { borderRadius: 16, height: 140, backgroundColor: '#080f1e', borderWidth: 1, borderColor: '#1a2d50', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    mapPlaceholderText: { color: '#3d5080', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
    button: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { backgroundColor: '#1a2d50' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    linkRow: { alignItems: 'center', marginTop: 16 },
    linkText: { color: '#6b7a99', fontSize: 14 },
    link: { color: '#7c3aed', fontWeight: '700' },
});
