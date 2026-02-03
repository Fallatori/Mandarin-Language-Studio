class WordService {
	constructor(db) {
		this.client = db.sequelize;
		this.word = db.Word;
	}

	async getWordsByUser(userId) {
		return await this.word
			.findAll({ where: { creator_id: userId } })
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
}

module.exports = WordService;
