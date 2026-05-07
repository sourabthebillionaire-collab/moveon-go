import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "AIzaSyA73xYd4Ks_5lDspe0j88SyhGLWIYVlqR0",
  authDomain: "bus-tracker-db6ee.firebaseapp.com",
  databaseURL: "https://bus-tracker-db6ee-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "bus-tracker-db6ee",
  storageBucket: "bus-tracker-db6ee.appspot.com",
  messagingSenderId: "46705530696",
  appId: "1:46705530696:web:98f1ddea79e37601d9057d"
};

const app = initializeApp(firebaseConfig);

export default app;