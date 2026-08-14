function normalizePinyin(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/v/g, "u")
        .replace(/[^a-z]/g, "");
}

export { normalizePinyin };
