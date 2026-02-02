module.exports = (sequelize, DataTypes) => {
	const Lesson = sequelize.define("Lesson", {
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		title: { type: DataTypes.STRING, allowNull: false },
		description: { type: DataTypes.TEXT },
		difficulty: { type: DataTypes.INTEGER }, // e.g., HSK level
	});

	Lesson.associate = (models) => {
		Lesson.belongsTo(models.User, { as: "Teacher", foreignKey: "creator_id" });
		Lesson.belongsToMany(models.Sentence, { through: "LessonSentences" });
		Lesson.belongsToMany(models.Word, { through: "LessonWords" });
	};
	return Lesson;
};
