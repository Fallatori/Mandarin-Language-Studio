const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const Story = sequelize.define(
		"Story",
		{
			id: {
				type: DataTypes.UUID,
				defaultValue: DataTypes.UUIDV4,
				primaryKey: true,
			},
			title: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			chineseText: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			creator_id: {
				type: DataTypes.UUID,
				allowNull: true,
			},
			is_public: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "Stories",
		},
	);

	Story.associate = (models) => {
		Story.belongsTo(models.User, {
			as: "Author",
			foreignKey: "creator_id",
		});

		Story.belongsToMany(models.Sentence, {
			through: "StorySentences",
			foreignKey: "story_id",
			otherKey: "sentence_id",
			as: "sentences",
		});
	};

	return Story;
};
