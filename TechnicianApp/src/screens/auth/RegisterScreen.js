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

const CATEGORIES = ['Electrician', 'Plumber', 'Carpenter', 'Painter', 'AC Technician', 'Mason'];

export default function RegisterScreen({ navigation }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [experience, setExperience] = useState('');
    const [pricing, setPricing] = useState('');
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [loading, setLoading] = useState(false);
    const [address, setAddress] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const [coords, setCoords] = useState(null);

    const toggleSkill = (skill) => {
        setSelectedSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
        );
    };

    const handleSearchAddress = async () => {
        if (!address.trim()) { Alert.alert('Enter Address', 'Please type your address first.'); return; }
        setGeocoding(true);
        try {
            const results = await Location.geocodeAsync(address.trim());
            if (results && results.length > 0) {
                setCoords({ latitude: results[0].latitude, longitude: results[0].longitude });
            } else {
                Alert.alert('Not Found', 'Could not find this address. Try a more specific one.');
            }
        } catch (e) {
            Alert.alert('Error', 'Address lookup failed.');
        } finally {
            setGeocoding(false);
        }
    };

    const handleUseMyLocation = async () => {
        setGeocoding(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { Alert.alert('Permission Denied', 'Allow location access first.'); return; }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
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
        if (!name || !email || !phone || !password || selectedSkills.length === 0) {
            Alert.alert('Validation Error', 'Please fill in all required fields and select at least one skill.');
            return;
        }
        if (!coords) {
            Alert.alert('Location Required', 'Please set your base location using address search or GPS.');
            return;
        }
        setLoading(true);
        try {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'technicians', user.uid), {
                uid: user.uid,
                name,
                email,
                phone,
                skills: selectedSkills,
                experience,
                pricing,
                homeAddress: address,
                homeLocation: { latitude: coords.latitude, longitude: coords.longitude },
                photoURL: '',
                availability: false,
                location: { latitude: coords.latitude, longitude: coords.longitude },
                rating: 0,
                totalRatings: 0,
                totalJobs: 0,
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
                    <Text style={styles.title}>Join as Technician</Text>
                    <Text style={styles.subtitle}>Create your professional profile</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput style={styles.input} placeholder="Your full name" value={name} onChangeText={setName} placeholderTextColor="#888" />

                    <Text style={styles.label}>Email *</Text>
                    <TextInput style={styles.input} placeholder="email@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#888" />

                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput style={styles.input} placeholder="+94 77 123 4567" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#888" />

                    <Text style={styles.label}>Password *</Text>
                    <TextInput style={styles.input} placeholder="Min 6 characters" value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor="#888" />

                    <Text style={styles.label}>Experience</Text>
                    <TextInput style={styles.input} placeholder="e.g. 3 years" value={experience} onChangeText={setExperience} placeholderTextColor="#888" />

                    <Text style={styles.label}>Pricing (optional)</Text>
                    <TextInput style={styles.input} placeholder="e.g. Rs. 500/hour" value={pricing} onChangeText={setPricing} placeholderTextColor="#888" />

                    {/* ── Location ── */}
                    <Text style={[styles.label, { marginTop: 24, color: '#fff', fontSize: 14 }]}>📍 Your Base Location *</Text>
                    <Text style={{ color: '#6b7a99', fontSize: 12, marginBottom: 10 }}>Customers near this area will find you first.</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Kandy, Sri Lanka"
                        value={address}
                        onChangeText={setAddress}
                        placeholderTextColor="#3d5080"
                        returnKeyType="search"
                        onSubmitEditing={handleSearchAddress}
                    />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 14 }}>
                        <TouchableOpacity style={styles.searchBtn} onPress={handleSearchAddress} disabled={geocoding}>
                            {geocoding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>🔍 Search</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.gpsBtn} onPress={handleUseMyLocation} disabled={geocoding}>
                            <Text style={styles.gpsBtnText}>📡 Use GPS</Text>
                        </TouchableOpacity>
                    </View>
                    {coords ? (
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                region={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                                scrollEnabled={false} zoomEnabled={false}
                            >
                                <Marker coordinate={coords} title="Your Base Location" pinColor="#6c63ff" />
                            </MapView>
                            <View style={styles.mapBadge}><Text style={styles.mapBadgeText}>📍 Location set</Text></View>
                        </View>
                    ) : (
                        <View style={styles.mapPlaceholder}>
                            <Text style={styles.mapPlaceholderText}>🗺️ Search address or use GPS to pin your location</Text>
                        </View>
                    )}

                    <Text style={styles.label}>Skills / Categories *</Text>
                    <View style={styles.skillsGrid}>
                        {CATEGORIES.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.skillChip, selectedSkills.includes(cat) && styles.skillChipSelected]}
                                onPress={() => toggleSkill(cat)}
                            >
                                <Text style={[styles.skillText, selectedSkills.includes(cat) && styles.skillTextSelected]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={[styles.button, (!coords || loading) && styles.buttonDisabled]} onPress={handleRegister} disabled={loading || !coords}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Account</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
                        <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign In</Text></Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: '#080f1e', padding: 20 },
    headerContainer: { alignItems: 'center', paddingTop: 50, paddingBottom: 24 },
    title: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    subtitle: { fontSize: 14, color: '#6b7a99', marginTop: 6 },
    card: { backgroundColor: '#0d1b35', borderRadius: 24, padding: 22, borderWidth: 1, borderColor: '#1a2d50' },
    label: { fontSize: 13, fontWeight: '600', color: '#6b7a99', marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: '#080f1e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#1a2d50' },
    skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    skillChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#1a2d50' },
    skillChipSelected: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    skillText: { color: '#6b7a99', fontSize: 13, fontWeight: '600' },
    skillTextSelected: { color: '#fff' },
    button: { backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
    buttonDisabled: { backgroundColor: '#1a2d50' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    linkRow: { alignItems: 'center', marginTop: 16 },
    linkText: { color: '#6b7a99', fontSize: 14 },
    link: { color: '#7c3aed', fontWeight: '700' },
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
});
