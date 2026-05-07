import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase config is safe to expose in client code — security is enforced via
// Firestore security rules, not by hiding the config. (Same config used by
// the legacy single-file app.)
const firebaseConfig = {
  apiKey: 'AIzaSyBox1sX7Ucm7D-VZpa3NJOGOIPEk8KnSDA',
  authDomain: 'pool-8bf61.firebaseapp.com',
  projectId: 'pool-8bf61',
  storageBucket: 'pool-8bf61.firebasestorage.app',
  messagingSenderId: '1086762649992',
  appId: '1:1086762649992:web:cfb5821422aedbac7a123d',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
