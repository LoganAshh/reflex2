// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB8Wai5sTLAsPg53oExFhu9adUSwgI7VXI",
  authDomain: "reflex-2970e.firebaseapp.com",
  projectId: "reflex-2970e",
  storageBucket: "reflex-2970e.firebasestorage.app",
  messagingSenderId: "468344200790",
  appId: "1:468344200790:web:25614badd4c91fa54e65f7",
  measurementId: "G-XV0VJEH80W",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
