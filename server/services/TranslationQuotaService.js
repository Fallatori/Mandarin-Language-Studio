const { Op } = require("sequelize");
const { httpError } = require("../utils/httpError");

function limitFrom(value, fallback) {
	if (value === undefined || value === "") return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

// Shared across every user — the ceiling is the Google Translate bill, not
// any one person's usage. Default sits under the 500,000/month free tier.
const GLOBAL_MONTHLY_CHARACTER_LIMIT = limitFrom(
	process.env.TRANSLATION_MONTHLY_CHAR_LIMIT,
	400000,
);

class TranslationQuotaService {
	constructor(db) {
		this.usage = db.UserTranslationUsage;
		this.user = db.User;
	}

	_currentMonth() {
		return new Date().toISOString().slice(0, 7);
	}

	async _globalTotal(month, transaction) {
		const total = await this.usage.sum("characterCount", {
			where: { month },
			transaction,
		});
		return total || 0;
	}

	async getGlobalUsage() {
		const month = this._currentMonth();
		const characterCount = await this._globalTotal(month);

		const rows = await this.usage.findAll({ where: { month }, raw: true });
		const byFeature = {};
		const byUserId = {};
		for (const row of rows) {
			byFeature[row.feature] = (byFeature[row.feature] || 0) + row.characterCount;
			byUserId[row.user_id] = (byUserId[row.user_id] || 0) + row.characterCount;
		}

		const userIds = Object.keys(byUserId);
		const users = userIds.length
			? await this.user.findAll({
					where: { id: { [Op.in]: userIds } },
					attributes: ["id", "Username"],
					raw: true,
				})
			: [];
		const usernameById = new Map(users.map((u) => [u.id, u.Username]));
		const byUser = userIds
			.map((id) => ({
				userId: id,
				username: usernameById.get(id) || "Unknown",
				characterCount: byUserId[id],
			}))
			.sort((a, b) => b.characterCount - a.characterCount);

		return {
			month,
			characterCount,
			limit: GLOBAL_MONTHLY_CHARACTER_LIMIT,
			remaining:
				GLOBAL_MONTHLY_CHARACTER_LIMIT > 0
					? Math.max(0, GLOBAL_MONTHLY_CHARACTER_LIMIT - characterCount)
					: null,
			byFeature,
			byUser,
		};
	}

	// Checks the shared monthly total and spends in one step — a translate()
	// call that fails after the check still counts, same tradeoff the old
	// per-user quota had. `feature` buckets spend by translation "place"
	// (word / sentence / story) for the usage breakdown.
	async checkAndRecordUsage(userId, text, feature = "other", transaction) {
		if (!userId) return;
		const characters = String(text || "").length;
		if (characters === 0) return;

		const month = this._currentMonth();
		const currentTotal = await this._globalTotal(month, transaction);

		if (
			GLOBAL_MONTHLY_CHARACTER_LIMIT > 0 &&
			currentTotal + characters > GLOBAL_MONTHLY_CHARACTER_LIMIT
		) {
			throw httpError(
				429,
				`Shared monthly translation limit of ${GLOBAL_MONTHLY_CHARACTER_LIMIT} characters reached. Try again next month.`,
			);
		}

		const [row] = await this.usage.findOrCreate({
			where: { user_id: userId, month, feature },
			defaults: { characterCount: 0 },
			transaction,
		});

		await row.increment("characterCount", { by: characters, transaction });
	}
}

module.exports = TranslationQuotaService;
