const express = require("express");
const router = express.Router();
const db = require("../models");
const authenticateToken = require("../middleware/auth");

router.get("/", authenticateToken, async (req, res) => {
	try {
		const decks = await db.Deck.findAll({
			where: { creator_id: req.user.id },
			include: [
				{
					model: db.Sentence,
					as: "sentences",
					attributes: ["id"],
				},
			],
		});
		res.json(decks);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "An error occurred while fetching decks." });
	}
});

router.post("/", authenticateToken, async (req, res) => {
	try {
		const { name, description, sentenceIds } = req.body;

		const deck = await db.Deck.create({
			name,
			description,
			creator_id: req.user.id,
		});

		if (sentenceIds && sentenceIds.length > 0) {
			await deck.setSentences(sentenceIds);
		}
		res.json(deck);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "An error occurred while creating deck." });
	}
});

router.put("/:id", authenticateToken, async (req, res) => {
	try {
		const { name, description, sentenceIds } = req.body;
		const deck = await db.Deck.findOne({
			where: { id: req.params.id, creator_id: req.user.id },
		});

		if (!deck) {
			return res.status(404).json({ error: "Deck not found" });
		}

		if (name) deck.name = name;
		if (description !== undefined) deck.description = description;
		await deck.save();

		if (sentenceIds) {
			await deck.setSentences(sentenceIds);
		}

		res.json(deck);
	} catch (error) {
		console.error("Error updating deck:", error);
		res.status(500).json({ error: "Failed to update deck" });
	}
});

router.delete("/:id", authenticateToken, async (req, res) => {
	try {
		await db.Deck.destroy({
			where: {
				id: req.params.id,
				creator_id: req.user.id,
			},
		});
		res.json({ success: true });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "An error occurred while deleting deck." });
	}
});

router.get("/:id/sentences", authenticateToken, async (req, res) => {
	try {
		const deck = await db.Deck.findOne({
			where: { id: req.params.id, creator_id: req.user.id },
			include: [{ model: db.Sentence, as: "sentences" }],
		});
		if (!deck) return res.status(404).json({ error: "Deck not found" });
		res.json(deck.sentences);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to fetch deck sentences" });
	}
});

module.exports = router;
