import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    Text, View, Modal, StyleSheet, TouchableOpacity,
    TextInput, ActivityIndicator, Alert,
} from 'react-native';
import {
    addDoc, collection, serverTimestamp, updateDoc, doc, runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import HomeScreen from '../screens/main/HomeScreen';
import MyRequestsScreen from '../screens/main/MyRequestsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import TechnicianProfileScreen from '../screens/main/TechnicianProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#0d1b35',
                    borderTopColor: '#1a2d50',
                    borderTopWidth: 1,
                    height: 70,
                    paddingBottom: 12,
                },
                tabBarActiveTintColor: '#7c3aed',
                tabBarInactiveTintColor: '#6b7a99',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🔍</Text>,
                    tabBarLabel: 'Find',
                }}
            />
            <Tab.Screen
                name="MyRequests"
                component={MyRequestsScreen}
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📋</Text>,
                    tabBarLabel: 'Requests',
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>,
                    tabBarLabel: 'Profile',
                }}
            />
        </Tab.Navigator>
    );
}

function MainStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="TechnicianProfile" component={TechnicianProfileScreen} />
        </Stack.Navigator>
    );
}

function AuthStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
    );
}

// ─── Global Review Modal ────────────────────────────────────────────────────
// Rendered at the top level so it appears over ANY screen when a review is pending
function GlobalReviewModal() {
    const { user, pendingReview, clearPendingReview } = useAuth();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!pendingReview) return null;

    const ratingLabels = ['', 'Poor 😞', 'Fair 😐', 'Good 🙂', 'Great 😊', 'Excellent 🤩'];

    const handleSubmit = async () => {
        if (rating === 0) {
            Alert.alert('Rating required', 'Please tap a star to rate the service.');
            return;
        }
        setSubmitting(true);
        try {
            // 1. Save review document
            await addDoc(collection(db, 'reviews'), {
                technicianId: pendingReview.technicianId,
                userId: user.uid,
                requestId: pendingReview.id,
                customerName: pendingReview.customerName || 'Customer',
                rating,
                comment: comment.trim(),
                timestamp: serverTimestamp(),
            });

            // 2. Mark request as reviewed (clears the listener trigger)
            await updateDoc(doc(db, 'requests', pendingReview.id), { reviewed: true });

            // 3. Atomically update technician's aggregate rating
            const techRef = doc(db, 'technicians', pendingReview.technicianId);
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

            clearPendingReview();
            setRating(0);
            setComment('');
            Alert.alert('🎉 Thank You!', 'Your review helps others choose great technicians!');
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleSkip = () => {
        Alert.alert(
            'Skip Review?',
            'You can rate this service later from the "Requests" tab.',
            [
                { text: 'Leave a Review', style: 'cancel' },
                {
                    text: 'Skip for Now',
                    onPress: () => clearPendingReview(),
                },
            ]
        );
    };

    return (
        <Modal visible transparent animationType="slide" statusBarTranslucent>
            <View style={modalStyles.overlay}>
                <View style={modalStyles.card}>
                    {/* Handle */}
                    <View style={modalStyles.handle} />

                    <Text style={modalStyles.emoji}>🌟</Text>
                    <Text style={modalStyles.title}>How was the service?</Text>
                    <Text style={modalStyles.subtitle}>
                        Your technician has marked the job complete and is requesting your feedback.
                    </Text>

                    {/* Stars */}
                    <View style={modalStyles.starsRow}>
                        {[1, 2, 3, 4, 5].map((s) => (
                            <TouchableOpacity
                                key={s}
                                onPress={() => setRating(s)}
                                style={modalStyles.starBtn}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    modalStyles.starText,
                                    s <= rating && modalStyles.starActive,
                                ]}>
                                    {s <= rating ? '⭐' : '☆'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {rating > 0 && (
                        <Text style={modalStyles.ratingLabel}>{ratingLabels[rating]}</Text>
                    )}

                    {/* Comment */}
                    <TextInput
                        style={modalStyles.input}
                        placeholder="Share your experience... (optional)"
                        placeholderTextColor="#3d5080"
                        value={comment}
                        onChangeText={setComment}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                        maxLength={300}
                    />
                    <Text style={modalStyles.charCount}>{comment.length}/300</Text>

                    {/* Buttons */}
                    <TouchableOpacity
                        style={[
                            modalStyles.submitBtn,
                            rating === 0 && modalStyles.submitBtnDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={submitting || rating === 0}
                    >
                        {submitting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={modalStyles.submitText}>Submit Review</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSkip} style={modalStyles.skipBtn}>
                        <Text style={modalStyles.skipText}>Skip for Now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// ─── Root Navigator ─────────────────────────────────────────────────────────
export default function AppNavigator() {
    const { user, loading } = useAuth();
    if (loading) return null;
    return (
        <NavigationContainer>
            {user ? <MainStack /> : <AuthStack />}
            {/* Global review modal – always rendered, shows when pendingReview != null */}
            {user && <GlobalReviewModal />}
        </NavigationContainer>
    );
}

// ─── Modal Styles ────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: '#000000cc',
        justifyContent: 'flex-end',
    },
    card: {
        backgroundColor: '#0d1b35',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 28,
        paddingBottom: 44,
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: '#1a2d50',
    },
    handle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: '#1a2d50', marginBottom: 22,
    },
    emoji: { fontSize: 52, marginBottom: 10 },
    title: {
        color: '#fff', fontSize: 22, fontWeight: '800',
        marginBottom: 8, textAlign: 'center',
    },
    subtitle: {
        color: '#6b7a99', fontSize: 13, textAlign: 'center',
        lineHeight: 20, marginBottom: 24,
    },
    starsRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
    starBtn: { padding: 4 },
    starText: { fontSize: 42, color: '#1a2d50' },
    starActive: { color: '#ffd700' },
    ratingLabel: {
        color: '#ffd700', fontSize: 15, fontWeight: '700', marginBottom: 18,
    },
    input: {
        width: '100%', backgroundColor: '#080f1e',
        borderRadius: 14, padding: 16,
        color: '#e0eaf7', fontSize: 14,
        borderWidth: 1, borderColor: '#1a2d50',
        minHeight: 90, marginBottom: 4,
    },
    charCount: {
        color: '#3d5080', fontSize: 11,
        alignSelf: 'flex-end', marginBottom: 20,
    },
    submitBtn: {
        width: '100%', backgroundColor: '#7c3aed',
        borderRadius: 16, paddingVertical: 16, alignItems: 'center',
        marginBottom: 12,
    },
    submitBtnDisabled: { backgroundColor: '#1a2d50' },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    skipBtn: { paddingVertical: 10 },
    skipText: { color: '#3d5080', fontSize: 14, fontWeight: '600' },
});
