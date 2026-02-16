const express = require("express");
const router = express.Router();
const db = require("../models");
const authenticateToken = require("../middleware/auth");

router.get("/", authenticateToken, async (req, res) => {
	try {
		const groups = await db.CardGroup.findAll({
			where: { creator_id: req.user.id },
			include: [
				{
					model: db.Sentence,
					as: "sentences",
					attributes: ["id"],
				},
			],
		});
		res.json(groups);
	} catch (error) {
		console.error(error);
		res
			.status(500)
			.json({ error: "An error occurred while fetching card groups." });
	}
});

router.post("/", authenticateToken, async (req, res) => {
	try {
		const { name, description, sentenceIds } = req.body;

		const group = await db.CardGroup.create({
			name,
			description,
			creator_id: req.user.id,
		});

		if (sentenceIds && sentenceIds.length > 0) {
			await group.setSentences(sentenceIds);
		}
		res.json(group);
	} catch (error) {
		console.error(error);
		res
			.status(500)
			.json({ error: "An error occurred while creating card group." });
	}
});

router.delete("/:id", authenticateToken, async (req, res) => {
	try {
		await db.CardGroup.destroy({
			where: {
				id: req.params.id,
				creator_id: req.user.id,
			},
		});
		res.json({ success: true });
	} catch (error) {
		console.error(error);
		res
			.status(500)
			.json({ error: "An error occurred while deleting card group." });
	}
});

router.get("/:id/sentences", authenticateToken, async (req, res) => {
	try {
		const group = await db.CardGroup.findOne({
			where: { id: req.params.id, creator_id: req.user.id },
			include: [{ model: db.Sentence, as: "sentences" }],
		});
		if (!group) return res.status(404).json({ error: "Group not found" });
		res.json(group.sentences);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Failed to fetch group sentences" });
	}
});

module.exports = router;
