// usage: node scripts/refreshWordGlosses.js [path/to/cedict_ts.u8] [--apply]
//
// Dry run by default; pass --apply to write. Rewrites Words rows that were
// filled in by an earlier, buggier dictionary build and leaves everything a
// person touched alone. Per-user UserWords overrides are never read or written.

const fs = require("fs");
const db = require("../models");
const {
	tonePinyin,
	cleanDefinitions,
	joinSenses,
	resolveSource,
} = require("./buildDictionary");

const apply = process.argv.includes("--apply");
const sourceArg = process.argv.slice(2).find((a) => !a.startsWith("--"));

function legacyCandidates(sourcePath) {
	const lines = fs.readFileSync(sourcePath, "utf8").split("\n");
	const seen = new Set();
	const candidates = new Map();

	for (const line of lines) {
		if (!line || line.startsWith("#")) continue;

		const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]*)\]\s+\/(.*)\/\s*$/);
		if (!match) continue;

		const [, , simplified, rawPinyin, defBlock] = match;
		const definitions = cleanDefinitions(defBlock);
		if (definitions.length === 0) continue;

		if (seen.has(simplified)) continue;
		seen.add(simplified);

		candidates.set(simplified, {
			pinyin: tonePinyin(rawPinyin),
			glosses: new Set([
				definitions.slice(0, 3).join("; "),
				joinSenses(definitions),
			]),
		});
	}

	return candidates;
}

async function main() {
	const sourcePath = resolveSource(sourceArg);
	const current = JSON.parse(
		fs.readFileSync(require("path").join(__dirname, "..", "data", "cedict.json"), "utf8"),
	);
	const legacy = legacyCandidates(sourcePath);

	const words = await db.Word.findAll();
	const changes = [];
	const skipped = [];

	for (const word of words) {
		const fresh = current[word.chineseWord];
		if (!fresh) continue;

		const [freshPinyin, freshGloss] = fresh;
		const old = legacy.get(word.chineseWord);

		const storedGloss = word.englishTranslation || "";
		const machineWritten =
			storedGloss === "" ||
			storedGloss === freshGloss ||
			(old && old.glosses.has(storedGloss));

		if (!machineWritten) {
			skipped.push(word.chineseWord);
			continue;
		}
		if (storedGloss === freshGloss && word.pinyin === freshPinyin) continue;

		changes.push({
			id: word.id,
			chineseWord: word.chineseWord,
			from: { pinyin: word.pinyin, gloss: storedGloss },
			to: { pinyin: freshPinyin, gloss: freshGloss },
		});
	}

	console.log(`Words in database: ${words.length}`);
	console.log(`Left alone (hand-written or edited): ${skipped.length}`);
	console.log(`Would update: ${changes.length}\n`);

	for (const c of changes) {
		console.log(`  ${c.chineseWord}`);
		console.log(`    pinyin  ${c.from.pinyin}  ->  ${c.to.pinyin}`);
		console.log(`    gloss   ${c.from.gloss || "(empty)"}`);
		console.log(`            ${c.to.gloss}`);
	}

	if (!apply) {
		console.log("\nDry run. Re-run with --apply to write these changes.");
		await db.sequelize.close();
		return;
	}

	const transaction = await db.sequelize.transaction();
	try {
		for (const c of changes) {
			await db.Word.update(
				{ pinyin: c.to.pinyin, englishTranslation: c.to.gloss },
				{ where: { id: c.id }, transaction },
			);
		}
		await transaction.commit();
		console.log(`\nUpdated ${changes.length} words.`);
	} catch (error) {
		await transaction.rollback();
		throw error;
	}

	await db.sequelize.close();
}

main().catch(async (error) => {
	console.error(error);
	await db.sequelize.close();
	process.exit(1);
});
