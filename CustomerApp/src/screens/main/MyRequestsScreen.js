import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, Alert, TextInput, Modal, Animated,
} from 'react-native';
import MapView, { Marker } from '../../components/MapWrapper';
import {
    collection, query, where, onSnapshot, orderBy,
    doc, updateDoc, addDoc, serverTimestamp, runTransaction, getDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const STATUS_META = {
    completed: { color: '#00ff88', bg: '#00ff8815', label: 'COMPLETED', icon: '✅' },
    accepted: { color: '#00b4d8', bg: '#00b4d815', label: 'IN PROGRESS', icon: '🔵' },
    pending: { color: '#ffd700', bg: '#ffd70015', label: 'PENDING', icon: '⏳' },
    rejected: { color: '#ff4444', bg: '#ff444415', label: 'DECLINED', icon: '❌' },
};

export default function MyRequestsScreen() {
    const { user } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Review modal state
    const [reviewModal, setReviewModal] = useState(false);
    const [reviewRequest, setReviewRequest] = useState(null);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Real-time listener for this customer's requests
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'requests'),
            where('userId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setRequests(list);
            setLoading(false);
        });
        return unsub;
    }, [user]);

    const filtered = filter === 'all'
        ? requests
        : requests.filter((r) => r.status === filter);

    // Submit review & update technician rating atomically
    const submitReview = async () => {
        if (rating === 0) {
            Alert.alert('Rating required', 'Please select at least 1 star before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            const reqRef = doc(db, 'requests', reviewRequest.id);
            const techRef = doc(db, 'technicians', reviewRequest.technicianId);

            // Add review document
            await addDoc(collection(db, 'reviews'), {
                technicianId: reviewRequest.technicianId,
                userId: user.uid,
                requestId: reviewRequest.id,
                customerName: reviewRequest.customerName || 'Customer',
                rating,
                comment: comment.trim(),
                timestamp: serverTimestamp(),
            });

            // Mark request as reviewed
            await updateDoc(reqRef, { reviewed: true });

            // Atomically update technician's aggregate rating
            await runTransaction(db, async (transaction) => {
                const techSnap = await transaction.get(techRef);
                if (!techSnap.exists()) return;
                const data = techSnap.data();
                const oldTotal = data.totalRatings || 0;
                const oldRating = data.rating || 0;
                const newTotal = oldTotal + 1;
                const newRating = ((oldRating * oldTotal) + rating) / newTotal;
                transaction.update(techRef, {
                    rating: Math.round(newRating * 10) / 10,
                    totalRatings: newTotal,
                });
            });

            setReviewModal(false);
            Alert.alert(
                '🎉 Thank You!',
                'Your review helps others find great technicians. It has been submitted successfully!'
            );
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const dismissReview = () => {
        Alert.alert(
            'Skip Review?',
            'You can always leave a review later from your request history.',
            [
                { text: 'Leave a Review', style: 'cancel' },
                { text: 'Skip for Now', onPress: () => setReviewModal(false) },
            ]
        );
    };

    const openManualReview = (req) => {
        setReviewRequest(req);
        setRating(0);
        setComment('');
        setReviewModal(true);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>My Requests</Text>
                <Text style={styles.count}>{requests.length} total</Text>
            </View>

            {/* Filter tabs */}
            <View style={styles.filterRow}>
                {[
                    { key: 'all', label: 'All' },
                    { key: 'pending', label: '⏳ Pending' },
                    { key: 'accepted', label: '🔵 Active' },
                    { key: 'completed', label: '✅ Done' },
                    { key: 'rejected', label: '❌ Declined' },
                ].map((f) => (
                    <TouchableOpacity
                        key={f.key}
                        style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
                        onPress={() => setFilter(f.key)}
                    >
                        <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator color="#00b4d8" size="large" style={{ marginTop: 60 }} />
            ) : filtered.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={styles.emptyEmoji}>📋</Text>
                    <Text style={styles.emptyText}>No requests found</Text>
                    <Text style={styles.emptySubtext}>
                        {filter === 'all'
                            ? 'Browse technicians and send a job request'
                            : `You have no ${filter} requests`}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
                    renderItem={({ item }) => {
                        const meta = STATUS_META[item.status] || STATUS_META.pending;
                        return (
                            <View style={[styles.card, { borderLeftColor: meta.color }]}>
                                {/* Card Header */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardHeaderLeft}>
                                        <Text style={styles.cardProblem} numberOfLines={2}>
                                            {item.problemDescription}
                                        </Text>
                                        <Text style={styles.cardDate}>
                                            🕐 {item.timestamp?.toDate
                                                ? item.timestamp.toDate().toLocaleDateString('en-US', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })
                                                : 'N/A'}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                                        <Text style={[styles.statusText, { color: meta.color }]}>
                                            {meta.icon} {meta.label}
                                        </Text>
                                    </View>
                                </View>

                                {/* Status-specific content */}
                                {item.status === 'pending' && (
                                    <View style={styles.infoNote}>
                                        <Text style={styles.infoNoteText}>
                                            ⏳ Waiting for the technician to accept your request.
                                        </Text>
                                    </View>
                                )}

                                {item.status === 'accepted' && (
                                    <View>
                                        <View style={[styles.infoNote, { backgroundColor: '#00b4d815', borderColor: '#00b4d830' }]}>
                                            <Text style={[styles.infoNoteText, { color: '#00b4d8' }]}>
                                                🔵 The technician is on their way! Work in progress.
                                            </Text>
                                        </View>
                                        {/* MAP VIEW FOR TECHNICIAN LOCATION */}
                                        {item.technicianLocation?.latitude ? (
                                            <View style={styles.mapContainer}>
                                                <View style={styles.mapHeader}>
                                                    <Text style={styles.mapHeaderText}>📍 Technician's Live Location</Text>
                                                </View>
                                                <MapView
                                                    style={styles.map}
                                                    region={{
                                                        latitude: item.technicianLocation.latitude,
                                                        longitude: item.technicianLocation.longitude,
                                                        latitudeDelta: 0.015,
                                                        longitudeDelta: 0.015,
                                                    }}
                                                    pitchEnabled={false}
                                                >
                                                    <Marker coordinate={item.technicianLocation} title="Technician" pinColor="#00b4d8" />
                                                </MapView>
                                            </View>
                                        ) : null}
                                    </View>
                                )}

                                {item.status === 'completed' && item.reviewed && (
                                    <View style={[styles.infoNote, { backgroundColor: '#00ff8815', borderColor: '#00ff8830' }]}>
                                        <Text style={[styles.infoNoteText, { color: '#00ff88' }]}>
                                            ✅ Job complete. Thanks for your review!
                                        </Text>
                                    </View>
                                )}

                                {item.status === 'rejected' && (
                                    <View style={[styles.infoNote, { backgroundColor: '#ff444415', borderColor: '#ff444430' }]}>
                                        <Text style={[styles.infoNoteText, { color: '#ff6666' }]}>
                                            ❌ The technician was unavailable. Please try another.
                                        </Text>
                                    </View>
                                )}

                                {/* Review button for completed, not yet reviewed */}
                                {item.status === 'completed' && !item.reviewed && (
                                    <TouchableOpacity
                                        style={styles.reviewBtn}
                                        onPress={() => openManualReview(item)}
                                    >
                                        <Text style={styles.reviewBtnIcon}>⭐</Text>
                                        <Text style={styles.reviewBtnText}>Rate This Service</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    }}
                />
            )}

            {/* ===== Review Modal ===== */}
            <Modal visible={reviewModal} transparent animationType="slide" statusBarTranslucent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {/* Handle */}
                        <View style={styles.modalHandle} />

                        <Text style={styles.modalEmoji}>🌟</Text>
                        <Text style={styles.modalTitle}>How was the service?</Text>
                        <Text style={styles.modalSubtitle}>
                            Your honest feedback helps the community choose great technicians.
                        </Text>

                        {/* Star Rating */}
                        <View style={styles.starContainer}>
                            {[1, 2, 3, 4, 5].map((s) => (
                                <TouchableOpacity
                                    key={s}
                                    onPress={() => setRating(s)}
                                    activeOpacity={0.7}
                                    style={styles.starBtn}
                                >
                                    <Text style={[
                                        styles.starText,
                                        s <= (hoveredStar || rating) && styles.starActive
                                    ]}>
                                        {s <= (hoveredStar || rating) ? '⭐' : '☆'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {rating > 0 && (
                            <Text style={styles.ratingLabel}>
                                {['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent 🤩'][rating]}
                            </Text>
                        )}

                        {/* Comment */}
                        <TextInput
                            style={styles.commentInput}
                            placeholder="Share your experience... (optional)"
                            placeholderTextColor="#3d5080"
                            value={comment}
                            onChangeText={setComment}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            maxLength={300}
                        />
                        <Text style={styles.charCount}>{comment.length}/300</Text>

                        {/* Actions */}
                        <TouchableOpacity
                            style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
                            onPress={submitReview}
                            disabled={submitting || rating === 0}
                        >
                            {submitting
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.submitBtnText}>Submit Review</Text>
                            }
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.skipBtn} onPress={dismissReview}>
                            <Text style={styles.skipBtnText}>Skip for Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080f1e' },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 22, paddingTop: 58, paddingBottom: 18,
        backgroundColor: '#0d1b35', borderBottomWidth: 1, borderBottomColor: '#1a2d50',
    },
    title: { color: '#fff', fontSize: 22, fontWeight: '800' },
    count: { color: '#6b7a99', fontSize: 13 },

    // Filter tabs
    filterRow: {
        flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12,
        gap: 6, flexWrap: 'nowrap',
    },
    filterTab: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
        backgroundColor: '#0d1b35', borderWidth: 1, borderColor: '#1a2d50',
    },
    filterTabActive: { backgroundColor: '#00b4d8', borderColor: '#00b4d8' },
    filterText: { color: '#6b7a99', fontSize: 11, fontWeight: '600' },
    filterTextActive: { color: '#fff' },

    // Empty
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyEmoji: { fontSize: 52, marginBottom: 16 },
    emptyText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    emptySubtext: { color: '#6b7a99', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },

    // Request Card
    card: {
        backgroundColor: '#0d1b35', borderRadius: 18, padding: 18,
        marginBottom: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#1a2d50',
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
    cardHeaderLeft: { flex: 1 },
    cardProblem: { color: '#e0eaf7', fontSize: 14, fontWeight: '600', lineHeight: 20 },
    cardDate: { color: '#3d5080', fontSize: 12, marginTop: 4 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

    infoNote: {
        backgroundColor: '#ffd70010', borderRadius: 10, padding: 10,
        marginTop: 6, borderWidth: 1, borderColor: '#ffd70025',
    },
    infoNoteText: { color: '#ffd700', fontSize: 13 },

    // Map feature
    mapContainer: { borderRadius: 14, overflow: 'hidden', height: 160, marginTop: 12, borderWidth: 1, borderColor: '#1a2d50' },
    mapHeader: { backgroundColor: '#1a2d50', paddingVertical: 6, alignItems: 'center' },
    mapHeaderText: { color: '#a0b4cc', fontSize: 11, fontWeight: '700' },
    map: { width: '100%', flex: 1 },

    // Review button
    reviewBtn: {
        marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#7c3aed20', borderRadius: 12, paddingVertical: 13,
        borderWidth: 1.5, borderColor: '#7c3aed',
    },
    reviewBtnIcon: { fontSize: 18 },
    reviewBtnText: { color: '#a78bfa', fontWeight: '700', fontSize: 14 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: '#0d1b35', borderTopLeftRadius: 32, borderTopRightRadius: 32,
        padding: 28, paddingBottom: 40, alignItems: 'center',
        borderTopWidth: 1, borderColor: '#1a2d50',
    },
    modalHandle: {
        width: 40, height: 4, borderRadius: 2, backgroundColor: '#1a2d50', marginBottom: 20,
    },
    modalEmoji: { fontSize: 52, marginBottom: 8 },
    modalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    modalSubtitle: { color: '#6b7a99', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24 },

    // Stars
    starContainer: { flexDirection: 'row', gap: 6, marginBottom: 10 },
    starBtn: { padding: 4 },
    starText: { fontSize: 40, color: '#1a2d50' },
    starActive: { color: '#ffd700' },
    ratingLabel: { color: '#ffd700', fontSize: 15, fontWeight: '700', marginBottom: 18 },

    // Comment
    commentInput: {
        width: '100%', backgroundColor: '#080f1e', borderRadius: 14, padding: 16,
        color: '#e0eaf7', fontSize: 14, borderWidth: 1, borderColor: '#1a2d50',
        minHeight: 100, marginBottom: 4,
    },
    charCount: { color: '#3d5080', fontSize: 11, alignSelf: 'flex-end', marginBottom: 20 },

    submitBtn: {
        width: '100%', backgroundColor: '#7c3aed', borderRadius: 16,
        paddingVertical: 16, alignItems: 'center', marginBottom: 12,
    },
    submitBtnDisabled: { backgroundColor: '#1a2d50' },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    skipBtn: { paddingVertical: 10 },
    skipBtnText: { color: '#3d5080', fontSize: 14, fontWeight: '600' },
});
