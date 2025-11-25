
import { io } from "socket.io-client";

const backendUrl = import.meta.env.VITE_BACKEND_URL;
console.log("Backend URL:", backendUrl);

const socket = io(backendUrl, {
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected from server:", reason);
});


export function fetchData(type, agentId) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) return reject("Socket not connected");

    socket.emit("get_data", { type, agentId }, (response) => {
      if (response?.error) return reject(response.error);
      resolve(response);
    });
  });
}

export default socket;
