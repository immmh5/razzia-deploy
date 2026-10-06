import type { Server } from "@razzia/common/types/game/socket"
import { gameSocketHandlers } from "@razzia/socket/handlers/game"
import { managerSocketHandlers } from "@razzia/socket/handlers/manager"
import { quizzSocketHandlers } from "@razzia/socket/handlers/quizz"
import { resultsSocketHandlers } from "@razzia/socket/handlers/results"
import type { SocketHandler } from "@razzia/socket/handlers/types"
import { initConfig } from "@razzia/socket/services/config"
import Registry from "@razzia/socket/services/registry"
import { Server as ServerIO } from "socket.io"

const WS_PORT = 3001

const io: Server = new ServerIO({
  path: "/ws",
})
// Database is initialized before the socket server accepts connections so the
// schema and seeded rows are guaranteed present on the first client handshake.
initConfig()
  .then(() => {
    console.log("Database initialized")
  })
  .catch((error: unknown) => {
    console.error("Failed to initialize database:", error)
    process.exit(1)
  })

console.log(`Socket server running on port ${WS_PORT}`)
io.listen(WS_PORT)

const socketHandlers: SocketHandler[] = [
  managerSocketHandlers,
  quizzSocketHandlers,
  gameSocketHandlers,
  resultsSocketHandlers,
]

io.on("connection", (socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

  socketHandlers.forEach((handler) => {
    handler({ io, socket })
  })
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
