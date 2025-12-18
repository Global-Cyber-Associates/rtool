// src/utils/socket.js
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
console.log("Backend URL:", backendUrl);

// ⭐ READ JWT FROM STORAGE
const token = sessionStorage.getItem("token");

// ⭐ CREATE SOCKET WITH AUTH
const socket = io(backendUrl, {
  transports: ["websocket"],
  auth: {
    token: token ? `Bearer ${token}` : null,
  },
});

socket.on("connect", () => {
  console.log("🔐 Connected to server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("❌ Disconnected from server:", reason);
});

// --------------------------------------------------
// ⭐ TENANT-AWARE FETCH
// --------------------------------------------------
export function fetchData(type, agentId) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      return reject("Socket not connected");
    }

    socket.emit("get_data", { type, agentId }, (response) => {
      if (!response) {
        return reject("No response from server");
      }

      if (response.success === false) {
        return reject(response.message || "Fetch failed");
      }

      resolve(response);
    });
  });
}

export function updateSocketToken(newToken) {
  if (newToken) {
    socket.auth = { token: `Bearer ${newToken}` };
    socket.connect();
  } else {
    socket.disconnect();
  }
}

export default socket;
