const jieba = require("nodejieba");
const pinyin = require("pinyin");
const translate = require("translate");
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

	async getSentenceByName(name) {
		return await this.sentence
			.findOne({ where: { chineseText: name } })
			.catch(function (err) {
				console.log(err);
			});
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
		const definedWordsMap = new Map();
		if (definedWords && Array.isArray(definedWords)) {
			definedWords.forEach((w) => {
				definedWordsMap.set(w.chineseWord, w);
				if (w.chineseWord) {
					jieba.insertWord(w.chineseWord);
				}
			});
		}

		const transaction = await this.client.transaction();
		try {
			const words = jieba.cut(sentenceData.chineseText);
			const sentencePinyinParts = [];
			const wordAssociations = [];

			for (const [index, wordString] of words.entries()) {
				if (wordString.trim() === "" || /[\p{P}\p{Z}]/u.test(wordString)) {
					if (wordString.trim() !== "") {
						sentencePinyinParts.push(wordString.trim());
					}
					continue;
				}

				// Check if we have user-defined word data from the preview
				const preDefined = definedWordsMap.get(wordString);
				let wordPinyin = preDefined ? preDefined.pinyin : null;

				if (!wordPinyin) {
					wordPinyin = pinyin
						.default(wordString, {
							style: pinyin.STYLE_NORMAL,
							segment: true,
						})
						.map((arr) => arr[0])
						.join("");
				}

				sentencePinyinParts.push(wordPinyin);

				const [word, created] = await this.word.findOrCreate({
					where: { chineseWord: wordString },
					defaults: {
						chineseWord: wordString,
						pinyin: wordPinyin,
						englishTranslation: preDefined ? preDefined.englishTranslation : "",
						creator_id: sentenceData.creator_id,
						is_public: false,
					},
					transaction: transaction,
				});

				if (created) {
					// Only use auto-translation if user didn't provide one
					if (!preDefined || !preDefined.englishTranslation) {
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
							await word.save({ transaction: transaction });
						} catch (error) {
							if (error.message.includes("Daily translation limit")) {
								throw error;
							}

							console.error(`Could not translate word: ${wordString}`, error);
							word.englishTranslation = "translation_failed";
							await word.save({ transaction: transaction });
						}
					}
				} else if (preDefined) {
					// Existing word: Update it if user edited it in the context of this sentence
					if (
						word.englishTranslation !== preDefined.englishTranslation ||
						word.pinyin !== preDefined.pinyin
					) {
						word.englishTranslation = preDefined.englishTranslation;
						word.pinyin = preDefined.pinyin;
						await word.save({ transaction: transaction });
					}
				}

				wordAssociations.push({ word: word, position: index });
			}

			const finalSentencePinyin = sentencePinyinParts.join(" ");

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

	async updateSentence(id, sentence) {
		return await this.sentence.update(sentence, { where: { id: id } });
	}

	async deleteSentence(id) {
		return await this.sentence.destroy({ where: { id: id } });
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
