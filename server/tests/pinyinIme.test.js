const { entriesFromDict, buildIndex, suggest } = require("../utils/pinyinIme");

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
