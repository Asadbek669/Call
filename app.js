const WSS_URL = "wss://call-backend-fmwj.onrender.com/ws";

let pc = null;
let localStream = null;
let socket = null;

const callBtn = document.getElementById("callBtn");
const statusText = document.getElementById("statusText");
const remoteAudio = document.getElementById("remoteAudio");

// WebSocket ulanadi
socket = new WebSocket(WSS_URL);

socket.onopen = () => statusText.innerText = "Siz online";

socket.onmessage = async (event) => {
    const msg = JSON.parse(event.data);

    if(msg.type === "peer_online"){
        statusText.innerText = "Ikkinchi foydalanuvchi online";
        callBtn.classList.remove("hidden");
    }

    if(msg.type === "peer_offline"){
        statusText.innerText = "Ikkinchi foydalanuvchi offline";
        callBtn.classList.add("hidden");
    }

    if(msg.type === "call_started"){
        statusText.innerText = "Qo‘ng‘iroq boshlandi...";
        await startCall(false);
    }

    if(msg.type === "signal"){
        if(!pc) await startCall(false);

        if(msg.data.type === "offer"){
            await pc.setRemoteDescription(msg.data);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.send(JSON.stringify({type:"signal", data:answer}));
        } else if(msg.data.type === "answer"){
            await pc.setRemoteDescription(msg.data);
        } else if(msg.data.candidate){
            await pc.addIceCandidate(msg.data);
        }
    }
};

callBtn.onclick = async () => {
    socket.send(JSON.stringify({type:"call"}));
    await startCall(true);
};

async function startCall(isOffer){
    // Faqat audio
    localStream = await navigator.mediaDevices.getUserMedia({audio:true});
    
    pc = new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = e => remoteAudio.srcObject = e.streams[0];
    pc.onicecandidate = e => {
        if(e.candidate) socket.send(JSON.stringify({type:"signal", data:e.candidate}));
    };

    if(isOffer){
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.send(JSON.stringify({type:"signal", data:offer}));
    }
}
