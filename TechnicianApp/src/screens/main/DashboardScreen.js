import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Switch, ActivityIndicator, Alert, Modal, Linking,
} from 'react-native';
import MapView, { Marker } from '../../components/MapWrapper';
import {
    collection, query, where, onSnapshot,
    doc, updateDoc, serverTimestamp, getDoc, runTransaction,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function DashboardScreen() {
    const { technicianProfile, user, refreshProfile } = useAuth();
    const [pendingRequests, setPendingRequests] = useState([]);
    const [acceptedRequests, setAcceptedRequests] = useState([]);
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, earnings: 0 });
    const [available, setAvailable] = useState(false);
    const [locationWatcher, setLocationWatcher] = useState(null);
    const [toggling, setToggling] = useState(false);
    const [completing, setCompleting] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    // Stable ref for accepted requests so the location watcher always has the latest without rebinding
    const acceptedRequestsRef = useRef([]);
    useEffect(() => {
        acceptedRequestsRef.current = acceptedRequests;
    }, [acceptedRequests]);

    useEffect(() => {
        if (technicianProfile) setAvailable(technicianProfile.availability || false);
    }, [technicianProfile]);

    // Real-time listener: pending requests
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'requests'),
            where('technicianId', '==', user.uid),
            where('status', '==', 'pending')
        );
        return onSnapshot(q, (snap) =>
            setPendingRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        );
    }, [user]);

    // Real-time listener: accepted (in-progress) requests
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'requests'),
            where('technicianId', '==', user.uid),
            where('status', '==', 'accepted')
        );
        return onSnapshot(q, (snap) =>
            setAcceptedRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        );
    }, [user]);

    // Stats listener
    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'requests'), where('technicianId', '==', user.uid));
        return onSnapshot(q, (snap) => {
            const all = snap.docs.map((d) => d.data());
            setStats({
                total: all.length,
                completed: all.filter((r) => r.status === 'completed').length,
                pending: all.filter((r) => r.status === 'pending').length,
            });
        });
    }, [user]);

    // Toggle availability + GPS
    const toggleAvailability = async (value) => {
        setToggling(true);
        try {
            const ref = doc(db, 'technicians', user.uid);
            await updateDoc(ref, { availability: value });
            setAvailable(value);

            if (value) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Denied', 'Location permission needed to go online.');
                    await updateDoc(ref, { availability: false });
                    setAvailable(false);
                    return;
                }
                const watcher = await Location.watchPositionAsync(
                    { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
                    async (loc) => {
                        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                        // Update tech profile
                        await updateDoc(ref, { location: coords });
                        // Update live location on all accepted active requests
                        acceptedRequestsRef.current.forEach(async (req) => {
                            try {
                                await updateDoc(doc(db, 'requests', req.id), { technicianLocation: coords });
                            } catch (error) { /* silently fail */ }
                        });
                    }
                );
                setLocationWatcher(watcher);
            } else {
                locationWatcher?.remove();
                setLocationWatcher(null);
            }
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setToggling(false);
        }
    };

    const handleAccept = async (req) => {
        try {
            await updateDoc(doc(db, 'requests', req.id), {
                status: 'accepted',
                updatedAt: serverTimestamp(),
            });
        } catch (e) {
            Alert.alert('Error', e.message);
        }
    };

    const handleReject = async (req) => {
        Alert.alert('Reject Job', 'Are you sure you want to reject this request?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reject', style: 'destructive',
                onPress: async () => {
                    try {
                        await updateDoc(doc(db, 'requests', req.id), {
                            status: 'rejected',
                            updatedAt: serverTimestamp(),
                        });
                    } catch (e) {
                        Alert.alert('Error', e.message);
                    }
                },
            },
        ]);
    };

    // Mark job complete + ask for review
    const handleMarkComplete = (req) => {
        setConfirmModal(req);
    };

    const confirmComplete = async () => {
        if (!confirmModal) return;
        setCompleting(confirmModal.id);
        try {
            await updateDoc(doc(db, 'requests', confirmModal.id), {
                status: 'completed',
                reviewRequested: true,
                completedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            // Increment technician totalJobs
            await updateDoc(doc(db, 'technicians', user.uid), {
                totalJobs: (technicianProfile?.totalJobs || 0) + 1,
            });
            await refreshProfile();
            setConfirmModal(null);
            Alert.alert(
                '✅ Job Completed!',
                'The customer will receive a review request popup shortly. Thank you!'
            );
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setCompleting(null);
        }
    };

    const callCustomer = (phone) => {
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const totalIncoming = pendingRequests.length + acceptedRequests.length;

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Good day,</Text>
                    <Text style={styles.name}>{technicianProfile?.name || 'Technician'} 👋</Text>
                </View>
                <View style={styles.toggleBox}>
                    <Text style={[styles.availText, { color: available ? '#00ff88' : '#6b7a99' }]}>
                        {available ? '● Online' : '○ Offline'}
                    </Text>
                    {toggling
                        ? <ActivityIndicator color="#7c3aed" style={{ marginLeft: 10 }} />
                        : <Switch
                            value={available}
                            onValueChange={toggleAvailability}
                            trackColor={{ false: '#1a2d50', true: '#7c3aed' }}
                            thumbColor={available ? '#fff' : '#6b7a99'}
                        />
                    }
                </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <StatCard icon="🔧" label="Total Jobs" value={stats.total} color="#7c3aed" />
                <StatCard icon="✅" label="Completed" value={stats.completed} color="#00ff88" />
                <StatCard icon="⏳" label="Pending" value={stats.pending} color="#ffd700" />
            </View>

            {/* Rating Banner */}
            <View style={styles.ratingBanner}>
                <View style={styles.ratingLeft}>
                    <Text style={styles.ratingStars}>
                        {'⭐'.repeat(Math.round(technicianProfile?.rating || 0))}
                        {'☆'.repeat(5 - Math.round(technicianProfile?.rating || 0))}
                    </Text>
                    <Text style={styles.ratingNum}>
                        {(technicianProfile?.rating || 0).toFixed(1)} rating
                    </Text>
                </View>
                <Text style={styles.ratingReviews}>
                    {technicianProfile?.totalRatings || 0} reviews
                </Text>
            </View>

            {/* In-Progress Jobs */}
            {acceptedRequests.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>🔵 In Progress</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{acceptedRequests.length}</Text>
                        </View>
                    </View>
                    {acceptedRequests.map((req) => (
                        <View key={req.id} style={[styles.jobCard, styles.jobCardBlue]}>
                            <View style={styles.jobCardHeader}>
                                <View style={styles.customerInfo}>
                                    <View style={styles.customerAvatar}>
                                        <Text style={styles.customerAvatarText}>
                                            {(req.customerName || 'C')[0].toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.customerName}>{req.customerName}</Text>
                                        <Text style={styles.customerPhone}>{req.customerPhone}</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusPill, { backgroundColor: '#00b4d820', borderColor: '#00b4d8' }]}>
                                    <Text style={[styles.statusPillText, { color: '#00b4d8' }]}>IN PROGRESS</Text>
                                </View>
                            </View>

                            <Text style={styles.problemText}>📋 {req.problemDescription}</Text>

                            <Text style={styles.jobDate}>
                                🕐 {req.timestamp?.toDate ? req.timestamp.toDate().toLocaleString() : 'N/A'}
                            </Text>

                            {/* MAP VIEW FOR CUSTOMER LOCATION */}
                            {req.customerLocation?.latitude ? (
                                <View style={styles.mapContainer}>
                                    <View style={styles.mapHeader}>
                                        <Text style={styles.mapHeaderText}>📍 Customer's Location</Text>
                                    </View>
                                    <MapView
                                        style={styles.map}
                                        region={{
                                            latitude: req.customerLocation.latitude,
                                            longitude: req.customerLocation.longitude,
                                            latitudeDelta: 0.015,
                                            longitudeDelta: 0.015,
                                        }}
                                        pitchEnabled={false}
                                    >
                                        <Marker coordinate={req.customerLocation} title="Customer" pinColor="#ff4444" />
                                    </MapView>
                                </View>
                            ) : null}

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.callBtn}
                                    onPress={() => callCustomer(req.customerPhone)}
                                >
                                    <Text style={styles.callBtnText}>📞 Call</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.completeBtn}
                                    onPress={() => handleMarkComplete(req)}
                                    disabled={completing === req.id}
                                >
                                    {completing === req.id
                                        ? <ActivityIndicator color="#fff" size="small" />
                                        : <Text style={styles.completeBtnText}>✅ Mark Complete & Ask Review</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Pending Requests */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>📬 New Requests</Text>
                    {pendingRequests.length > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: '#ffd70022', borderColor: '#ffd700' }]}>
                            <Text style={[styles.countBadgeText, { color: '#ffd700' }]}>{pendingRequests.length}</Text>
                        </View>
                    )}
                </View>

                {pendingRequests.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={styles.emptyTitle}>No pending requests</Text>
                        <Text style={styles.emptySubtitle}>
                            {available ? 'Waiting for customers to find you...' : 'Go online to receive job requests'}
                        </Text>
                    </View>
                ) : (
                    pendingRequests.map((req) => (
                        <View key={req.id} style={[styles.jobCard, styles.jobCardYellow]}>
                            <View style={styles.jobCardHeader}>
                                <View style={styles.customerInfo}>
                                    <View style={[styles.customerAvatar, { backgroundColor: '#ffd70020', borderColor: '#ffd700' }]}>
                                        <Text style={[styles.customerAvatarText, { color: '#ffd700' }]}>
                                            {(req.customerName || 'C')[0].toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.customerName}>{req.customerName}</Text>
                                        <Text style={styles.customerPhone}>{req.customerPhone}</Text>
                                    </View>
                                </View>
                                <View style={[styles.statusPill, { backgroundColor: '#ffd70020', borderColor: '#ffd700' }]}>
                                    <Text style={[styles.statusPillText, { color: '#ffd700' }]}>NEW</Text>
                                </View>
                            </View>

                            <Text style={styles.problemText}>📋 {req.problemDescription}</Text>
                            <Text style={styles.jobDate}>
                                🕐 {req.timestamp?.toDate ? req.timestamp.toDate().toLocaleString() : 'N/A'}
                            </Text>

                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req)}>
                                    <Text style={styles.rejectBtnText}>✗ Decline</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req)}>
                                    <Text style={styles.acceptBtnText}>✓ Accept Job</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            <View style={{ height: 40 }} />

            {/* Confirm Complete Modal */}
            <Modal visible={!!confirmModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalEmoji}>✅</Text>
                        <Text style={styles.modalTitle}>Mark Job as Complete?</Text>
                        <Text style={styles.modalSubtitle}>
                            This will notify the customer to leave a review. The rating will update your profile score.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setConfirmModal(null)}
                                disabled={!!completing}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmBtn}
                                onPress={confirmComplete}
                                disabled={!!completing}
                            >
                                {completing
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={styles.modalConfirmText}>Complete & Ask Review</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

function StatCard({ icon, label, value, color }) {
    return (
        <View style={[styles.statCard, { borderTopColor: color }]}>
            <Text style={styles.statIcon}>{icon}</Text>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080f1e' },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 22, paddingTop: 58, paddingBottom: 20,
        backgroundColor: '#0d1b35',
        borderBottomWidth: 1, borderBottomColor: '#1a2d50',
    },
    greeting: { color: '#6b7a99', fontSize: 13, fontWeight: '600' },
    name: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 2 },
    toggleBox: { alignItems: 'flex-end', gap: 4 },
    availText: { fontSize: 13, fontWeight: '700' },

    // Stats
    statsRow: { flexDirection: 'row', padding: 16, gap: 10 },
    statCard: {
        flex: 1, backgroundColor: '#0d1b35', borderRadius: 16, padding: 14,
        alignItems: 'center', borderTopWidth: 3,
        borderWidth: 1, borderColor: '#1a2d50',
    },
    statIcon: { fontSize: 20, marginBottom: 4 },
    statValue: { fontSize: 26, fontWeight: '800' },
    statLabel: { color: '#6b7a99', fontSize: 11, marginTop: 3, fontWeight: '600' },

    // Rating banner
    ratingBanner: {
        marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0d1b35',
        borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', borderWidth: 1, borderColor: '#1a2d50',
    },
    ratingLeft: { gap: 4 },
    ratingStars: { fontSize: 22 },
    ratingNum: { color: '#fff', fontSize: 16, fontWeight: '800' },
    ratingReviews: { color: '#6b7a99', fontSize: 13 },

    // Sections
    section: { paddingHorizontal: 16, marginBottom: 8 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
    sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
    countBadge: {
        backgroundColor: '#7c3aed20', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
        borderWidth: 1, borderColor: '#7c3aed',
    },
    countBadgeText: { color: '#7c3aed', fontSize: 12, fontWeight: '800' },

    // Job Cards
    jobCard: {
        borderRadius: 20, padding: 18, marginBottom: 14,
        borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    jobCardBlue: { backgroundColor: '#0d1b35', borderColor: '#00b4d830' },
    jobCardYellow: { backgroundColor: '#0d1b35', borderColor: '#ffd70030' },

    jobCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    customerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    customerAvatar: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: '#00b4d820', justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: '#00b4d8',
    },
    customerAvatarText: { color: '#00b4d8', fontSize: 18, fontWeight: '800' },
    customerName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    customerPhone: { color: '#6b7a99', fontSize: 12, marginTop: 2 },

    statusPill: {
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1,
    },
    statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

    problemText: { color: '#a0b4cc', fontSize: 14, lineHeight: 20, marginBottom: 6 },
    jobDate: { color: '#3d5080', fontSize: 12, marginBottom: 14 },

    mapContainer: { borderRadius: 14, overflow: 'hidden', height: 160, marginBottom: 16, borderWidth: 1, borderColor: '#1a2d50' },
    mapHeader: { backgroundColor: '#1a2d50', paddingVertical: 6, alignItems: 'center' },
    mapHeaderText: { color: '#a0b4cc', fontSize: 11, fontWeight: '700' },
    map: { width: '100%', flex: 1 },

    // Action rows
    actionRow: { flexDirection: 'row', gap: 10 },
    callBtn: {
        paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12,
        backgroundColor: '#0d1b35', borderWidth: 1.5, borderColor: '#00b4d8',
    },
    callBtnText: { color: '#00b4d8', fontWeight: '700', fontSize: 13 },
    completeBtn: {
        flex: 1, backgroundColor: '#00c88a', borderRadius: 12,
        paddingVertical: 11, alignItems: 'center',
    },
    completeBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    acceptBtn: {
        flex: 1, backgroundColor: '#7c3aed', borderRadius: 12,
        paddingVertical: 12, alignItems: 'center',
    },
    acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    rejectBtn: {
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
        backgroundColor: '#ff444415', borderWidth: 1.5, borderColor: '#ff4444',
    },
    rejectBtnText: { color: '#ff4444', fontWeight: '700', fontSize: 14 },

    // Empty
    emptyCard: {
        backgroundColor: '#0d1b35', borderRadius: 20, padding: 40,
        alignItems: 'center', borderWidth: 1, borderColor: '#1a2d50',
    },
    emptyEmoji: { fontSize: 44, marginBottom: 12 },
    emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    emptySubtitle: { color: '#6b7a99', fontSize: 13, marginTop: 6, textAlign: 'center' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalCard: {
        backgroundColor: '#0d1b35', borderRadius: 24, padding: 28,
        width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#1a2d50',
    },
    modalEmoji: { fontSize: 52, marginBottom: 14 },
    modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
    modalSubtitle: { color: '#6b7a99', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
    modalCancelBtn: {
        flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
        borderWidth: 1.5, borderColor: '#1a2d50',
    },
    modalCancelText: { color: '#6b7a99', fontWeight: '700', fontSize: 15 },
    modalConfirmBtn: {
        flex: 2, backgroundColor: '#00c88a', borderRadius: 14,
        paddingVertical: 14, alignItems: 'center',
    },
    modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
