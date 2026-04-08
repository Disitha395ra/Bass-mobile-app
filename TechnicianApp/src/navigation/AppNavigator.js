import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import JobHistoryScreen from '../screens/main/JobHistoryScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#1a1a2e',
                    borderTopColor: '#2a2a50',
                    borderTopWidth: 1,
                    height: 70,
                    paddingBottom: 12,
                },
                tabBarActiveTintColor: '#6c63ff',
                tabBarInactiveTintColor: '#a0a0b8',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>🏠</Text>, tabBarLabel: 'Home' }}
            />
            <Tab.Screen
                name="JobHistory"
                component={JobHistoryScreen}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>📋</Text>, tabBarLabel: 'History' }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22, color }}>👤</Text>, tabBarLabel: 'Profile' }}
            />
        </Tab.Navigator>
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

export default function AppNavigator() {
    const { user, loading } = useAuth();

    if (loading) return null; // Or a splash screen

    return (
        <NavigationContainer>
            {user ? <MainTabs /> : <AuthStack />}
        </NavigationContainer>
    );
}
