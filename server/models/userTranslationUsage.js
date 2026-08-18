const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const UserTranslationUsage = sequelize.define(
		"UserTranslationUsage",
		{
			user_id: {
				type: DataTypes.UUID,
				primaryKey: true,
			},
			month: {
				// "YYYY-MM", UTC.
				type: DataTypes.STRING(7),
				primaryKey: true,
			},
			feature: {
				// Which translation site spent this: "word", "sentence", "story".
				type: DataTypes.STRING(32),
				primaryKey: true,
				defaultValue: "other",
			},
			characterCount: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
		},
		{
			tableName: "UserTranslationUsages",
			timestamps: false,
		},
	);

	return UserTranslationUsage;
};
