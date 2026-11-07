/**
 * Shared Socket.io server instance.
 * Set once during initSocket(), then importable by any route/service.
 */
import { Server as SocketServer } from "socket.io";

let _io: SocketServer | null = null;

export function setIo(io: SocketServer): void {
  _io = io;
}

export function getIo(): SocketServer | null {
  return _io;
}
