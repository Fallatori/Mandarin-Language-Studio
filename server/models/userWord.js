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
			user_id: {
				type: DataTypes.UUID,
				allowNull: false,
				references: { model: "Users", key: "id" },
			},
			word_id: {
				type: DataTypes.UUID,
				allowNull: false,
				references: { model: "Words", key: "id" },
			},
			pinyin: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			englishTranslation: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			notes: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			lastPracticedAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			status: {
				type: DataTypes.ENUM("new", "learning", "known"),
				defaultValue: "learning",
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "UserWords",
			indexes: [{ unique: true, fields: ["user_id", "word_id"] }],
		},
	);

	UserWord.associate = (models) => {
		UserWord.belongsTo(models.Word, { foreignKey: "word_id" });
		UserWord.belongsTo(models.User, { foreignKey: "user_id" });
	};

	return UserWord;
};
