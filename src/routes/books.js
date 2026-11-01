import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";
import { verifyJWT } from "../auth.js";

const router = Router();
const CATEGORIES = ["Fiction", "Science", "History", "Kids", "Others"];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanBook(body) {
  const title = String(body.title || "").trim();
  const author = String(body.author || "").trim();
  const category = String(body.category || "");
  const image = String(body.image || "").trim();
  const description = String(body.description || "").trim();
  const totalCopies = Number(body.totalCopies);
  if (!title || !author || !image || !description) {
    return { error: "Title, author, image and description are all required." };
  }
  if (!CATEGORIES.includes(category)) {
    return { error: "Pick one of the listed categories." };
  }
  if (!Number.isInteger(totalCopies) || totalCopies < 1) {
    return { error: "Total copies must be a whole number of at least 1." };
  }
  return { value: { title, author, category, image, description, totalCopies } };
}

// GET /books  (public) - newest first. Optional: ?limit=6&category=Fiction&search=term&addedBy=email
router.get("/", async (req, res, next) => {
  try {
    const db = await getDb();
    const { category, search, addedBy, limit } = req.query;
    const query = {};
    if (category && category !== "All") query.category = String(category);
    if (addedBy) query.addedByEmail = String(addedBy);
    if (search) {
      const rx = { $regex: escapeRegex(String(search)), $options: "i" };
      query.$or = [{ title: rx }, { author: rx }];
    }
    let cursor = db.collection("books").find(query).sort({ createdAt: -1 });
    const n = parseInt(limit, 10);
    if (n > 0) cursor = cursor.limit(Math.min(n, 100));
    res.json(await cursor.toArray());
  } catch (err) {
    next(err);
  }
});

// GET /books/:id
router.get("/:id", verifyJWT, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const db = await getDb();
    const book = await db
      .collection("books")
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!book) return res.status(404).json({ message: "This book could not be found." });
    res.json(book);
  } catch (err) {
    next(err);
  }
});

// POST /books
router.post("/", verifyJWT, async (req, res, next) => {
  try {
    const { value, error } = cleanBook(req.body);
    if (error) return res.status(400).json({ message: error });
    const db = await getDb();
    const doc = {
      ...value,
      availableCopies: value.totalCopies,
      addedByName: req.user.name,
      addedByEmail: req.user.email,
      createdAt: new Date(),
    };
    const result = await db.collection("books").insertOne(doc);
    res.status(201).json({ ...doc, _id: result.insertedId });
  } catch (err) {
    next(err);
  }
});

// PATCH /books/:id  (owner only)
router.patch("/:id", verifyJWT, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const db = await getDb();
    const books = db.collection("books");
    const _id = new ObjectId(req.params.id);
    const book = await books.findOne({ _id });
    if (!book) return res.status(404).json({ message: "This book could not be found." });
    if (book.addedByEmail !== req.user.email) {
      return res.status(403).json({ message: "You can only edit books you added." });
    }
    const { value, error } = cleanBook({ ...book, ...req.body });
    if (error) return res.status(400).json({ message: error });

    const borrowed = book.totalCopies - book.availableCopies;
    if (value.totalCopies < borrowed) {
      return res.status(400).json({
        message: `${borrowed} ${borrowed === 1 ? "copy is" : "copies are"} currently borrowed, so total copies cannot go below ${borrowed}.`,
      });
    }
    const set = {
      ...value,
      availableCopies: value.totalCopies - borrowed,
      updatedAt: new Date(),
    };
    await books.updateOne({ _id }, { $set: set });
    res.json({ ...book, ...set });
  } catch (err) {
    next(err);
  }
});

// DELETE /books/:id  (owner only)
router.delete("/:id", verifyJWT, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const db = await getDb();
    const _id = new ObjectId(req.params.id);
    const book = await db.collection("books").findOne({ _id });
    if (!book) return res.status(404).json({ message: "This book could not be found." });
    if (book.addedByEmail !== req.user.email) {
      return res.status(403).json({ message: "You can only delete books you added." });
    }
    await db.collection("books").deleteOne({ _id });
    await db.collection("borrows").deleteMany({ bookId: req.params.id });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
