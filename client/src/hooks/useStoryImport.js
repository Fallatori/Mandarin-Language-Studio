import { useState } from "react";
import axios from "axios";

export function useStoryImport() {
	const [status, setStatus] = useState("idle"); // idle, checking, ready, uploading, success, error
	const [payload, setPayload] = useState(null);
	const [previewData, setPreviewData] = useState([]);
	const [importResult, setImportResult] = useState(null);
	const [error, setError] = useState("");

	const API_Check = "http://localhost:5001/api/sentences/check-existing";
	const API_Import = "http://localhost:5001/api/stories/import";

	const processFile = (file) => {
		if (!file) return;
		setStatus("checking");
		setError("");

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const json = JSON.parse(e.target.result);
				if (!json || typeof json !== "object" || Array.isArray(json)) {
					throw new Error("File must be a story object, not an array");
				}
				if (!Array.isArray(json.sentences) || json.sentences.length === 0) {
					throw new Error("Story needs a non-empty sentences array");
				}

				const texts = json.sentences.map((s) => s.chineseText);
				const { data } = await axios.post(
					API_Check,
					{ chineseTexts: texts },
					{ withCredentials: true },
				);
				const dbDuplicates = new Set(data.existing);

				const contentSeen = new Set();
				const processed = json.sentences.map((item) => {
					const isBatchDup = contentSeen.has(item.chineseText);
					contentSeen.add(item.chineseText);

					return {
						...item,
						isDuplicate: dbDuplicates.has(item.chineseText),
						isBatchDuplicate: isBatchDup,
					};
				});

				setPayload(json);
				setPreviewData(processed);
				setStatus("ready");
			} catch (err) {
				setError(err.message || "Invalid JSON file");
				setStatus("error");
			}
		};
		reader.readAsText(file);
	};

	const importData = async () => {
		setStatus("uploading");
		try {
			const sentences = previewData.filter((i) => !i.isBatchDuplicate);
			const { data } = await axios.post(
				API_Import,
				{ ...payload, sentences },
				{ withCredentials: true },
			);

			const batchDupTexts = previewData
				.filter((i) => i.isBatchDuplicate)
				.map((i) => `${i.chineseText} (File Duplicate)`);

			setImportResult({
				...data,
				skipped: [...data.skipped, ...batchDupTexts],
			});
			setStatus("success");
			return data.story;
		} catch (err) {
			console.error("Import error:", err);
			setError(err.response?.data?.error || "Import failed");
			setStatus("error");
		}
	};

	const reset = () => {
		setStatus("idle");
		setPayload(null);
		setPreviewData([]);
		setImportResult(null);
		setError("");
	};

	return {
		status,
		payload,
		previewData,
		importResult,
		error,
		processFile,
		importData,
		reset,
	};
}
