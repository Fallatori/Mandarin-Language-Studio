const {
	entriesFromDict,
	entriesFromRows,
	buildIndex,
	suggest,
} = require("../utils/pinyinIme");

describe("pinyin IME suggest", () => {
	const index = buildIndex(
		entriesFromDict({
			我: ["wǒ", "I"],
			爱: ["ài", "love"],
			你: ["nǐ", "you"],
			我们: ["wǒ men", "we"],
			握: ["wò", "grasp"],
		}),
	);

	test("woaini converts as a phrase of 我爱你", () => {
		const list = suggest(index, "woaini");
		expect(list[0]).toMatchObject({ text: "我爱你", isPhrase: true });
	});

	test("wo lists 我 before 我们", () => {
		const texts = suggest(index, "wo").map((item) => item.text);
		expect(texts[0]).toBe("我");
		expect(texts).toContain("我们");
	});

	test("empty buffer is empty", () => {
		expect(suggest(index, "")).toEqual([]);
	});
});

describe("real CEDICT ranking", () => {
	const { suggestQuery } = require("../utils/pinyinIme");

	test("wo leads with 我, not a rare homophone", () => {
		const texts = suggestQuery("wo").map((item) => item.text);
		expect(texts[0]).toBe("我");
	});

	test("woaini phrase is 我爱你", () => {
		expect(suggestQuery("woaini")[0]).toMatchObject({
			text: "我爱你",
			isPhrase: true,
		});
	});

	test("huan does not commit 话 and leave n", () => {
		const first = suggestQuery("huan")[0];
		expect(first.py).toBe("huan");
		expect(first.text).not.toBe("话");
	});

	test("xihuan is 喜欢, not 西话", () => {
		expect(suggestQuery("xihuan")[0].text).toBe("喜欢");
	});

	test("woxihuan phrase is 我喜欢", () => {
		expect(suggestQuery("woxihuan")[0]).toMatchObject({
			text: "我喜欢",
			isPhrase: true,
		});
	});
});

describe("shortcut input", () => {
	const index = buildIndex(
		entriesFromRows([
			["我", "wo", 200000],
			["你", "ni", 234587],
			["好", "hao", 92543],
			["你好", "ni hao", 725],
			["中", "zhong", 50000],
			["国", "guo", 40000],
			["中国", "zhong guo", 129470],
			["喜欢", "xi huan", 9783],
			["西", "xi", 8000],
			["话", "hua", 12000],
			["西话", "xi hua", 5],
			["们", "men", 30000],
			["的", "de", 318825],
			["我们", "wo men", 98740],
			["我们的", "wo men de", 5000],
			["吗", "ma", 21245],
			["爱", "ai", 20000],
		]),
	);

	const top = (raw) => suggest(index, raw)[0];

	test("initials alone convert: nh is 你好", () => {
		expect(top("nh").text).toBe("你好");
	});

	test("initials alone convert: zg is 中国", () => {
		expect(top("zg").text).toBe("中国");
	});

	test("full first syllable then an initial: zhongg is 中国", () => {
		expect(top("zhongg").text).toBe("中国");
	});

	test("full syllables then an initial: womend is 我们的", () => {
		expect(top("womend").text).toBe("我们的");
	});

	test("a half-typed trailing syllable still matches: zhonggu is 中国", () => {
		expect(top("zhonggu").text).toBe("中国");
	});

	test("frequency decides between homophones: xihuan is 喜欢", () => {
		expect(top("xihuan").text).toBe("喜欢");
	});

	test("a shorter word stays available on a long buffer", () => {
		const texts = suggest(index, "nihaoma").map((item) => item.text);
		expect(texts).toContain("你好");
	});
});

describe("consumed buffer length", () => {
	const index = buildIndex(
		entriesFromRows([
			["中国", "zhong guo", 129470],
			["你好", "ni hao", 725],
		]),
	);

	test("an abbreviated commit reports what was typed, not the full pinyin", () => {
		const item = suggest(index, "zhongg")[0];
		expect(item.text).toBe("中国");
		expect(item.consumed).toBe(6);
		expect(item.py).toBe("zhongguo");
	});

	test("a fully typed commit reports the whole buffer", () => {
		expect(suggest(index, "nihao")[0].consumed).toBe(5);
	});
});

describe("saved words rank higher", () => {
	const index = buildIndex(
		entriesFromRows([
			["女孩", "nv hai", 13197],
			["你好", "ni hao", 1254],
			["男孩", "nan hai", 9000],
		]),
	);

	test("without a boost the corpus decides", () => {
		expect(suggest(index, "nh")[0].text).toBe("女孩");
	});

	test("a word the user has saved comes first", () => {
		const list = suggest(index, "nh", { boost: new Set(["你好"]) });
		expect(list[0].text).toBe("你好");
	});

	test("the boost does not invent candidates", () => {
		const list = suggest(index, "nh", { boost: new Set(["謝謝"]) });
		expect(list.map((item) => item.text)).not.toContain("謝謝");
	});
});

describe("phrase pieces are whole words", () => {
	const index = buildIndex(
		entriesFromRows([
			["我", "wo", 200000],
			["我们", "wo men", 400000],
			["爱", "ai", 20000],
			["你", "ni", 234587],
		]),
	);

	test("a phrase never emits a character the buffer did not ask for", () => {
		const list = suggest(index, "woaini", { boost: new Set(["我们"]) });
		expect(list[0].text).toBe("我爱你");
		expect(list.map((item) => item.text)).not.toContain("我们爱你");
	});
});
