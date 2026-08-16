const {
	extraHanzi,
	sentencePinyinFromWords,
} = require("../utils/previewWords");

describe("extraHanzi", () => {
	test("adds 我 爱 你 after the idiom 我爱你", () => {
		expect(extraHanzi([{ chineseWord: "我爱你" }])).toEqual(["我", "爱", "你"]);
	});

	test("skips characters already in the list", () => {
		expect(
			extraHanzi([{ chineseWord: "我" }, { chineseWord: "经理" }]),
		).toEqual(["经", "理"]);
	});

	test("ignores single-character words", () => {
		expect(extraHanzi([{ chineseWord: "好" }])).toEqual([]);
	});
});

describe("sentencePinyinFromWords", () => {
	test("does not append extra-character pinyin after an idiom", () => {
		expect(
			sentencePinyinFromWords("我爱你", [
				{ chineseWord: "我爱你", pinyin: "wǒàinǐ" },
				{ chineseWord: "我", pinyin: "wǒ" },
				{ chineseWord: "爱", pinyin: "ài" },
				{ chineseWord: "你", pinyin: "nǐ" },
			]),
		).toBe("wǒàinǐ");
	});

	test("uses the character rows when the idiom is removed", () => {
		expect(
			sentencePinyinFromWords("我爱你", [
				{ chineseWord: "我", pinyin: "wǒ" },
				{ chineseWord: "爱", pinyin: "ài" },
				{ chineseWord: "你", pinyin: "nǐ" },
			]),
		).toBe("wǒ ài nǐ");
	});

	test("prefers the longest cover at each position", () => {
		expect(
			sentencePinyinFromWords("我爱你", [
				{ chineseWord: "我", pinyin: "wǒ" },
				{ chineseWord: "爱", pinyin: "ài" },
				{ chineseWord: "你", pinyin: "nǐ" },
				{ chineseWord: "我爱你", pinyin: "wǒ ài nǐ" },
			]),
		).toBe("wǒ ài nǐ");
	});
});
