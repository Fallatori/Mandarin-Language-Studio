const jieba = require("nodejieba");
const pinyin = require("pinyin");
const translate = require("translate");
jieba.load();

translate.engine = "google";

class SentenceService {
	constructor(db) {
		this.client = db.sequelize;
		this.sentence = db.Sentence;
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

	async addSentence(sentenceData) {
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
						englishTranslation: "...",
						creator_id: sentenceData.creator_id,
						is_public: false,
					},
					transaction: transaction,
				});

				if (created) {
					try {
						const translation = await translate.default(wordString, {
							from: "zh",
							to: "en",
						});
						word.englishTranslation = translation;
						await word.save({ transaction: transaction }); // Save the updated word
					} catch (translateError) {
						console.error(
							`Could not translate word: ${wordString}`,
							translateError,
						);
						word.englishTranslation = "translation_failed";
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

	async translateText(text) {
		try {
			return await translate.default(text, { from: "zh", to: "en" });
		} catch (error) {
			console.error("Translation service error:", error);
			throw error;
		}
	}
}

module.exports = SentenceService;
