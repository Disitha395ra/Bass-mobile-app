import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [technicianProfile, setTechnicianProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);
                // Fetch technician profile from Firestore
                try {
                    const ref = doc(db, 'technicians', firebaseUser.uid);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        setTechnicianProfile({ id: snap.id, ...snap.data() });
                    }
                } catch (e) {
                    console.error('Error fetching technician profile:', e);
                }
            } else {
                setUser(null);
                setTechnicianProfile(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const refreshProfile = async () => {
        if (!user) return;
        const ref = doc(db, 'technicians', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            setTechnicianProfile({ id: snap.id, ...snap.data() });
        }
    };

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider value={{ user, technicianProfile, loading, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
