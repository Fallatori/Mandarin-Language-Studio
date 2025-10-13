const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Word = sequelize.define(
		"Word",
		{
			id: {
				type: DataTypes.UUID,
				defaultValue: DataTypes.UUIDV4,
				primaryKey: true,
			},
			chineseWord: {
				type: DataTypes.STRING,
				allowNull: false,
				unique: true,
			},
			pinyin: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			englishTranslation: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "Words",
		}
	);
	Word.associate = (models) => {
		Word.belongsToMany(models.User, { through: models.UserWord });
		Word.belongsToMany(models.Sentence, { through: models.SentenceWord });
	};

	return Word;
};
