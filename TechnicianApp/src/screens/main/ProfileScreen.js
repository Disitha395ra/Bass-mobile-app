import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
    Image, ActivityIndicator, Alert,
} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = ['Electrician', 'Plumber', 'Carpenter', 'Painter', 'AC Technician', 'Mason'];

export default function ProfileScreen() {
    const { user, technicianProfile, refreshProfile } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [experience, setExperience] = useState('');
    const [pricing, setPricing] = useState('');
    const [selectedSkills, setSelectedSkills] = useState([]);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (technicianProfile) {
            setName(technicianProfile.name || '');
            setPhone(technicianProfile.phone || '');
            setExperience(technicianProfile.experience || '');
            setPricing(technicianProfile.pricing || '');
            setSelectedSkills(technicianProfile.skills || []);
        }
    }, [technicianProfile]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission required', 'We need camera roll access to update your photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });
        if (!result.canceled) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri) => {
        setUploadingImage(true);
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            const fileRef = storageRef(storage, `technicians/${user.uid}/avatar.jpg`);
            await uploadBytes(fileRef, blob);
            const downloadURL = await getDownloadURL(fileRef);
            await updateDoc(doc(db, 'technicians', user.uid), { photoURL: downloadURL });
            await refreshProfile();
            Alert.alert('Success', 'Profile photo updated!');
        } catch (e) {
            Alert.alert('Upload Failed', e.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'technicians', user.uid), {
                name, phone, experience, pricing, skills: selectedSkills,
            });
            await refreshProfile();
            Alert.alert('Success', 'Profile updated successfully!');
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleSkill = (skill) =>
        setSelectedSkills((prev) =>
            prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
        );

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Avatar */}
            <View style={styles.avatarSection}>
                <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                    {uploadingImage ? (
                        <ActivityIndicator color="#6c63ff" size="large" />
                    ) : technicianProfile?.photoURL ? (
                        <Image source={{ uri: technicianProfile.photoURL }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarInitial}>{(technicianProfile?.name || 'T')[0].toUpperCase()}</Text>
                        </View>
                    )}
                    <View style={styles.cameraIcon}><Text style={{ fontSize: 14 }}>📷</Text></View>
                </TouchableOpacity>
                <Text style={styles.avatarHint}>Tap to change photo</Text>
                <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>⭐ {technicianProfile?.rating?.toFixed(1) || '0.0'}</Text>
                    <Text style={styles.ratingCount}> ({technicianProfile?.totalRatings || 0} reviews)</Text>
                </View>
            </View>

            {/* Form */}
            <View style={styles.form}>
                <Text style={styles.sectionTitle}>Personal Information</Text>

                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#888" placeholder="Your name" />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#888" placeholder="Phone" />

                <Text style={styles.label}>Experience</Text>
                <TextInput style={styles.input} value={experience} onChangeText={setExperience} placeholderTextColor="#888" placeholder="e.g. 3 years" />

                <Text style={styles.label}>Pricing</Text>
                <TextInput style={styles.input} value={pricing} onChangeText={setPricing} placeholderTextColor="#888" placeholder="e.g. Rs. 500/hr" />

                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Skills & Services</Text>
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

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f1a' },
    avatarSection: { alignItems: 'center', paddingTop: 60, paddingBottom: 24, backgroundColor: '#1a1a2e' },
    avatarContainer: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#6c63ff' },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#2a2a50', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#6c63ff' },
    avatarInitial: { color: '#fff', fontSize: 40, fontWeight: '800' },
    cameraIcon: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#6c63ff', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
    avatarHint: { color: '#a0a0b8', fontSize: 12, marginTop: 8 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#12122a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    ratingText: { color: '#ffd700', fontWeight: '800', fontSize: 16 },
    ratingCount: { color: '#a0a0b8', fontSize: 13 },
    form: { padding: 20 },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
    label: { color: '#a0a0b8', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 14 },
    input: { backgroundColor: '#1a1a2e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a50' },
    skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    skillChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#3d3d6b' },
    skillChipSelected: { backgroundColor: '#6c63ff', borderColor: '#6c63ff' },
    skillText: { color: '#a0a0b8', fontSize: 13, fontWeight: '600' },
    skillTextSelected: { color: '#fff' },
    saveButton: { backgroundColor: '#6c63ff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 32, marginBottom: 40 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
