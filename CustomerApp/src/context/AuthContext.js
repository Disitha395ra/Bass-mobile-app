import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    // Global review pending state — true whenever a completed+reviewRequested+!reviewed request exists
    const [pendingReview, setPendingReview] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                try {
                    const ref = doc(db, 'users', firebaseUser.uid);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        setUserProfile({ id: snap.id, ...snap.data() });
                    }
                } catch (e) {
                    console.error('Error fetching user profile:', e);
                }
            } else {
                setUser(null);
                setUserProfile(null);
                setPendingReview(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // ── Global review request listener ──────────────────────────────────────
    // Runs whenever the user is logged in, regardless of which screen is active.
    // Picks up the FIRST request that is completed + reviewRequested + not reviewed.
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'requests'),
            where('userId', '==', user.uid),
            where('status', '==', 'completed'),
            where('reviewRequested', '==', true),
            where('reviewed', '==', false)
        );
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const first = { id: snap.docs[0].id, ...snap.docs[0].data() };
                setPendingReview(first);
            } else {
                setPendingReview(null);
            }
        });
        return unsub;
    }, [user]);

    const refreshProfile = async () => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() });
        }
    };

    const clearPendingReview = () => setPendingReview(null);

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider
            value={{ user, userProfile, loading, logout, refreshProfile, pendingReview, clearPendingReview }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
