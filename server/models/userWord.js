const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const UserWord = sequelize.define(
		"UserWord",
		{
			id: {
				// It's good practice for join tables to have their own PK
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			lastPracticedAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			// You could add other fields here, like 'status' ('learning', 'mastered')
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "UserWords",
		}
	);

	return UserWord;
};
