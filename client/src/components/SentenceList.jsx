import React from 'react';
import SentenceItem from './SentenceItem';

function SentenceList({ sentences, onDeleteSentence, onToggleDifficult, audioBaseUrl }) {
    if (!sentences || sentences.length === 0) {
        return <div style={{color:'#666', fontStyle:'italic', marginTop:'20px'}}>No sentences found.</div>;
    }

    return (
        <div className="sentence-grid"> 
            {sentences.map((sentence) => (
                <SentenceItem
                    key={sentence.id}
                    sentence={sentence}
                    onDeleteSentence={onDeleteSentence}
                    onToggleDifficult={onToggleDifficult} 
                    audioBaseUrl={audioBaseUrl}
                />
            ))}
        </div>
    );
}

export default SentenceList;