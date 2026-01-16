const WSS_URL = "wss://call-backend-fmwj.onrender.com/ws"; // Backend URL

// STATE
const state = {
  socket: null,
  name: "",
  pc: null,
  localStream: null,
  status: "ENTER_NAME",
};

// ELEMENTS
const stepName = document.getElementById("step-name");
const stepStatus = document.getElementById("step-status");
const joinBtn = document.getElementById("joinBtn");
const callBtn = document.getElementById("callBtn");
const nameInput = document.getElementById("nameInput");
const statusText = document.getElementById("statusText");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const videoContainer = document.getElementById("videoContainer");

// JOIN
joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Ism kiriting");
  state.name = name;
  connectSocket();
};

// CALL
callBtn.onclick = async () => {
  callBtn.disabled = true;
  setStatus("IN_CALL", "Qo‘ng‘iroq boshlanmoqda...");
  await startCall(true);
};

// WEBSOCKET
function connectSocket() {
  state.socket = new WebSocket(WSS_URL);

  state.socket.onopen = () => {
    send({ type: "join", name: state.name });
    stepName.classList.add("hidden");
    stepStatus.classList.remove("hidden");
    setStatus("WAITING", "Siz live. Ikkinchi ishtirokchini kutyapmiz...");
  };

  state.socket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "waiting") setStatus("WAITING", "Kutilyapti...");
    if (msg.type === "ready") {
      setStatus("READY", `${msg.peer} online. Qo‘ng‘iroq qilish mumkin`);
      callBtn.classList.remove("hidden");
    }

    if (msg.type === "signal") await handleSignal(msg.data);

    if (msg.type === "error") {
      alert(msg.message);
      state.socket.close();
    }
  };

  state.socket.onclose = () => {
    setStatus("ENTER_NAME", "Ulanish uzildi");
    callBtn.classList.add("hidden");
  };
}

// HELPER
function send(data) {
  state.socket.send(JSON.stringify(data));
}
function setStatus(newStatus, text) {
  state.status = newStatus;
  statusText.innerText = text;
}

// WEBRTC LOGIC
async function startCall(isOffer = false) {
  // getUserMedia
  state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = state.localStream;
  localVideo.classList.remove("hidden");
  videoContainer.classList.remove("hidden");

  state.pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });

  state.localStream.getTracks().forEach(track => state.pc.addTrack(track, state.localStream));

  state.pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.classList.remove("hidden");
  };

  state.pc.onicecandidate = (event) => {
    if (event.candidate) send({ type: "signal", data: event.candidate });
  };

  if (isOffer) {
    const offer = await state.pc.createOffer();
    await state.pc.setLocalDescription(offer);
    send({ type: "signal", data: offer });
  }
}

// SIGNAL HANDLER
async function handleSignal(data) {
  if (!state.pc) await startCall(false);

  if (data.type === "offer") {
    await state.pc.setRemoteDescription(data);
    const answer = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answer);
    send({ type: "signal", data: answer });
  } else if (data.type === "answer") {
    await state.pc.setRemoteDescription(data);
  } else if (data.candidate) {
    try { await state.pc.addIceCandidate(data); } catch (e) { console.warn(e); }
  }
}
