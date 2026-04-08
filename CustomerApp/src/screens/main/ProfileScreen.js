import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Alert,
} from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function ProfileScreen() {
    const { user, userProfile, refreshProfile, logout } = useAuth();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setName(userProfile.name || '');
            setPhone(userProfile.phone || '');
        }
    }, [userProfile]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.7 });
        if (!result.canceled) {
            setUploadingImage(true);
            try {
                const response = await fetch(result.assets[0].uri);
                const blob = await response.blob();
                const fileRef = storageRef(storage, `users/${user.uid}/avatar.jpg`);
                await uploadBytes(fileRef, blob);
                const url = await getDownloadURL(fileRef);
                await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
                await refreshProfile();
                Alert.alert('Success', 'Profile photo updated!');
            } catch (e) {
                Alert.alert('Error', e.message);
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { name, phone });
            await refreshProfile();
            Alert.alert('Saved', 'Profile updated successfully!');
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
                    {uploadingImage ? (
                        <ActivityIndicator color="#00b4d8" size="large" />
                    ) : (
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarInitial}>{(userProfile?.name || 'U')[0].toUpperCase()}</Text>
                        </View>
                    )}
                    <View style={styles.cameraBtn}><Text>📷</Text></View>
                </TouchableOpacity>
                <Text style={styles.userName}>{userProfile?.name || 'User'}</Text>
                <Text style={styles.userEmail}>{userProfile?.email || ''}</Text>
            </View>

            <View style={styles.form}>
                <Text style={styles.sectionTitle}>Account Settings</Text>

                <Text style={styles.label}>Full Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor="#556" />

                <Text style={styles.label}>Phone Number</Text>
                <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor="#556" />

                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                    <Text style={styles.logoutText}>Sign Out</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a1628' },
    header: { backgroundColor: '#111d33', paddingTop: 60, paddingBottom: 28, alignItems: 'center' },
    avatarContainer: { position: 'relative', marginBottom: 12 },
    avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#0a1628', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#00b4d8' },
    avatarInitial: { color: '#00b4d8', fontSize: 38, fontWeight: '800' },
    cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#00b4d8', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
    userName: { color: '#fff', fontSize: 22, fontWeight: '800' },
    userEmail: { color: '#8892a4', fontSize: 13, marginTop: 4 },
    form: { padding: 20 },
    sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
    label: { color: '#8892a4', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 14 },
    input: { backgroundColor: '#111d33', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#1e3050' },
    saveButton: { backgroundColor: '#00b4d8', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 28 },
    saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    logoutButton: { borderWidth: 1.5, borderColor: '#ff4444', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
    logoutText: { color: '#ff4444', fontSize: 15, fontWeight: '700' },
});
