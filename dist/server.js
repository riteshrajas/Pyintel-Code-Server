"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_1 = require("./types/socket");
const user_1 = require("./types/user");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.use(express_1.default.static(path_1.default.join(__dirname, "public"))); // Serve static files
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
    },
});
let userSocketMap = [];
// Function to get all users in a room
function getUsersInRoom(roomId) {
    return userSocketMap.filter((user) => user.roomId == roomId);
}
// Function to get room id by socket id
function getRoomId(socketId) {
    const roomId = userSocketMap.find((user) => user.socketId === socketId)?.roomId;
    if (!roomId) {
        console.error("Room ID is undefined for socket ID:", socketId);
        return null;
    }
    return roomId;
}
function getUserBySocketId(socketId) {
    const user = userSocketMap.find((user) => user.socketId === socketId);
    if (!user) {
        console.error("User not found for socket ID:", socketId);
        return null;
    }
    return user;
}
io.on("connection", (socket) => {
    // Handle user actions
    socket.on(socket_1.MessageEvent.JOIN_REQUEST, ({ roomId, username }) => {
        // Check is username exist in the room
        const isUsernameExist = getUsersInRoom(roomId).filter((u) => u.username === username);
        if (isUsernameExist.length > 0) {
            io.to(socket.id).emit(socket_1.MessageEvent.USERNAME_EXISTS);
            return;
        }
        const user = {
            username,
            roomId,
            status: user_1.USER_CONNECTION_STATUS.ONLINE,
            cursorPosition: 0,
            typing: false,
            socketId: socket.id,
            currentFile: null,
        };
        userSocketMap.push(user);
        socket.join(roomId);
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.USER_JOINED, { user });
        const users = getUsersInRoom(roomId);
        io.to(socket.id).emit(socket_1.MessageEvent.JOIN_ACCEPTED, { user, users });
    });
    socket.on("disconnecting", () => {
        const user = getUserBySocketId(socket.id);
        if (!user)
            return;
        const roomId = user.roomId;
        socket.broadcast
            .to(roomId)
            .emit(socket_1.MessageEvent.USER_DISCONNECTED, { user });
        userSocketMap = userSocketMap.filter((u) => u.socketId !== socket.id);
        socket.leave(roomId);
    });
    // Handle file actions
    socket.on(socket_1.MessageEvent.SYNC_FILES, ({ files, currentFile, socketId }) => {
        io.to(socketId).emit(socket_1.MessageEvent.SYNC_FILES, {
            files,
            currentFile,
        });
    });
    socket.on(socket_1.MessageEvent.FILE_CREATED, ({ file }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.FILE_CREATED, { file });
    });
    socket.on(socket_1.MessageEvent.FILE_UPDATED, ({ file }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.FILE_UPDATED, { file });
    });
    socket.on(socket_1.MessageEvent.FILE_RENAMED, ({ file }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.FILE_RENAMED, { file });
    });
    socket.on(socket_1.MessageEvent.FILE_DELETED, ({ id }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.FILE_DELETED, { id });
    });
    // Handle user status
    socket.on(socket_1.MessageEvent.USER_OFFLINE, ({ socketId }) => {
        userSocketMap = userSocketMap.map((user) => {
            if (user.socketId === socketId) {
                return { ...user, status: user_1.USER_CONNECTION_STATUS.OFFLINE };
            }
            return user;
        });
        const roomId = getRoomId(socketId);
        if (!roomId)
            return;
        socket.broadcast
            .to(roomId)
            .emit(socket_1.MessageEvent.USER_OFFLINE, { socketId });
    });
    socket.on(socket_1.MessageEvent.USER_ONLINE, ({ socketId }) => {
        userSocketMap = userSocketMap.map((user) => {
            if (user.socketId === socketId) {
                return { ...user, status: user_1.USER_CONNECTION_STATUS.ONLINE };
            }
            return user;
        });
        const roomId = getRoomId(socketId);
        if (!roomId)
            return;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.USER_ONLINE, { socketId });
    });
    // Handle chat actions
    socket.on(socket_1.MessageEvent.SEND_MESSAGE, ({ message }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast
            .to(roomId)
            .emit(socket_1.MessageEvent.RECEIVE_MESSAGE, { message });
    });
    // Handle cursor position
    socket.on(socket_1.MessageEvent.TYPING_START, ({ cursorPosition }) => {
        userSocketMap = userSocketMap.map((user) => {
            if (user.socketId === socket.id) {
                return { ...user, typing: true, cursorPosition };
            }
            return user;
        });
        const user = getUserBySocketId(socket.id);
        if (!user)
            return;
        const roomId = user.roomId;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.TYPING_START, { user });
    });
    socket.on(socket_1.MessageEvent.TYPING_PAUSE, () => {
        userSocketMap = userSocketMap.map((user) => {
            if (user.socketId === socket.id) {
                return { ...user, typing: false };
            }
            return user;
        });
        const user = getUserBySocketId(socket.id);
        if (!user)
            return;
        const roomId = user.roomId;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.TYPING_PAUSE, { user });
    });
    socket.on(socket_1.MessageEvent.REQUEST_DRAWING, () => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast
            .to(roomId)
            .emit(socket_1.MessageEvent.REQUEST_DRAWING, { socketId: socket.id });
    });
    socket.on(socket_1.MessageEvent.SYNC_DRAWING, ({ drawingData, socketId }) => {
        socket.broadcast
            .to(socketId)
            .emit(socket_1.MessageEvent.SYNC_DRAWING, { drawingData });
    });
    socket.on(socket_1.MessageEvent.DRAWING_UPDATE, ({ snapshot }) => {
        const roomId = getRoomId(socket.id);
        if (!roomId)
            return;
        socket.broadcast.to(roomId).emit(socket_1.MessageEvent.DRAWING_UPDATE, {
            snapshot,
        });
    });
});
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => {
    // Send the index.html file
    res.sendFile(path_1.default.join(__dirname, "..", "public", "index.html"));
});
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
