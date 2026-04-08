export default {
    "expo": {
        "name": "CustomerApp",
        "slug": "CustomerApp",
        "version": "1.0.0",
        "orientation": "portrait",
        "icon": "./assets/icon.png",
        "userInterfaceStyle": "light",
        "newArchEnabled": true,
        "splash": {
            "image": "./assets/splash-icon.png",
            "resizeMode": "contain",
            "backgroundColor": "#ffffff"
        },
        "ios": {
            "supportsTablet": true,
            "bundleIdentifier": "com.bass.customerapp",
            "config": {
                "googleMapsApiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
            }
        },
        "android": {
            "package": "com.bass.customerapp",
            "adaptiveIcon": {
                "foregroundImage": "./assets/adaptive-icon.png",
                "backgroundColor": "#ffffff"
            },
            "edgeToEdgeEnabled": true,
            "config": {
                "googleMaps": {
                    "apiKey": process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ""
                }
            }
        },
        "web": {
            "favicon": "./assets/favicon.png"
        },
        "plugins": [
            [
                "expo-location",
                {
                    "locationAlwaysAndWhenInUsePermission": "This app uses your location to find nearby technicians."
                }
            ]
        ],
        "extra": {
            "eas": {
                "projectId": "a74a36d4-207f-41e3-913e-f12a77d422de"
            }
        }
    }
};
