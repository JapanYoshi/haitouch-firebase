// Firebase import
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  get,
  push,
  update,
  child,
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-database.js";
import {
  getAuth,
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";

export function doEverything(STRINGS) {
  var ready = false;
  const NICKNAME_CHAR_LIMIT = STRINGS.nicknameCharLimit;

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
  let roomRef;
  let roomCodeList = {};
  let roomCodeListInitialized = 0;
  let controllerPageName = "";
  let roomCanBeJoined = false;
  let nicknameIsValid = false;

  let myName = localStorage.getItem("name");
  if (!myName) {
    myName = "";
    let seed = new Date().valueOf(); // current timestamp in ms
    // this is not actually Base64
    const key =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    // just make shit up using Math.random()
    for (let i = 0; i < 8; i++) {
      myName += key.charAt(Math.floor(Math.random() * 64));
    }
    console.log("New name is:", myName);
    localStorage.setItem("name", myName);
  }

  let roomCodeRef = ref(window.fb_db, "roomCodes");
  function setRoomCodes(snapshot) {
    if (!snapshot.val()) return;
    roomCodeList = snapshot.val();
    roomCodeListInitialized = +new Date();
    console.log("Room codes updated on", roomCodeListInitialized);
  }

  function roomExists(roomCode) {
    return roomCodeList[roomCode] == true;
  }

  function getRoomData(roomCode) {
    roomRef = child(window.fb_dbRef, `rooms/${roomCode}`);
    let promise = new Promise((resolve, reject) => {
      get(roomRef)
        .then((snapshot) => {
          console.log("getRoomData then");
          if (!snapshot.exists()) {
            resolve({ state: -1, name: STRINGS.roomNone }); // room nonexistent; please update room codes list
          }
          let val = snapshot.val();
          controllerPageName = val.controllerName;
          if (val.inProgress === true) {
            resolve({ state: 3, name: val.gameName }); // game already started and can’t join as audience
          }
          if (val.playerCount < val.maxPlayers) {
            resolve({ state: 1, name: val.gameName }); // open for players
          }
          if (val.audienceCount < val.maxAudience) {
            resolve({ state: 2, name: val.gameName }); // open only for audience
          }
          resolve({ state: 0, name: val.gameName }); // room exists, but is full and cannot be joined
        })
        .catch((error) => {
          console.error(error);
          resolve({ state: -1, name: STRINGS.roomError });
        });
    });

    return promise;
  }

  /* Autofill upon reload */
  document.addEventListener("DOMContentLoaded", () => {
    const inputRc = document.getElementById("rc");
    const inputNick = document.getElementById("nick");
    const btnJoin = document.getElementById("btnJoin");
    const joinStatus = document.getElementById("joinStatus");

    signInAnonymously(auth)
    .then(() => {
      console.log("Signed in anonymously to Firebase Realtime Database.");
      document.getElementById("roomName").innerText = STRINGS.connectedToDb;
      document.getElementById("roomStatus").innerText = STRINGS.connectedPrompt;
      ready = true;
      validateRoomCode();
    })
    .catch((error) => {
      console.error(
        "Error signing in anonymously to Firebase Realtime Database.",
        error.code,
        error.message
      );
    });
    
    var rc = window.location.hash
      .substring(1) // starts with a literal "#"
      .toUpperCase();
    if (/^[A-Z]{4}$/.test(rc)) {
      inputRc.value = rc;
    } else {
      inputRc.value = "";
    }
    validateRoomCode();
    document.getElementById("roomClosedThanks").innerText =
      STRINGS.disconnectedThanks;
    document.getElementById("roomClosedMessage").innerText =
      STRINGS.disconnected;
    document.querySelector("#roomClosedModal button").innerText =
      STRINGS.buttonReload;
    if (!ready) {
      document.getElementById("roomName").innerText = STRINGS.connectingToDb;
      document.getElementById("roomStatus").innerText = STRINGS.connectingWait;
      btnJoin.innerText = STRINGS.buttonJoin;
    }

    /* Nickname text field validity display */
    function setNicknameValid(newValue) {
      nicknameIsValid = newValue;
      if (newValue) {
        inputNick.classList.remove("fixThis");
      } else {
        inputNick.classList.add("fixThis");
      }
      btnJoin.disabled = !(roomCanBeJoined && nicknameIsValid);
    }

    /*
Room code input.
If the room code is valid, first check if it's in the list of room codes.
Then if it exists, get the current state of the room.
*/
    function validateRoomCode(event) {
      if (!!event && event.isComposing) {
        return;
      }
      roomCanBeJoined = false;
      let rc = inputRc.value.toUpperCase();
      document.querySelector(
        "label[for=rc] + .letterCount"
      ).innerText = `${rc.length}/4`;
      btnJoin.disabled = true;
      const regex = /^[A-Z]{4}$/;
      if (regex.test(rc)) {
        // valid room code
        inputRc.classList.remove("fixThis");
        if (!ready) {
          roomName.innerText = STRINGS.connectingToDb;
          roomStatus.innerText = STRINGS.connectingWait;
          setTimeout(250, validateRoomCode);
          return;
        }
        // Keep room code cache for 10 seconds
        if (roomCodeListInitialized + 10_000 < +new Date()) {
          roomName.innerText = STRINGS.roomCodeRefreshing;
          roomStatus.innerText = STRINGS.roomCodeRefreshingWait;
          get(roomCodeRef).then((snapshot) => {
            setRoomCodes(snapshot);
            validateRoomCode(event);
          });
          return;
        }
        if (!roomExists(rc)) {
          roomName.innerText = STRINGS.roomNone;
          roomStatus.innerText = STRINGS.roomPleaseVerify;
          window.location.hash = "";
          return;
        }
        roomName.innerText = STRINGS.loadingGameName;
        roomStatus.innerText = "...";
        window.rc = rc;
        let roomData = getRoomData(rc);
        console.log(roomData);
        roomData.then((value) => {
          console.log("roomData resolved, value is", value);
          roomName.innerText = value.name;
          switch (value.state) {
            case 0:
              roomStatus.innerText = STRINGS.joinFull;
              roomCanBeJoined = false;
              break;
            case 1:
              roomStatus.innerText = STRINGS.joinAsPlayer;
              roomCanBeJoined = true;
              break;
            case 2:
              roomStatus.innerText = STRINGS.joinAsAudience;
              roomCanBeJoined = true;
              break;
            case 3:
              roomStatus.innerText = STRINGS.fullGameInProgress;
              roomCanBeJoined = false;
              break;
            default:
              roomStatus.innerText = `Unknown status (${value.state})`;
              roomCanBeJoined = false;
          }
          if (roomCanBeJoined) {
            validateNickname();
            inputNick.focus();
            // set cursor position after the name so that the player can reset it
            inputNick.setSelectionRange(
              inputNick.value.length,
              inputNick.value.length
            );
          }
        });
      } else {
        btnJoin.disabled = true;
        inputRc.classList.add("fixThis");
        roomName.innerText = STRINGS.roomCodeNotEntered;
        roomStatus.innerText = STRINGS.roomCodeInvalid;
      }
    }
    inputRc.addEventListener("input", validateRoomCode);
    inputRc.addEventListener("compositionend", validateRoomCode);
    /*
Join request!
*/
    function joinRoom() {
      if (!(roomCanBeJoined && nicknameIsValid)) {
        return;
      }
      btnJoin.disabled = true;
      console.log("Joining");
      btnJoin.innerText = STRINGS.joinWait;
      // write own username into 'pending', then listen for it to be removed after it being processed
      let joinRef = child(roomRef, `pending/${myName}`);
      onValue(joinRef, (snapshot) => {
        let val = snapshot.val();
        console.log("joinRoom val", val);
        if (val.status === 1) {
          // no change
          return;
        }
        if (val.status == -1) {
          console.log("join rejected");
          btnJoin.disabled = false;
          joinStatus.innerText = STRINGS.joinRejected;
          btnJoin.innerText = STRINGS.buttonJoin;
        } else {
          window.isAudience = val.status == 9;
          console.log("join permitted");
          joinStatus.innerText = STRINGS.loadingController;
          btnJoin.innerText = STRINGS.buttonJoinSuccess;
          replacePage();
        }
      });
      update(joinRef, { status: 1, nick: inputNick.value, uuid: myName });
    }

    btnJoin.addEventListener("click", joinRoom);

    function validateNickname(event) {
      if (!!event && event.isComposing) {
        return;
      }
      fixQuotes(inputNick);
      // Check against the name regex
      var nameRegex = STRINGS.nicknameRegex;
      if (nameRegex.test(inputNick.value)) {
        // Valid nick, allow join and save for later
        setNicknameValid(true);
        localStorage.setItem("nickname", inputNick.value);
        console.log(inputNick.value, "is valid");
      } else {
        // Not a valid nick, don't allow join
        setNicknameValid(false);
        console.log(inputNick.value, "is invalid");
      }
    }
    inputNick.addEventListener("input", validateNickname);

    // Let the player press Enter after entering their nickname to insta-join
    inputNick.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && btnJoin.disabled === false) {
        joinRoom();
      }
    });

    /*
Nickname input.
Pass the input element.
If the nickname contains curly Unicode single quotes,
replace them with the allowed typewriter/ASCII single quotes.
*/
    function fixQuotes(el) {
      // replace unicode single quotes
      var start = el.selectionStart;
      var end = el.selectionEnd;
      const quotes = /[\u2018\u2019\u201b]/g;
      el.value = el.value.replaceAll(quotes, "'");
      el.value = el.value.replaceAll("\u201a", ",");
      // use uppercase Eszett for German (also avoids longstanding Chromium bug)
      el.value = el.value.replaceAll("ß", "ẞ");
      el.value = el.value.toUpperCase();
      el.setSelectionRange(start, end);
      document.querySelector(
        "label[for=nick] + .letterCount"
      ).innerText = `${el.value.length}/${NICKNAME_CHAR_LIMIT}`;
    }

    // Once you join, replace the page's contents with the specified controller
    function replacePage() {
      // set section tag to make rejoining easier
      window.location.hash = window.rc;
      // fetch the controller file
      var xmlHttp = new XMLHttpRequest();
      xmlHttp.onreadystatechange = () => {
        if (xmlHttp.readyState == 4) {
          if (xmlHttp.status == 200) {
            // console.log(xmlHttp.responseText);
            // manually extract the element div.game using specific comments
            // this is pretty janky, so if you're looking at this, don't do this for your own projects
            let header = "<!--START INJECTED HTML-->";
            let start = xmlHttp.responseText.indexOf(header) + header.length;
            let end = xmlHttp.responseText.indexOf("<!--END INJECTED HTML-->");
            let htmlText = xmlHttp.responseText.substring(start, end);
            let disconnectedModal = document.getElementById("roomClosedBg");
            document.body.innerHTML = htmlText;
            document.body.appendChild(disconnectedModal);
            // manually extract the element script using specific comments
            // again, this is janky and I do not recommend doing this
            header = "/** START INJECTED SCRIPT **/";
            start = xmlHttp.responseText.indexOf(header) + header.length;
            end = xmlHttp.responseText.indexOf("/** END INJECTED SCRIPT **/");
            let jsText = xmlHttp.responseText.substring(start, end);
            let scriptEl = document.createElement("script");
            scriptEl.innerHTML = jsText;
            scriptEl.type = "module";
            document.head.appendChild(scriptEl);
            // setInterval(heartbeat, 1000);
          } else {
            console.log(`Failed (status is ${xmlHttp.status}, not 200`);
            joinStatus.innerText = "Error downloading controller.";
          }
        } else {
          console.log(`Not ready (readyState is ${xmlHttp.readyState}, not 4)`);
        }
      };
      xmlHttp.open(
        "GET",
        "https://" +
          window.location.hostname +
          "/controller/" +
          controllerPageName +
          ".html",
        true
      );
      xmlHttp.send(null);
    }
  });
}
