const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	// Define the Sentence model
	const Sentence = sequelize.define(
		"Sentence",
		{
			id: {
				type: DataTypes.UUID,
				defaultValue: DataTypes.UUIDV4,
				primaryKey: true,
				allowNull: false,
			},
			chineseText: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			pinyin: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			englishTranslation: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			audioFilename: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			lastPracticedAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "Sentences",
		}
	);
	Sentence.associate = (models) => {
		Sentence.belongsToMany(models.Word, { through: models.SentenceWord });
	};

	return Sentence;
};
