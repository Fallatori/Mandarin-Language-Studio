module.exports = (sequelize, Sequelize) => {
	const User = sequelize.define(
		"User",
		{
			Username: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			Email: {
				type: Sequelize.DataTypes.STRING,
				allowNull: false,
			},
			Password: {
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
	};
	return User;
};
