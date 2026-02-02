import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api/words';

function WordPage() {
    const [words, setWords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchWords = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await axios.get(API_URL, { withCredentials: true });
                setWords(response.data);
            } catch (err) {
                console.error("Failed to fetch words:", err);
                setError("Failed to load words. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchWords();
    }, []);

    return (
        <div className="main-content">
            <div style={{ width: '100%' }}>
                <h2>My Word List</h2>
                {isLoading && <p>Loading words...</p>}
                {error && <p className="error-message">{error}</p>}
                
                {!isLoading && !error && words.length === 0 && (
                    <p>No words found. Add sentences to see words here!</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
                    {words.map((word) => (
                        <div key={word.id} style={{ 
                            background: '#242424', 
                            border: '1px solid #444', 
                            borderRadius: '8px', 
                            padding: '15px',
                            textAlign: 'center'
                        }}>
                            <div style={{ fontSize: '1.8em', marginBottom: '5px' }}>{word.chineseWord}</div>
                            <div style={{ color: '#999', marginBottom: '5px' }}>{word.pinyin}</div>
                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>{word.englishTranslation}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default WordPage;