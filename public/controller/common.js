import {
  ref,
  onValue,
  get,
  update,
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

export const createControllerHandler = (handlers) => {
  console.log("database object =", window.fb_db);
  var scene = document.querySelector("article#standby");
  
  // Judge that the game has been ended if it has been 10 seconds since the last timestamp update.
  const close_room = () => {
    console.log("close_room()");
    window.location.hash = "";
    // Show disconnect overlay
    document.getElementById("roomClosedBg").style.display = "";
  }
  var disconnect_timer = undefined;
  const disconnect_timer_timeout_ms = 10000;
  var ref_timestamp = ref(window.fb_db, `rooms/${window.rc}/lastUpdate`);
  onValue(ref_timestamp, (snapshot) => {
    // If this gets called, the value has changed (not deleted)
    // const data = snapshot.val();
    if (disconnect_timer) {
      clearTimeout(disconnect_timer);
    }
    disconnect_timer = setTimeout(close_room, disconnect_timer_timeout_ms);
  });
  
  /* New Firebase-based player initializer */
  var ref_me = ref(
    window.fb_db,
    `rooms/${window.rc}/connections/${localStorage.getItem("name")}`
  );
  /* New Firebase-based game event handler */
  var snapshotMe = {
    input: 0,
    inputText: "",
    messages: { },
    nick: "",
    score: -1,
  };
  
  /* Initialize the value. */
  get(ref_me).then((snapshot) => {
    console.log("Player Init");
    if (!snapshot.exists()) {
      console.error(`Could not make a reference to rooms/${window.rc}/connections/${localStorage.getItem("name")}`);
      return;
    }
    let val = snapshot.val();
    document.getElementById("nickname").innerText = val.nick;
    if (val.playerNumber == 1) {
      document.getElementById("game").classList.add("playerOne");
    }
    /* Insert other player init here. */
    if (handlers.hasOwnProperty("playerInit")) {
      handlers.playerInit(snapshotMe, snapshot.val);
    }
    snapshotMe = val;
  });
  
  /* When the value has been changed from the initially pushed value. */
  onValue(ref_me, (snapshot) => {
    const data = snapshot.val();
    console.log("ref me", data);
    if (!data) {return;}
    // Includes changes in score, input state, nickname, etc.
    if (snapshotMe.nick != data.nick) {
      document.getElementById("nickname").innerText = data.nick;
    }
    if (snapshotMe.score != data.score) {
      // Add live score display if desired
    }
    if (snapshotMe.messages.time < data.messages.time) {
      onPlayerMessage(data.messages);
    }
    if (snapshotMe.kicked != 0) {
      // Player was kicked
      if (disconnect_timer) {
        clearTimeout(disconnect_timer);
      }
      close_room();
    }
    /* Do other updates here. */
    if (handlers.hasOwnProperty("playerUpdate")) {
      handlers.playerUpdate(snapshotMe, data);
    }
    // Update local copy for next snapshot
    snapshotMe = data;
  });
  
  /* Get messages from the room. */
  var msg_timestamp = 0;
  var ref_msg = ref(window.fb_db, `rooms/${window.rc}/scene`);
  onValue(ref_msg, (snapshot) => {
    const data = snapshot.val();
    if (data !== null) {
      data.forEach((m, _index, _array) => {
        if (m.time > msg_timestamp) {
          msg_timestamp = m.time;
          onRoomMessage(m);
        }
      });
    }
  });
  
  /* Interpret messages given to the entire room. */
  
  var onRoomMessage = (data) => {
    console.log("onRoomMessage", data.sceneName);
    if (data.sceneName == "none") {return;}
    if (handlers.hasOwnProperty("roomMessage")) {
      handlers.roomMessage(snapshotMe, data);
    } else {
      console.error("Unimplemented sceneName: " + data.sceneName);
      return;
    }
  };
  
  /* Interpret messages given to this player specifically. */
  var onPlayerMessage = (data) => {
    console.log("onPlayerMessage", data.action);
    if (data.action == "none") {return;}
    if (handlers.hasOwnProperty("playerMessage")) {
      handlers.playerMessage(snapshotMe, data);
    } else {
      console.error("Unimplemented player message action: " + data.action);
      return;
    }
  };
  
  /* Send a button input to the game. Supports multiple buttons and specifying them by index. */
  // Add this much delay to a button that will submit text.
  const TEXT_DEBOUNCE_MS = 100;
  function sendButton(which, reason) {
    let bit = 1 << which;
    update(ref_me, { input: bit });
    console.debug(`Pressed ${which} for ${reason}.`);
  }
  
  /* Adding button event listeners. */
  // Skip buttons
  let skipButtons = document.querySelectorAll(".skipButton");
  skipButtons.forEach((el, i, parent) => {
    el.addEventListener("click", () => {
      sendButton(5, "skip");
    });
  });
  
  // Add other button event listeners here.
  if (handlers.hasOwnProperty("needButtonListener")) {
    for (let entry of handlers.needButtonListener) {
      if (!(
        entry.hasOwnProperty("selector") &&
        entry.hasOwnProperty("selectAll") &&
        entry.hasOwnProperty("buttonIndex") &&
        entry.hasOwnProperty("reason")
      )) {
        console.error("needButtonListener needs to have all of these properties: selector (CSS selector), selectAll (boolean), buttonIndex (integer), and reason (string).");
        continue
      }
      if (entry.selectAll) {
        Array.from(document.querySelectorAll(entry.selector)).forEach((el) => {
          el.addEventListener("click", () => {
            sendButton(entry.buttonIndex, entry.reason);
          });
        });
      } else {
        document.querySelector(entry.selector).addEventListener("click", () => {
          sendButton(entry.buttonIndex, entry.reason);
        })
      }
    }
  }
  
  /* Update the text input to the game. The input shouldn't be finalized and accepted until sendButton is used. */
  const updateText = (newKey, newValue) => {
    let newContent = {}
    newContent[newKey] = newValue;
    update(ref_me, newContent);
  };
  /* In order to prevent overwhelming the server with fast typing, apply a debounce. */
  function debounce(func, timeout) {
    let timer;
    return (...args) => {
      if (!timer) {
        func.apply(this, args);
        //clearTimeout(timer);
        timer = setTimeout(() => {
          timer = undefined;
          func.apply(this, args);
        }, timeout);
      }
    };
  }
  const sendTextContent = debounce(updateText, TEXT_DEBOUNCE_MS);
  
  // Add text input listeners.
  if (handlers.hasOwnProperty("needTextListener")) {
    for (let entry of handlers.needTextListener) {
      if (!(
        entry.hasOwnProperty("selector") &&
        entry.hasOwnProperty("selectAll") &&
        entry.hasOwnProperty("dbKey")
      )) {
        console.error("needTextListener needs to have all of these properties: selector (CSS selector), selectAll (boolean), dbKey (string, key in the player's database entry).");
        continue
      }
      if (entry.selectAll) {
        Array.from(document.querySelectorAll(entry.selector)).forEach((el) => {
          el.addEventListener("input", () => {
            sendTextContent(entry.dbKey, el.value);
          });
        });
      } else {
        const el = document.querySelector(entry.selector);
        el.addEventListener("input", () => {
          sendTextContent(entry.dbKey, el.value);
        })
      }
    }
  }
}