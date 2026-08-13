const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	const UserStory = sequelize.define(
		"UserStory",
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
			story_id: {
				type: DataTypes.UUID,
				allowNull: false,
				references: { model: "Stories", key: "id" },
			},
			lastReadAt: {
				type: DataTypes.DATE,
				allowNull: true,
			},
		},
		{
			underscored: true,
			timestamps: true,
			tableName: "UserStories",
			indexes: [
				{
					unique: true,
					fields: ["user_id", "story_id"],
				},
			],
		},
	);

	return UserStory;
};
