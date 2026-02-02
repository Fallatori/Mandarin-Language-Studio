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
				type: DataTypes.STRING,
				allowNull: false,
			},
			audioFilename: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			description: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			creator_id: {
				type: DataTypes.UUID,
				allowNull: true,
				references: { model: "Users", key: "id" },
			},
			is_public: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
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
