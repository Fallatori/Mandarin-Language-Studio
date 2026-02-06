import { useState } from "react";
import axios from "axios";

export function useBulkUpload() {
	const [status, setStatus] = useState("idle"); // idle, checking, ready, uploading, success, error
	const [previewData, setPreviewData] = useState([]);
	const [uploadResult, setUploadResult] = useState(null);
	const [error, setError] = useState("");

	const API_Check = "http://localhost:5001/api/sentences/check-existing";
	const API_Upload = "http://localhost:5001/api/sentences/bulk";

	const processFile = (file) => {
		if (!file) return;
		setStatus("checking");
		setError("");

		const reader = new FileReader();
		reader.onload = async (e) => {
			try {
				const json = JSON.parse(e.target.result);
				if (!Array.isArray(json)) throw new Error("File must be a JSON array");

				const texts = json.map((i) => i.chineseText);
				const { data } = await axios.post(
					API_Check,
					{ chineseTexts: texts },
					{ withCredentials: true },
				);
				const dbDuplicates = new Set(data.existing);

				const contentSeen = new Set();

				const processed = json.map((item) => {
					const isBatchDup = contentSeen.has(item.chineseText);
					contentSeen.add(item.chineseText);

					return {
						...item,
						isDuplicate: dbDuplicates.has(item.chineseText),
						isBatchDuplicate: isBatchDup,
					};
				});

				setPreviewData(processed);
				setStatus("ready");
			} catch (err) {
				setError(err.message || "Invalid JSON file");
				setStatus("error");
			}
		};
		reader.readAsText(file);
	};

	const uploadData = async () => {
		setStatus("uploading");
		try {
			const uniqueData = previewData.filter((i) => !i.isBatchDuplicate);
			const { data } = await axios.post(
				API_Upload,
				{ sentences: uniqueData },
				{ withCredentials: true },
			);

			const batchDupTexts = previewData
				.filter((i) => i.isBatchDuplicate)
				.map((i) => `${i.chineseText} (File Duplicate)`);

			setUploadResult({
				...data,
				skipped: [...data.skipped, ...batchDupTexts],
			});
			setStatus("success");
			return data.added;
		} catch (err) {
			console.error("Upload error:", err);
			setError("Upload failed");
			setStatus("error");
		}
	};

	const reset = () => {
		setStatus("idle");
		setPreviewData([]);
		setUploadResult(null);
		setError("");
	};

	return {
		status,
		previewData,
		uploadResult,
		error,
		processFile,
		uploadData,
		reset,
	};
}
