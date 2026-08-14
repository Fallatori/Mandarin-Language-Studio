function normalizePinyin(value) {
	return String(value || "")
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/v/g, "u")
		.replace(/[^a-z]/g, "");
}

function attachPinyinSearch(model) {
	const sync = (instance) => {
		if (instance.changed("pinyin") || instance.isNewRecord) {
			instance.pinyinSearch = normalizePinyin(instance.pinyin);
		}
	};

	model.addHook("beforeValidate", sync);
	model.addHook("beforeSave", sync);
}

module.exports = { normalizePinyin, attachPinyinSearch };
