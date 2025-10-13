// src/components/SentenceItem.jsx
import { act } from 'react';
import { useState } from 'react';

// Helper to format dates nicely
const formatDate = (isoString) => {
    if (!isoString) return 'Never';
    try {
        return new Date(isoString).toLocaleString(); // Adjust format as needed
    } catch (error) {
        console.error("Error formatting date:", error);
        return 'Invalid Date';
    }
};

function SentenceItem({ sentence, onMarkAsPracticed, onDeleteSentence, audioBaseUrl }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const audioUrl = sentence.audioFilename ? `${audioBaseUrl}${sentence.audioFilename}` : null;

    const handleActionClick = (e, action) => {
        e.stopPropagation();
        action();
    }

    return (
        <div className="sentence-item" onClick={() => setIsExpanded(!isExpanded)}>
            <div className="sentence-text">
                <p className="chinese">{sentence.chineseText}</p>
                <p className="pinyin">{sentence.pinyin}</p>
                <p className="translation">{sentence.englishTranslation}</p>
            </div>
           {isExpanded && (
                <div className="sentence-details">
                    <div className="sentence-audio" onClick={(e) => e.stopPropagation()}>
                        {audioUrl ? (
                            <audio controls src={audioUrl}>
                                Your browser does not support the audio element.
                            </audio>
                        ) : (
                            <p>No audio available.</p>
                        )}
                    </div>
                    <div className="sentence-meta">
                        <p>Created: {formatDate(sentence.createdAt)}</p>
                        <p>Last Practiced: <strong>{formatDate(sentence.lastPracticedAt)}</strong></p>
                    </div>
                    <div className="sentence-actions">
                        <button onClick={(e) => handleActionClick(e, () => onMarkAsPracticed(sentence.id))} className="practice-button">
                            Mark as Practiced Now
                        </button>
                        <button onClick={(e) => handleActionClick(e, () => onDeleteSentence(sentence.id))} className="delete-button">
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SentenceItem;