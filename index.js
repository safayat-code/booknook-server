import "dotenv/config";
import express from "express";
import cors from "cors";
import booksRouter from "./src/routes/books.js";
import borrowsRouter from "./src/routes/borrows.js";

const app = express();

const allowed = (process.env.CLIENT_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""));

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin) || origin === "http://localhost:3000") {
        return cb(null, true);
      }
      cb(new Error("Origin not allowed"));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

app.get("/", (req, res) => res.json({ name: "BookNook API", status: "ok" }));
app.use("/books", booksRouter);
app.use("/borrows", borrowsRouter);

app.use((req, res) => res.status(404).json({ message: "Route not found." }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "The server hit a problem. Please try again." });
});

if (!process.env.VERCEL) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`BookNook API running on port ${port}`));
}

export default app;
