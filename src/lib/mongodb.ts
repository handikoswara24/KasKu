import { Db, MongoClient } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI?.trim();
  return Boolean(
    uri && (uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://"))
  );
}

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI belum dikonfigurasi pada environment variables.");
  }

  const dbName = process.env.MONGODB_DB_NAME?.trim() || "kasku_finance";

  if (!globalThis._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 8000,
    });
    globalThis._mongoClientPromise = client.connect().catch((err) => {
      globalThis._mongoClientPromise = undefined;
      throw err;
    });
  }

  try {
    const connectedClient = await globalThis._mongoClientPromise;
    return connectedClient.db(dbName);
  } catch (err) {
    globalThis._mongoClientPromise = undefined;
    throw err;
  }
}
