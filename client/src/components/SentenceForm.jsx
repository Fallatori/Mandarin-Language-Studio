
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function SentenceForm({ onAddSentence, isLoading }) {
    const navigate = useNavigate();
     const [step, setStep] = useState('input'); // 'input' or 'preview'
    const [chineseText, setChineseText] = useState('');
    const [pinyin, setPinyin] = useState('');
    const [englishTranslation, setEnglishTranslation] = useState('');
    const [audioFile, setAudioFile] = useState(null);
    const [error, setError] = useState('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [previewData, setPreviewData] = useState(null);

  const handleTranslate = async (sourceText, targetLang, setTargetField) => {
        if (!sourceText.trim()) return;
        
        setIsTranslating(true);
        try {
            const response = await axios.post(
                'http://localhost:5001/api/sentences/translate',
                { text: sourceText, targetLang }, 
                { withCredentials: true }
            );
            setTargetField(response.data.translation);
        } catch (err) {
            console.error("Translation failed:", err);
            if (err.response && err.response.status === 401) {
                navigate('/login');
                return;
            }
            setError("Could not auto-translate. Please enter manually.");
        } finally {
            setIsTranslating(false);
        }
    };

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type.startsWith('audio/')) {
            setAudioFile(file);
            setError('');
        } else {
            setAudioFile(null);
            setError('Please select a valid audio file.');
        }
    };

    const handleAnalyze = async () => {
        if (!chineseText) {
            setError('Chinese text is required for preview.');
            return;
        }
        setIsTranslating(true);
        try {
            const response = await axios.post(
                'http://localhost:5001/api/sentences/analyze', 
                { chineseText }, 
                { withCredentials: true }
            );
            setPreviewData(response.data);
            setStep('preview');
            setError('');
        } catch (err) {
            console.error("Analysis failed:", err);
            setError("Failed to analyze sentence.");
        } finally {
            setIsTranslating(false);
        }
    };

    const handleWordChange = (index, field, value) => {
        const newWords = [...previewData.words];
        newWords[index] = { ...newWords[index], [field]: value };
        setPreviewData({ ...previewData, words: newWords });
    };

    const handleDeleteWord = (index) => {
        const newWords = previewData.words.filter((_, i) => i !== index);
        setPreviewData({ ...previewData, words: newWords });
    };

    const handleAddWord = () => {
        setPreviewData({
            ...previewData,
            words: [
                ...previewData.words, 
                { 
                    chineseWord: '', 
                    pinyin: '', 
                    englishTranslation: '', 
                    isNew: true 
                }
            ]
        });
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setError(''); 

        if (!chineseText || !englishTranslation) {
            setError('All text fields are required.');
            return;
        }

        // Use FormData to send text and file data together
        const formData = new FormData();
        formData.append('chineseText', chineseText);
        formData.append('pinyin', previewData ? previewData.pinyin : pinyin); 
        formData.append('englishTranslation', englishTranslation);
        if (previewData && previewData.words) {
            const validWords = previewData.words.filter(w => w.chineseWord && w.chineseWord.trim() !== '');
            formData.append('definedWords', JSON.stringify(validWords));
        }
        if (audioFile) {
            formData.append('audioFile', audioFile); 
        }

        onAddSentence(formData);
        
        setChineseText('');
        setPinyin('');
        setEnglishTranslation('');
        setAudioFile(null);
        setStep('input');
        setPreviewData(null);
    };

    if (step === 'preview') {
        return (
            <div className="sentence-form">
                <h3>Review Sentence Words</h3>
                {error && <p className="error-message">{error}</p>}
                
                <div className="preview-sentence-header">
                    <div className="preview-sentence-chinese">{chineseText}</div>
                    <div className="preview-sentence-pinyin">{previewData.pinyin}</div>
                    <div className="preview-sentence-english">{englishTranslation}</div>
                </div>

                <div className="word-preview-list">
                    {previewData && previewData.words.map((word, index) => (
                        <div key={index} className={`word-preview-item ${word.isNew ? 'new-word' : ''}`}>
                            <div className="word-preview-chinese-col">
                                {word.isNew ? (
                                    <input 
                                        className="word-preview-chinese-input"
                                        placeholder="Word"
                                        value={word.chineseWord}
                                        onChange={(e) => handleWordChange(index, 'chineseWord', e.target.value)}
                                    />
                                ) : (
                                    <div className="word-preview-char">{word.chineseWord}</div>
                                )}
                                {word.isNew && <span className="word-preview-badge">NEW</span>}
                            </div>
                            <div>
                                <label className="word-preview-label">Pinyin</label>
                                <input 
                                    value={word.pinyin || ''} 
                                    onChange={(e) => handleWordChange(index, 'pinyin', e.target.value)}
                                    className="word-preview-input"
                                    disabled={!word.isNew} 
                                    title={!word.isNew ? "Existing word (cannot edit)" : "Edit Pinyin"}
                                />
                            </div>
                            <div>
                                <label className="word-preview-label">English</label>
                                <input 
                                    value={word.englishTranslation || ''} 
                                    onChange={(e) => handleWordChange(index, 'englishTranslation', e.target.value)}
                                    className="word-preview-input"
                                    disabled={!word.isNew}
                                    title={!word.isNew ? "Existing word (cannot edit)" : "Edit Translation"}
                                />
                            </div>
                            <button 
                                type="button" 
                                className="word-preview-delete-btn"
                                onClick={() => handleDeleteWord(index)}
                                title="Remove Word"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <button type="button" className="btn-add-word" onClick={handleAddWord}>
                        + Add Word Manually
                    </button>
                </div>
                <div className="preview-actions">
                     <button type="button" onClick={() => setStep('input')} className="btn-secondary">
                        Back
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={isLoading}>
                        {isLoading ? 'Saving...' : 'Confirm & Save'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={(e) => e.preventDefault()} className="sentence-form">
            <h3>Add New Sentence</h3>
            {error && <p className="error-message">{error}</p>}
            <div>
                <div className="form-field-header">
                    <label htmlFor="chineseText">Chinese:</label>
                    <button 
                        type="button" 
                        onClick={() => handleTranslate(englishTranslation, 'zh', setChineseText)}
                        disabled={isTranslating || !englishTranslation}
                        className="btn-small-action"
                    >
                        {isTranslating ? '...' : 'Suggest Chinese'}
                    </button>
                </div>
                <textarea
                    id="chineseText"
                    value={chineseText}
                    onChange={(e) => setChineseText(e.target.value)}
                    required
                />
            </div>

             <div>
                <div className="form-field-header">
                    <label htmlFor="englishTranslation">English:</label>
                    <button 
                        type="button" 
                        onClick={() => handleTranslate(chineseText, "en", setEnglishTranslation)}
                        disabled={isTranslating || !chineseText}
                        className="btn-small-action"
                    >
                        {isTranslating ? 'Translating...' : 'Auto Translate'}
                    </button>
                </div>
                <textarea
                    id="englishTranslation"
                    value={englishTranslation}
                    onChange={(e) => setEnglishTranslation(e.target.value)}
                    required
                />
            </div>
            <div>
                <label htmlFor="audioFile">Audio File:</label>
                <input
                    type="file"
                    id="audioFile"
                    accept="audio/*" 
                    onChange={handleFileChange}
                />
                 {audioFile && <span className="file-selected-text">Selected: {audioFile.name}</span>}
            </div>
           <button type="button" onClick={handleAnalyze} disabled={isTranslating}>
                {isTranslating ? 'Analyzing...' : 'Next: Preview Words'}
            </button>
        </form>
    );
}

export default SentenceForm;