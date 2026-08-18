const { Op } = require("sequelize");
const pinyinConverter = require("pinyin");
const { httpError } = require("../utils/httpError");
const TranslationService = require("./TranslationService");
const TranslationQuotaService = require("./TranslationQuotaService");

const STATUSES = ["new", "learning", "known"];

class WordService {
	constructor(db) {
		this.client = db.sequelize;
		this.word = db.Word;
		this.sentence = db.Sentence;
		this.userWord = db.UserWord;
		this.translationService = new TranslationService();
		this.translationQuota = new TranslationQuotaService(db);
	}

	_merge(word, userWord, userId) {
		const plain = word.toJSON ? word.toJSON() : word;
		const isOwner = !!plain.creator_id && plain.creator_id === userId;
		return {
			...plain,
			pinyin: userWord?.pinyin ?? plain.pinyin,
			englishTranslation:
				userWord?.englishTranslation ?? plain.englishTranslation,
			notes: userWord?.notes ?? null,
			isOwner,
			isLocked: !!plain.is_locked && !isOwner,
			isCustomised: !!(userWord?.pinyin || userWord?.englishTranslation),
			status: userWord?.status ?? null,
			lastPracticedAt: userWord?.lastPracticedAt ?? null,
		};
	}

	async getWordsByUser(userId) {
		const rows = await this.userWord.findAll({
			where: { user_id: userId },
			include: [{ model: this.word }],
		});

		return rows
			.filter((row) => row.Word)
			.map((row) => this._merge(row.Word, row, userId));
	}

	async getUserWordTexts(userId) {
		if (!userId) return [];
		const rows = await this.userWord.findAll({
			where: { user_id: userId },
			attributes: ["word_id"],
			include: [{ model: this.word, attributes: ["chineseWord"] }],
		});
		return rows.filter((row) => row.Word).map((row) => row.Word.chineseWord);
	}

	async ensureUserWord(wordId, userId, transaction, status) {
		if (!userId) return null;

		const defaults = { user_id: userId, word_id: wordId };
		if (status) defaults.status = status;

		const [userWord] = await this.userWord.findOrCreate({
			where: { user_id: userId, word_id: wordId },
			defaults,
			transaction,
		});
		return userWord;
	}

	async setStatus(wordId, userId, status) {
		if (!STATUSES.includes(status)) {
			throw httpError(400, `Status must be one of: ${STATUSES.join(", ")}`);
		}

		const { word, userWord } = await this.getWordInUserList(wordId, userId);
		const target = userWord || (await this.ensureUserWord(wordId, userId));

		await target.update({ status });
		return this._merge(word, target, userId);
	}

	async promoteWordsForSentence(sentenceId, userId, transaction) {
		const sentence = await this.sentence.findOne({
			where: { id: sentenceId },
			include: [{ model: this.word, through: { attributes: [] } }],
			transaction,
		});
		if (!sentence || !sentence.Words || sentence.Words.length === 0) return 0;

		const [affected] = await this.userWord.update(
			{ status: "known" },
			{
				where: {
					user_id: userId,
					word_id: { [Op.in]: sentence.Words.map((w) => w.id) },
					status: { [Op.in]: ["new", "learning"] },
				},
				transaction,
			},
		);

		return affected;
	}

	async getUserWord(wordId, userId, transaction) {
		return await this.userWord.findOne({
			where: { user_id: userId, word_id: wordId },
			transaction,
		});
	}

	async getWordInUserList(id, userId) {
		const word = await this.word.findOne({ where: { id } });
		if (!word) throw httpError(404, "Word not found");

		const userWord = await this.getUserWord(id, userId);
		const isCreator = !!word.creator_id && word.creator_id === userId;
		if (!userWord && !isCreator) {
			throw httpError(404, "Word not found");
		}

		return { word, userWord, isCreator };
	}

	async updateWord(id, updates, userId) {
		const { word, userWord, isCreator } = await this.getWordInUserList(
			id,
			userId,
		);

		if (word.is_locked && !isCreator) {
			throw httpError(
				403,
				"This word is part of a lesson and cannot be edited",
			);
		}

		if (isCreator) {
			const shared = {};
			if (updates.chineseWord) shared.chineseWord = updates.chineseWord;
			if (updates.pinyin !== undefined) shared.pinyin = updates.pinyin;
			if (updates.englishTranslation !== undefined) {
				shared.englishTranslation = updates.englishTranslation;
			}
			await word.update(shared);
			return this._merge(word, userWord, userId);
		}

		const target = userWord || (await this.ensureUserWord(id, userId));
		const sameAsShared = (value, shared) =>
			value === undefined || value === null || value === shared;

		await target.update({
			pinyin: sameAsShared(updates.pinyin, word.pinyin) ? null : updates.pinyin,
			englishTranslation: sameAsShared(
				updates.englishTranslation,
				word.englishTranslation,
			)
				? null
				: updates.englishTranslation,
			notes: updates.notes ?? target.notes ?? null,
		});

		return this._merge(word, target, userId);
	}

	async setOverride(
		wordId,
		userId,
		{ pinyin, englishTranslation },
		transaction,
	) {
		const userWord = await this.ensureUserWord(wordId, userId, transaction);
		if (!userWord) return null;

		const patch = {};
		if (pinyin) patch.pinyin = pinyin;
		if (englishTranslation) patch.englishTranslation = englishTranslation;
		if (Object.keys(patch).length === 0) return userWord;

		return await userWord.update(patch, { transaction });
	}

	async deleteWord(id, userId) {
		const { word, userWord, isCreator } = await this.getWordInUserList(
			id,
			userId,
		);

		if (userWord) await userWord.destroy();

		if (!isCreator) return { removedFromList: true, deletedShared: false };

		const remaining = await this.userWord.count({ where: { word_id: id } });
		if (remaining > 0) {
			return { removedFromList: true, deletedShared: false };
		}

		await word.destroy();
		return { removedFromList: true, deletedShared: true };
	}

	// Dictionary -> pinyin package -> Google Translate, in that order. Shared
	// by addWord and the live lookup/suggest endpoints so all three fill
	// fields the same way.
	async _resolveWordFields(
		trimmed,
		userId,
		{ needPinyin = true, needEnglish = true } = {},
	) {
		let py = "";
		let en = "";

		if (needPinyin || needEnglish) {
			const DictionaryService = require("./DictionaryService");
			const entry = new DictionaryService().lookup(trimmed);
			if (needPinyin && entry?.pinyin) py = entry.pinyin;
			if (needEnglish && entry?.englishTranslation) en = entry.englishTranslation;
		}

		if (needPinyin && !py) {
			py = pinyinConverter
				.default(trimmed, {
					style: pinyinConverter.STYLE_NORMAL,
					segment: true,
				})
				.map((arr) => arr[0])
				.join("");
		}

		if (needEnglish && !en && this.translationService.isConfigured()) {
			try {
				await this.translationQuota.checkAndRecordUsage(userId, trimmed, "word");
				en = await this.translationService.translate(trimmed, "en");
			} catch (e) {
				if (e.status === 429) throw e;
				console.error("Word translation failed:", e.message);
			}
		}

		return { pinyin: py, englishTranslation: en };
	}

	// Read-only preview for the add-word form: dictionary/shared-word lookup,
	// falling through to the same translate fallback addWord uses. Never
	// creates anything.
	async lookupWord(chineseWord, userId) {
		const trimmed = String(chineseWord || "").trim();
		if (!trimmed || !/\p{Script=Han}/u.test(trimmed)) {
			return { pinyin: "", englishTranslation: "", exists: false };
		}

		const existing = await this.word.findOne({ where: { chineseWord: trimmed } });
		if (existing) {
			const userWord = userId
				? await this.getUserWord(existing.id, userId)
				: null;
			return {
				pinyin: userWord?.pinyin ?? existing.pinyin,
				englishTranslation:
					userWord?.englishTranslation ?? existing.englishTranslation,
				exists: true,
			};
		}

		const resolved = await this._resolveWordFields(trimmed, userId);
		return { ...resolved, exists: false };
	}

	// The reverse direction for the add-word form: English text -> a
	// suggested Chinese word (and its pinyin). No dictionary reverse-index
	// exists, so this always calls Google Translate.
	async suggestChinese(englishText, userId) {
		const trimmed = String(englishText || "").trim();
		if (!trimmed) return { chineseWord: "", pinyin: "" };
		if (!this.translationService.isConfigured()) {
			throw httpError(500, "Translation is not configured.");
		}

		await this.translationQuota.checkAndRecordUsage(userId, trimmed, "word");
		const chineseWord = await this.translationService.translate(trimmed, "zh");

		const { pinyin } = await this._resolveWordFields(chineseWord, userId, {
			needEnglish: false,
		});
		return { chineseWord, pinyin };
	}

	async addWord({ chineseWord, pinyin, englishTranslation }, userId) {
		const trimmed = String(chineseWord || "").trim();
		if (!trimmed) {
			throw httpError(400, "Chinese word is required");
		}
		if (!/\p{Script=Han}/u.test(trimmed)) {
			throw httpError(400, "Chinese word must contain hanzi");
		}

		let py = String(pinyin || "").trim();
		let en = String(englishTranslation || "").trim();

		const existing = await this.word.findOne({ where: { chineseWord: trimmed } });
		if (existing) {
			const userWord = await this.ensureUserWord(existing.id, userId);
			return this._merge(existing, userWord, userId);
		}

		if (!py || !en) {
			const resolved = await this._resolveWordFields(trimmed, userId, {
				needPinyin: !py,
				needEnglish: !en,
			});
			if (!py) py = resolved.pinyin;
			if (!en) en = resolved.englishTranslation;
		}

		const word = await this.word.create({
			chineseWord: trimmed,
			pinyin: py,
			englishTranslation: en,
			creator_id: userId,
			is_public: false,
		});

		const userWord = await this.ensureUserWord(word.id, userId);
		return this._merge(word, userWord, userId);
	}

	async deleteAllWordsByUser(userId) {
		const rows = await this.userWord.findAll({
			where: { user_id: userId },
			attributes: ["word_id"],
		});
		const wordIds = rows.map((row) => row.word_id);

		await this.userWord.destroy({ where: { user_id: userId } });
		if (wordIds.length === 0) return 0;

		const stillHeld = await this.userWord.findAll({
			where: { word_id: { [Op.in]: wordIds } },
			attributes: ["word_id"],
			group: ["word_id"],
		});
		const heldIds = new Set(stillHeld.map((row) => row.word_id));
		const orphaned = wordIds.filter((wordId) => !heldIds.has(wordId));
		if (orphaned.length === 0) return 0;

		return await this.word.destroy({
			where: { id: { [Op.in]: orphaned }, creator_id: userId },
		});
	}
}

module.exports = WordService;
