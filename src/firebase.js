import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'

const firebaseConfig = {
  apiKey: "AIzaSyDYT9Ov0lJfEQ4osHd5_quGtg6x2ghsB7c",
  authDomain: "romeo-and-juliet---tools.firebaseapp.com",
  databaseURL: 'https://romeo-and-juliet---tools-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: "romeo-and-juliet---tools",
  storageBucket: "romeo-and-juliet---tools.firebasestorage.app",
  messagingSenderId: "744866188923",
  appId: "1:744866188923:web:940975bbde321bfc5f1cde"
};

export const CREATE_ROOM_GUID = '441fb449-1dbd-4520-b9c9-0a7b3aa42a9b'

const app = initializeApp(firebaseConfig)

if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
}

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6LfQXpUsAAAAAPAiARqqTdSRuAlIuUd8KL2aJnJc'),
  isTokenAutoRefreshEnabled: true
})

export const db = getDatabase(app)
