// SentenceService loads these at require time.
jest.mock("nodejieba", () => ({ load: jest.fn(), cut: jest.fn(() => []) }));
jest.mock("pinyin", () => ({ default: jest.fn(() => []), STYLE_NORMAL: 0 }));

const { Op } = require("sequelize");
const WordService = require("../services/WordService");
const SentenceService = require("../services/SentenceService");
const { normalizePinyin } = require("../utils/pinyinSearch");

const OWNER = "owner-uuid";
const OTHER = "other-uuid";

function makeWord(overrides = {}) {
	return {
		id: "w1",
		chineseWord: "好",
		pinyin: "hao",
		englishTranslation: "good",
		creator_id: OWNER,
		is_locked: false,
		toJSON() {
			const { toJSON, update, destroy, ...rest } = this;
			return rest;
		},
		update: jest.fn(function (patch) {
			Object.assign(this, patch);
			return this;
		}),
		destroy: jest.fn(),
		...overrides,
	};
}

function makeUserWord(overrides = {}) {
	return {
		pinyin: null,
		englishTranslation: null,
		notes: null,
		update: jest.fn(function (patch) {
			Object.assign(this, patch);
			return this;
		}),
		destroy: jest.fn(),
		...overrides,
	};
}

function wordServiceWith({ word, userWord, userWordCount = 0 }) {
	return new WordService({
		sequelize: {},
		Word: {
			findOne: jest.fn().mockResolvedValue(word),
			destroy: jest.fn(),
		},
		Sentence: {},
		UserWord: {
			findOne: jest.fn().mockResolvedValue(userWord),
			findAll: jest.fn().mockResolvedValue([]),
			findOrCreate: jest.fn().mockResolvedValue([userWord || makeUserWord()]),
			count: jest.fn().mockResolvedValue(userWordCount),
			destroy: jest.fn(),
		},
	});
}

describe("editing a shared word", () => {
	test("the creator edits the shared entry itself", async () => {
		const word = makeWord();
		const service = wordServiceWith({ word, userWord: makeUserWord() });

		const result = await service.updateWord(
			"w1",
			{ englishTranslation: "fine" },
			OWNER,
		);

		expect(word.update).toHaveBeenCalledWith({ englishTranslation: "fine" });
		expect(result.englishTranslation).toBe("fine");
	});

	test("another user gets a private override, leaving the shared row alone", async () => {
		const word = makeWord({ creator_id: OTHER });
		const userWord = makeUserWord();
		const service = wordServiceWith({ word, userWord });

		const result = await service.updateWord(
			"w1",
			{ englishTranslation: "well" },
			OWNER,
		);

		expect(word.update).not.toHaveBeenCalled();
		expect(userWord.update).toHaveBeenCalledWith(
			expect.objectContaining({ englishTranslation: "well" }),
		);
		expect(result.englishTranslation).toBe("well");
	});

	test("the override does not leak into what other users see", async () => {
		const word = makeWord({ creator_id: OTHER });
		const service = wordServiceWith({ word, userWord: makeUserWord() });

		await service.updateWord("w1", { englishTranslation: "well" }, OWNER);

		// The shared row another user reads is untouched.
		expect(word.englishTranslation).toBe("good");
	});

	test("an edit back to the shared value clears the override", async () => {
		const word = makeWord({ creator_id: OTHER });
		const userWord = makeUserWord({ englishTranslation: "well" });
		const service = wordServiceWith({ word, userWord });

		await service.updateWord(
			"w1",
			{ pinyin: "hao", englishTranslation: "good" },
			OWNER,
		);

		expect(userWord.update).toHaveBeenCalledWith(
			expect.objectContaining({ pinyin: null, englishTranslation: null }),
		);
	});

	test("a word you do not have in your list is a 404", async () => {
		const word = makeWord({ creator_id: OTHER });
		const service = wordServiceWith({ word, userWord: null });

		await expect(
			service.updateWord("w1", { pinyin: "x" }, OWNER),
		).rejects.toMatchObject({ status: 404 });
	});

	test("missing word is a 404", async () => {
		const service = wordServiceWith({ word: null });

		await expect(service.deleteWord("w1", OWNER)).rejects.toMatchObject({
			status: 404,
		});
	});
});

describe("locked lesson words", () => {
	test("a student cannot edit or override a locked word", async () => {
		const word = makeWord({ creator_id: OTHER, is_locked: true });
		const userWord = makeUserWord();
		const service = wordServiceWith({ word, userWord });

		await expect(
			service.updateWord("w1", { englishTranslation: "mine" }, OWNER),
		).rejects.toMatchObject({ status: 403 });
		expect(word.update).not.toHaveBeenCalled();
		expect(userWord.update).not.toHaveBeenCalled();
	});

	test("the teacher can still edit their own locked word", async () => {
		const word = makeWord({ is_locked: true });
		const service = wordServiceWith({ word, userWord: makeUserWord() });

		await service.updateWord("w1", { englishTranslation: "fixed" }, OWNER);

		expect(word.update).toHaveBeenCalled();
	});

	test("a locked word is reported as locked to students only", async () => {
		const word = makeWord({ creator_id: OTHER, is_locked: true });
		const service = wordServiceWith({ word });

		expect(service._merge(word, null, OWNER).isLocked).toBe(true);
		expect(service._merge(word, null, OTHER).isLocked).toBe(false);
	});
});

describe("removing a word", () => {
	test("leaves the shared row when other users still hold it", async () => {
		const word = makeWord();
		const userWord = makeUserWord();
		const service = wordServiceWith({ word, userWord, userWordCount: 3 });

		const result = await service.deleteWord("w1", OWNER);

		expect(userWord.destroy).toHaveBeenCalled();
		expect(word.destroy).not.toHaveBeenCalled();
		expect(result).toEqual({ removedFromList: true, deletedShared: false });
	});

	test("a non-creator never destroys the shared row", async () => {
		const word = makeWord({ creator_id: OTHER });
		const userWord = makeUserWord();
		const service = wordServiceWith({ word, userWord, userWordCount: 0 });

		await service.deleteWord("w1", OWNER);

		expect(userWord.destroy).toHaveBeenCalled();
		expect(word.destroy).not.toHaveBeenCalled();
	});

	test("the creator cleans up a shared row nobody holds any more", async () => {
		const word = makeWord();
		const service = wordServiceWith({
			word,
			userWord: makeUserWord(),
			userWordCount: 0,
		});

		const result = await service.deleteWord("w1", OWNER);

		expect(word.destroy).toHaveBeenCalled();
		expect(result.deletedShared).toBe(true);
	});
});

describe("merged reads", () => {
	test("an override wins over the shared value, field by field", () => {
		const service = wordServiceWith({ word: null });
		const word = makeWord();
		const merged = service._merge(
			word,
			makeUserWord({ englishTranslation: "well" }),
			OTHER,
		);

		expect(merged.englishTranslation).toBe("well");
		expect(merged.pinyin).toBe("hao");
		expect(merged.isCustomised).toBe(true);
	});

	test("no override means the shared values are used", () => {
		const service = wordServiceWith({ word: null });
		const merged = service._merge(makeWord(), makeUserWord(), OWNER);

		expect(merged.englishTranslation).toBe("good");
		expect(merged.isCustomised).toBe(false);
		expect(merged.isOwner).toBe(true);
	});
});

function sentenceServiceWith(sentence) {
	const service = Object.create(SentenceService.prototype);
	service.sentence = {
		findOne: jest.fn().mockResolvedValue(sentence),
		destroy: jest.fn().mockResolvedValue(1),
		update: jest.fn().mockResolvedValue([1]),
	};
	return service;
}

describe("SentenceService ownership", () => {
	test("deleteSentence rejects a sentence created by someone else", async () => {
		const service = sentenceServiceWith({ id: "s1", creator_id: OTHER });

		await expect(service.deleteSentence("s1", OWNER)).rejects.toMatchObject({
			status: 403,
		});
		expect(service.sentence.destroy).not.toHaveBeenCalled();
	});

	test("deleteSentence reports a missing sentence as 404", async () => {
		const service = sentenceServiceWith(null);

		await expect(service.deleteSentence("s1", OWNER)).rejects.toMatchObject({
			status: 404,
		});
		expect(service.sentence.destroy).not.toHaveBeenCalled();
	});

	test("the creator can delete their own sentence", async () => {
		const service = sentenceServiceWith({ id: "s1", creator_id: OWNER });

		await service.deleteSentence("s1", OWNER);
		expect(service.sentence.destroy).toHaveBeenCalledWith({
			where: { id: "s1" },
		});
	});

	test("updateSentence is guarded the same way", async () => {
		const service = sentenceServiceWith({ id: "s1", creator_id: OTHER });

		await expect(
			service.updateSentence("s1", { pinyin: "x" }, OWNER),
		).rejects.toMatchObject({ status: 403 });
		expect(service.sentence.update).not.toHaveBeenCalled();
	});
});

describe("editing a sentence", () => {
	function ownSentence() {
		const sentence = {
			id: "s1",
			creator_id: OWNER,
			pinyin: "ni hao",
			englishTranslation: "Hello",
			update: jest.fn(function (patch) {
				Object.assign(this, patch);
				return this;
			}),
		};
		const service = sentenceServiceWith(sentence);
		return { service, sentence };
	}

	test("updates pinyin and translation, trimming whitespace", async () => {
		const { service, sentence } = ownSentence();

		await service.updateSentence(
			"s1",
			{ pinyin: "  ni hao ma  ", englishTranslation: " How are you? " },
			OWNER,
		);

		expect(sentence.update).toHaveBeenCalledWith({
			pinyin: "ni hao ma",
			englishTranslation: "How are you?",
		});
	});

	test("leaves the other field alone when only one is sent", async () => {
		const { service, sentence } = ownSentence();

		await service.updateSentence("s1", { pinyin: "ni hao ma" }, OWNER);

		expect(sentence.update).toHaveBeenCalledWith({ pinyin: "ni hao ma" });
	});

	test("chineseText is never writable", async () => {
		const { service, sentence } = ownSentence();

		await service.updateSentence(
			"s1",
			{ chineseText: "changed", pinyin: "ni hao ma" },
			OWNER,
		);

		expect(sentence.update).toHaveBeenCalledWith({ pinyin: "ni hao ma" });
	});

	test("rejects blanking a field", async () => {
		const { service, sentence } = ownSentence();

		await expect(
			service.updateSentence("s1", { pinyin: "   " }, OWNER),
		).rejects.toMatchObject({ status: 400 });
		expect(sentence.update).not.toHaveBeenCalled();
	});
});

describe("sentence search", () => {
	const service = Object.create(SentenceService.prototype);

	test("blank searches produce no clause", () => {
		expect(service._searchClause("")).toBeNull();
		expect(service._searchClause("   ")).toBeNull();
	});

	test("matches chinese, pinyin, english and toneless pinyin", () => {
		const clause = service._searchClause("hao");
		const fields = clause[Op.or].map((entry) => Object.keys(entry)[0]);

		expect(fields).toEqual([
			"chineseText",
			"pinyin",
			"englishTranslation",
			"pinyinSearch",
		]);
		expect(clause[Op.or][1].pinyin[Op.like]).toBe("%hao%");
	});

	test("strips tone marks and spacing from the search term", () => {
		const clause = service._searchClause("kě yǐ");

		expect(clause[Op.or][3].pinyinSearch[Op.like]).toBe("%keyi%");
	});

	test("accepts v for ü, as an IME does", () => {
		const clause = service._searchClause("lv");

		expect(clause[Op.or][3].pinyinSearch[Op.like]).toBe("%lu%");
	});

	test("a search with no latin letters skips the toneless branch", () => {
		const clause = service._searchClause("可以");
		const fields = clause[Op.or].map((entry) => Object.keys(entry)[0]);

		expect(fields).not.toContain("pinyinSearch");
	});

	test("escapes LIKE wildcards so they match literally", () => {
		const clause = service._searchClause("100%_x");

		expect(clause[Op.or][0].chineseText[Op.like]).toBe("%100\\%\\_x%");
	});
});

describe("pinyin normalisation", () => {
	test("tone marks, spacing and case all collapse", () => {
		expect(normalizePinyin("kě yǐ yòng")).toBe("keyiyong");
		expect(normalizePinyin("KE YI")).toBe("keyi");
		expect(normalizePinyin("hui4 yi4")).toBe("huiyi");
	});

	test("ü, v and u all reach the same key", () => {
		expect(normalizePinyin("lǜ")).toBe("lu");
		expect(normalizePinyin("lü")).toBe("lu");
		expect(normalizePinyin("lv")).toBe("lu");
	});

	test("non-pinyin input normalises to an empty string", () => {
		expect(normalizePinyin("可以")).toBe("");
		expect(normalizePinyin("")).toBe("");
		expect(normalizePinyin(null)).toBe("");
	});
});
