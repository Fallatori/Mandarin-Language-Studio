import React from 'react';

function SentenceItem({ sentence, onDeleteSentence, onToggleDifficult, audioBaseUrl }) {
    

    const hasNextDue = sentence.progress?.nextDueAt;
    const isDue = !hasNextDue || new Date(sentence.progress.nextDueAt) <= new Date();
    const isDifficult = sentence.progress?.difficult;
    
    const audioUrl = sentence.audioFilename ? `${audioBaseUrl}${sentence.audioFilename}` : null;

    const playAudio = (e) => {
        e.stopPropagation();
        if(audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(e => console.error("Audio play failed", e));
        }
    };

    return (
        <div className="card" onClick={playAudio}>
            <div className="card-top">
                <div className="card-badges">
                    {isDue && <span className="badge badge-due">Review Due</span>}
                    {isDifficult && <span className="badge badge-difficult">Difficult</span>}
                </div>
                
                <div className="card-actions">                  
                     {audioUrl && (
                        <button 
                            className="icon-btn"
                            title="Play Audio"
                            onClick={playAudio}
                        >
                            <span className="material-symbols-outlined">volume_up</span>
                        </button>
                     )}

                    <button 
                        className={`icon-btn ${isDifficult ? 'active' : ''}`}
                        title={isDifficult ? "Unmark Difficult" : "Mark Difficult"}
                        onClick={(e) => {
                            e.stopPropagation();
                            if(onToggleDifficult) onToggleDifficult(sentence.id, !isDifficult);
                        }}
                    >
                        <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>warning</span>
                    </button>

                    {/* <button 
                        className="icon-btn"
                        title="Mark as Practiced"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if(window.confirm('Mark as practiced?')) onMarkAsPracticed(sentence.id); 
                        }}
                    >
                        <span className="material-symbols-outlined">check_circle</span>
                    </button> */}
                    
                    <button 
                        className="icon-btn" 
                        title="Delete"
                        onClick={(e) => {
                            e.stopPropagation();
                            if(onDeleteSentence) onDeleteSentence(sentence.id);
                        }}
                    >
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </div>

            <div className="card-content">
                <h3 className="card-hanzi hanzi-font">{sentence.chineseText}</h3>
                <p className="card-pinyin">{sentence.pinyin}</p>
                <p className="card-english">{sentence.englishTranslation}</p>
            </div>
        </div>
    );
}

export default SentenceItem;