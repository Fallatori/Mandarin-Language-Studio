// server/server.js
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

var db = require("./models");
db.sequelize.sync({ force: true });

const app = express();
const PORT = process.env.PORT || 5001; // Use port 5001 to avoid conflict with React default 3000
const UPLOADS_DIR = path.join(__dirname, "uploads");
const DB_PATH = path.join(__dirname, "sentences.json");

const sentencesRouter = require("./routes/sentences");

// --- Middleware ---
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON request bodies
app.use("/uploads", express.static(UPLOADS_DIR)); // Serve audio files statically

// --- API Routes ---
app.use("/api/sentences", sentencesRouter);

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

// --- Multer Configuration for Audio Upload ---
// const storage = multer.diskStorage({
// 	destination: function (req, file, cb) {
// 		// Ensure uploads directory exists
// 		if (!fs.existsSync(UPLOADS_DIR)) {
// 			fs.mkdirSync(UPLOADS_DIR);
// 		}
// 		cb(null, UPLOADS_DIR);
// 	},
// 	filename: function (req, file, cb) {
// 		// Create a unique filename to avoid overwrites
// 		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
// 		const extension = path.extname(file.originalname);
// 		cb(null, file.fieldname + "-" + uniqueSuffix + extension);
// 	},
// });

// const upload = multer({
// 	storage: storage,
// 	fileFilter: (req, file, cb) => {
// 		// Basic audio file type check (add more mimetypes as needed)
// 		if (file.mimetype.startsWith("audio/")) {
// 			cb(null, true);
// 		} else {
// 			cb(new Error("Only audio files are allowed!"), false);
// 		}
// 	},
// }); // Field name for audio file will be 'audioFile'

// --- API Routes ---

// GET all sentences
// app.get("/api/sentences", (req, res) => {
// 	const sentences = readSentences();
// 	res.json(sentences);
// });

// POST a new sentence (with audio upload)
// app.post("/api/sentences", upload.single("audioFile"), (req, res) => {
// 	try {
// 		const { chineseText, pinyin, englishTranslation } = req.body;
// 		const audioFile = req.file; // File info from multer

// 		if (!chineseText || !pinyin || !englishTranslation) {
// 			return res.status(400).json({ message: "Missing required text fields." });
// 		}

// 		const newSentence = {
// 			id: uuidv4(), // Generate unique ID
// 			chineseText,
// 			pinyin,
// 			englishTranslation,
// 			audioFilename: audioFile ? audioFile.filename : null, // Store filename or null
// 			// Construct URL on the fly or store full URL if base URL is fixed
// 			// audioUrl: audioFile ? `/uploads/${audioFile.filename}` : null,
// 			createdAt: new Date().toISOString(),
// 			lastPracticedAt: null, // Initially not practiced
// 		};

// 		const sentences = readSentences();
// 		sentences.push(newSentence);
// 		writeSentences(sentences);

// 		res.status(201).json(newSentence);
// 	} catch (error) {
// 		console.error("Error creating sentence:", error);
// 		// Clean up uploaded file if DB write fails? More complex logic needed for robustness.
// 		res
// 			.status(500)
// 			.json({ message: "Error saving sentence", error: error.message });
// 	}
// });

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

// DELETE a sentence
// app.delete("/api/sentences/:id", (req, res) => {
// 	const { id } = req.params;
// 	let sentences = readSentences();
// 	const sentenceIndex = sentences.findIndex((s) => s.id === id);

// 	if (sentenceIndex === -1) {
// 		return res.status(404).json({ message: "Sentence not found" });
// 	}

// 	// --- Delete Associated Audio File ---
// 	const sentenceToDelete = sentences[sentenceIndex];
// 	if (sentenceToDelete.audioFilename) {
// 		const audioPath = path.join(UPLOADS_DIR, sentenceToDelete.audioFilename);
// 		fs.unlink(audioPath, (err) => {
// 			if (err) {
// 				// Log error but continue deleting DB record - maybe file was already gone?
// 				console.error(`Failed to delete audio file ${audioPath}:`, err);
// 			} else {
// 				console.log(`Deleted audio file: ${audioPath}`);
// 			}
// 		});
// 	}

// 	// Filter out the sentence
// 	sentences = sentences.filter((s) => s.id !== id);
// 	writeSentences(sentences);

// 	res.status(204).send(); // No content response
// });

// --- Start Server ---
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
	console.log(`Audio files served from: ${UPLOADS_DIR}`);
	console.log(`Sentence data stored in: ${DB_PATH}`);
});
