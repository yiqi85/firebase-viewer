// Firebase Configuration Template
// Replace with your actual Firebase project configuration
// You can find this in Firebase Console -> Project Settings -> Your apps

const firebaseConfigTemplate = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Example database structure for testing:
// Devices/
//   ├── ANGSTROM_ID_1/
//   │   └── historical_data/
//   │       └── 2024/
//   │           └── 05/
//   │               └── 30/
//   │                   ├── 08:00/
//   │                   │   ├── data01: 45.2
//   │                   │   ├── data02: 56.8
//   │                   │   ├── data03: 67.3
//   │                   │   ├── data04: 78.1
//   │                   │   ├── data05: 89.5
//   │                   │   ├── data06: 34.2
//   │                   │   ├── data07: 45.6
//   │                   │   ├── data08: 56.7
//   │                   │   ├── data09: 67.8
//   │                   │   └── data10: 78.9
//   │                   ├── 09:00/
//   │                   │   └── (similar structure)
//   │                   └── ... (more hours)
