jest.mock("nodejieba", () => ({ load: jest.fn(), cut: jest.fn(() => []) }));
jest.mock("pinyin", () => ({ default: jest.fn(() => []), STYLE_NORMAL: 0 }));

const jieba = require("nodejieba");
const pinyin = require("pinyin");
const SentenceService = require("../services/SentenceService");

const OWNER = "owner-uuid";
const OTHER = "other-uuid";

function makeService(overrides = {}) {
	const progress = {
		xp: 0,
		difficult: false,
		lastPracticedAt: null,
		nextDueAt: null,
		save: jest.fn().mockResolvedValue(undefined),
		...overrides.progress,
	};
	const sentence = {
		id: "s1",
		creator_id: OWNER,
		chineseText: "你好！",
		save: jest.fn().mockResolvedValue(undefined),
		toJSON() {
			return { id: this.id, creator_id: this.creator_id };
		},
		...overrides.sentence,
	};
	const transaction = {
		commit: jest.fn().mockResolvedValue(undefined),
		rollback: jest.fn().mockResolvedValue(undefined),
	};
	const wordFindOne = overrides.wordFindOne || jest.fn().mockResolvedValue(null);
	const service = new SentenceService({
		sequelize: {
			transaction: jest.fn().mockResolvedValue(transaction),
		},
		Sentence: {
			findOne: jest.fn().mockResolvedValue(sentence),
		},
		UserTranslationQuota: {
			findOrCreate: jest.fn(),
		},
		Word: {
			findOne: wordFindOne,
		},
		UserSentence: {
			findOrCreate: jest.fn().mockResolvedValue([progress]),
		},
		Deck: {},
		UserWord: {
			findOne: jest.fn().mockResolvedValue(null),
		},
	});
	service.wordService.promoteWordsForSentence = jest.fn().mockResolvedValue(0);
	service.wordService.getUserWord =
		overrides.getUserWord || jest.fn().mockResolvedValue(null);
	service.dictionary = {
		lookup: overrides.dictionaryLookup || jest.fn().mockReturnValue(null),
	};
	service.translationService = {
		translate: jest.fn(),
	};
	service.checkAndIncrementQuota = jest.fn();
	return { service, progress, sentence, transaction, wordFindOne };
}

describe("tokenizeSentence", () => {
	beforeEach(() => {
		jieba.cut.mockReset();
		pinyin.default.mockReset();
	});

	test("drops punctuation and returns chineseWord+pinyin", async () => {
		jieba.cut.mockReturnValue(["你", "好", "！", "", " "]);
		const { service } = makeService({
			wordFindOne: jest.fn(async ({ where }) => {
				if (where.chineseWord === "你") {
					return { id: "w1", chineseWord: "你", pinyin: "nǐ" };
				}
				return null;
			}),
			getUserWord: jest.fn(async (id) => {
				if (id === "w1") return { pinyin: "ni" };
				return null;
			}),
			dictionaryLookup: jest.fn((word) => {
				if (word === "好") return { pinyin: "hǎo" };
				return null;
			}),
		});

		const tokens = await service.tokenizeSentence("你好！", OWNER);

		expect(jieba.cut).toHaveBeenCalledWith("你好！");
		expect(tokens).toEqual([
			{ chineseWord: "你", pinyin: "ni" },
			{ chineseWord: "好", pinyin: "hǎo" },
		]);
	});

	test("falls back to pinyin STYLE_NORMAL joined with spaces", async () => {
		jieba.cut.mockReturnValue(["四点"]);
		pinyin.default.mockReturnValue([["si"], ["dian"]]);
		const { service } = makeService();

		const tokens = await service.tokenizeSentence("四点", OWNER);

		expect(pinyin.default).toHaveBeenCalledWith("四点", {
			style: pinyin.STYLE_NORMAL,
			segment: true,
		});
		expect(tokens).toEqual([{ chineseWord: "四点", pinyin: "si dian" }]);
	});

	test("does not increment translation quota or call translate", async () => {
		jieba.cut.mockReturnValue(["四点"]);
		pinyin.default.mockReturnValue([["si"], ["dian"]]);
		const { service } = makeService();

		await service.tokenizeSentence("四点", OWNER);

		expect(service.translationService.translate).not.toHaveBeenCalled();
		expect(service.checkAndIncrementQuota).not.toHaveBeenCalled();
		expect(service.UserTranslationQuota.findOrCreate).not.toHaveBeenCalled();
	});
});

describe("markAsPracticed xpDelta", () => {
	test("defaults to +1", async () => {
		const { service, progress } = makeService({ progress: { xp: 2 } });

		await service.markAsPracticed("s1", OWNER);

		expect(progress.xp).toBe(3);
		expect(progress.save).toHaveBeenCalled();
	});

	test("xpDelta 3 adds 3", async () => {
		const { service, progress } = makeService({ progress: { xp: 2 } });

		await service.markAsPracticed("s1", OWNER, 3);

		expect(progress.xp).toBe(5);
	});
});

describe("GET tokens ownership", () => {
	test("getOwnedSentence is 403 for a non-owner", async () => {
		const { service, sentence } = makeService({
			sentence: { creator_id: OTHER },
		});

		await expect(service.getOwnedSentence("s1", OWNER)).rejects.toMatchObject({
			status: 403,
		});
		expect(sentence.chineseText).toBe("你好！");
	});
});

describe("PATCH practice xp validation", () => {
	test("omitted xp is 1", () => {
		expect(SentenceService.resolvePracticeXp(undefined)).toBe(1);
	});

	test("accepts 1 or 3", () => {
		expect(SentenceService.resolvePracticeXp(1)).toBe(1);
		expect(SentenceService.resolvePracticeXp(3)).toBe(3);
	});

	test("rejects xp other than 1 or 3", () => {
		for (const xp of [0, 2, 4, -1, "foo", null]) {
			try {
				SentenceService.resolvePracticeXp(xp);
				throw new Error(`expected reject for ${xp}`);
			} catch (error) {
				expect(error.status).toBe(400);
			}
		}
	});
});
