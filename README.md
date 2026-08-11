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

Two one-off steps, in this order.

**1. Check nothing will be truncated.** `Sentences.english_translation` changed
from `TEXT` to `VARCHAR(512)`, and `sync({ alter: true })` rewrites the column on
the next start — anything longer is lost. Run this *before* restarting:

```
cd server
npm run check:lengths
```

It prints the longest value per column and exits non-zero if any row would not
fit.

**2. Backfill the word lists.** "My words" used to be derived from your sentences
and is now the `UserWords` table. Start the server (which adds the new columns),
then:

```
npm run backfill:userwords
```

Both scripts are idempotent. Until the backfill runs, existing users will see an
empty word list.

## TODO

### Done

- [x] Add verification to words added to database from sentence, before saved. Like You get to see a list of suggestions for words that will be added to the database based on your sentence. — `SentenceForm` preview step (`/analyze` → editable word list → Confirm & Save)
- [x] Create a option for bulk upload data — `BulkUploadForm` + `POST /api/sentences/bulk`, with duplicate detection
- [x] Add option to search for sentence in the deckbuilder. — search + pagination in the deck modal toolbar
- [x] Add option to edit deck — `openEditModal` in `DeckPage` + `PUT /api/decks/:id`
- [x] Add way to search for pinyin in the searchbar — pinyin is stored toneless (`STYLE_NORMAL`), so plain-letter search matches
- [x] Plan a word/sentence game — flashcards shipped with Chinese-front / English-front modes, deck + difficulty filters and SRS scheduling
- [x] verify creator_id matches req.user.id befor delete or update — `getOwnedSentence` / `getWordInUserList` guard every mutating route; deck updates only accept sentences you own. Non-owners get 403, missing rows 404

- [x] Add option to edit pinyin from sentence — `PUT /api/sentences/:id` takes pinyin + English; edit button on each sentence card. Chinese stays fixed so the word breakdown remains valid
- [x] Look into moving modal logic to own component — `components/Modal.jsx`, used by `SentencePage`, `DeckPage` and `WordPage`
- [x] Disable outer scroll when in the modal — body scroll lock in `Modal`, with scrollbar-width compensation so the page doesn't jump. Escape also closes
- [x] english_translation now saves a text in database, should be varchar(string) — `Sentences.english_translation` is now `VARCHAR(512)`. `chineseText` stays `TEXT`
- [x] Sentence search now runs server-side across every page, not just the loaded one

### In progress

- [ ] Find a logo to use for the project, change away from default google icon — `logo-yellow.svg` is the favicon, but the sidebar still uses the Material Symbols `translate` glyph
- [ ] Add documentation — README covers setup only; no API or architecture docs

### Not started

- [ ] Add chinese keyboard
- [ ] Deck builder still loads up to 1000 sentences and filters them client-side (`DeckPage`), unlike the sentence page

### Game ideas

Game idea - Get a english sentence, select the correct chinese sentence. (1 correct, 2 random from the users data)
Game idea - Write the chinese word for a color, when the color shows up
Game idea - association game, you get the word drink need to match with sentences or words that has something to do with the word "drink"
Game idea - Recognice the word, see the word and the it will mix with other words and you need to click the correct one.
Game idea - Recognice the correct chinese word, select between similar characters.
Game idea - Radical game, choose a word that matches a certain radical.
Find other radical based games
