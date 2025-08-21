require('dotenv').config(); // Load environment variables from .env

const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
// Use process.env.PORT provided by Render, or default to 3000
const port = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
let serviceAccount;
let firebaseProjectId;

// Check if GOOGLE_APPLICATION_CREDENTIALS_JSON is set (preferred for Render)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
        // Parse the JSON string from the environment variable
        serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        firebaseProjectId = serviceAccount.project_id;
        console.log('Firebase service account loaded from GOOGLE_APPLICATION_CREDENTIALS_JSON.');
    } catch (error) {
        console.error('Error parsing GOOGLE_APPLICATION_CREDENTIALS_JSON:', error.message);
        process.exit(1); // Exit if JSON is invalid
    }
} else {
    // Fallback to loading from file path if environment variable is not set
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH;
    if (!serviceAccountPath) {
        console.error('Error: FIREBASE_SERVICE_ACCOUNT_KEY_PATH or GOOGLE_APPLICATION_CREDENTIALS_JSON is not set in .env file or environment.');
        process.exit(1); // Exit if no path is provided
    }

    try {
        // Load service account key data from the path specified in .env
        serviceAccount = require(serviceAccountPath);
        firebaseProjectId = serviceAccount.project_id;
        console.log(`Firebase service account loaded from file: ${serviceAccountPath}`);
    } catch (error) {
        console.error(`Error loading service account key from ${serviceAccountPath}:`, error.message);
        console.error('Please ensure the path in your .env file is correct and the file exists.');
        process.exit(1); // Exit if file cannot be loaded
    }
}

// Ensure project_id is found
if (!firebaseProjectId) {
    console.error('Error: Could not find project_id in the service account key data.');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Use the Project ID retrieved from serviceAccount to set databaseURL
    databaseURL: `https://${firebaseProjectId}.firebaseio.com`
});

// Get a reference to the database service
const database = admin.database();

// Middleware
// Allow access from all origins (*) for testing. For production, restrict origins
app.use(cors({ origin: '*' }));
app.use(express.json()); // For receiving JSON body in requests

// ===============================================
// API Endpoint for Login
// ===============================================
const MOCK_USERS = {
    "user1": "pass1" // Username: user1, Password: pass1
};

// Define which user owns which locker
const MOCK_USER_LOCKER_MAPPING = {
    "user1": "LOCKER001" // user1 owns LOCKER001
};

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (MOCK_USERS[username] && MOCK_USERS[username] === password) {
        const lockerId = MOCK_USER_LOCKER_MAPPING[username];
        if (lockerId) {
            return res.status(200).json({ message: 'Login successful', username: username, lockerId: lockerId });
        } else {
            return res.status(403).json({ message: 'No locker assigned to this user.' });
        }
    } else {
        return res.status(401).json({ message: 'Invalid credentials' });
    }
});

// ===============================================
// New API Endpoint for Clearing Notifications
// ===============================================
app.post('/clear-notifications', async (req, res) => {
    const { lockerId } = req.body;
    
    // Check if lockerId is provided
    if (!lockerId) {
        return res.status(400).json({ error: 'Locker ID is required.' });
    }
    
    // Reference the path of notifications in Firebase
    const notificationsRef = database.ref(`lockers/${lockerId}/notifications`);
    
    try {
        // Use .remove() to delete all data at the specified path
        await notificationsRef.remove();
        console.log(`Notifications for locker ${lockerId} cleared.`);
        res.status(200).json({ message: 'Notifications cleared successfully.' });
    } catch (error) {
        console.error(`Error clearing notifications for locker ${lockerId}:`, error);
        res.status(500).json({ error: 'Failed to clear notifications.', details: error.message });
    }
});

// ===============================================
// Start the server
// ===============================================
app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
    // Display the Project ID retrieved directly from serviceAccount
    console.log(`Firebase Project ID: ${firebaseProjectId}`);
});
