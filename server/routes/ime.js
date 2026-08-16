const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { suggestQuery } = require("../utils/pinyinIme");

router.use(authenticateToken);

router.get("/", (req, res) => {
	try {
		const q = String(req.query.q || "");
		if (!q || q.length > 80) {
			return res.json({ candidates: [] });
		}
		res.json({ candidates: suggestQuery(q) });
	} catch (err) {
		if (err.status) {
			return res.status(err.status).json({ error: err.message });
		}
		console.error("IME suggest failed:", err);
		res.status(500).json({ error: "Failed to suggest hanzi" });
	}
});

module.exports = router;
