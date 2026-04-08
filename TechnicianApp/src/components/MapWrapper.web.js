import React from 'react';
import { View, Text } from 'react-native';

export const Marker = (props) => null;

export default function MapView({ style, children, ...props }) {
    return (
        <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a2d50', padding: 20 }]}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>🗺️ Map Disabled</Text>
            <Text style={{ color: '#00b4d8', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                Maps only work on physical iOS/Android devices via the Expo Go app. Web preview is unsupported.
            </Text>
        </View>
    );
}
