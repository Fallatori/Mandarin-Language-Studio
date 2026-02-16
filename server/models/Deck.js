const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Deck = sequelize.define(
		"Deck",
		{
			id: {
				type: DataTypes.UUID,
				defaultValue: DataTypes.UUIDV4,
				primaryKey: true,
			},
			name: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			description: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			creator_id: {
				type: DataTypes.UUID,
				allowNull: false,
			},
		},
		{
			tableName: "Decks",
		},
	);

	Deck.associate = (models) => {
		Deck.belongsTo(models.User, {
			foreignKey: "creator_id",
		});

		Deck.belongsToMany(models.Sentence, {
			through: "DeckSentences",
			foreignKey: "deck_id",
			otherKey: "sentence_id",
			as: "sentences",
		});
	};
	return Deck;
};
