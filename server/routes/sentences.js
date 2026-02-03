const express = require("express");
const router = express.Router();
const db = require("../models");
const SentenceService = require("../services/SentenceService");
const sentenceService = new SentenceService(db);
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authenticateToken = require("../middleware/auth");

const MAX_TRANSLATIONS_PER_DAY = 20;

// Ensure the uploads directory exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		const extension = path.extname(file.originalname);
		cb(null, file.fieldname + "-" + uniqueSuffix + extension);
	},
});

const upload = multer({
	storage: storage,
	fileFilter: (req, file, cb) => {
		if (file.mimetype.startsWith("audio/")) {
			cb(null, true);
		} else {
			cb(new Error("Only audio files are allowed!"), false);
		}
	},
});

router.use(authenticateToken);

router.post("/analyze", async (req, res) => {
	try {
		const { chineseText } = req.body;
		if (!chineseText) {
			return res.status(400).json({ message: "Text is required" });
		}
		const result = await sentenceService.analyzeSentence(
			chineseText,
			req.user.id,
		);
		res.json(result);
	} catch (error) {
		console.error("Analysis endpoint error:", error);
		if (error.message.includes("Daily translation limit")) {
			return res.status(429).json({ message: error.message });
		}
		res.status(500).json({ message: "Analysis failed" });
	}
});

router.post("/translate", async (req, res) => {
	try {
		const { text, targetLang } = req.body;
		if (!text) {
			return res.status(400).json({ message: "Text is required" });
		}

		const userId = req.user.id;
		const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

		const [quota] = await db.UserTranslationQuota.findOrCreate({
			where: { user_id: userId, date: today },
			defaults: { count: 0 },
		});

		if (quota.count >= MAX_TRANSLATIONS_PER_DAY) {
			return res.status(429).json({
				message: `Daily translation limit of ${MAX_TRANSLATIONS_PER_DAY} reached.`,
			});
		}

		const translation = await sentenceService.translateText(text, targetLang);

		await quota.increment("count");

		res.json({ translation });
	} catch (error) {
		console.error("Translation endpoint error:", error);
		res.status(500).json({ message: "Translation failed" });
	}
});

router.get("/", async (req, res) => {
	try {
		// const sentences = await sentenceService.getAllSentences();
		const sentences = await sentenceService.getSentencesByUser(req.user.id);

		if (sentences == null) {
			return res
				.status(404)
				.json({ message: "No sentences found for this user." });
		}

		res.json(sentences);
	} catch (error) {
		console.error("Error fetching sentences:", error);
		res.status(500).json({ message: "Failed to fetch sentences." });
	}
});

router.post("/", upload.single("audioFile"), async (req, res) => {
	try {
		const { chineseText, englishTranslation, definedWords } = req.body;

		if (!chineseText || !englishTranslation) {
			return res.status(400).json({ message: "Missing required fields." });
		}

		const existingSentence =
			await sentenceService.getSentenceByName(chineseText);
		if (existingSentence) {
			return res
				.status(400)
				.json({ message: "Sentence with this Chinese text already exists." });
		}

		let parsedWords = [];
		if (definedWords) {
			try {
				parsedWords = JSON.parse(definedWords);
			} catch (e) {
				console.warn("Could not parse definedWords", e);
			}
		}

		const audioFilename = req.file ? req.file.filename : null;

		const newSentence = await sentenceService.addSentence({
			chineseText: chineseText,
			englishTranslation: englishTranslation,
			audioFilename: audioFilename,
			creator_id: req.user.id,
			definedWords: parsedWords,
		});

		res.status(201).json(newSentence);
	} catch (error) {
		console.error("Error adding sentence:", error);

		if (error.message.includes("Daily translation limit")) {
			return res.status(429).json({ message: error.message });
		}

		res.status(500).json({ message: "Failed to add sentence." });
	}
});

router.patch("/:id/practice", async (req, res) => {
	const { id } = req.params;

	try {
		const updatedSentence = await sentenceService.markAsPracticed(id);
		res.json(updatedSentence);
	} catch (error) {
		console.error("Error marking sentence as practiced:", error);
		res.status(500).json({ message: "Failed to mark sentence as practiced." });
	}
});

router.delete("/:id", async (req, res) => {
	const { id } = req.params;

	try {
		const sentence = await sentenceService.getSentenceById(id);

		if (sentence && sentence.audioFilename) {
			const filePath = path.join(
				__dirname,
				"..",
				"uploads",
				sentence.audioFilename,
			);

			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		}

		await sentenceService.deleteSentence(id);
		res.status(204).send();
	} catch (error) {
		console.error("Error deleting sentence:", error);
		res.status(500).json({ message: "Failed to delete sentence." });
	}
});

module.exports = router;
