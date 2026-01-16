const WSS_URL = "wss://call-backend-fmwj.onrender.com/ws";

const state = {
  socket: null,
  online: false,
  peerOnline: false
};

const statusText = document.getElementById("statusText");
const callBtn = document.getElementById("callBtn");

// WebSocket ulanadi
function connectSocket() {
  state.socket = new WebSocket(WSS_URL);

  state.socket.onopen = () => {
    state.online = true;
    send({ type: "online" }); // serverga online holat yuboriladi
    statusText.innerText = "Siz online";

    console.log("WebSocket ulanish ochildi");
  };

  state.socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if(msg.type === "peer_online") {
      state.peerOnline = true;
      callBtn.classList.remove("hidden");
      statusText.innerText = "Ikkinchi foydalanuvchi online";
    }

    if(msg.type === "peer_offline") {
      state.peerOnline = false;
      callBtn.classList.add("hidden");
      statusText.innerText = "Ikkinchi foydalanuvchi offline";
    }

    if(msg.type === "call_started") {
      statusText.innerText = "Qo‘ng‘iroq boshlandi...";
      callBtn.disabled = true;
    }
  };

  state.socket.onclose = () => {
    statusText.innerText = "Ulanish uzildi";
    callBtn.classList.add("hidden");
  };
}

// call tugmasi
callBtn.onclick = () => {
  send({ type: "call" });
  statusText.innerText = "Qo‘ng‘iroq yuborildi...";
  callBtn.disabled = true;
};

// serverga yuborish
function send(data) {
  state.socket.send(JSON.stringify(data));
}

// init
connectSocket();
