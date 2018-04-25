import io from 'socket.io-client'
export function connectToWebsocket() {
  const socket = io();
  return socket;
}
