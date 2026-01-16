// Render backend URL'ingizni shu yerga yozing
const RENDER_URL = "https://call-backend-fmwj.onrender.com";

let peerConnection = null;
let localStream = null;
let remoteStream = null;
let socket = null;
let myClientId = null;
let otherClientId = null;

const statusText = document.getElementById("statusText");
const remoteAudio = document.getElementById("remoteAudio");
const endCallBtn = document.getElementById("endCallBtn");
const muteBtn = document.getElementById("muteBtn");
const audioLevel = document.getElementById("audioLevel");
let isMuted = false;

// WebSocket ulanishi
function connectWebSocket() {
    const wsUrl = `${RENDER_URL.replace('https', 'wss')}/ws`;
    socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
        console.log("WebSocket connected");
        statusText.textContent = "Ulanish...";
        statusText.className = "status";
    };
    
    socket.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "self_online") {
            myClientId = msg.clientId;
            statusText.textContent = "Qo'ng'iroqni kutmoqda...";
            
            // Agar call boshqa client tomonidan boshlangan bo'lsa
            if (window.location.search.includes('caller')) {
                await startCall(true);
            }
        }
        
        else if (msg.type === "call_started") {
            otherClientId = msg.from;
            statusText.textContent = "Qo'ng'iroq qabul qilinmoqda...";
            await startCall(false);
        }
        
        else if (msg.type === "peer_offline") {
            statusText.textContent = "Ikkinchi foydalanuvchi offline";
            endCall();
        }
        
        else if (msg.type === "signal") {
            if (!peerConnection && msg.data.type === "offer") {
                await startCall(false);
            }
            
            if (peerConnection) {
                if (msg.data.type === "offer") {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    
                    socket.send(JSON.stringify({
                        type: "signal",
                        data: answer
                    }));
                    
                    statusText.textContent = "Qo'ng'iroq bog'landi";
                } 
                else if (msg.data.type === "answer") {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data));
                    statusText.textContent = "Qo'ng'iroq bog'landi";
                } 
                else if (msg.data.candidate) {
                    try {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(msg.data));
                    } catch (e) {
                        console.error("ICE candidate qo'shishda xatolik:", e);
                    }
                }
            }
        }
    };
    
    socket.onclose = () => {
        statusText.textContent = "Serverga ulanish uzildi";
        statusText.className = "status disconnected";
    };
}

// WebRTC orqali qo'ng'iroqni boshlash
async function startCall(isCaller) {
    try {
        // Mikrofondan audio olish
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        
        // PeerConnection yaratish
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
        
        peerConnection = new RTCPeerConnection(configuration);
        
        // Local streamni qo'shish
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        // Remote streamni qabul qilish
        peerConnection.ontrack = (event) => {
            remoteStream = event.streams[0];
            remoteAudio.srcObject = remoteStream;
            
            // Audio monitoring
            if (remoteStream) {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                const source = audioContext.createMediaStreamSource(remoteStream);
                source.connect(analyser);
                analyser.fftSize = 256;
                
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                
                function updateAudioLevel() {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const average = sum / bufferLength;
                    const level = Math.min(100, (average / 128) * 100);
                    
                    audioLevel.style.width = `${level}%`;
                    
                    if (remoteStream && remoteStream.active) {
                        requestAnimationFrame(updateAudioLevel);
                    }
                }
                
                updateAudioLevel();
            }
        };
        
        // ICE candidate lar
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({
                    type: "signal",
                    data: event.candidate
                }));
            }
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            console.log("ICE connection state:", peerConnection.iceConnectionState);
            
            if (peerConnection.iceConnectionState === "connected") {
                statusText.textContent = "Qo'ng'iroq bog'landi";
                statusText.className = "status connected";
            } else if (peerConnection.iceConnectionState === "disconnected" ||
                       peerConnection.iceConnectionState === "failed") {
                statusText.textContent = "Qo'ng'iroq uzildi";
                statusText.className = "status disconnected";
            }
        };
        
        // Agar caller bo'lsa, offer yaratish
        if (isCaller) {
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true
            });
            
            await peerConnection.setLocalDescription(offer);
            
            socket.send(JSON.stringify({
                type: "signal",
                data: offer
            }));
            
            statusText.textContent = "Qo'ng'iroq qilinmoqda...";
        }
        
    } catch (error) {
        console.error("Qo'ng'iroqni boshlashda xatolik:", error);
        statusText.textContent = "Xatolik: " + error.message;
        statusText.className = "status disconnected";
    }
}

// Qo'ng'iroqni tugatish
function endCall() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    if (remoteAudio.srcObject) {
        remoteAudio.srcObject = null;
    }
    
    if (socket) {
        socket.close();
    }
    
    // Asosiy sahifaga qaytish
    setTimeout(() => {
        window.location.href = "index.html";
    }, 1000);
}

// Audio ni o'chirish/yoqish
function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            isMuted = !isMuted;
            audioTrack.enabled = !isMuted;
            muteBtn.innerHTML = isMuted ? 
                '<i class="fas fa-microphone-slash"></i> Audio Yoqish' : 
                '<i class="fas fa-microphone"></i> Audio O'chirish';
        }
    }
}

// Tugmalar uchun event listenerlar
document.addEventListener('DOMContentLoaded', () => {
    connectWebSocket();
    
    if (endCallBtn) {
        endCallBtn.onclick = endCall;
    }
    
    if (muteBtn) {
        muteBtn.onclick = toggleMute;
    }
    
    // Sahifa yopilganda qo'ng'iroqni tugatish
    window.addEventListener('beforeunload', endCall);
});
