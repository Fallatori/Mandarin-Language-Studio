
import React, { useState } from 'react';

function SentenceForm({ onAddSentence, isLoading }) {
    const [chineseText, setChineseText] = useState('');
    const [pinyin, setPinyin] = useState('');
    const [englishTranslation, setEnglishTranslation] = useState('');
    const [audioFile, setAudioFile] = useState(null);
    const [error, setError] = useState('');

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
        formData.append('pinyin', pinyin);
        formData.append('englishTranslation', englishTranslation);
        if (audioFile) {
            formData.append('audioFile', audioFile); 
        }

        onAddSentence(formData);

        setChineseText('');
        setPinyin('');
        setEnglishTranslation('');
        setAudioFile(null);
        event.target.reset();
    };

    return (
        <form onSubmit={handleSubmit} className="sentence-form">
            <h3>Add New Sentence</h3>
            {error && <p className="error-message">{error}</p>}
            <div>
                <label htmlFor="chineseText">Chinese:</label>
                <textarea
                    id="chineseText"
                    value={chineseText}
                    onChange={(e) => setChineseText(e.target.value)}
                    required
                />
            </div>
            {/* <div>
                <label htmlFor="pinyin">Pinyin:</label>
                <input
                    type="text"
                    id="pinyin"
                    value={pinyin}
                    onChange={(e) => setPinyin(e.target.value)}
                />
            </div> */}
            <div>
                <label htmlFor="englishTranslation">English:</label>
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
                 {audioFile && <span style={{ marginLeft: '10px', fontSize: '0.9em'}}>Selected: {audioFile.name}</span>}
            </div>
            <button name='add-sentence' type="submit" disabled={isLoading}>
                {isLoading ? 'Adding...' : 'Add Sentence'}
            </button>
        </form>
    );
}

export default SentenceForm;