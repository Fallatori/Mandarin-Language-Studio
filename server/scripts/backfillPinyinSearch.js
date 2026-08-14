// usage: node scripts/backfillPinyinSearch.js [--apply]
//
// Dry run by default; pass --apply to write. Fills pinyin_search on Words and
// Sentences for rows saved before the column existed. Idempotent.

const db = require("../models");
const { normalizePinyin } = require("../utils/pinyinSearch");

const apply = process.argv.includes("--apply");

async function backfill(model, label) {
	const rows = await model.findAll();
	const stale = rows.filter(
		(row) => row.pinyinSearch !== normalizePinyin(row.pinyin),
	);

	console.log(`${label}: ${rows.length} rows, ${stale.length} to update`);
	for (const row of stale.slice(0, 5)) {
		console.log(
			`   ${row.pinyin}  ->  ${normalizePinyin(row.pinyin)}`,
		);
	}
	if (stale.length > 5) console.log(`   ... and ${stale.length - 5} more`);

	if (!apply) return 0;

	for (const row of stale) {
		await model.update(
			{ pinyinSearch: normalizePinyin(row.pinyin) },
			{ where: { id: row.id }, hooks: false, silent: true },
		);
	}
	return stale.length;
}

async function main() {
	const words = await backfill(db.Word, "Words");
	const sentences = await backfill(db.Sentence, "Sentences");

	if (apply) {
		console.log(`\nUpdated ${words} words and ${sentences} sentences.`);
	} else {
		console.log("\nDry run. Re-run with --apply to write these changes.");
	}

	await db.sequelize.close();
}

main().catch(async (error) => {
	console.error(error);
	await db.sequelize.close();
	process.exit(1);
});
