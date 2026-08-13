const { Op } = require("sequelize");
const { httpError } = require("../utils/httpError");

const STATUSES = ["new", "learning", "known"];

class WordService {
	constructor(db) {
		this.client = db.sequelize;
		this.word = db.Word;
		this.sentence = db.Sentence;
		this.userWord = db.UserWord;
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
