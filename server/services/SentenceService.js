const jieba = require("nodejieba");
const pinyin = require("pinyin");
const translate = require("translate");
const { Op } = require("sequelize");
jieba.load();

translate.engine = "google";

class SentenceService {
	constructor(db) {
		this.client = db.sequelize;
		this.sentence = db.Sentence;
		this.UserTranslationQuota = db.UserTranslationQuota;
		this.word = db.Word;
	}

	async getAllSentences() {
		return await this.sentence.findAll({ where: {} }).catch(function (err) {
			console.error("Failed to get all sentences:", err);
		});
	}

	async getSentencesByUser(userId) {
		return await this.sentence
			.findAll({ where: { creator_id: userId } })
			.catch(function (err) {
				console.error("Failed to get sentences by user:", err);
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
			const dbWord = await this.word.findOne({
				where: { chineseWord: wordString },
			});

			if (dbWord) {
				wordPinyin = dbWord.pinyin;
				wordTranslation = dbWord.englishTranslation;
			} else {
				isNew = true;
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
					wordTranslation = await translate.default(wordString, {
						from: "zh",
						to: "en",
					});
				} catch (e) {
					if (e.message.includes("Daily translation limit")) {
						throw e;
					}
					console.log("Translation failed for preview", e);
				}
			}

			sentencePinyinParts.push(wordPinyin);

			resultWords.push({
				chineseWord: wordString,
				pinyin: wordPinyin,
				englishTranslation: wordTranslation,
				isNew,
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

		this._updateJiebaDictionary(definedWords);

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

	_updateJiebaDictionary(definedWords) {
		if (definedWords && Array.isArray(definedWords)) {
			definedWords.forEach((w) => {
				if (w.chineseWord) {
					jieba.insertWord(w.chineseWord);
				}
			});
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

				if (
					!created &&
					w.englishTranslation &&
					w.englishTranslation !== word.englishTranslation
				) {
					word.englishTranslation = w.englishTranslation;
					await word.save({ transaction });
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

				if (created && !sentenceData.skipWordTranslation) {
					try {
						await this.checkAndIncrementQuota(
							sentenceData.creator_id,
							transaction,
						);
						const translation = await translate.default(wordString, {
							from: "zh",
							to: "en",
						});
						word.englishTranslation = translation;
						await word.save({ transaction });
					} catch (e) {}
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

	async updateSentence(id, sentence) {
		return await this.sentence.update(sentence, { where: { id: id } });
	}

	async deleteSentence(id) {
		return await this.sentence.destroy({ where: { id: id } });
	}

	async deleteAllSentencesByUser(userId) {
		return await this.sentence.destroy({ where: { creator_id: userId } });
	}

	async markAsPracticed(id) {
		const sentence = await this.getSentenceById(id);
		if (!sentence) {
			throw new Error("Sentence not found");
		}

		sentence.lastPracticedAt = new Date();
		await sentence.save();
		return sentence;
	}

	async translateText(text, targetLang = "en") {
		try {
			return await translate.default(text, { to: targetLang });
		} catch (error) {
			console.error("Translation service error:", error);
			throw error;
		}
	}
}

module.exports = SentenceService;
