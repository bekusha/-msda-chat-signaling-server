const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
const app = express();
const server = http.createServer(app);
const apiProxy = createProxyMiddleware("/api", {
  // actual backend
  target: backendUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    "^/api": "",
  },
});
app.use(cors());
app.use("/api", apiProxy);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const connectedUsers = {};
const uuidToSocketId = {};

io.on("connection", (socket) => {
  socket.on("register", (userData) => {
    const { peerId, name, lastName, username } = userData;
    socket.peerId = peerId;
    connectedUsers[peerId] = { peerId, name, lastName, username };
    uuidToSocketId[peerId] = socket.id;

    console.log("user connected" + userData);
    io.emit(
      "users-list",
      Object.values(connectedUsers).map((user) => ({
        peerId: user.peerId,
        name: user.name,
        lastName: user.lastName,
        username: user.username,
      }))
    );
  });

  socket.on("send-friend-request", (data) => {
    const target = data.target;
    const requestingUser = connectedUsers[socket.peerId];
    console.log("friend request is sent ", data.target);
    if (!target) {
      console.error("Target is undefined in send-friend-request");
      return;
    }

    const targetSocketId = uuidToSocketId[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit("friend-request-received", {
        from: requestingUser,
      });
    } else {
      console.error("Target socket not found for target:", target);
    }

    console.log(
      "Friend request sent from:",
      socket.peerId,
      "to:",
      target,
      "requestingUser:",
      requestingUser
    );
  });

  socket.on("accept-friend-request", (data) => {
    const target = data.target;
    const acceptingUser = connectedUsers[socket.peerId];

    if (!target) {
      console.error("Target is undefined in accept-friend-request");
      return;
    }

    const targetSocketId = uuidToSocketId[target];
    if (targetSocketId) {
      io.to(targetSocketId).emit("friend-request-accepted", {
        from: acceptingUser,
      });

      const senderUuid = data.senderUuid;
      console.log("sender: " + data.senderUuid);
      const receiverUuid = socket.peerId;
      console.log("receiver: " + socket.peerId);

      const senderUser = connectedUsers[senderUuid];
      const receiverUser = connectedUsers[receiverUuid];

      io.to(uuidToSocketId[senderUuid]).emit(
        "update-friends-list",
        receiverUser
      );
      io.to(uuidToSocketId[receiverUuid]).emit(
        "update-friends-list",
        senderUser
      );

      console.log(
        `Emitting update-friends-list to ${senderUuid} and ${receiverUuid}`
      );
    } else {
      console.error("Target socket not found for target:", target);
    }

    console.log(
      "Friend request accepted by:",
      target,
      "from:",
      socket.peerId,
      "acceptingUser:",
      acceptingUser
    );
  });

  socket.on("initiateCall", (data) => {
    const targetPeerId = data.targetPeerId; // The peer ID of the user to call
    const callerUserData = connectedUsers[socket.peerId]; // Assuming the caller's user data is stored and keyed by their peer ID

    if (!targetPeerId || !callerUserData) {
      console.error("Invalid targetPeerId or caller user data not found.");
      return;
    }

    const targetSocketId = uuidToSocketId[targetPeerId];
    if (targetSocketId) {
      // Send a call initiation event to the target user including the caller's user data
      io.to(targetSocketId).emit("callInitiated", {
        fromPeerId: socket.peerId, // Include the caller's peer ID
        userData: callerUserData, // Include the caller's user data
      });
    } else {
      console.error("Target socket not found for peer ID:", targetPeerId);
    }
  });

  socket.on("disconnect", () => {
    if (socket.peerId && connectedUsers[socket.peerId]) {
      delete connectedUsers[socket.peerId];
      delete uuidToSocketId[socket.peerId];
      io.emit(
        "users-list",
        Object.values(connectedUsers).map((user) => ({
          peerId: user.peerId,
          name: user.name,
          lastName: user.lastName,
          username: user.username,
        }))
      );

      console.log(`User ${socket.peerId} disconnected`);
    }
  });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
