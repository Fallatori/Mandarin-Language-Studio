module.exports = (sequelize, Sequelize) => {
	const User = sequelize.define(
		"User",
		{
			id: {
				type: Sequelize.DataTypes.UUID,
				defaultValue: Sequelize.DataTypes.UUIDV4,
				primaryKey: true,
			},
			Username: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			Email: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			EncryptedPassword: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
		},
		{
			timestamps: false,
			tableName: "Users",
		}
	);
	User.associate = (models) => {
		User.belongsToMany(models.Word, { through: models.UserWord });
		User.belongsToMany(models.Sentence, { through: models.UserSentence });
	};
	return User;
};
