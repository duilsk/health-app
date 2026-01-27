// Import Firebase tools from the web CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// YOUR SPECIFIC CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyD5yaej6ISa71EscDbi7jNTr5HcoyFj9JE",
  authDomain: "dochas-4ca1f.firebaseapp.com",
  projectId: "dochas-4ca1f",
  storageBucket: "dochas-4ca1f.firebasestorage.app",
  messagingSenderId: "495093680025",
  appId: "1:495093680025:web:acbe22eec3504043eaf508"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Automatically sign in so Firestore allows data saving
signInAnonymously(auth).catch(err => console.error("Auth Error:", err));

// --- 1. MANUAL SAVE LOGIC ---
const btnSave = document.getElementById('btnSave');
if (btnSave) {
    btnSave.onclick = async () => {
        const sys = document.getElementById('sys').value;
        const dia = document.getElementById('dia').value;

        if (!sys || !dia) return alert("Please enter both numbers");

        try {
            await addDoc(collection(db, "bp_readings"), {
                systolic: parseInt(sys),
                diastolic: parseInt(dia),
                timestamp: new Date(),
                source: "Manual"
            });
            alert("Reading saved!");
            document.getElementById('sys').value = '';
            document.getElementById('dia').value = '';
        } catch (e) {
            alert("Error saving: " + e.message);
        }
    };
}

// --- 2. HEALTH CONNECT SYNC LOGIC ---
const btnSync = document.getElementById('btnSync');
if (btnSync) {
    btnSync.onclick = async () => {
        try {
            // This part only executes if running inside the Android App
            const { HealthConnect } = Capacitor.Plugins;

            // Step A: Request Permissions
            await HealthConnect.requestPermission({
                read: ['BloodPressure']
            });

            // Step B: Read last 24 hours of data
            const startTime = new Date();
            startTime.setHours(startTime.getHours() - 24);

            const result = await HealthConnect.readRecords({
                type: 'BloodPressure',
                startTime: startTime.toISOString(),
                endTime: new Date().toISOString()
            });

            // Step C: Loop through records and save to Firebase
            if (result.records.length === 0) {
                alert("No new readings found in Health Connect from the last 24 hours.");
                return;
            }

            for (let record of result.records) {
                await addDoc(collection(db, "bp_readings"), {
                    systolic: record.systolic.value,
                    diastolic: record.diastolic.value,
                    timestamp: new Date(record.time),
                    source: "Omron/HealthConnect"
                });
            }
            alert(`Successfully synced ${result.records.length} readings!`);

        } catch (e) {
            console.error(e);
            alert("Sync Error: This button only works when installed as an Android App.");
        }
    };
}

// --- 3. HISTORY DISPLAY LOGIC ---
const readingsList = document.getElementById('readingsList');
if (readingsList) {
    // Listen to the database in real-time
    const q = query(collection(db, "bp_readings"), orderBy("timestamp", "desc"), limit(30));
    
    onSnapshot(q, (snapshot) => {
        readingsList.innerHTML = ''; // Clear list
        if (snapshot.empty) {
            readingsList.innerHTML = '<p>No readings found yet.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            const date = data.timestamp.toDate ? data.timestamp.toDate().toLocaleString() : "Just now";
            
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="font-size: 1.2em; font-weight: bold;">${data.systolic}/${data.diastolic} <span style="font-size: 0.7em; font-weight: normal; color: #666;">mmHg</span></div>
                <div style="font-size: 0.8em; color: #888;">${date}</div>
                <div style="font-size: 0.7em; margin-top: 5px; color: #007bff;">Source: ${data.source}</div>
            `;
            readingsList.appendChild(card);
        });
    });
}