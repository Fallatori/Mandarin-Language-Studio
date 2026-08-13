const express = require("express");
const router = express.Router();
const db = require("../models");
const StoryService = require("../services/StoryService");
const storyService = new StoryService(db);
const authenticateToken = require("../middleware/auth");

router.use(authenticateToken);

function fail(res, err, message) {
	if (err.status) {
		return res.status(err.status).json({ error: err.message });
	}
	console.error(`${message}:`, err);
	res.status(500).json({ error: message });
}

router.post("/analyze", async (req, res) => {
	try {
		const analysis = await storyService.analyzeStory(
			req.body.chineseText,
			req.user.id,
			{ maxLength: req.body.maxLength },
		);
		res.json(analysis);
	} catch (err) {
		fail(res, err, "Failed to analyze story");
	}
});

router.post("/import", async (req, res) => {
	try {
		const result = await storyService.importStory(req.body, req.user.id);
		res.status(201).json(result);
	} catch (err) {
		fail(res, err, "Failed to import story");
	}
});

router.post("/", async (req, res) => {
	try {
		const result = await storyService.createStory(req.body, req.user.id);
		res.status(201).json(result);
	} catch (err) {
		fail(res, err, "Failed to save story");
	}
});

router.get("/", async (req, res) => {
	try {
		const stories = await storyService.getStoriesByUser(req.user.id);
		res.json(stories);
	} catch (err) {
		fail(res, err, "Failed to fetch stories");
	}
});

router.get("/:id", async (req, res) => {
	try {
		const story = await storyService.readStory(req.params.id, req.user.id, {
			maxLength: req.query.maxLength,
		});
		res.json(story);
	} catch (err) {
		fail(res, err, "Failed to fetch story");
	}
});

router.post("/:id/sentences", async (req, res) => {
	try {
		const sentence = await storyService.saveCustomSentence(
			req.params.id,
			req.body.clauses,
			req.user.id,
		);
		res.status(201).json(sentence);
	} catch (err) {
		fail(res, err, "Failed to save sentence");
	}
});

router.delete("/:id", async (req, res) => {
	try {
		await storyService.deleteStory(req.params.id, req.user.id);
		res.status(204).send();
	} catch (err) {
		fail(res, err, "Failed to delete story");
	}
});

module.exports = router;
