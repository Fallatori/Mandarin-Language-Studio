function extraHanzi(words) {
	const seen = new Set(
		(words || []).map((word) => word.chineseWord).filter(Boolean),
	);
	const extra = [];
	for (const word of words || []) {
		const chars = [...String(word.chineseWord || "")].filter((ch) =>
			/\p{Script=Han}/u.test(ch),
		);
		if (chars.length < 2) continue;
		for (const ch of chars) {
			if (seen.has(ch)) continue;
			seen.add(ch);
			extra.push(ch);
		}
	}
	return extra;
}

function coveringWords(chineseText, definedWords) {
	const words = (definedWords || []).filter(
		(word) => word && word.chineseWord,
	);
	const text = String(chineseText || "");
	const used = new Set();
	const covered = [];
	let i = 0;

	while (i < text.length) {
		let best = -1;
		let bestLen = 0;
		for (let j = 0; j < words.length; j++) {
			if (used.has(j)) continue;
			const token = String(words[j].chineseWord);
			if (token.length > bestLen && text.startsWith(token, i)) {
				best = j;
				bestLen = token.length;
			}
		}
		if (best >= 0) {
			used.add(best);
			covered.push(words[best]);
			i += bestLen;
		} else {
			i += 1;
		}
	}

	return covered;
}

function sentencePinyinFromWords(chineseText, definedWords) {
	return coveringWords(chineseText, definedWords)
		.map((word) => word.pinyin)
		.filter(Boolean)
		.join(" ");
}

module.exports = { extraHanzi, coveringWords, sentencePinyinFromWords };
