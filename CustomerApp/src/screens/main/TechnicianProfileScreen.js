import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, ActivityIndicator, Linking, FlatList,
} from 'react-native';
import {
    addDoc, collection, serverTimestamp,
    query, where, getDocs, onSnapshot, orderBy,
} from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

export default function TechnicianProfileScreen({ route, navigation }) {
    const { technician } = route.params;
    const { user, userProfile } = useAuth();
    const [problem, setProblem] = useState('');
    const [sending, setSending] = useState(false);
    const [reviews, setReviews] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(true);

    // Live reviews feed for this technician
    useEffect(() => {
        const q = query(
            collection(db, 'reviews'),
            where('technicianId', '==', technician.id),
            orderBy('timestamp', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoadingReviews(false);
        });
        return unsub;
    }, [technician.id]);

    // Compute live rating from reviews
    const liveRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
        : (technician.rating || 0);

    const handleCall = () => {
        if (technician.phone) Linking.openURL(`tel:${technician.phone}`);
    };

    const handleSendRequest = async () => {
        if (!problem.trim()) {
            Alert.alert('Empty Request', 'Please describe your problem before sending a request.');
            return;
        }
        setSending(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            let coords = { latitude: 0, longitude: 0 };
            if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            }

            await addDoc(collection(db, 'requests'), {
                userId: user.uid,
                technicianId: technician.id,
                customerName: userProfile?.name || 'Customer',
                customerPhone: userProfile?.phone || '',
                customerLocation: coords,
                problemDescription: problem.trim(),
                status: 'pending',
                reviewed: false,
                reviewRequested: false,
                timestamp: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            Alert.alert(
                '✅ Request Sent!',
                `Your request has been sent to ${technician.name}. You'll be notified when they respond.`,
                [{ text: 'View My Requests', onPress: () => navigation.navigate('MainTabs', { screen: 'MyRequests' }) }]
            );
            setProblem('');
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setSending(false);
        }
    };

    const renderStars = (value, size = 18) => {
        const full = Math.round(value);
        return (
            <Text style={{ fontSize: size }}>
                {'⭐'.repeat(full)}{'☆'.repeat(5 - full)}
            </Text>
        );
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>

                {/* Avatar */}
                <View style={[
                    styles.avatarCircle,
                    { borderColor: technician.availability ? '#00ff88' : '#6b7a99' }
                ]}>
                    <Text style={styles.avatarInitial}>
                        {(technician.name || 'T')[0].toUpperCase()}
                    </Text>
                </View>

                <Text style={styles.name}>{technician.name}</Text>

                <View style={[
                    styles.availPill,
                    technician.availability
                        ? { backgroundColor: '#00ff8820', borderColor: '#00ff88' }
                        : { backgroundColor: '#6b7a9920', borderColor: '#6b7a99' }
                ]}>
                    <Text style={[
                        styles.availPillText,
                        { color: technician.availability ? '#00ff88' : '#6b7a99' }
                    ]}>
                        {technician.availability ? '● Available Now' : '○ Currently Busy'}
                    </Text>
                </View>

                {/* Live rating */}
                <View style={styles.ratingRow}>
                    {renderStars(liveRating)}
                    <Text style={styles.ratingText}>
                        {liveRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                    </Text>
                </View>
            </View>

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
                <StatBox emoji="🏆" label="Experience" value={technician.experience || 'N/A'} />
                <StatBox emoji="💰" label="Pricing" value={technician.pricing || 'Negotiable'} />
                <StatBox
                    emoji="📍"
                    label="Distance"
                    value={technician.distance != null ? `${technician.distance.toFixed(1)} km` : 'Nearby'}
                />
                <StatBox emoji="✅" label="Total Jobs" value={String(technician.totalJobs || 0)} />
            </View>

            {/* Skills */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Services Offered</Text>
                <View style={styles.skillsRow}>
                    {(technician.skills || []).length > 0
                        ? (technician.skills || []).map((s) => (
                            <View key={s} style={styles.skillChip}>
                                <Text style={styles.skillText}>{s}</Text>
                            </View>
                        ))
                        : <Text style={styles.noSkills}>No skills listed</Text>
                    }
                </View>
            </View>

            {/* Send Request */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Send a Job Request</Text>
                <TextInput
                    style={styles.problemInput}
                    placeholder="Describe your problem in detail (e.g. AC not cooling, pipe leaking...)"
                    placeholderTextColor="#3d5080"
                    value={problem}
                    onChangeText={setProblem}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    maxLength={500}
                />
                <Text style={styles.charCount}>{problem.length}/500</Text>
                <TouchableOpacity
                    style={[styles.sendButton, (!problem.trim() || sending) && styles.sendButtonDisabled]}
                    onPress={handleSendRequest}
                    disabled={sending || !problem.trim()}
                >
                    {sending
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.sendButtonText}>📤 Send Request</Text>
                    }
                </TouchableOpacity>
            </View>

            {/* Call */}
            <View style={styles.section}>
                {technician.phone && (
                    <TouchableOpacity style={styles.callButton} onPress={handleCall}>
                        <Text style={styles.callButtonText}>📞 Call {technician.name}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Reviews Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Customer Reviews</Text>

                {loadingReviews ? (
                    <ActivityIndicator color="#7c3aed" style={{ marginVertical: 20 }} />
                ) : reviews.length === 0 ? (
                    <View style={styles.noReviews}>
                        <Text style={styles.noReviewsText}>⭐ Be the first to leave a review!</Text>
                    </View>
                ) : (
                    reviews.map((rev) => (
                        <View key={rev.id} style={styles.reviewCard}>
                            <View style={styles.reviewHeader}>
                                <View style={styles.reviewAvatar}>
                                    <Text style={styles.reviewAvatarText}>
                                        {(rev.customerName || 'C')[0].toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.reviewMeta}>
                                    <Text style={styles.reviewName}>{rev.customerName || 'Customer'}</Text>
                                    <Text style={styles.reviewDate}>
                                        {rev.timestamp?.toDate
                                            ? rev.timestamp.toDate().toLocaleDateString('en-US', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })
                                            : ''}
                                    </Text>
                                </View>
                                <View style={styles.reviewStarBadge}>
                                    <Text style={styles.reviewStarBadgeText}>⭐ {rev.rating}</Text>
                                </View>
                            </View>
                            {rev.comment ? (
                                <Text style={styles.reviewComment}>"{rev.comment}"</Text>
                            ) : null}
                        </View>
                    ))
                )}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

function StatBox({ emoji, label, value }) {
    return (
        <View style={styles.statBox}>
            <Text style={styles.statEmoji}>{emoji}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080f1e' },

    // Header
    header: {
        backgroundColor: '#0d1b35', paddingTop: 58, paddingBottom: 28,
        alignItems: 'center', paddingHorizontal: 24,
        borderBottomWidth: 1, borderBottomColor: '#1a2d50',
    },
    backBtn: { alignSelf: 'flex-start', marginBottom: 20 },
    backText: { color: '#7c3aed', fontSize: 15, fontWeight: '600' },
    avatarCircle: {
        width: 92, height: 92, borderRadius: 46,
        backgroundColor: '#1a2d50', justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, marginBottom: 14,
    },
    avatarInitial: { color: '#fff', fontSize: 38, fontWeight: '800' },
    name: { color: '#fff', fontSize: 24, fontWeight: '800' },
    availPill: {
        marginTop: 10, paddingHorizontal: 16, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1,
    },
    availPillText: { fontSize: 13, fontWeight: '700' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
    ratingText: { color: '#a0b4cc', fontSize: 13 },

    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 12 },
    statBox: {
        flex: 1, minWidth: '44%', backgroundColor: '#0d1b35', borderRadius: 16,
        padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#1a2d50',
    },
    statEmoji: { fontSize: 24, marginBottom: 6 },
    statValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
    statLabel: { color: '#6b7a99', fontSize: 12, marginTop: 3 },

    // Sections
    section: { marginHorizontal: 16, marginBottom: 22 },
    sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 14 },

    // Skills
    skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    skillChip: {
        backgroundColor: '#7c3aed20', paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1, borderColor: '#7c3aed',
    },
    skillText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
    noSkills: { color: '#3d5080', fontSize: 13, fontStyle: 'italic' },

    // Request
    problemInput: {
        backgroundColor: '#0d1b35', borderRadius: 14, padding: 16, color: '#e0eaf7',
        fontSize: 14, borderWidth: 1, borderColor: '#1a2d50', minHeight: 120,
        lineHeight: 21,
    },
    charCount: { color: '#3d5080', fontSize: 11, alignSelf: 'flex-end', marginTop: 4, marginBottom: 12 },
    sendButton: {
        backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    },
    sendButtonDisabled: { backgroundColor: '#1a2d50' },
    sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Call
    callButton: {
        borderRadius: 14, paddingVertical: 15, alignItems: 'center',
        borderWidth: 1.5, borderColor: '#00ff88', backgroundColor: '#00ff8812',
    },
    callButtonText: { color: '#00ff88', fontSize: 15, fontWeight: '700' },

    // Reviews
    noReviews: {
        backgroundColor: '#0d1b35', borderRadius: 14, padding: 24,
        alignItems: 'center', borderWidth: 1, borderColor: '#1a2d50',
    },
    noReviewsText: { color: '#6b7a99', fontSize: 14 },
    reviewCard: {
        backgroundColor: '#0d1b35', borderRadius: 16, padding: 16,
        marginBottom: 10, borderWidth: 1, borderColor: '#1a2d50',
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    reviewAvatar: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: '#7c3aed20',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#7c3aed',
    },
    reviewAvatarText: { color: '#a78bfa', fontSize: 15, fontWeight: '800' },
    reviewMeta: { flex: 1 },
    reviewName: { color: '#fff', fontSize: 13, fontWeight: '700' },
    reviewDate: { color: '#3d5080', fontSize: 11, marginTop: 2 },
    reviewStarBadge: { backgroundColor: '#ffd70015', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
    reviewStarBadgeText: { color: '#ffd700', fontSize: 12, fontWeight: '800' },
    reviewComment: { color: '#a0b4cc', fontSize: 13, fontStyle: 'italic', lineHeight: 20 },
});
