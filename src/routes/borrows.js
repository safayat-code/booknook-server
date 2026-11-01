import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";
import { verifyJWT } from "../auth.js";

const router = Router();
const LOAN_DAYS = 7;

// POST /borrows
router.post("/", verifyJWT, async (req, res, next) => {
  try {
    const bookId = String(req.body.bookId || "");
    if (!ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "That book link is not valid." });
    }
    const db = await getDb();
    const books = db.collection("books");
    const borrows = db.collection("borrows");
    const _id = new ObjectId(bookId);

    const book = await books.findOne({ _id });
    if (!book) return res.status(404).json({ message: "This book could not be found." });

    const already = await borrows.findOne({ bookId, userEmail: req.user.email });
    if (already) {
      return res.status(409).json({
        message: "You have already borrowed this book. Return it before borrowing it again.",
      });
    }

    // Take one copy only if one is left. Doing it in a single update avoids races.
    const taken = await books.updateOne(
      { _id, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } }
    );
    if (taken.modifiedCount === 0) {
      return res
        .status(409)
        .json({ message: "No copies of this book are available right now." });
    }

    const borrowDate = new Date();
    const returnDate = new Date(borrowDate.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
    const doc = {
      bookId,
      bookTitle: book.title,
      bookImage: book.image,
      userEmail: req.user.email,
      userName: req.user.name,
      borrowDate,
      returnDate,
    };
    try {
      const result = await borrows.insertOne(doc);
      res.status(201).json({ ...doc, _id: result.insertedId });
    } catch (err) {
      await books.updateOne({ _id }, { $inc: { availableCopies: 1 } });
      if (err.code === 11000) {
        return res.status(409).json({
          message: "You have already borrowed this book. Return it before borrowing it again.",
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

// GET /borrows - borrows of the logged in user
router.get("/", verifyJWT, async (req, res, next) => {
  try {
    const db = await getDb();
    const list = await db
      .collection("borrows")
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// DELETE /borrows/:id - return a book
router.delete("/:id", verifyJWT, async (req, res, next) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "That borrow record is not valid." });
    }
    const db = await getDb();
    const borrows = db.collection("borrows");
    const _id = new ObjectId(req.params.id);
    const borrow = await borrows.findOne({ _id, userEmail: req.user.email });
    if (!borrow) {
      return res.status(404).json({ message: "This borrow record could not be found." });
    }
    await borrows.deleteOne({ _id });
    if (ObjectId.isValid(borrow.bookId)) {
      await db
        .collection("books")
        .updateOne({ _id: new ObjectId(borrow.bookId) }, { $inc: { availableCopies: 1 } });
    }
    res.json({ returned: true });
  } catch (err) {
    next(err);
  }
});

export default router;
