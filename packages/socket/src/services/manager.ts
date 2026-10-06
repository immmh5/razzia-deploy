import { EVENTS } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getQuizzMeta, getResultsMeta } from "@razzia/socket/services/config"
import { getClientId } from "@razzia/socket/utils/socket"

export const emitConfig = async (socket: SocketContext["socket"]) => {
  const [quizz, results] = await Promise.all([getQuizzMeta(), getResultsMeta()])

  socket.emit(EVENTS.MANAGER.CONFIG, { quizz, results })
}

class Manager {
  private loggedClients = new Set()

  isLogged(socket: Socket) {
    return this.loggedClients.has(getClientId(socket))
  }

  login(socket: Socket) {
    this.loggedClients.add(getClientId(socket))
  }

  logout(socket: Socket) {
    this.loggedClients.delete(getClientId(socket))
  }

  // Handlers may be async (database access); the wrapper keeps a void return so
  // socket.io's listener contract holds, and a rejected handler never crashes
  // the socket.
  withAuth<T extends unknown[]>(
    socket: Socket,
    handler: (..._args: T) => void | Promise<void>,
  ) {
    return (..._args: T) => {
      if (!this.isLogged(socket)) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      void Promise.resolve(handler(..._args)).catch((error: unknown) => {
        console.error("Socket handler failed:", error)
      })
    }
  }
}

export default new Manager()
