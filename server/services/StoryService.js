const jieba = require("nodejieba");
const pinyin = require("pinyin");
const { httpError } = require("../utils/httpError");
const WordService = require("./WordService");
const DictionaryService = require("./DictionaryService");
const SentenceService = require("./SentenceService");
const TranslationQuotaService = require("./TranslationQuotaService");

function limitFrom(value, fallback) {
	if (value === undefined || value === "") return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

const MAX_STORIES_PER_DAY = limitFrom(process.env.STORY_DAILY_LIMIT, 1);
const MAX_WORDS_PER_STORY = limitFrom(process.env.STORY_MAX_WORDS, 200);
const DEFAULT_MAX_SENTENCE_LENGTH = 30;

const SENTENCE_ENDINGS = /(?<=[。！？；…!?])/u;
const CLAUSE_ENDINGS = /(?<=[，、；：,])/u;
const TRAILING_CLAUSE_PUNCT = /[，、；：,]+$/u;

class StoryService {
	constructor(db) {
		this.client = db.sequelize;
		this.story = db.Story;
		this.sentence = db.Sentence;
		this.userStory = db.UserStory;
		this.UserTranslationQuota = db.UserTranslationQuota;
		this.wordService = new WordService(db);
		this.dictionary = new DictionaryService();
		this.sentenceService = new SentenceService(db);
		this.translationQuota = new TranslationQuotaService(db);
	}

	_clean(text) {
		return String(text || "").replace(/\s+/g, "");
	}

	_splitSentences(text) {
		return String(text || "")
			.split(SENTENCE_ENDINGS)
			.map((part) => this._clean(part))
			.filter(Boolean);
	}

	_stripTrailingClausePunct(text) {
		return String(text || "").replace(TRAILING_CLAUSE_PUNCT, "");
	}

	_splitClauses(sentence) {
		return String(sentence || "")
			.split(CLAUSE_ENDINGS)
			.map((part) => this._clean(part))
			.filter(Boolean);
	}

	_segment(text) {
		return jieba
			.cut(text)
			.filter(
				(token) => token.trim() !== "" && !/[\p{P}\p{Z}]/u.test(token),
			);
	}

	_tokens(text) {
		return jieba
			.cut(text)
			.filter((token) => token.trim() !== "")
			.map((token) => ({
				text: token,
				isWord: !/[\p{P}\p{Z}]/u.test(token),
			}));
	}

	_describeWord(chineseWord) {
		const entry = this.dictionary.lookup(chineseWord);
		if (entry) {
			return {
				chineseWord,
				pinyin: entry.pinyin,
				englishTranslation: entry.englishTranslation,
			};
		}

		return {
			chineseWord,
			pinyin: pinyin
				.default(chineseWord, { style: pinyin.STYLE_NORMAL, segment: true })
				.map((arr) => arr[0])
				.join(" "),
			englishTranslation: "",
		};
	}

	async _statusesFor(chineseWords, userId) {
		const rows = await this.wordService.getWordsByUser(userId);
		const byWord = new Map(rows.map((row) => [row.chineseWord, row.status]));

		return new Map(chineseWords.map((w) => [w, byWord.get(w) ?? null]));
	}

	async _wordInfoFor(chineseWords, userId) {
		const rows = await this.wordService.getWordsByUser(userId);
		const byWord = new Map(rows.map((row) => [row.chineseWord, row]));

		return new Map(
			chineseWords.map((w) => {
				const owned = byWord.get(w);
				return [
					w,
					{
						status: owned?.status ?? null,
						pinyin: owned?.pinyin || this._describeWord(w).pinyin,
					},
				];
			}),
		);
	}

	async _quotaRow(userId, transaction) {
		const today = new Date().toISOString().split("T")[0];

		const [quota] = await this.UserTranslationQuota.findOrCreate({
			where: { user_id: userId, date: today },
			defaults: { count: 0, storyCount: 0 },
			transaction,
		});
		return quota;
	}

	async assertStoryQuota(userId) {
		if (MAX_STORIES_PER_DAY <= 0) return;

		const quota = await this._quotaRow(userId);
		if ((quota.storyCount || 0) >= MAX_STORIES_PER_DAY) {
			throw httpError(
				429,
				`Story limit reached (${MAX_STORIES_PER_DAY} per day). Try again tomorrow.`,
			);
		}
	}

	async consumeStoryQuota(userId, transaction) {
		if (MAX_STORIES_PER_DAY <= 0) return;

		const quota = await this._quotaRow(userId, transaction);
		if ((quota.storyCount || 0) >= MAX_STORIES_PER_DAY) {
			throw httpError(
				429,
				`Story limit reached (${MAX_STORIES_PER_DAY} per day). Try again tomorrow.`,
			);
		}
		await quota.increment("storyCount", { transaction });
	}

	async _fillMissingGlosses(described, userId) {
		const missing = described.filter((d) => !d.englishTranslation);
		if (missing.length === 0) return described;
		if (!this.sentenceService.translationService.isConfigured()) return described;

		try {
			const words = missing.map((d) => d.chineseWord);
			await this.translationQuota.checkAndRecordUsage(
				userId,
				words.join(""),
				"story",
			);
			const translations =
				await this.sentenceService.translationService.translateBatch(words);
			missing.forEach((d, i) => {
				d.englishTranslation = translations[i] || "";
			});
		} catch (error) {
			console.error("Gloss translation failed:", error.message);
		}

		return described;
	}

	_assertWordCap(count) {
		if (MAX_WORDS_PER_STORY <= 0) return;

		if (count > MAX_WORDS_PER_STORY) {
			throw httpError(
				429,
				`This story has ${count} unique words, over the ${MAX_WORDS_PER_STORY} limit. Split it into shorter pieces.`,
			);
		}
	}

	async analyzeStory(chineseText, userId, options = {}) {
		const maxLength = Number(options.maxLength) || DEFAULT_MAX_SENTENCE_LENGTH;
		const text = String(chineseText || "").trim();
		if (!text) throw httpError(400, "Story text is required");

		await this.assertStoryQuota(userId);

		const sentences = this._splitSentences(text);
		if (sentences.length === 0) {
			throw httpError(400, "No sentences found in the story");
		}

		const allTokens = sentences.flatMap((s) => this._segment(s));
		const unique = [...new Set(allTokens)];
		this._assertWordCap(unique.length);

		const statuses = await this._statusesFor(unique, userId);
		const vocabulary = await this._fillMissingGlosses(
			unique.map((chineseWord) => ({
				...this._describeWord(chineseWord),
				status: statuses.get(chineseWord),
				isNew: statuses.get(chineseWord) === null,
			})),
			userId,
		);

		const analysed = sentences.map((chineseText, index) => {
			const tokens = this._segment(chineseText);
			const autoSave = [...chineseText].length <= maxLength;

			return {
				index,
				chineseText,
				length: [...chineseText].length,
				autoSave,
				words: tokens,
				clauses: autoSave ? [] : this._splitClauses(chineseText),
			};
		});

		const toTranslate = analysed.filter((s) => s.autoSave);
		if (toTranslate.length > 0 && this.sentenceService.translationService.isConfigured()) {
			try {
				const texts = toTranslate.map((s) => s.chineseText);
				await this.translationQuota.checkAndRecordUsage(
					userId,
					texts.join(""),
					"story",
				);
				const translations =
					await this.sentenceService.translationService.translateBatch(texts);
				toTranslate.forEach((s, i) => {
					s.englishTranslation = translations[i] || "";
				});
			} catch (error) {
				console.error("Story translation failed:", error.message);
			}
		}

		return {
			chineseText: text,
			maxLength,
			sentences: analysed,
			vocabulary,
			counts: {
				sentences: analysed.length,
				autoSave: analysed.filter((s) => s.autoSave).length,
				manual: analysed.filter((s) => !s.autoSave).length,
				words: unique.length,
				newWords: vocabulary.filter((w) => w.isNew).length,
			},
		};
	}

	async _addWords(words, userId, status) {
		let added = 0;

		const entries = await this._fillMissingGlosses(
			words.map((w) =>
				typeof w === "string" ? this._describeWord(w) : w,
			),
			userId,
		);

		for (const described of entries) {
			const chineseWord = described.chineseWord;
			const [word, created] = await this.sentenceService.word.findOrCreate({
				where: { chineseWord },
				defaults: {
					chineseWord,
					pinyin: described.pinyin,
					englishTranslation: described.englishTranslation,
					creator_id: userId,
					is_public: false,
				},
			});

			const existing = await this.wordService.getUserWord(word.id, userId);
			if (!existing) added += 1;
			await this.wordService.ensureUserWord(word.id, userId, null, status);

			if (created && !word.englishTranslation && described.englishTranslation) {
				await word.update({
					englishTranslation: described.englishTranslation,
				});
			}
		}

		return added;
	}

	async _saveSentences(story, sentences, userId) {
		const results = { added: [], skipped: [], errors: [] };

		for (const item of sentences) {
			try {
				const chineseText = this._clean(item.chineseText);
				if (!chineseText) continue;

				const existing = await this.sentenceService.getSentenceByName(
					chineseText,
					userId,
				);
				if (existing) {
					await story.addSentence(existing);
					results.skipped.push(chineseText);
					continue;
				}

				const definedWords =
					item.words && item.words.length > 0
						? item.words
						: await this._fillMissingGlosses(
								this._segment(chineseText).map((w) =>
									this._describeWord(w),
								),
								userId,
							);

				const created = await this.sentenceService.addSentence({
					chineseText,
					pinyin: item.pinyin || "",
					englishTranslation: item.englishTranslation || "",
					creator_id: userId,
					definedWords,
					skipWordTranslation: true,
				});

				await story.addSentence(created);
				results.added.push(created);
			} catch (error) {
				console.error("Story sentence save error:", error);
				results.errors.push({
					text: item.chineseText,
					error: error.message,
				});
			}
		}

		return results;
	}

	async createStory({ title, chineseText }, userId) {
		const text = String(chineseText || "").trim();
		if (!text) throw httpError(400, "Story text is required");

		const analysis = await this.analyzeStory(text, userId);
		await this.consumeStoryQuota(userId);

		const story = await this.story.create({
			title: String(title || "").trim() || "Untitled story",
			chineseText: text,
			creator_id: userId,
		});
		await this.userStory.findOrCreate({
			where: { user_id: userId, story_id: story.id },
			defaults: { lastReadAt: new Date() },
		});

		const newWords = analysis.vocabulary.filter((w) => w.isNew);
		const wordsAdded = await this._addWords(newWords, userId, "new");

		const byWord = new Map(
			analysis.vocabulary.map((w) => [w.chineseWord, w]),
		);
		const autoSaved = analysis.sentences
			.filter((s) => s.autoSave)
			.map((s) => ({
				chineseText: s.chineseText,
				englishTranslation: s.englishTranslation || "",
				words: s.words.map(
					(w) => byWord.get(w) || this._describeWord(w),
				),
			}));

		const saved = await this._saveSentences(story, autoSaved, userId);

		return {
			story,
			wordsAdded,
			sentencesAdded: saved.added.length,
			skipped: saved.skipped,
			errors: saved.errors,
			pending: analysis.sentences.filter((s) => !s.autoSave),
		};
	}

	async importStory(payload, userId) {
		const sentences = Array.isArray(payload?.sentences) ? payload.sentences : [];
		if (sentences.length === 0) {
			throw httpError(400, "The file needs a non-empty sentences array");
		}

		const cleaned = sentences
			.map((s) => ({ ...s, chineseText: this._clean(s.chineseText) }))
			.filter((s) => s.chineseText);
		if (cleaned.length === 0) {
			throw httpError(400, "No sentences with chineseText were found");
		}

		const unique = new Set();
		for (const item of cleaned) {
			const words =
				item.words && item.words.length > 0
					? item.words.map((w) => w.chineseWord).filter(Boolean)
					: this._segment(item.chineseText);
			words.forEach((w) => unique.add(w));
		}
		this._assertWordCap(unique.size);

		const text =
			String(payload.chineseText || "").trim() ||
			cleaned.map((s) => s.chineseText).join("");

		const story = await this.story.create({
			title: String(payload.title || "").trim() || "Imported story",
			chineseText: text,
			creator_id: userId,
		});
		await this.userStory.findOrCreate({
			where: { user_id: userId, story_id: story.id },
			defaults: { lastReadAt: new Date() },
		});

		const statuses = await this._statusesFor([...unique], userId);
		const newWords = [...unique].filter((w) => statuses.get(w) === null);
		const wordsAdded = await this._addWords(newWords, userId, "new");

		const saved = await this._saveSentences(story, cleaned, userId);

		return {
			story,
			wordsAdded,
			added: saved.added,
			skipped: saved.skipped,
			errors: saved.errors,
		};
	}

	async saveCustomSentence(storyId, clauses, userId) {
		const story = await this.getOwnedStory(storyId, userId);

		const chineseText = this._stripTrailingClausePunct(
			this._clean(Array.isArray(clauses) ? clauses.join("") : clauses),
		);
		if (!chineseText) throw httpError(400, "Select at least one section");

		if (!this._clean(story.chineseText).includes(chineseText)) {
			throw httpError(400, "That selection is not part of this story");
		}

		const existing = await this.sentenceService.getSentenceByName(
			chineseText,
			userId,
		);
		if (existing) {
			await story.addSentence(existing);
			throw httpError(409, "You already saved that sentence");
		}

		let englishTranslation = "";
		if (this.sentenceService.translationService.isConfigured()) {
			try {
				await this.translationQuota.checkAndRecordUsage(
					userId,
					chineseText,
					"story",
				);
				englishTranslation =
					await this.sentenceService.translationService.translate(chineseText);
			} catch (error) {
				console.error("Custom sentence translation failed:", error.message);
			}
		}

		const words = this._segment(chineseText).map((w) => this._describeWord(w));
		const created = await this.sentenceService.addSentence({
			chineseText,
			pinyin: "",
			englishTranslation,
			creator_id: userId,
			definedWords: words,
			skipWordTranslation: true,
		});
		await story.addSentence(created);

		return created;
	}

	async getStoriesByUser(userId) {
		return await this.story.findAll({
			where: { creator_id: userId },
			order: [["createdAt", "DESC"]],
		});
	}

	async getOwnedStory(id, userId) {
		const story = await this.story.findOne({ where: { id } });
		if (!story) throw httpError(404, "Story not found");
		if (story.creator_id !== userId) {
			throw httpError(403, "You can only open stories you created");
		}
		return story;
	}

	async readStory(id, userId, options = {}) {
		const story = await this.getOwnedStory(id, userId);
		const maxLength = Number(options.maxLength) || DEFAULT_MAX_SENTENCE_LENGTH;

		const sentences = this._splitSentences(story.chineseText);
		const unique = [...new Set(sentences.flatMap((s) => this._segment(s)))];
		const info = await this._wordInfoFor(unique, userId);

		const saved = await story.getSentences();
		const savedTexts = saved.map((s) => this._clean(s.chineseText));
		const isCovered = (text) => {
			const probe = this._stripTrailingClausePunct(text);
			return savedTexts.some((t) => t.includes(probe));
		};

		return {
			story,
			sentences: sentences.map((chineseText, index) => {
				const clauses = this._splitClauses(chineseText).map((text, i) => ({
					index: i,
					text,
					saved: isCovered(text),
				}));

				return {
					index,
					chineseText,
					length: [...chineseText].length,
					autoSave: [...chineseText].length <= maxLength,
					saved: isCovered(chineseText),
					pending: clauses.some((c) => !c.saved),
					words: this._tokens(chineseText).map((token) => ({
						chineseWord: token.text,
						isWord: token.isWord,
						status: token.isWord
							? (info.get(token.text)?.status ?? null)
							: null,
						pinyin: token.isWord
							? (info.get(token.text)?.pinyin ?? "")
							: "",
					})),
					clauses,
				};
			}),
			savedSentences: saved,
		};
	}

	async deleteStory(id, userId) {
		await this.getOwnedStory(id, userId);
		await this.userStory.destroy({ where: { story_id: id } });
		return await this.story.destroy({ where: { id } });
	}
}

module.exports = StoryService;
