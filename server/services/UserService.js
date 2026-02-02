class UserService {
	constructor(db) {
		this.client = db.sequelize;
		this.User = db.User;
	}

	async getUserByEmail(email) {
		return await this.User.findOne({ where: { Email: email } });
	}

	async createUser(username, email, hashedPassword) {
		return await this.User.create({
			Username: username,
			Email: email,
			EncryptedPassword: hashedPassword,
		});
	}
}

module.exports = UserService;
