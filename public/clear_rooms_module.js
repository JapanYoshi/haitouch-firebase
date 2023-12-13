// Firebase import
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-database.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";

export function doEverything() {
  const firebaseConfig = {
    apiKey: "AIzaSyCCQlFqG66ls0jNEeZDqv0F5V4d2l3mIPw",
    authDomain: "haitouch-9320f.firebaseapp.com",
    databaseURL: "https://haitouch-9320f-default-rtdb.firebaseio.com",
    projectId: "haitouch-9320f",
    storageBucket: "haitouch-9320f.appspot.com",
    messagingSenderId: "850603279750",
    appId: "1:850603279750:web:a92cc85981305fe85e5807",
  };

  window.fb_app = initializeApp(firebaseConfig);
  window.fb_db = getDatabase(window.fb_app);
  window.fb_dbRef = ref(window.fb_db);
  window.rc = "";

  const auth = getAuth();

  document.addEventListener("DOMContentLoaded", async () => {
    await signInAnonymously(auth);

    let theRef = ref(window.fb_db, "rooms");
    let snapshot = await get(theRef);
    let val = snapshot.val();
    const cutoff = +(new Date() / 1000) - 600; // 10 minutes ago
    console.log(val, cutoff);
    let deletedCount = 0;
    let usedRoomCodes = [];
    for (let k of Object.keys(val)) {
      if (val[k].lastUpdate < cutoff) {
        let childRef = ref(window.fb_db, "rooms/" + k);
        await set(childRef, {});
        deletedCount++;
      } else {
        usedRoomCodes.push(k);
      }
    }
    let roomCodeRef = ref(window.fb_db, "roomCodes");
    snapshot = await get(roomCodeRef);
    let val_ = snapshot.val();
    console.log(val_);
    let newRoomCodes = Object.keys(val_);
    newRoomCodes = newRoomCodes.filter(
      (rc) => val_[rc] == true && usedRoomCodes.includes(rc)
    );
    newRoomCodes = Object.fromEntries(
      Array.from(newRoomCodes, (entry) => [entry, true])
    );
    set(roomCodeRef, newRoomCodes);
    console.log(
      "Cleaned up " +
        deletedCount +
        " rooms that have been unused for 10 minutes."
    );
  });
}
