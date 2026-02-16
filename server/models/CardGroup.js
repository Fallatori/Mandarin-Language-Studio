const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const CardGroup = sequelize.define("CardGroup", {
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
	});

	CardGroup.associate = (models) => {
		CardGroup.belongsTo(models.User, {
			foreignKey: "creator_id",
		});

		CardGroup.belongsToMany(models.Sentence, {
			through: "CardGroupSentences",
			foreignKey: "card_group_id",
			otherKey: "sentence_id",
			as: "sentences",
		});
	};
	return CardGroup;
};
