const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const db = require("../models");
const UserService = require("../services/UserService");
const userService = new UserService(db);
const authenticateToken = require("../middleware/auth");

const TOKEN_SECRET = process.env.TOKEN_SECRET || "dev_secret";

router.post("/register", async (req, res) => {
	const { username, email, password } = req.body || {};

	if (!username || !password || !email) {
		return res.status(400).json({
			status: "error",
			statuscode: 400,
			data: { result: "Username, email, and password are required" },
		});
	}

	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.status(400).json({
			status: "error",
			statuscode: 400,
			data: { result: "Invalid email format" },
		});
	}

	const stringPassword = password.toString();

	try {
		const existingUser = await userService.getUserByEmail(email);
		if (existingUser) {
			return res.status(400).json({
				status: "error",
				statuscode: 400,
				data: { result: "User already exists" },
			});
		}

		const hashedPassword = await bcrypt.hash(stringPassword, 10);
		const newUser = await userService.createUser(
			username,
			email,
			hashedPassword,
		);

		const token = jwt.sign(
			{ id: newUser.id, username: newUser.Username, email: newUser.Email },
			TOKEN_SECRET,
			{
				expiresIn: "2h",
			},
		);

		res.cookie("token", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 2 * 60 * 60 * 1000, // 2 hours
		});

		return res.status(201).json({
			status: "success",
			statuscode: 201,
			data: { token },
		});
	} catch (error) {
		console.error("Registration error:", error);
		return res.status(500).json({
			status: "error",
			statuscode: 500,
			data: { result: "Registration failed", error: error.message },
		});
	}
});

router.post("/login", async (req, res) => {
	const { email, password } = req.body || {};

	if (!email || !password) {
		return res.status(400).json({
			status: "error",
			statuscode: 400,
			data: { result: "Email and password are required" },
		});
	}

	const stringPassword = password.toString();

	try {
		const user = await userService.getUserByEmail(email);
		if (!user) {
			return res.status(400).json({
				status: "error",
				statuscode: 400,
				data: { result: "Invalid email or password" },
			});
		}
		const passwordMatch = await bcrypt.compare(
			stringPassword,
			user.EncryptedPassword,
		);
		if (!passwordMatch) {
			return res.status(400).json({
				status: "error",
				statuscode: 400,
				data: { result: "Invalid email or password" },
			});
		}
		const token = jwt.sign(
			{ id: user.id, username: user.Username, email: user.Email },
			TOKEN_SECRET,
			{
				expiresIn: "2h",
			},
		);

		res.cookie("token", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 2 * 60 * 60 * 1000, // 2 hours
		});

		return res.status(200).json({
			status: "success",
			statuscode: 200,
			data: {
				user: { id: user.id, username: user.Username, email: user.Email },
				token,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({
			status: "error",
			statuscode: 500,
			data: { result: "Login failed", error: error.message },
		});
	}
});

router.get("/me", authenticateToken, (req, res) => {
	res.json({
		status: "success",
		data: {
			user: {
				id: req.user.id,
				username: req.user.username,
				email: req.user.email,
			},
		},
	});
});

router.post("/logout", (req, res) => {
	res.clearCookie("token");
	res.json({ message: "Logged out" });
});

module.exports = router;
