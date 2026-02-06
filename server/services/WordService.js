const { Op } = require("sequelize");

class WordService {
	constructor(db) {
		this.client = db.sequelize;
		this.word = db.Word;
		this.sentence = db.Sentence;
	}

	async getWordsByUser(userId) {
		return await this.word
			.findAll({
				where: {
					[Op.or]: [
						{ creator_id: userId },
						{ "$Sentences.creator_id$": userId },
					],
				},
				include: [
					{
						model: this.sentence,
						attributes: [],
						through: { attributes: [] },
					},
				],
				group: ["Word.id"],
			})
			.catch(function (err) {
				console.error(
					"Failed to get words by user in getWordsByUser for userId:",
					userId,
					err,
				);
			});
	}

	async updateWord(id, updates) {
		const word = await this.word.findOne({ where: { id } });
		if (!word) throw new Error("Word not found");
		return await word.update(updates);
	}

	async deleteWord(id) {
		const word = await this.word.findOne({ where: { id } });
		if (!word) throw new Error("Word not found");
		return await word.destroy();
	}

	async deleteAllWordsByUser(userId) {
		return await this.word.destroy({ where: { creator_id: userId } });
	}
}

module.exports = WordService;
