const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const UserTranslationQuota = sequelize.define(
		"UserTranslationQuota",
		{
			user_id: {
				type: DataTypes.UUID,
				primaryKey: true,
			},
			date: {
				type: DataTypes.DATEONLY,
				primaryKey: true,
			},
			count: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
		},
		{
			tableName: "UserTranslationQuotas",
			timestamps: false,
		},
	);

	return UserTranslationQuota;
};
