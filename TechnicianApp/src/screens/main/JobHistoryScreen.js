import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, ActivityIndicator,
    TouchableOpacity, ScrollView,
} from 'react-native';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const STATUS_META = {
    completed: { color: '#00ff88', bg: '#00ff8815', icon: '✅', label: 'COMPLETED' },
    accepted: { color: '#00b4d8', bg: '#00b4d815', icon: '🔵', label: 'IN PROGRESS' },
    pending: { color: '#ffd700', bg: '#ffd70015', icon: '⏳', label: 'PENDING' },
    rejected: { color: '#ff4444', bg: '#ff444415', icon: '❌', label: 'DECLINED' },
};

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: '⏳ Pending' },
    { key: 'accepted', label: '🔵 Active' },
    { key: 'completed', label: '✅ Completed' },
    { key: 'rejected', label: '❌ Declined' },
];

export default function JobHistoryScreen() {
    const { user, technicianProfile } = useAuth();
    const [jobs, setJobs] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [tab, setTab] = useState('jobs'); // 'jobs' | 'reviews'

    // Jobs listener
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'requests'),
            where('technicianId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );
        return onSnapshot(q, (snap) => {
            setJobs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
    }, [user]);

    // Reviews listener
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'reviews'),
            where('technicianId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );
        return onSnapshot(q, (snap) => {
            setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
    }, [user]);

    const filteredJobs = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter);

    const avgRating = technicianProfile?.rating || 0;
    const totalReviews = technicianProfile?.totalRatings || 0;

    // Star distribution
    const starDist = [5, 4, 3, 2, 1].map((s) => ({
        star: s,
        count: reviews.filter((r) => Math.round(r.rating) === s).length,
        pct: reviews.length > 0
            ? (reviews.filter((r) => Math.round(r.rating) === s).length / reviews.length) * 100
            : 0,
    }));

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>History & Reviews</Text>
                <Text style={styles.subtitle}>{jobs.length} jobs · {totalReviews} reviews</Text>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tabBtn, tab === 'jobs' && styles.tabBtnActive]}
                    onPress={() => setTab('jobs')}
                >
                    <Text style={[styles.tabText, tab === 'jobs' && styles.tabTextActive]}>
                        🔧 Job History
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, tab === 'reviews' && styles.tabBtnActive]}
                    onPress={() => setTab('reviews')}
                >
                    <Text style={[styles.tabText, tab === 'reviews' && styles.tabTextActive]}>
                        ⭐ Reviews
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator color="#7c3aed" size="large" style={{ marginTop: 60 }} />
            ) : tab === 'jobs' ? (
                <>
                    {/* Filter row */}
                    <View style={styles.filterContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filterRow}
                        >
                            {FILTERS.map((f) => (
                                <TouchableOpacity
                                    key={f.key}
                                    style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                                    onPress={() => setFilter(f.key)}
                                >
                                    <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                                        {f.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <FlatList
                        data={filteredJobs}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 }}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text style={styles.emptyEmoji}>📋</Text>
                                <Text style={styles.emptyText}>No jobs found</Text>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const meta = STATUS_META[item.status] || STATUS_META.pending;
                            return (
                                <View style={[styles.jobCard, { borderLeftColor: meta.color }]}>
                                    <View style={styles.jobCardHeader}>
                                        <View style={styles.customerRow}>
                                            <View style={[styles.avatar, { borderColor: meta.color, backgroundColor: meta.bg }]}>
                                                <Text style={[styles.avatarText, { color: meta.color }]}>
                                                    {(item.customerName || 'C')[0].toUpperCase()}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={styles.customerName}>{item.customerName}</Text>
                                                <Text style={styles.customerPhone}>{item.customerPhone}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                                            <Text style={[styles.statusPillText, { color: meta.color }]}>
                                                {meta.icon} {meta.label}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.problemText} numberOfLines={2}>
                                        📋 {item.problemDescription}
                                    </Text>

                                    <View style={styles.jobMeta}>
                                        <Text style={styles.jobDate}>
                                            🕐 {item.timestamp?.toDate
                                                ? item.timestamp.toDate().toLocaleDateString('en-US', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })
                                                : 'N/A'}
                                        </Text>
                                        {item.status === 'completed' && item.reviewed && (
                                            <View style={styles.reviewedTag}>
                                                <Text style={styles.reviewedTagText}>⭐ Reviewed</Text>
                                            </View>
                                        )}
                                        {item.status === 'completed' && !item.reviewed && (
                                            <View style={styles.awaitingTag}>
                                                <Text style={styles.awaitingTagText}>⏳ Awaiting review</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        }}
                    />
                </>
            ) : (
                // Reviews tab
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                    {/* Rating summary card */}
                    <View style={styles.ratingCard}>
                        <View style={styles.ratingCardLeft}>
                            <Text style={styles.bigRating}>{avgRating.toFixed(1)}</Text>
                            <Text style={styles.bigStars}>
                                {'⭐'.repeat(Math.round(avgRating))}
                                {'☆'.repeat(5 - Math.round(avgRating))}
                            </Text>
                            <Text style={styles.totalReviews}>{totalReviews} reviews</Text>
                        </View>
                        <View style={styles.ratingCardRight}>
                            {starDist.map(({ star, count, pct }) => (
                                <View key={star} style={styles.distRow}>
                                    <Text style={styles.distStar}>{star}★</Text>
                                    <View style={styles.distBarBg}>
                                        <View style={[styles.distBarFill, { width: `${pct}%` }]} />
                                    </View>
                                    <Text style={styles.distCount}>{count}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Individual reviews */}
                    {reviews.length === 0 ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyEmoji}>💬</Text>
                            <Text style={styles.emptyText}>No reviews yet</Text>
                            <Text style={styles.emptySubtext}>
                                Complete jobs and ask customers for reviews to build your reputation
                            </Text>
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
                                        <Text style={styles.reviewCustomer}>
                                            {rev.customerName || 'Customer'}
                                        </Text>
                                        <Text style={styles.reviewDate}>
                                            {rev.timestamp?.toDate
                                                ? rev.timestamp.toDate().toLocaleDateString('en-US', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })
                                                : 'N/A'}
                                        </Text>
                                    </View>
                                    <View style={styles.reviewStarBadge}>
                                        <Text style={styles.reviewStarBadgeText}>⭐ {rev.rating}</Text>
                                    </View>
                                </View>
                                <Text style={styles.reviewStarsRow}>
                                    {'⭐'.repeat(Math.round(rev.rating))}
                                    {'☆'.repeat(5 - Math.round(rev.rating))}
                                </Text>
                                {rev.comment ? (
                                    <Text style={styles.reviewComment}>"{rev.comment}"</Text>
                                ) : (
                                    <Text style={styles.noComment}>No written feedback</Text>
                                )}
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080f1e' },

    header: {
        paddingHorizontal: 22, paddingTop: 58, paddingBottom: 18,
        backgroundColor: '#0d1b35', borderBottomWidth: 1, borderBottomColor: '#1a2d50',
    },
    title: { color: '#fff', fontSize: 22, fontWeight: '800' },
    subtitle: { color: '#6b7a99', fontSize: 13, marginTop: 4 },

    // Tabs
    tabRow: {
        flexDirection: 'row', backgroundColor: '#0d1b35',
        paddingHorizontal: 16, paddingBottom: 12, gap: 10,
    },
    tabBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 14,
        backgroundColor: '#080f1e', alignItems: 'center',
        borderWidth: 1, borderColor: '#1a2d50',
    },
    tabBtnActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    tabText: { color: '#6b7a99', fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: '#fff' },

    // Filter chips
    filterContainer: {
        paddingTop: 14,
        paddingBottom: 6,
    },
    filterRow: {
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    filterChip: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 24,
        backgroundColor: '#1a2d5080',
        borderWidth: 1,
        borderColor: '#1a2d50',
    },
    filterChipActive: {
        backgroundColor: '#7c3aed20',
        borderColor: '#7c3aed'
    },
    filterText: {
        color: '#6b7a99',
        fontSize: 13,
        fontWeight: '600'
    },
    filterTextActive: {
        color: '#a78bfa',
        fontWeight: '700'
    },

    // Empty
    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
    emptyEmoji: { fontSize: 48, marginBottom: 14 },
    emptyText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    emptySubtext: { color: '#6b7a99', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },

    // Job cards
    jobCard: {
        backgroundColor: '#0d1b35', borderRadius: 18, padding: 16,
        marginBottom: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: '#1a2d50',
    },
    jobCardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
    },
    customerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
    avatarText: { fontSize: 17, fontWeight: '800' },
    customerName: { color: '#fff', fontSize: 14, fontWeight: '700' },
    customerPhone: { color: '#6b7a99', fontSize: 12, marginTop: 2 },
    statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
    statusPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
    problemText: { color: '#a0b4cc', fontSize: 13, lineHeight: 19, marginBottom: 10 },
    jobMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    jobDate: { color: '#3d5080', fontSize: 11 },
    reviewedTag: { backgroundColor: '#ffd70015', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    reviewedTagText: { color: '#ffd700', fontSize: 10, fontWeight: '700' },
    awaitingTag: { backgroundColor: '#6b7a9915', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    awaitingTagText: { color: '#6b7a99', fontSize: 10, fontWeight: '700' },

    // Rating summary card
    ratingCard: {
        backgroundColor: '#0d1b35', borderRadius: 20, padding: 20, marginBottom: 20,
        flexDirection: 'row', borderWidth: 1, borderColor: '#1a2d50',
    },
    ratingCardLeft: { alignItems: 'center', justifyContent: 'center', paddingRight: 20, borderRightWidth: 1, borderRightColor: '#1a2d50', minWidth: 100 },
    bigRating: { color: '#fff', fontSize: 52, fontWeight: '800', lineHeight: 58 },
    bigStars: { fontSize: 16, marginBottom: 4 },
    totalReviews: { color: '#6b7a99', fontSize: 12 },
    ratingCardRight: { flex: 1, paddingLeft: 16, justifyContent: 'center', gap: 6 },
    distRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    distStar: { color: '#ffd700', fontSize: 11, fontWeight: '700', width: 18 },
    distBarBg: { flex: 1, height: 6, backgroundColor: '#1a2d50', borderRadius: 3, overflow: 'hidden' },
    distBarFill: { height: '100%', backgroundColor: '#ffd700', borderRadius: 3 },
    distCount: { color: '#6b7a99', fontSize: 11, width: 18, textAlign: 'right' },

    // Individual review card
    reviewCard: {
        backgroundColor: '#0d1b35', borderRadius: 18, padding: 18,
        marginBottom: 12, borderWidth: 1, borderColor: '#1a2d50',
    },
    reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
    reviewAvatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#7c3aed20',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#7c3aed',
    },
    reviewAvatarText: { color: '#a78bfa', fontSize: 16, fontWeight: '800' },
    reviewMeta: { flex: 1 },
    reviewCustomer: { color: '#fff', fontSize: 14, fontWeight: '700' },
    reviewDate: { color: '#6b7a99', fontSize: 11, marginTop: 2 },
    reviewStarBadge: { backgroundColor: '#ffd70015', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    reviewStarBadgeText: { color: '#ffd700', fontSize: 13, fontWeight: '800' },
    reviewStarsRow: { fontSize: 18, marginBottom: 10 },
    reviewComment: { color: '#a0b4cc', fontSize: 14, fontStyle: 'italic', lineHeight: 21 },
    noComment: { color: '#3d5080', fontSize: 13, fontStyle: 'italic' },
});
