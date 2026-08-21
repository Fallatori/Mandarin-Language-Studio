const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const { httpError } = require("../utils/httpError");

class UserService {
	constructor(db) {
		this.client = db.sequelize;
		this.User = db.User;
		this.word = db.Word;
		this.userWord = db.UserWord;
		this.sentence = db.Sentence;
		this.userSentence = db.UserSentence;
		this.story = db.Story;
		this.userStory = db.UserStory;
		this.deck = db.Deck;
		this.userTranslationQuota = db.UserTranslationQuota;
		this.userTranslationUsage = db.UserTranslationUsage;
	}

	async getUserByEmail(email) {
		return await this.User.findOne({ where: { Email: email } });
	}

	async createUser(username, email, hashedPassword) {
		return await this.User.create({
			Username: username,
			Email: email,
			EncryptedPassword: hashedPassword,
		});
	}

	async _releaseWords(userId, transaction) {
		const rows = await this.userWord.findAll({
			where: { user_id: userId },
			attributes: ["word_id"],
			transaction,
		});
		const wordIds = rows.map((row) => row.word_id);

		await this.userWord.destroy({ where: { user_id: userId }, transaction });

		if (wordIds.length > 0) {
			const stillHeld = await this.userWord.findAll({
				where: { word_id: { [Op.in]: wordIds } },
				attributes: ["word_id"],
				group: ["word_id"],
				transaction,
			});
			const heldIds = new Set(stillHeld.map((row) => row.word_id));
			const orphaned = wordIds.filter((wordId) => !heldIds.has(wordId));

			if (orphaned.length > 0) {
				await this.word.destroy({
					where: { id: { [Op.in]: orphaned }, creator_id: userId },
					transaction,
				});
			}
		}

		await this.word.update(
			{ creator_id: null },
			{ where: { creator_id: userId }, transaction },
		);
	}

	async _releaseSentences(userId, transaction) {
		await this.userSentence.destroy({
			where: { user_id: userId },
			transaction,
		});

		const created = await this.sentence.findAll({
			where: { creator_id: userId },
			attributes: ["id"],
			transaction,
		});
		const sentenceIds = created.map((row) => row.id);

		if (sentenceIds.length > 0) {
			const stillHeld = await this.userSentence.findAll({
				where: { sentence_id: { [Op.in]: sentenceIds } },
				attributes: ["sentence_id"],
				group: ["sentence_id"],
				transaction,
			});
			const heldIds = new Set(stillHeld.map((row) => row.sentence_id));
			const orphaned = sentenceIds.filter((id) => !heldIds.has(id));

			if (orphaned.length > 0) {
				await this.sentence.destroy({
					where: { id: { [Op.in]: orphaned } },
					transaction,
				});
			}
		}

		await this.sentence.update(
			{ creator_id: null },
			{ where: { creator_id: userId }, transaction },
		);
	}

	async _releaseStories(userId, transaction) {
		await this.userStory.destroy({ where: { user_id: userId }, transaction });

		const created = await this.story.findAll({
			where: { creator_id: userId },
			attributes: ["id"],
			transaction,
		});
		const storyIds = created.map((row) => row.id);

		if (storyIds.length > 0) {
			const stillHeld = await this.userStory.findAll({
				where: { story_id: { [Op.in]: storyIds } },
				attributes: ["story_id"],
				group: ["story_id"],
				transaction,
			});
			const heldIds = new Set(stillHeld.map((row) => row.story_id));
			const orphaned = storyIds.filter((id) => !heldIds.has(id));

			if (orphaned.length > 0) {
				await this.story.destroy({
					where: { id: { [Op.in]: orphaned } },
					transaction,
				});
			}
		}

		await this.story.update(
			{ creator_id: null },
			{ where: { creator_id: userId }, transaction },
		);
	}

	async _releaseLegacyCardGroups(userId, transaction) {
		const [tables] = await this.client.query(
			"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'CardGroups'",
			{ transaction },
		);
		if (tables.length === 0) return;

		await this.client.query(
			"DELETE FROM `CardGroups` WHERE creator_id = :userId",
			{ replacements: { userId }, transaction },
		);
	}

	async deleteAccount(userId, password) {
		const user = await this.User.findByPk(userId);
		if (!user) throw httpError(404, "User not found");

		if (!password) throw httpError(400, "Password is required");

		const matches = await bcrypt.compare(
			password.toString(),
			user.EncryptedPassword,
		);
		if (!matches) throw httpError(403, "Password is incorrect");

		const transaction = await this.client.transaction();
		try {
			await this.userTranslationQuota.destroy({
				where: { user_id: userId },
				transaction,
			});
			await this.userTranslationUsage.destroy({
				where: { user_id: userId },
				transaction,
			});
			await this.deck.destroy({
				where: { creator_id: userId },
				transaction,
			});
			await this._releaseLegacyCardGroups(userId, transaction);
			await this._releaseStories(userId, transaction);
			await this._releaseSentences(userId, transaction);
			await this._releaseWords(userId, transaction);
			await user.destroy({ transaction });

			await transaction.commit();
		} catch (error) {
			await transaction.rollback();
			throw error;
		}
	}
}

module.exports = UserService;
