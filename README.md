# BookNook Server

Express + MongoDB API for [BookNook](https://YOUR-CLIENT.vercel.app), a small online library.

## Routes

| Method | Path | Access | What it does |
| --- | --- | --- | --- |
| GET | /books | public | All books, newest first (`?limit=`, `?category=`, `?search=`, `?addedBy=`) |
| GET | /books/:id | JWT | One book |
| POST | /books | JWT | Add a book |
| PATCH | /books/:id | JWT, owner | Update a book |
| DELETE | /books/:id | JWT, owner | Delete a book |
| POST | /borrows | JWT | Borrow a book (`$inc` copies -1, blocks double borrow) |
| GET | /borrows | JWT | Borrows of the logged in user |
| DELETE | /borrows/:id | JWT | Return a book (`$inc` copies +1) |

## Auth

The client uses Better Auth with its `jwt` plugin. Every protected request sends
`Authorization: Bearer <token>`. This server verifies the token with the public keys at
`AUTH_URL/api/auth/jwks` (using `jose`) and reads the user email from the token.

## Run locally

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI
npm run dev
```

## Deploy on Vercel

Import the repo, add `MONGODB_URI`, `MONGODB_DB`, `CLIENT_URL` and `AUTH_URL` as environment
variables, and allow `0.0.0.0/0` in MongoDB Atlas Network Access.
