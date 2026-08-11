// Run before restarting with a shortened column: node scripts/checkTextLengths.js
const db = require("../models");

const LIMIT = 512;

const COLUMNS = [
	{ table: "Sentences", column: "english_translation", limit: LIMIT },
	{ table: "Sentences", column: "chinese_text", limit: null },
	{ table: "Words", column: "english_translation", limit: 255 },
];

async function main() {
	await db.sequelize.authenticate();

	let overLimit = 0;

	for (const { table, column, limit } of COLUMNS) {
		const [[row]] = await db.sequelize.query(
			`
			SELECT
				COUNT(*) AS total,
				MAX(CHAR_LENGTH(${column})) AS longest,
				SUM(CASE WHEN CHAR_LENGTH(${column}) > ${limit || 0} THEN 1 ELSE 0 END) AS over_limit
			FROM ${table}
		`,
			{ logging: false },
		);

		const longest = row.longest || 0;
		const target = limit ? `limit ${limit}` : "no limit planned";
		console.log(
			`${table}.${column}: ${row.total} rows, longest ${longest} chars (${target})`,
		);

		if (limit && Number(row.over_limit) > 0) {
			overLimit += Number(row.over_limit);
			console.log(
				`  !! ${row.over_limit} row(s) exceed ${limit} and would be truncated by the ALTER`,
			);
		}
	}

	if (overLimit > 0) {
		console.log("\nDo not restart the server until these are shortened.");
		process.exitCode = 1;
	} else {
		console.log("\nSafe to restart: nothing would be truncated.");
	}
}

main()
	.catch((error) => {
		console.error("Length check failed:", error);
		process.exitCode = 1;
	})
	.finally(() => db.sequelize.close());
