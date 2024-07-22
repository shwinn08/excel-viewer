import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; 

const firebaseConfig = {
  apiKey: "AIzaSyBFoWvhyP2j4aKCCQNKjB9N0JyYQR7Hw1E",
  authDomain: "excelviewer-b76a9.firebaseapp.com",
  projectId: "excelviewer-b76a9",
  storageBucket: "excelviewer-b76a9.appspot.com",
  messagingSenderId: "14329911663",
  appId: "1:14329911663:web:00f67cdfa6b481bb9c709a",
  measurementId: "G-67MSQJYSZK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // Initializing storage

const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

export { auth, db, secondaryAuth, storage };
