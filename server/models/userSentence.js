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
			lastPracticedAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			status: {
				type: DataTypes.ENUM("learning", "mastered"),
				defaultValue: "learning",
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "UserSentences",
		}
	);

	return UserSentence;
};
