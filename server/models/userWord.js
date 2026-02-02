const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const UserWord = sequelize.define(
		"UserWord",
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
			tableName: "UserWords",
		}
	);

	return UserWord;
};
