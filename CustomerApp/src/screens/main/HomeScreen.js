import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from '../../components/MapWrapper';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const CATEGORIES = [
    { label: 'All', icon: '🔧' },
    { label: 'Electrician', icon: '⚡' },
    { label: 'Plumber', icon: '🚿' },
    { label: 'Carpenter', icon: '🪵' },
    { label: 'Painter', icon: '🎨' },
    { label: 'AC Technician', icon: '❄️' },
    { label: 'Mason', icon: '🧱' },
];

const RADIUS_OPTIONS = [
    { label: 'Any', value: null },
    { label: '5 km', value: 5 },
    { label: '10 km', value: 10 },
    { label: '15 km', value: 15 },
    { label: '20 km', value: 20 },
    { label: '25 km', value: 25 },
];

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HomeScreen({ navigation }) {
    const { userProfile } = useAuth();
    const [technicians, setTechnicians] = useState([]);
    const [userLocation, setUserLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchText, setSearchText] = useState('');
    const [ratingFilter, setRatingFilter] = useState(false);
    const [selectedRadius, setSelectedRadius] = useState(null); // null = Any

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return null;
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            return loc.coords;
        } catch {
            return null;
        }
    };

    const fetchTechnicians = useCallback(async () => {
        try {
            // Get user location (fallback to registered home profile location if GPS fails)
            let loc = await getUserLocation();
            if (!loc && userProfile?.location?.latitude) {
                loc = userProfile.location;
            }
            if (loc) setUserLocation(loc);

            // Fetch ALL technicians – availability filter removed so test accounts appear
            const snap = await getDocs(collection(db, 'technicians'));
            const list = snap.docs.map((d) => {
                const data = d.data();
                const hasLocation =
                    data.location?.latitude != null &&
                    data.location?.longitude != null &&
                    (data.location.latitude !== 0 || data.location.longitude !== 0);

                const dist =
                    loc && hasLocation
                        ? getDistanceKm(
                            loc.latitude,
                            loc.longitude,
                            data.location.latitude,
                            data.location.longitude
                        )
                        : null; // null means unknown – don't filter out

                return { id: d.id, ...data, distance: dist };
            });

            // Sort: available first, then by distance (unknowns go last)
            list.sort((a, b) => {
                if (b.availability !== a.availability) return b.availability ? 1 : -1;
                if (a.distance === null && b.distance === null) return 0;
                if (a.distance === null) return 1;
                if (b.distance === null) return -1;
                return a.distance - b.distance;
            });

            setTechnicians(list);
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchTechnicians(); }, []);

    const filtered = technicians
        .filter((t) =>
            selectedCategory === 'All' ||
            (t.skills || []).some(
                (s) => s.toLowerCase() === selectedCategory.toLowerCase()
            )
        )
        .filter((t) => !ratingFilter || (t.rating || 0) >= 4)
        .filter((t) =>
            selectedRadius === null ||
            (t.distance !== null && t.distance <= selectedRadius)
        )
        .filter((t) =>
            !searchText ||
            t.name?.toLowerCase().includes(searchText.toLowerCase())
        );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>
                        Hello, {userProfile?.name?.split(' ')[0] || 'there'} 👋
                    </Text>
                    <Text style={styles.subtitle}>Find a service professional near you</Text>
                </View>
                <View style={styles.locationBadge}>
                    <Text style={styles.locationText}>
                        {userLocation ? '📍 Live' : '📍 --'}
                    </Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color="#00b4d8" size="large" style={{ marginTop: 60 }} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 32 }}
                    ListHeaderComponent={() => (
                        <>
                            {/* Search bar */}
                            <View style={styles.searchContainer}>
                                <Text style={styles.searchIcon}>🔍</Text>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search by name..."
                                    placeholderTextColor="#556"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                                {searchText.length > 0 && (
                                    <TouchableOpacity onPress={() => setSearchText('')}>
                                        <Text style={{ color: '#8892a4', fontSize: 18, paddingHorizontal: 4 }}>✕</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Category pills */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.categoriesRow}
                            >
                                {CATEGORIES.map((item) => {
                                    const active = selectedCategory === item.label;
                                    return (
                                        <TouchableOpacity
                                            key={item.label}
                                            style={[styles.catChip, active && styles.catChipActive]}
                                            onPress={() => setSelectedCategory(item.label)}
                                            activeOpacity={0.75}
                                        >
                                            <Text style={styles.catIcon}>{item.icon}</Text>
                                            <Text style={[styles.catText, active && styles.catTextActive]}>
                                                {item.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Quick filters row */}
                            <View style={styles.quickFilters}>
                                <TouchableOpacity
                                    style={[styles.quickFilter, ratingFilter && styles.quickFilterActive]}
                                    onPress={() => setRatingFilter(!ratingFilter)}
                                >
                                    <Text style={[styles.quickFilterText, ratingFilter && { color: '#fff' }]}>
                                        ⭐ Top Rated
                                    </Text>
                                </TouchableOpacity>

                                <View style={styles.resultCount}>
                                    <Text style={styles.resultCountText}>
                                        {filtered.length} professional{filtered.length !== 1 ? 's' : ''} found
                                    </Text>
                                </View>
                            </View>

                            {/* Radius filter chips */}
                            <View style={styles.radiusSection}>
                                <Text style={styles.radiusLabel}>📏 Search radius:</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
                                >
                                    {RADIUS_OPTIONS.map((item) => {
                                        const active = selectedRadius === item.value;
                                        return (
                                            <TouchableOpacity
                                                key={String(item.value)}
                                                style={[styles.radiusChip, active && styles.radiusChipActive]}
                                                onPress={() => setSelectedRadius(item.value)}
                                                activeOpacity={0.75}
                                            >
                                                <Text style={[styles.radiusChipText, active && styles.radiusChipTextActive]}>
                                                    {item.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Live Map Display */}
                            {userLocation ? (
                                <View style={styles.mapContainer}>
                                    <MapView
                                        style={styles.map}
                                        region={{
                                            latitude: userLocation.latitude,
                                            longitude: userLocation.longitude,
                                            latitudeDelta: selectedRadius ? (selectedRadius / 55) : 0.3,
                                            longitudeDelta: selectedRadius ? (selectedRadius / 55) : 0.3,
                                        }}
                                        pitchEnabled={false}
                                    >
                                        {/* Customer marker */}
                                        <Marker coordinate={userLocation} title="Your Location" pinColor="#ff4444" />

                                        {/* Radius Circle */}
                                        {selectedRadius && (
                                            <Circle
                                                center={userLocation}
                                                radius={selectedRadius * 1000}
                                                fillColor="rgba(124, 58, 237, 0.15)"
                                                strokeColor="rgba(124, 58, 237, 0.8)"
                                                strokeWidth={2}
                                            />
                                        )}

                                        {/* Technician Markers */}
                                        {filtered.map((item, index) => {
                                            if (!item.location?.latitude) return null;
                                            return (
                                                <Marker
                                                    key={item.id}
                                                    coordinate={item.location}
                                                    title={item.name}
                                                    description={item.pricing || 'Technician'}
                                                >
                                                    <View style={styles.markerWrapper}>
                                                        <View style={styles.markerBadge}>
                                                            <Text style={styles.markerBadgeText}>{index + 1}</Text>
                                                        </View>
                                                        <Text style={styles.markerPointer}>▼</Text>
                                                    </View>
                                                </Marker>
                                            );
                                        })}
                                    </MapView>
                                </View>
                            ) : null}
                        </>
                    )}

                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchTechnicians(); }}
                            tintColor="#00b4d8"
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Text style={styles.emptyEmoji}>🔍</Text>
                            <Text style={styles.emptyText}>No technicians found</Text>
                            <Text style={styles.emptySubtext}>
                                Try selecting a larger search radius or checking "All" categories to find professionals nearby.
                            </Text>
                        </View>
                    }
                    renderItem={({ item, index }) => (
                        <TouchableOpacity
                            style={styles.techCard}
                            onPress={() => navigation.navigate('TechnicianProfile', { technician: item })}
                            activeOpacity={0.85}
                        >
                            {/* Avatar */}
                            <View style={styles.techCardLeft}>
                                <View style={styles.listIndexBadge}>
                                    <Text style={styles.listIndexBadgeText}>{index + 1}</Text>
                                </View>
                                <View style={[
                                    styles.avatarCircle,
                                    { borderColor: item.availability ? '#00ff88' : '#8892a4' }
                                ]}>
                                    <Text style={styles.avatarInitial}>
                                        {(item.name || 'T')[0].toUpperCase()}
                                    </Text>
                                </View>
                                <View style={[
                                    styles.onlineDot,
                                    { backgroundColor: item.availability ? '#00ff88' : '#8892a4' }
                                ]} />
                            </View>

                            {/* Info */}
                            <View style={styles.techInfo}>
                                <View style={styles.techNameRow}>
                                    <Text style={styles.techName}>{item.name || 'Unknown'}</Text>
                                    {item.availability && (
                                        <View style={styles.availableBadge}>
                                            <Text style={styles.availableText}>Available</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.techSkills} numberOfLines={1}>
                                    {(item.skills || []).join(' • ') || 'No skills listed'}
                                </Text>
                                <Text style={styles.techExp}>
                                    🏆 {item.experience || 'Experience N/A'}
                                </Text>
                                {item.pricing && (
                                    <Text style={styles.techPricing}>💰 {item.pricing}</Text>
                                )}
                            </View>

                            {/* Meta */}
                            <View style={styles.techMeta}>
                                <Text style={styles.techRating}>
                                    ⭐ {(item.rating || 0).toFixed(1)}
                                </Text>
                                <Text style={styles.techDistance}>
                                    {item.distance != null
                                        ? `${item.distance.toFixed(1)} km`
                                        : 'Nearby'}
                                </Text>
                                <Text style={styles.techArrow}>›</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080f1e' },

    // Header
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 22, paddingTop: 58, paddingBottom: 20,
        backgroundColor: '#0d1b35',
        borderBottomWidth: 1, borderBottomColor: '#1a2d50',
    },
    greeting: { color: '#fff', fontSize: 21, fontWeight: '800', letterSpacing: 0.2 },
    subtitle: { color: '#6b7a99', fontSize: 13, marginTop: 3 },
    locationBadge: {
        backgroundColor: '#00b4d815', paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, borderWidth: 1, borderColor: '#00b4d8',
    },
    locationText: { color: '#00b4d8', fontSize: 12, fontWeight: '700' },

    // Search
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginVertical: 14,
        backgroundColor: '#0d1b35', borderRadius: 16,
        paddingHorizontal: 16, paddingVertical: 13,
        borderWidth: 1, borderColor: '#1a2d50',
    },
    searchIcon: { fontSize: 16, marginRight: 10 },
    searchInput: { flex: 1, color: '#fff', fontSize: 15 },

    // Categories
    categoriesRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, alignItems: 'center' },
    catChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
        backgroundColor: '#0d1b35', borderWidth: 1, borderColor: '#1a2d50',
    },
    catChipActive: { backgroundColor: '#00b4d8', borderColor: '#00b4d8' },
    catIcon: { fontSize: 15 },
    catText: { color: '#6b7a99', fontSize: 13, fontWeight: '600' },
    catTextActive: { color: '#fff' },

    // Quick filters
    quickFilters: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, marginBottom: 6, gap: 10,
    },
    quickFilter: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: '#0d1b35', borderWidth: 1, borderColor: '#1a2d50',
    },
    quickFilterActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
    quickFilterText: { color: '#6b7a99', fontSize: 12, fontWeight: '600' },
    resultCount: { marginLeft: 'auto' },
    resultCountText: { color: '#3d5080', fontSize: 12 },

    // Empty
    empty: { alignItems: 'center', paddingTop: 20, paddingBottom: 40, paddingHorizontal: 30 },
    emptyEmoji: { fontSize: 52, marginBottom: 16 },
    emptyText: { color: '#fff', fontSize: 17, fontWeight: '700' },
    emptySubtext: { color: '#6b7a99', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 20 },

    // Tech Card
    techCard: {
        backgroundColor: '#0d1b35', borderRadius: 20, padding: 16,
        marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderColor: '#1a2d50',
        shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    techCardLeft: { position: 'relative', marginRight: 14 },
    avatarCircle: {
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: '#1a2d50', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2,
    },
    avatarInitial: { color: '#fff', fontSize: 22, fontWeight: '800' },
    onlineDot: {
        position: 'absolute', bottom: 1, right: 1,
        width: 13, height: 13, borderRadius: 7,
        borderWidth: 2, borderColor: '#0d1b35',
    },
    techInfo: { flex: 1 },
    techNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    techName: { color: '#fff', fontSize: 15, fontWeight: '700' },
    availableBadge: {
        backgroundColor: '#00ff8820', paddingHorizontal: 7, paddingVertical: 2,
        borderRadius: 8, borderWidth: 1, borderColor: '#00ff88',
    },
    availableText: { color: '#00ff88', fontSize: 10, fontWeight: '700' },
    techSkills: { color: '#6b7a99', fontSize: 12, marginTop: 3 },
    techExp: { color: '#8899b4', fontSize: 12, marginTop: 4 },
    techPricing: { color: '#00b4d8', fontSize: 12, marginTop: 2 },
    techMeta: { alignItems: 'flex-end', gap: 4 },
    techRating: { color: '#ffd700', fontSize: 13, fontWeight: '700' },
    techDistance: { color: '#6b7a99', fontSize: 11 },
    techArrow: { color: '#00b4d8', fontSize: 22, fontWeight: '300', marginTop: 2 },

    // Map feature
    mapContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        marginTop: 6,
        height: 240,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#1a2d50'
    },
    map: { width: '100%', height: '100%' },
    markerWrapper: { alignItems: 'center' },
    markerBadge: {
        backgroundColor: '#7c3aed',
        width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#fff'
    },
    markerBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    markerPointer: { color: '#7c3aed', fontSize: 14, marginTop: -6 },

    // Radius styling
    radiusSection: { marginBottom: 12 },
    radiusLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 16, marginBottom: 10 },
    radiusChip: { backgroundColor: '#1a2d50', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24 },
    radiusChipActive: { backgroundColor: '#7c3aed' },
    radiusChipText: { color: '#a0b4cc', fontSize: 13, fontWeight: '600' },
    radiusChipTextActive: { color: '#fff' },

    // Linking map number to card
    listIndexBadge: {
        position: 'absolute', top: -6, left: -6, zIndex: 10,
        backgroundColor: '#7c3aed', width: 22, height: 22, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#0d1b35'
    },
    listIndexBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
