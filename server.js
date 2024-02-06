const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
app.use(cors);
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

  // socket.on("signaling-message", (data) => {
  //   const targetSocketId = uuidToSocketId[data.targetUuid];
  //   if (targetSocketId) {
  //     io.to(targetSocketId).emit("signaling-message", {
  //       fromUuid: socket.peerId,
  //       ...data,
  //     });
  //   }
  // });

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
    const acceptingUser = connectedUsers[socket.peerId]; // Assuming socket.peerId is the receiver's UUID

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
      // ... (possibly some validation of senderUser and receiverUser)

      // Emit an event to both the sender and the receiver to update their friends list
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
  socket.on("disconnect", () => {
    // Perform cleanup for the disconnected user
    if (socket.peerId && connectedUsers[socket.peerId]) {
      delete connectedUsers[socket.peerId];
      delete uuidToSocketId[socket.peerId];

      // Emit an updated users-list to all connected clients
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
  // socket.on("disconnect", () => {
  //   delete connectedUsers[socket.peerId];
  //   io.emit(
  //     "users-list",
  //     Object.values(connectedUsers).map((user) => ({
  //       peerId: user.peerId,
  //       name: user.name,
  //       lastName: user.lastName,
  //       username: user.username,
  //     }))
  //   );
  // });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
