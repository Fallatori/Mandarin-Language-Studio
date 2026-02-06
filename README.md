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

TODO

Add documentation
english_translation now saves a text in database, should be varchar(string). Please look into this
Add verification to words added to database from sentence, before saved. Like You get to see a list of suggestions for words that will be added to the database based on your sentence.
verify creator_id matches req.user.id befor delete or update
Disable outer scroll when in the modal
Add option to edit pinyin from sentence
Plan a word/sentence game
Create a option for bulk upload data
Game idea - Get a english sentence, select the correct chinese sentence. (1 correct, 2 random from the users data)
Game idea - Write the chinese word for a color, when the color shows up
Game idea - association game, you get the word drink need to match with sentences or words that has something to do with the word "drink"
Game idea - Recognice the word, see the word and the it will mix with other words and you need to click the correct one.
Game idea - Recognice the correct chinese word, select between similar characters.
Game idea - Radical game, choose a word that matches a certain radical.
Find other radical based games
