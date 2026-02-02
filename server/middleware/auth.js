const jwt = require("jsonwebtoken");
const TOKEN_SECRET = process.env.TOKEN_SECRET || "dev_secret";

function authenticateToken(req, res, next) {
	const authHeader = req.headers["authorization"];
	const token =
		(authHeader && authHeader.split(" ")[1]) ||
		(req.cookies && req.cookies.token);
	if (!token)
		return res.status(401).json({ message: "Authentication required" });

	jwt.verify(token, TOKEN_SECRET, (err, user) => {
		if (err)
			return res.status(403).json({ message: "Invalid or expired token" });
		req.user = user;
		next();
	});
}

module.exports = authenticateToken;
