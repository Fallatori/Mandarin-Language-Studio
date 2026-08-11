# Quick Start

1. **Clone the repository**

```
   git clone https://github.com/Fallatori/Mandarin-Language-Studio
   cd Mandarin-Language-Studio
```

2. **Set up environment variables**

- Copy `server/env_example` to `server/.env` and fill in your values:
  ```
  cp server/env_example [.env](http://_vscodecontentref_/0)
  ```
- Edit `server/.env` with your MySQL credentials and secrets.

3. **Create MySQL database and user**

- Create a database and user matching your `.env` file.
- Grant the user necessary privileges.

4. **Install backend dependencies**

```
cd server
npm install
```

5. **Start the backend server**

```
npm start
```

- The backend runs on [http://localhost:5001](http://localhost:5001)

6. **Install frontend dependencies**

```
cd ../client
npm install
```

7. **Start the frontend app**

```
npm run dev
```

- The frontend runs on [http://localhost:5173](http://localhost:5173)

8. **Login/Register**

- Open [http://localhost:5173](http://localhost:5173) in your browser.
- Register a new user or login with your credentials.

---

**Note:**

- Endpoints are protected; you must be logged in to use the app.
- Make sure your MySQL server is running and accessible.

## How words are stored

Words are shared, deduplicated rows — `chineseWord` is unique, so when two users
write a sentence containing 好 they link to the same `Words` row. Editing works
on two levels so that sharing storage never means sharing mistakes:

| Who | What an edit does |
| --- | --- |
| The word's creator | Updates the shared row. Everyone who has not personalised it sees the improvement. |
| Any other user | Saves a personal override on their `UserWords` row. Nobody else sees it. |
| Anyone, on a locked word | Rejected with 403. Lesson content reads identically for every student. |

`UserWords` is the list of words a user has: one row per (user, word), holding
their optional `pinyin` / `english_translation` overrides plus practice
progress. Reads return the override where present and the shared value
otherwise, so an override set back to the shared value is stored as `NULL` and
the user keeps inheriting later corrections.

Removing a word leaves your list — it never destroys a row other users still
hold. The shared row is only deleted when its creator removes it and nobody else
has it.

Teacher/lesson words are marked `is_locked` on the `Words` row. Their creator
can still edit them; nobody else can edit or override them.

### Migrating an existing database

"My words" used to be derived from your sentences and is now the `UserWords`
table, so an existing database needs a one-off backfill. Start the server first
(it runs `sync({ alter: true })` outside production and adds the new columns),
then:

```
cd server
npm run backfill:userwords
```

The script is idempotent. Until it runs, existing users will see an empty word
list.

## TODO

### Done

- [x] Add verification to words added to database from sentence, before saved. Like You get to see a list of suggestions for words that will be added to the database based on your sentence. — `SentenceForm` preview step (`/analyze` → editable word list → Confirm & Save)
- [x] Create a option for bulk upload data — `BulkUploadForm` + `POST /api/sentences/bulk`, with duplicate detection
- [x] Add option to search for sentence in the deckbuilder. — search + pagination in the deck modal toolbar
- [x] Add option to edit deck — `openEditModal` in `DeckPage` + `PUT /api/decks/:id`
- [x] Add way to search for pinyin in the searchbar — pinyin is stored toneless (`STYLE_NORMAL`), so plain-letter search matches
- [x] Plan a word/sentence game — flashcards shipped with Chinese-front / English-front modes, deck + difficulty filters and SRS scheduling
- [x] verify creator_id matches req.user.id befor delete or update — `getOwnedSentence` / `getOwnedWord` guard every mutating route; deck updates only accept sentences you own. Non-owners get 403, missing rows 404

### In progress

- [ ] Add option to edit pinyin from sentence — a word's pinyin is editable on the word page, but a sentence's own pinyin is read-only (no `PUT /api/sentences/:id`)
- [ ] Find a logo to use for the project, change away from default google icon — `logo-yellow.svg` is the favicon, but the sidebar still uses the Material Symbols `translate` glyph
- [ ] Add documentation — README covers setup only; no API or architecture docs

### Not started

- [ ] english_translation now saves a text in database, should be varchar(string). Please look into this — still `DataTypes.TEXT` (so is `chineseText`)
- [ ] Disable outer scroll when in the modal — no body scroll lock; the page behind the modal still scrolls
- [ ] Look into moving modal logic to own component — overlay/close markup is duplicated in `SentencePage`, `DeckPage` and `WordPage`
- [ ] Add chinese keyboard
- [ ] Sentence search only filters the currently loaded page, so matches on later pages are missed

### Game ideas

Game idea - Get a english sentence, select the correct chinese sentence. (1 correct, 2 random from the users data)
Game idea - Write the chinese word for a color, when the color shows up
Game idea - association game, you get the word drink need to match with sentences or words that has something to do with the word "drink"
Game idea - Recognice the word, see the word and the it will mix with other words and you need to click the correct one.
Game idea - Recognice the correct chinese word, select between similar characters.
Game idea - Radical game, choose a word that matches a certain radical.
Find other radical based games
