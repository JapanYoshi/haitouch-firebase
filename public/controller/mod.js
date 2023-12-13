import {
  ref,
  onValue,
  get,
  set,
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-database.js";

export function convertBB(bbcode) {
  if (typeof bbcode == "string") {
    return bbcode
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\[b\]/g, "<strong>")
      .replace(/\[\/b\]/g, "</strong>")
      .replace(/\[i\]/g, "<em>")
      .replace(/\[\/i\]/g, "</em>")
      .replace(/\[code\]/g, "<code>")
      .replace(/\[\/code\]/g, "</code>")
      .replace(/\[lb\]/g, "[")
      .replace(/\[rb\]/g, "]");
  } else {
    console.error(
      "convertBB could not convert this content because it is not a string:",
      bbcode
    );
    return "Error in funtion convertBB";
  }
}

const PENDING = 1;
const ACCEPTED = 2;
const REJECTED = -1;
const KICKED = -2;

export const createModeratorHandler = (params) => {
  console.log("database object =", window.fb_db);
  
  let refMod = ref(
    window.fb_db,
    `rooms/${window.rc}/modQueue`
  );

  let snapshotMod = [];
  // Listen to updates.
  onValue(refMod, (snapshot) => {
    let val = snapshot.val;
    if (!val) {
      console.error("Got a blank update");
      return
    }
    for (let i = 0; i < val.length; i++) {
      const local = snapshotMod.findIndex(
        element => (
          element.uuid == val[i].uuid &&
          element.type == val[i].type &&
          element.id == val[i].id
        )
      );
      if (local == -1) {
        // no local match, new addition
        snapshotMod.push(val[i]);
        params.onNewModEvent(val[i]);
      } else if (snapshotMod[local].status !== val[i].status) {
        snapshotMod[local].status = val[i].status
        if (val[i].status !== PENDING) {
          params.onRemovedModEvent(val[i]);
        }
      }
    }
  })
  // Init this value.
  get(refMod).then((snapshot) => {
    let val = snapshot.val;
    if (!val) {
      console.error("Failed to initialize the mod queue");
      return
    }
    for (let i = 0; i < val.length; i++) {
      if (val[i].status === PENDING) {
        refMod.push(val[i]);
        params.onNewModEvent(val[i]);
      }
    }
  })

  return {
    acceptModEvent: (uuid, type, id) => {
      const local = snapshotMod.findIndex(
        element => (
          element.uuid == uuid &&
          element.type == type &&
          element.id == id
        )
      );
      snapshotMod[local].status = ACCEPTED;
      refMod.update({local: snapshotMod[local]})
    },
    rejectModEvent: (uuid, type, id) => {
      const local = snapshotMod.findIndex(
        element => (
          element.uuid == uuid &&
          element.type == type &&
          element.id == id
        )
      );
      snapshotMod[local].status = REJECTED;
      refMod.update({local: snapshotMod[local]})
      const refPlayerWarns = ref(
        window.fb_db,
        `rooms/${window.rc}/connections/${uuid}/warned`
      );
      get(refPlayerWarns).then((snapshot) => {
        const val = snapshot.value;
        set(refPlayerWarns, val + 1);
      })
    },
    kickModEvent: (uuid, type, id) => {
      const local = snapshotMod.findIndex(
        element => (
          element.uuid == uuid &&
          element.type == type &&
          element.id == id
        )
      );
      snapshotMod[local].status = KICKED;
      refMod.update({local: snapshotMod[local]}).then(() => {
        const refPlayerKicked = ref(
          window.fb_db,
          `rooms/${window.rc}/connections/${uuid}/kicked`
        );
        set(refPlayerKicked, 1);
      });
    },
    alterModEvent: (uuid, type, id, newContent) => {
      const i = snapshotMod.findIndex((entry) => entry.uuid === modEvent.uuid && entry.type === "join")
      snapshotMod[i].nick = newName;
      refMod.update({i: snapshotMod[i]});
    }
  };
}