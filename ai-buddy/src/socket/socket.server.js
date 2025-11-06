const { Server } = require("socket.io");
const authMiddleware = require('../middleware/auth.middleware');
const agent = require('../agent/agent');

const createSocketServer = (httpServer) => {
    const io = new Server(httpServer, {});

    io.use(authMiddleware);

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id);
        socket.on("message", async (data) => {
            const agentResponse = await agent.invoke({
                messages: [
                    { role: "user", content: data }
                ]
            },{
                metadata: { token: socket.token }
            });
            const lastMessage = agentResponse.messages[agentResponse.messages.length - 1];
            socket.emit("message", lastMessage.content);
        });
    });
};

module.exports = createSocketServer;