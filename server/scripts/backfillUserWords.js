// One-off, idempotent: node scripts/backfillUserWords.js
const db = require("../models");

async function main() {
	await db.sequelize.authenticate();

	const [pairs] = await db.sequelize.query(
		`
		SELECT DISTINCT s.creator_id AS user_id, sw.word_id AS word_id
		FROM SentenceWords sw
		JOIN Sentences s ON s.id = sw.sentence_id
		WHERE s.creator_id IS NOT NULL
		UNION
		SELECT w.creator_id AS user_id, w.id AS word_id
		FROM Words w
		WHERE w.creator_id IS NOT NULL
	`,
		{ logging: false },
	);

	if (pairs.length === 0) {
		console.log("Nothing to backfill.");
		return;
	}

	const before = await db.UserWord.count();
	await db.UserWord.bulkCreate(
		pairs.map((pair) => ({ user_id: pair.user_id, word_id: pair.word_id })),
		{ ignoreDuplicates: true },
	);
	const after = await db.UserWord.count();

	console.log(`Found ${pairs.length} user/word pairs.`);
	console.log(`UserWords rows: ${before} -> ${after} (${after - before} new).`);
}

main()
	.catch((error) => {
		console.error("Backfill failed:", error);
		process.exitCode = 1;
	})
	.finally(() => db.sequelize.close());
