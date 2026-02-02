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
}

module.exports = WordService;
