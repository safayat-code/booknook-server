import { MongoClient } from "mongodb";

let dbPromise;

export function getDb() {
  if (!dbPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    dbPromise = client
      .connect()
      .then(async (c) => {
        const db = c.db(process.env.MONGODB_DB || "booknook");
        // One active borrow per user and book, enforced by the database too.
        await db
          .collection("borrows")
          .createIndex({ bookId: 1, userEmail: 1 }, { unique: true });
        return db;
      })
      .catch((err) => {
        dbPromise = undefined;
        throw err;
      });
  }
  return dbPromise;
}
