
/**
 * Disable developer tools shortcuts and copying on the webpage.
 */
document.addEventListener("keydown", function (e) {
    // Disable F12, Ctrl+Shift+I/J/C/U, Ctrl+U, Ctrl+S, Ctrl+Shift+K, Ctrl+Shift+J, Cmd+Opt+I (Mac)
    if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && e.key.toUpperCase() === "U") ||
        (e.ctrlKey && e.key.toUpperCase() === "S") ||
        (e.metaKey && e.altKey && e.key.toUpperCase() === "I") // Mac: Cmd+Opt+I
    ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
});

// Disable right-click context menu
document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    return false;
});

// Disable copy, cut, and paste
["copy", "cut", "paste"].forEach(evt =>
    document.addEventListener(evt, function (e) {
        e.preventDefault();
        return false;
    })
);

// Disable text selection
document.addEventListener("selectstart", function (e) {
    e.preventDefault();
    return false;
});


// ================ Firebase Initialization ================
const firebaseConfig = {
    // IMPORTANT: Replace these with your actual Firebase config values
    apiKey: "AIzaSyBvSzghb4ptPJqYPgndg01oR4O8lZK3mLc",
    authDomain: "to-do-d9600.firebaseapp.com",
    projectId: "to-do-d9600",
    storageBucket: "to-do-d9600.appspot.com",
    messagingSenderId: "33870422419",
    appId: "1:1234567890:web:321abc456def7890"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence with multi-tab support
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn("Multiple tabs open, persistence only works in one tab at a time.");
    } else if (err.code === 'unimplemented') {
        console.warn("The current browser doesn't support offline persistence.");
    } else {
        console.error("Firestore offline persistence error:", err);
    }
});

// ================ Global Variables ================
let currentUser = null;
let meetings = [];

// ================ Authentication Functions ================
function initAuth() {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            console.log("User signed in:", user.email);
            document.getElementById("userEmail").textContent = user.displayName || user.email;
            document.getElementById("authSection").style.display = "none";
            document.getElementById("appSection").style.display = "block";
            loadMeetings();
        } else {
            currentUser = null;
            console.log("User signed out");
            document.getElementById("authSection").style.display = "block";
            document.getElementById("appSection").style.display = "none";
        }
    });
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(handleAuthError);
}

function signOut() {
    auth.signOut().catch(handleAuthError);
}

function handleAuthError(error) {
    let errorMessage = "Authentication failed.";

    switch (error.code) {
        case "auth/popup-closed-by-user":
            errorMessage = "Sign-in popup was closed.";
            break;
        case "auth/network-request-failed":
            errorMessage = "Network error. Check your connection.";
            break;
        default:
            errorMessage = error.message;
    }

    console.error("Auth Error:", error);
    showAlert(errorMessage, "error");
}

// ================ Firestore Database Functions ================
function loadMeetings() {
    if (!currentUser) return;

    // Simple query without ordering to avoid index requirements
    db.collection("meetings")
        .where("userId", "==", currentUser.uid)
        .onSnapshot(
            (snapshot) => {
                meetings = [];
                snapshot.forEach((doc) => {
                    meetings.push({ id: doc.id, ...doc.data() });
                });

                // Sort meetings in JavaScript instead of Firestore
                meetings.sort((a, b) => {
                    const dateA = new Date(a.date + ' ' + a.time);
                    const dateB = new Date(b.date + ' ' + b.time);
                    return dateA - dateB;
                });

                renderMeetings();
            },
            (error) => {
                handleFirestoreError(error);
            }
        );
}

function saveMeeting(meetingData) {
    if (!currentUser) return;

    try {
        validateMeeting(meetingData);

        const meeting = {
            ...meetingData,
            userId: currentUser.uid,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
        };

        if (meeting.id) {
            // Update existing meeting
            db.collection("meetings")
                .doc(meeting.id)
                .update(meeting)
                .then(() => showAlert("Meeting updated successfully!", "success"))
                .catch(handleFirestoreError);
        } else {
            // Add new meeting
            db.collection("meetings")
                .add(meeting)
                .then(() => showAlert("Meeting added successfully!", "success"))
                .catch(handleFirestoreError);
        }

        closeModal();
    } catch (error) {
        showAlert(error.message, "error");
    }
}

function deleteMeeting(meetingId) {
    if (!confirm("Are you sure you want to delete this meeting?")) return;

    db.collection("meetings")
        .doc(meetingId)
        .delete()
        .then(() => showAlert("Meeting deleted successfully!", "success"))
        .catch(handleFirestoreError);
}

function handleFirestoreError(error) {
    let errorMessage = "Database operation failed.";

    switch (error.code) {
        case "permission-denied":
            errorMessage = "You don't have permission to perform this action.";
            break;
        case "unavailable":
            errorMessage = "You're offline. Changes will sync when you reconnect.";
            break;
        default:
            errorMessage = error.message;
    }

    console.error("Firestore Error:", error);
    showAlert(errorMessage, "error");
}

// ================ Meeting Validation ================
function validateMeeting(meeting) {
    if (!meeting.title || meeting.title.trim().length < 3) {
        throw new Error("Meeting title must be at least 3 characters.");
    }

    if (!meeting.date || isNaN(new Date(meeting.date).getTime())) {
        throw new Error("Invalid meeting date.");
    }

    if (!meeting.time || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(meeting.time)) {
        throw new Error("Invalid meeting time (use HH:MM format).");
    }

    if (!meeting.duration || meeting.duration < 15 || meeting.duration > 240) {
        throw new Error("Duration must be between 15 and 240 minutes.");
    }
}

// ================ UI Rendering Functions ================
function renderMeetings() {
    const meetingsContainer = document.getElementById("meetingsContainer");
    meetingsContainer.innerHTML = "";

    if (meetings.length === 0) {
        meetingsContainer.innerHTML = `<div class="empty-state">No meetings scheduled</div>`;
        return;
    }

    meetings.forEach((meeting) => {
        const meetingElement = document.createElement("div");
        meetingElement.className = "meeting-card";
        meetingElement.innerHTML = `
                    <h3>${meeting.title}</h3>
                    <p><i class="fas fa-calendar-day"></i> ${formatDate(meeting.date)}</p>
                    <p><i class="fas fa-clock"></i> ${meeting.time} (${meeting.duration} mins)</p>
                    <div class="meeting-actions">
                        <button class="btn-edit" data-id="${meeting.id}">Edit</button>
                        <button class="btn-delete" data-id="${meeting.id}">Delete</button>
                    </div>
                `;
        meetingsContainer.appendChild(meetingElement);
    });

    // Add event listeners to action buttons
    document.querySelectorAll(".btn-edit").forEach(btn => {
        btn.addEventListener("click", (e) => openEditModal(e.target.dataset.id));
    });

    document.querySelectorAll(".btn-delete").forEach(btn => {
        btn.addEventListener("click", (e) => deleteMeeting(e.target.dataset.id));
    });
}

// ================ Modal Functions ================
function openAddModal() {
    document.getElementById("modalTitle").textContent = "Add New Meeting";
    document.getElementById("meetingForm").reset();
    document.getElementById("meetingId").value = "";
    document.getElementById("deleteMeetingBtn").style.display = "none";
    document.getElementById("meetingModal").style.display = "block";
}

function openEditModal(meetingId) {
    const meeting = meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    document.getElementById("modalTitle").textContent = "Edit Meeting";
    document.getElementById("meetingId").value = meeting.id;
    document.getElementById("meetingTitle").value = meeting.title;
    document.getElementById("meetingDate").value = meeting.date;
    document.getElementById("meetingTime").value = meeting.time;
    document.getElementById("meetingDuration").value = meeting.duration;
    document.getElementById("deleteMeetingBtn").style.display = "block";
    document.getElementById("meetingModal").style.display = "block";
}

function closeModal() {
    document.getElementById("meetingModal").style.display = "none";
}

// ================ Utility Functions ================
function formatDate(dateString) {
    const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function showAlert(message, type) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.classList.add("fade-out");
        setTimeout(() => alertDiv.remove(), 500);
    }, 3000);
}

// ================ Event Listeners ================
document.addEventListener("DOMContentLoaded", () => {
    initAuth();

    // Auth buttons
    document.getElementById("googleSignInBtn").addEventListener("click", signInWithGoogle);
    document.getElementById("signOutBtn").addEventListener("click", signOut);

    // Meeting buttons
    document.getElementById("addMeetingBtn").addEventListener("click", openAddModal);
    document.getElementById("closeModalBtn").addEventListener("click", closeModal);
    document.getElementById("cancelBtn").addEventListener("click", closeModal);

    // Form submission
    document.getElementById("meetingForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const meetingData = {
            id: document.getElementById("meetingId").value,
            title: document.getElementById("meetingTitle").value,
            date: document.getElementById("meetingDate").value,
            time: document.getElementById("meetingTime").value,
            duration: parseInt(document.getElementById("meetingDuration").value),
        };
        saveMeeting(meetingData);
    });

    // Delete button
    document.getElementById("deleteMeetingBtn").addEventListener("click", () => {
        const meetingId = document.getElementById("meetingId").value;
        if (meetingId) deleteMeeting(meetingId);
    });
});
