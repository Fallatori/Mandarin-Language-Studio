import React from 'react';
import SentenceItem from './SentenceItem';

function SentenceList({ sentences, onDeleteSentence, onToggleDifficult, onEditSentence, audioBaseUrl }) {
    if (!sentences || sentences.length === 0) {
        return <div className="empty-state-message">No sentences found.</div>;
    }

    return (
        <div className="sentence-grid"> 
            {sentences.map((sentence) => (
                <SentenceItem
                    key={sentence.id}
                    sentence={sentence}
                    onDeleteSentence={onDeleteSentence}
                    onToggleDifficult={onToggleDifficult}
                    onEditSentence={onEditSentence}
                    audioBaseUrl={audioBaseUrl}
                />
            ))}
        </div>
    );
}

export default SentenceList;