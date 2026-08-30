import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDdzx4v1685XKn9VoZjSrjemCnldPKIMSI",
    authDomain: "hacksentinel.firebaseapp.com",
    projectId: "hacksentinel",
    storageBucket: "hacksentinel.firebasestorage.app",
    messagingSenderId: "103960869206",
    appId: "1:103960869206:web:d38387c2b374aefb90bef7",
    measurementId: "G-ZK4FG4BW5G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
