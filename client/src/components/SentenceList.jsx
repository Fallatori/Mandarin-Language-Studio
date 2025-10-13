// src/components/SentenceList.jsx
import React from 'react';
import SentenceItem from './SentenceItem';

function SentenceList({ sentences, onMarkAsPracticed, onDeleteSentence, audioBaseUrl }) {
    if (!sentences || sentences.length === 0) {
        // Message is handled in App.jsx, return null or minimal fragment here
        return null;
    }

    return (
        <div className="sentence-list">
            {sentences.map((sentence) => (
                <SentenceItem
                    key={sentence.id}
                    sentence={sentence}
                    onMarkAsPracticed={onMarkAsPracticed}
                    onDeleteSentence={onDeleteSentence}
                    audioBaseUrl={audioBaseUrl}
                />
            ))}
        </div>
    );
}

export default SentenceList;