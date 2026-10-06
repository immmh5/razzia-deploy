import { createClient, type Row, type Value } from "@libsql/client"
import { EXAMPLE_QUIZZ } from "@razzia/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzWithId,
} from "@razzia/common/types/game"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { nanoid } from "nanoid"

interface GameConfig {
  managerPassword: string
}

// LibSQL rows are array-like Records of Values; these describe the columns we
// select so reads are checked against the actual query.
interface QuizzRow extends Row {
  id: Value
  data: Value
}

interface ConfigRow extends Row {
  data: Value
}

interface CountRow extends Row {
  count: Value
}

// Reading a column is explicit so a bad row is caught here instead of
// corrupting a payload deeper in the app.
const readString = (row: Row, column: string): string => {
  const value = row[column]

  if (typeof value !== "string") {
    throw new Error(`Expected string at "${column}", got ${typeof value}`)
  }

  return value
}

// LibSQL (Turso) client. Falls back to a local embedded replica on disk when
// no database URL is configured, so local `pnpm dev` keeps working unchanged.
const configDir = process.env.CONFIG_PATH ?? "./config"
const dbUrl = process.env.TURSO_DATABASE_URL
const dbToken = process.env.TURSO_AUTH_TOKEN

export const client = createClient(
  dbUrl
    ? { url: dbUrl, authToken: dbToken }
    : { url: `file:${configDir}/razzia.db` },
)

let migrated = false

// Creates the schema if missing. Runs once per process; cheap to call on boot.
export const initConfig = async () => {
  if (migrated) {
    return
  }

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS game_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quizz (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `)

  // Seed default game config (manager password) when the table is empty.
  const configRow = await client.execute(
    "SELECT data FROM game_config WHERE id = 1",
  )

  if (configRow.rows.length === 0) {
    await client.execute({
      sql: "INSERT INTO game_config (id, data) VALUES (1, ?)",
      args: [JSON.stringify({ managerPassword: "PASSWORD" })],
    })
  }

  // Seed the example quizz when none exists yet.
  const quizzRow = await client.execute("SELECT COUNT(*) AS count FROM quizz")

  if (Number((quizzRow.rows[0] as unknown as CountRow).count) === 0) {
    await client.execute({
      sql: "INSERT INTO quizz (id, data) VALUES (?, ?)",
      args: [nanoid(), JSON.stringify(EXAMPLE_QUIZZ)],
    })
  }

  migrated = true
}

export const writeGameConfig = async (config: GameConfig) => {
  await client.execute({
    sql: "INSERT INTO game_config (id, data) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data",
    args: [JSON.stringify(config)],
  })
}

export const getGameConfig = async (): Promise<GameConfig> => {
  const result = await client.execute(
    "SELECT data FROM game_config WHERE id = 1",
  )

  if (result.rows.length === 0) {
    throw new Error("Game config not found")
  }

  try {
    return JSON.parse(readString(result.rows[0], "data")) as GameConfig
  } catch (error) {
    console.error("Failed to read game config:", error)
  }

  return {} as GameConfig
}

export const getQuizzMeta = async (): Promise<
  Array<{ id: string; subject: string }>
> => (await getQuizz()).map(({ id, subject }) => ({ id, subject }))

export const getQuizzById = async (id: string): Promise<QuizzWithId> => {
  const result = await client.execute({
    sql: "SELECT data FROM quizz WHERE id = ?",
    args: [id],
  })

  if (result.rows.length === 0) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const parsed = parseQuizz(readString(result.rows[0], "data"), id)

  if (!parsed) {
    throw new Error(`Quizz "${id}" is invalid`)
  }

  return parsed
}

export const getQuizz = async (): Promise<QuizzWithId[]> => {
  const result = await client.execute("SELECT id, data FROM quizz")

  return result.rows
    .map((row) =>
      parseQuizz(
        readString(row as unknown as QuizzRow, "data"),
        readString(row as unknown as QuizzRow, "id"),
      ),
    )
    .filter((quizz): quizz is QuizzWithId => quizz !== null)
}

// Validates a stored payload and attaches its id. Warns (without dropping the
// row) on schema drift so a bad record never silently deletes all quizzes.
const parseQuizz = (data: string, id: string): QuizzWithId | null => {
  try {
    const parsed: unknown = JSON.parse(data)
    const validate = quizzValidator.safeParse(parsed)

    if (!validate.success) {
      console.warn(`Invalid quizz record "${id}":`, validate.error.issues)

      return null
    }

    return { id, ...validate.data }
  } catch (error) {
    console.warn(`Unreadable quizz record "${id}":`, error)

    return null
  }
}

export const updateQuizz = async (
  id: string,
  data: unknown,
): Promise<{ id: string }> => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const existing = await client.execute({
    sql: "SELECT id FROM quizz WHERE id = ?",
    args: [id],
  })

  if (existing.rows.length === 0) {
    throw new Error(`Quizz "${id}" not found`)
  }

  await client.execute({
    sql: "UPDATE quizz SET data = ? WHERE id = ?",
    args: [JSON.stringify(result.data), id],
  })

  return { id }
}

export const deleteQuizz = async (id: string): Promise<void> => {
  const existing = await client.execute({
    sql: "SELECT id FROM quizz WHERE id = ?",
    args: [id],
  })

  if (existing.rows.length === 0) {
    throw new Error(`Quizz "${id}" not found`)
  }

  await client.execute({ sql: "DELETE FROM quizz WHERE id = ?", args: [id] })
}

export const saveResult = async (data: GameResult): Promise<void> => {
  try {
    await client.execute({
      sql: "INSERT INTO results (id, data) VALUES (?, ?)",
      args: [data.id, JSON.stringify(data)],
    })

    console.log(`Saved result for "${data.subject}"`)
  } catch (error) {
    console.error("Failed to save result:", error)
  }
}

export const getResultsMeta = async (): Promise<GameResultMeta[]> => {
  const result = await client.execute("SELECT data FROM results")

  return result.rows
    .map((row) => {
      try {
        const data = JSON.parse(readString(row, "data")) as GameResult

        return {
          id: data.id,
          subject: data.subject,
          date: data.date,
          playerCount: data.players.length,
        }
      } catch {
        return null
      }
    })
    .filter((meta): meta is GameResultMeta => meta !== null)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export const getResultById = async (id: string): Promise<GameResult> => {
  const result = await client.execute({
    sql: "SELECT data FROM results WHERE id = ?",
    args: [id],
  })

  if (result.rows.length === 0) {
    throw new Error(`Result "${id}" not found`)
  }

  return JSON.parse(readString(result.rows[0], "data")) as GameResult
}

export const deleteResult = async (id: string): Promise<void> => {
  const existing = await client.execute({
    sql: "SELECT id FROM results WHERE id = ?",
    args: [id],
  })

  if (existing.rows.length === 0) {
    throw new Error(`Result "${id}" not found`)
  }

  await client.execute({ sql: "DELETE FROM results WHERE id = ?", args: [id] })
}

export const saveQuizz = async (data: unknown): Promise<{ id: string }> => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const id = nanoid()

  await client.execute({
    sql: "INSERT INTO quizz (id, data) VALUES (?, ?)",
    args: [id, JSON.stringify(result.data)],
  })

  return { id }
}
