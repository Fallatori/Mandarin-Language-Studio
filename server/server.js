// server/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const cookieParser = require("cookie-parser");
require("dotenv").config();

var db = require("./models");
db.sequelize.sync({ force: false });

const app = express();
const PORT = process.env.PORT || 5001; // Use port 5001 to avoid conflict with React default 3000
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_PATH = path.join(__dirname, "sentences.json");

const sentencesRouter = require("./routes/sentences");
const authRouter = require("./routes/auth");
const wordsRouter = require("./routes/words");

// --- Middleware ---
app.use(
	cors({
		origin: process.env.FRONTEND_URL,
		credentials: true,
	}),
);
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR)); // Serve audio files statically

// --- API Routes ---
app.use("/api/sentences", sentencesRouter);
app.use("/api/auth", authRouter);
app.use("/api/words", wordsRouter);

// --- Helper Functions for File DB ---
const readSentences = () => {
	try {
		if (!fs.existsSync(DB_PATH)) {
			fs.writeFileSync(DB_PATH, JSON.stringify([])); // Create if doesn't exist
		}
		const data = fs.readFileSync(DB_PATH, "utf8");
		return JSON.parse(data);
	} catch (error) {
		console.error("Error reading sentences DB:", error);
		return []; // Return empty array on error
	}
};

const writeSentences = (sentences) => {
	try {
		fs.writeFileSync(DB_PATH, JSON.stringify(sentences, null, 2)); // Pretty print JSON
	} catch (error) {
		console.error("Error writing sentences DB:", error);
	}
};

// PATCH - Mark a sentence as practiced
app.patch("/api/sentences/:id/practice", (req, res) => {
	const { id } = req.params;
	const sentences = readSentences();
	const sentenceIndex = sentences.findIndex((s) => s.id === id);

	if (sentenceIndex === -1) {
		return res.status(404).json({ message: "Sentence not found" });
	}

	sentences[sentenceIndex].lastPracticedAt = new Date().toISOString();
	writeSentences(sentences);

	res.json(sentences[sentenceIndex]); // Return the updated sentence
});

app.use((err, req, res, next) => {
	if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
		return res.status(400).json({
			status: "error",
			statuscode: 400,
			data: { result: "Invalid JSON in request body" },
		});
	}
	next();
});

// --- Start Server ---
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
	console.log(`Audio files served from: ${UPLOADS_DIR}`);
	console.log(`Sentence data stored in: ${DB_PATH}`);
});
