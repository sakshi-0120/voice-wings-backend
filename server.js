require('dotenv').config();
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const DbConnect = require("./database");
const router = require("./routes");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const ACTIONS = require("./actions");

const io = require("socket.io")(server, {
  cors: {
    origin: process.env.FRONT_URL,
    methods: ["GET", "POST"],
  },
});
function generateOTP() {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
}
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);

const sendSMS = async (body) => {
  // Define the message options
  let msgOptions = {
    body,
    to: '+918146558127', // Set the destination phone number
    from: '+18283830901' // Set your Twilio phone number
  };

  try {
    // Use the Twilio client to send the SMS
    const message = await client.messages.create(msgOptions);
    console.log(message);
  } catch (error) {
    console.error(error);
  }
};

sendSMS(`sms send to number ${generateOTP()}`)
// client.calls
//   .create({
//     url: 'https://voice-wings.onrender.com/',
//     body: 'This is the ship that made the Kessel Run in fourteen parsecs?',
//     to: '918146558127',
//     from: '+918146558127',
//   })
//   .then(call => console.log(call.sid))
//   .catch(err => console.log(err));

app.use(cookieParser());
const corsOption = {
  credentials: true,
  origin: [process.env.FRONT_URL, "http://localhost:3000"],
};
app.use(cors(corsOption));
app.use("/storage", express.static("storage"));

const PORT = process.env.PORT || 5500;
DbConnect();
app.use(express.json({ limit: "8mb" }));
app.use(router);

app.get("/", (req, res) => {
  res.send("Hello from express Js");
});

// Sockets
const socketUserMap = {};

io.on("connection", (socket) => {
  console.log("New connection", socket.id);
  socket.on(ACTIONS.JOIN, ({ roomId, user }) => {
    socketUserMap[socket.id] = user;
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    clients.forEach((clientId) => {
      io.to(clientId).emit(ACTIONS.ADD_PEER, {
        peerId: socket.id,
        createOffer: false,
        user,
      });
      socket.emit(ACTIONS.ADD_PEER, {
        peerId: clientId,
        createOffer: true,
        user: socketUserMap[clientId],
      });
    });
    socket.join(roomId);
  });

  socket.on(ACTIONS.RELAY_ICE, ({ peerId, icecandidate }) => {
    io.to(peerId).emit(ACTIONS.ICE_CANDIDATE, {
      peerId: socket.id,
      icecandidate,
    });
  });

  socket.on(ACTIONS.RELAY_SDP, ({ peerId, sessionDescription }) => {
    io.to(peerId).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerId: socket.id,
      sessionDescription,
    });
  });

  socket.on(ACTIONS.MUTE, ({ roomId, userId }) => {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    clients.forEach((clientId) => {
      io.to(clientId).emit(ACTIONS.MUTE, {
        peerId: socket.id,
        userId,
      });
    });
  });

  socket.on(ACTIONS.UNMUTE, ({ roomId, userId }) => {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    clients.forEach((clientId) => {
      io.to(clientId).emit(ACTIONS.UNMUTE, {
        peerId: socket.id,
        userId,
      });
    });
  });

  socket.on(ACTIONS.MUTE_INFO, ({ userId, roomId, isMute }) => {
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    clients.forEach((clientId) => {
      if (clientId !== socket.id) {
        console.log("mute info");
        io.to(clientId).emit(ACTIONS.MUTE_INFO, {
          userId,
          isMute,
        });
      }
    });
  });

  const leaveRoom = () => {
    const { rooms } = socket;
    Array.from(rooms).forEach((roomId) => {
      const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
      clients.forEach((clientId) => {
        io.to(clientId).emit(ACTIONS.REMOVE_PEER, {
          peerId: socket.id,
          userId: socketUserMap[socket.id]?.id,
        });

        // socket.emit(ACTIONS.REMOVE_PEER, {
        //     peerId: clientId,
        //     userId: socketUserMap[clientId]?.id,
        // });
      });
      socket.leave(roomId);
    });
    delete socketUserMap[socket.id];
  };

  socket.on(ACTIONS.LEAVE, leaveRoom);

  socket.on("disconnecting", leaveRoom);
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));