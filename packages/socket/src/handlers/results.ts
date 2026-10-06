import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { deleteResult, getResultById } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"

export const resultsSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.RESULTS.GET,
    manager.withAuth(socket, async (id) => {
      try {
        socket.emit(EVENTS.RESULTS.DATA, await getResultById(id))
      } catch (error) {
        console.error("Failed to get result:", error)
      }
    }),
  )

  socket.on(
    EVENTS.RESULTS.DELETE,
    manager.withAuth(socket, async (id) => {
      try {
        await deleteResult(id)
        await emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete result:", error)
      }
    }),
  )
}
