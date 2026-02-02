const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const SentenceWord = sequelize.define(
		"SentenceWord",
		{
			id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			position: {
				type: DataTypes.INTEGER,
				allowNull: false,
				comment: "The position of the word within the sentence (0-indexed).",
			},
		},
		{
			underscored: true,
			timestamps: false,
			tableName: "SentenceWords",
		}
	);
	return SentenceWord;
};
