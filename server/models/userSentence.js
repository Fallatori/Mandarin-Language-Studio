const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const UserSentence = sequelize.define(
		"UserSentence",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			user_id: {
				type: DataTypes.UUID,
				allowNull: false,
				references: { model: "Users", key: "id" },
			},
			sentence_id: {
				type: DataTypes.UUID,
				allowNull: false,
				references: { model: "Sentences", key: "id" },
			},
			lastPracticedAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			status: {
				type: DataTypes.ENUM("learning", "mastered"),
				defaultValue: "learning",
			},
			xp: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
			},
			nextDueAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			difficult: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "UserSentences",
			indexes: [
				{
					unique: true,
					fields: ["user_id", "sentence_id"],
				},
			],
		},
	);

	return UserSentence;
};
