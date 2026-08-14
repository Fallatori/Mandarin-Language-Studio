const jieba = require("nodejieba");
const pinyin = require("pinyin");
const { Op } = require("sequelize");
const { httpError } = require("../utils/httpError");
const { normalizePinyin } = require("../utils/pinyinSearch");
const WordService = require("./WordService");
const TranslationService = require("./TranslationService");
const DictionaryService = require("./DictionaryService");
jieba.load();

// Words are promoted to "known" once their sentences reach this xp, the point
// at which _calculateNextDueAt has stretched the interval to three days.
const PROMOTE_AT_XP = 6;

class SentenceService {
	constructor(db) {
		this.client = db.sequelize;
		this.sentence = db.Sentence;
		this.UserTranslationQuota = db.UserTranslationQuota;
		this.word = db.Word;
		this.UserSentence = db.UserSentence;
		this.Deck = db.Deck;
		this.wordService = new WordService(db);
		this.translationService = new TranslationService();
		this.dictionary = new DictionaryService();
	}

	_calculateNextDueAt(xp, difficult) {
		// Simple spacing schedule (days). Caps at 14.
		// Difficult sentences get shorter spacing.
		const days = difficult ? 1 : Math.min(14, Math.max(1, Math.floor(xp / 2)));
		return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
	}

	static resolvePracticeXp(xp) {
		if (xp === undefined) return 1;
		const n = Number(xp);
		if (n !== 1 && n !== 3) throw httpError(400, "xp must be 1 or 3");
		return n;
	}

	async recordSentencePractice(sentenceId, userId, transaction, xpDelta = 1) {
		const sentence = await this.getOwnedSentence(sentenceId, userId);

		const now = new Date();

		const [progress] = await this.UserSentence.findOrCreate({
			where: { user_id: userId, sentence_id: sentenceId },
			defaults: {
				xp: 0,
				difficult: false,
				nextDueAt: null,
				lastPracticedAt: null,
				status: "learning",
			},
			transaction,
		});

		progress.xp = (progress.xp || 0) + xpDelta;
		progress.lastPracticedAt = now;
		progress.nextDueAt = this._calculateNextDueAt(
			progress.xp,
			progress.difficult,
		);
		await progress.save({ transaction });

		// Keep legacy sentence sorting working.
		sentence.lastPracticedAt = now;
		await sentence.save({ transaction });

		if (progress.xp >= PROMOTE_AT_XP) {
			await this.wordService.promoteWordsForSentence(
				sentenceId,
				userId,
				transaction,
			);
		}

		return progress;
	}

	async setSentenceDifficult(sentenceId, userId, difficult) {
		await this.getOwnedSentence(sentenceId, userId);

		const [progress] = await this.UserSentence.findOrCreate({
			where: { user_id: userId, sentence_id: sentenceId },
			defaults: {
				xp: 0,
				difficult: false,
				nextDueAt: null,
				lastPracticedAt: null,
				status: "learning",
			},
		});

		progress.difficult = !!difficult;
		if (progress.difficult && !progress.nextDueAt) {
			progress.nextDueAt = this._calculateNextDueAt(progress.xp || 0, true);
		}
		await progress.save();

		return progress;
	}

	_searchClause(search) {
		const term = String(search).trim();
		if (!term) return null;

		const escape = (value) => value.replace(/[\\%_]/g, (char) => `\\${char}`);
		const like = { [Op.like]: `%${escape(term)}%` };

		const clauses = [
			{ chineseText: like },
			{ pinyin: like },
			{ englishTranslation: like },
		];

		const toneless = normalizePinyin(term);
		if (toneless) {
			clauses.push({
				pinyinSearch: { [Op.like]: `%${escape(toneless)}%` },
			});
		}

		return { [Op.or]: clauses };
	}

	async getFlashcardSentences(
		userId,
		{ deckId = null, filter = "all", page = 1, limit = 50, search = "" } = {},
	) {
		const offset = (page - 1) * limit;

		const queryOptions = {
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["createdAt", "DESC"]],
			where: { creator_id: userId },
			include: [],
			distinct: true,
		};

		const searchClause = this._searchClause(search);
		if (searchClause) {
			queryOptions.where[Op.and] = [searchClause];
		}

		if (deckId) {
			queryOptions.include.push({
				model: this.Deck,
				as: "decks",
				where: { id: deckId },
				required: true,
				through: { attributes: [] },
			});
		}

		if (filter === "difficult") {
			const difficultRecords = await this.UserSentence.findAll({
				where: {
					user_id: userId,
					difficult: true,
				},
				attributes: ["sentence_id"],
			});
			const difficultIds = difficultRecords.map((r) => r.sentence_id);

			queryOptions.where.id = { [Op.in]: difficultIds };
		} else if (filter === "due") {
			const notDueRecords = await this.UserSentence.findAll({
				where: {
					user_id: userId,
					nextDueAt: { [Op.gt]: new Date() },
					difficult: false,
				},
				attributes: ["sentence_id"],
			});

			const notDueIds = notDueRecords.map((r) => r.sentence_id);

			if (notDueIds.length > 0) {
				queryOptions.where.id = { [Op.notIn]: notDueIds };
			}
		}

		const { count, rows: sentences } =
			await this.sentence.findAndCountAll(queryOptions);

		const sentenceIds = sentences.map((s) => s.id);
		let progressBySentenceId = new Map();

		if (sentenceIds.length > 0) {
			const progressRows = await this.UserSentence.findAll({
				where: {
					user_id: userId,
					sentence_id: { [Op.in]: sentenceIds },
				},
			});
			progressBySentenceId = new Map(
				progressRows.map((p) => [p.sentence_id, p.toJSON()]),
			);
		}

		const enriched = sentences.map((s) => {
			const json = s.toJSON();
			return { ...json, progress: progressBySentenceId.get(s.id) || null };
		});

		return {
			sentences: enriched,
			total: count,
			page: parseInt(page),
			hasMore: offset + sentences.length < count,
		};
	}

	async getFlashcardCounts(userId, { deckId = null } = {}) {
		const include = [];
		if (deckId) {
			include.push({
				model: this.Deck,
				as: "decks",
				where: { id: deckId },
				required: true,
				through: { attributes: [] },
			});
		}

		const sentences = await this.sentence.findAll({
			where: { creator_id: userId },
			include,
		});

		const sentenceIds = sentences.map((s) => s.id);
		if (sentenceIds.length === 0) {
			return { all: 0, due: 0, difficult: 0 };
		}

		const progressRows = await this.UserSentence.findAll({
			where: {
				user_id: userId,
				sentence_id: { [Op.in]: sentenceIds },
			},
		});

		const progressBySentenceId = new Map(
			progressRows.map((p) => [p.sentence_id, p.toJSON()]),
		);

		const now = new Date();
		let all = 0;
		let due = 0;
		let difficult = 0;

		for (const s of sentences) {
			all += 1;
			const progress = progressBySentenceId.get(s.id) || null;
			if (progress?.difficult) difficult += 1;

			// Keep identical semantics to getFlashcardSentences(filter === 'due')
			if (!progress?.nextDueAt) {
				due += 1;
				continue;
			}
			if (progress?.difficult) {
				due += 1;
				continue;
			}
			if (new Date(progress.nextDueAt) <= now) {
				due += 1;
			}
		}

		return { all, due, difficult };
	}

	async getAllSentences() {
		return await this.sentence.findAll({ where: {} }).catch(function (err) {
			console.error("Failed to get all sentences:", err);
		});
	}

	async getSentencesByUser(
		userId,
		{ filter = "all", page = 1, limit = 50, search = "" } = {},
	) {
		return await this.getFlashcardSentences(userId, {
			filter,
			page,
			limit,
			search,
		});
	}

	async getSentenceByName(name, userId = null) {
		const where = { chineseText: name };
		if (userId) {
			where.creator_id = userId;
		}
		return await this.sentence.findOne({ where }).catch(function (err) {
			console.log(err);
		});
	}

	async checkExistingSentences(chineseTexts, userId) {
		const existing = await this.sentence.findAll({
			where: {
				creator_id: userId,
				chineseText: {
					[Op.in]: chineseTexts,
				},
			},
			attributes: ["chineseText"],
		});
		return existing.map((e) => e.chineseText);
	}

	async getSentenceById(id) {
		return await this.sentence
			.findOne({ where: { id: id } })
			.catch(function (err) {
				console.log(err);
			});
	}

	async getOwnedSentence(id, userId) {
		const sentence = await this.getSentenceById(id);
		if (!sentence) throw httpError(404, "Sentence not found");
		if (sentence.creator_id !== userId) {
			throw httpError(403, "You can only modify sentences you created");
		}
		return sentence;
	}

	async _pinyinForToken(wordString, userId) {
		const dbWord = await this.word.findOne({
			where: { chineseWord: wordString },
		});
		if (dbWord) {
			const override = userId
				? await this.wordService.getUserWord(dbWord.id, userId)
				: null;
			return override?.pinyin ?? dbWord.pinyin;
		}

		const entry = this.dictionary.lookup(wordString);
		if (entry) return entry.pinyin;

		return pinyin
			.default(wordString, {
				style: pinyin.STYLE_NORMAL,
				segment: true,
			})
			.map((arr) => arr[0])
			.join(" ");
	}

	async tokenizeSentence(chineseText, userId) {
		const words = jieba.cut(chineseText);
		const tokens = [];

		for (const wordString of words) {
			if (wordString.trim() === "" || /[\p{P}\p{Z}]/u.test(wordString)) {
				continue;
			}
			tokens.push({
				chineseWord: wordString,
				pinyin: await this._pinyinForToken(wordString, userId),
			});
		}

		return tokens;
	}

	async analyzeSentence(chineseText, userId) {
		const words = jieba.cut(chineseText);
		const resultWords = [];
		const sentencePinyinParts = [];

		for (const wordString of words) {
			if (wordString.trim() === "" || /[\p{P}\p{Z}]/u.test(wordString)) {
				if (wordString.trim() !== "") {
					sentencePinyinParts.push(wordString.trim());
				}
				continue;
			}

			let wordPinyin = "";
			let wordTranslation = "";
			let isNew = false;
			let isLocked = false;
			const dbWord = await this.word.findOne({
				where: { chineseWord: wordString },
			});

			if (dbWord) {
				const override = userId
					? await this.wordService.getUserWord(dbWord.id, userId)
					: null;
				wordPinyin = override?.pinyin ?? dbWord.pinyin;
				wordTranslation =
					override?.englishTranslation ?? dbWord.englishTranslation;
				isLocked = !!dbWord.is_locked && dbWord.creator_id !== userId;
			} else {
				isNew = true;
				const entry = this.dictionary.lookup(wordString);

				if (entry) {
					wordPinyin = entry.pinyin;
					wordTranslation = entry.englishTranslation;
				} else {
					wordPinyin = pinyin
						.default(wordString, {
							style: pinyin.STYLE_NORMAL,
							segment: true,
						})
						.map((arr) => arr[0])
						.join("");
					try {
						if (userId) {
							await this.checkAndIncrementQuota(userId);
						}
						wordTranslation = await this.translationService.translate(
							wordString,
							"en",
						);
					} catch (e) {
						if (e.message.includes("Daily translation limit")) {
							throw e;
						}
						console.log("Translation failed for preview", e);
					}
				}
			}

			sentencePinyinParts.push(wordPinyin);

			resultWords.push({
				chineseWord: wordString,
				pinyin: wordPinyin,
				englishTranslation: wordTranslation,
				isNew,
				isLocked,
			});
		}

		return {
			chineseText,
			pinyin: sentencePinyinParts.join(" "),
			englishTranslation: "",
			words: resultWords,
		};
	}

	async checkAndIncrementQuota(userId, transaction) {
		const MAX_QUOTA = 20;
		const today = new Date().toISOString().split("T")[0];

		const [quota] = await this.UserTranslationQuota.findOrCreate({
			where: { user_id: userId, date: today },
			defaults: { count: 0 },
			transaction: transaction,
		});

		if (quota.count >= MAX_QUOTA) {
			throw new Error(`Daily translation limit of ${MAX_QUOTA} reached.`);
		}

		await quota.increment("count", { transaction: transaction });
	}

	async addSentence(sentenceData) {
		const { definedWords } = sentenceData;

		const transaction = await this.client.transaction();
		try {
			const { wordAssociations, finalSentencePinyin } =
				await this._processSentenceContent(
					sentenceData,
					definedWords,
					transaction,
				);

			const newSentence = await this.sentence.create(
				{
					...sentenceData,
					pinyin: finalSentencePinyin,
				},
				{ transaction: transaction },
			);

			for (const association of wordAssociations) {
				await newSentence.addWord(association.word, {
					through: { position: association.position },
					transaction: transaction,
				});
			}

			await transaction.commit();
			return newSentence;
		} catch (error) {
			console.error("Error adding sentence:", error);
			await transaction.rollback();
			throw error;
		}
	}

	async _processSentenceContent(sentenceData, definedWords, transaction) {
		const useDefinedWords =
			definedWords && Array.isArray(definedWords) && definedWords.length > 0;
		const wordAssociations = [];
		let finalSentencePinyin = sentenceData.pinyin;

		if (useDefinedWords) {
			for (const [index, w] of definedWords.entries()) {
				if (!w.chineseWord) continue;

				const wordPinyin =
					w.pinyin ||
					pinyin
						.default(w.chineseWord, {
							style: pinyin.STYLE_NORMAL,
							segment: true,
						})
						.map((arr) => arr[0])
						.join("");

				const [word, created] = await this.word.findOrCreate({
					where: { chineseWord: w.chineseWord },
					defaults: {
						chineseWord: w.chineseWord,
						pinyin: wordPinyin,
						englishTranslation: w.englishTranslation || "",
						creator_id: sentenceData.creator_id,
						is_public: false,
					},
					transaction: transaction,
				});

				await this.wordService.ensureUserWord(
					word.id,
					sentenceData.creator_id,
					transaction,
				);

				if (!created && !word.is_locked) {
					const differs =
						(w.englishTranslation &&
							w.englishTranslation !== word.englishTranslation) ||
						(w.pinyin && w.pinyin !== word.pinyin);

					if (differs) {
						if (word.creator_id === sentenceData.creator_id) {
							if (w.englishTranslation) {
								word.englishTranslation = w.englishTranslation;
							}
							if (w.pinyin) word.pinyin = w.pinyin;
							await word.save({ transaction });
						} else {
							await this.wordService.setOverride(
								word.id,
								sentenceData.creator_id,
								{
									pinyin: w.pinyin !== word.pinyin ? w.pinyin : null,
									englishTranslation:
										w.englishTranslation !== word.englishTranslation
											? w.englishTranslation
											: null,
								},
								transaction,
							);
						}
					}
				}

				wordAssociations.push({ word: word, position: index });
			}

			if (!finalSentencePinyin) {
				finalSentencePinyin = definedWords.map((w) => w.pinyin).join(" ");
			}
		} else {
			const words = jieba.cut(sentenceData.chineseText);
			const sentencePinyinParts = [];

			for (const [index, wordString] of words.entries()) {
				if (wordString.trim() === "" || /[\p{P}\p{Z}]/u.test(wordString)) {
					if (wordString.trim() !== "") {
						sentencePinyinParts.push(wordString.trim());
					}
					continue;
				}

				const wordPinyin = pinyin
					.default(wordString, {
						style: pinyin.STYLE_NORMAL,
						segment: true,
					})
					.map((arr) => arr[0])
					.join("");

				sentencePinyinParts.push(wordPinyin);

				const [word, created] = await this.word.findOrCreate({
					where: { chineseWord: wordString },
					defaults: {
						chineseWord: wordString,
						pinyin: wordPinyin,
						englishTranslation: "",
						creator_id: sentenceData.creator_id,
						is_public: false,
					},
					transaction: transaction,
				});

				await this.wordService.ensureUserWord(
					word.id,
					sentenceData.creator_id,
					transaction,
				);

				if (created && !word.englishTranslation) {
					const entry = this.dictionary.lookup(wordString);
					if (entry) {
						word.englishTranslation = entry.englishTranslation;
						await word.save({ transaction });
					} else if (!sentenceData.skipWordTranslation) {
						try {
							await this.checkAndIncrementQuota(
								sentenceData.creator_id,
								transaction,
							);
							word.englishTranslation = await this.translationService.translate(
								wordString,
								"en",
							);
							await word.save({ transaction });
						} catch (e) {}
					}
				}

				wordAssociations.push({ word: word, position: index });
			}
			finalSentencePinyin = sentencePinyinParts.join(" ");
		}

		return { wordAssociations, finalSentencePinyin };
	}

	async addBulkSentences(sentencesData, creatorId) {
		const results = {
			added: [],
			skipped: [],
			errors: [],
		};

		for (const s of sentencesData) {
			try {
				if (!s.chineseText || !s.englishTranslation) {
					results.errors.push({
						text: s.chineseText || "Unknown",
						error: "Missing fields",
					});
					continue;
				}

				const existing = await this.getSentenceByName(s.chineseText, creatorId);
				if (existing) {
					results.skipped.push(s.chineseText);
					continue;
				}

				const newSentence = await this.addSentence({
					...s,
					definedWords: s.definedWords || s.words,
					creator_id: creatorId,
					skipWordTranslation: true,
				});
				results.added.push(newSentence);
			} catch (e) {
				console.error("Bulk add error:", e);
				results.errors.push({ text: s.chineseText, error: e.message });
			}
		}
		return results;
	}

	async updateSentence(id, updates, userId) {
		const sentence = await this.getOwnedSentence(id, userId);

		const patch = {};
		if (updates.pinyin !== undefined) patch.pinyin = String(updates.pinyin).trim();
		if (updates.englishTranslation !== undefined) {
			patch.englishTranslation = String(updates.englishTranslation).trim();
		}

		if (patch.pinyin === "") throw httpError(400, "Pinyin cannot be empty");
		if (patch.englishTranslation === "") {
			throw httpError(400, "English translation cannot be empty");
		}
		if (Object.keys(patch).length === 0) return sentence;

		return await sentence.update(patch);
	}

	async deleteSentence(id, userId) {
		await this.getOwnedSentence(id, userId);
		return await this.sentence.destroy({ where: { id: id } });
	}

	async deleteAllSentencesByUser(userId) {
		return await this.sentence.destroy({ where: { creator_id: userId } });
	}

	async markAsPracticed(id, userId, xpDelta = 1) {
		const transaction = await this.client.transaction();
		try {
			const progress = await this.recordSentencePractice(
				id,
				userId,
				transaction,
				xpDelta,
			);
			await transaction.commit();

			const updatedSentence = await this.getSentenceById(id);
			return { ...updatedSentence.toJSON(), progress };
		} catch (e) {
			await transaction.rollback();
			throw e;
		}
	}

	async translateText(text, targetLang = "en") {
		try {
			return await this.translationService.translate(text, targetLang);
		} catch (error) {
			console.error("Translation service error:", error);
			throw error;
		}
	}
}

module.exports = SentenceService;
