// src/App.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios'; // Make sure to install axios: npm install axios
import SentenceForm from './components/SentenceForm';
import SentenceList from './components/SentenceList';
import './App.css'; // Add some basic styling later

// Define the base URL for your backend API
const API_URL = 'http://localhost:5001/api/sentences';
const AUDIO_BASE_URL = 'http://localhost:5001/uploads/'; // Base URL for audio files

function App() {
    const [sentences, setSentences] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc' for last practiced

    // Fetch sentences from backend
    const fetchSentences = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.get(API_URL);
            // Sort immediately after fetching or before setting state
            const sorted = sortSentences(response.data, sortOrder);
            setSentences(sorted);
        } catch (err) {
            console.error("Failed to fetch sentences:", err);
            setError("Failed to load sentences. Please try again later.");
            setSentences([]); // Clear sentences on error
        } finally {
            setIsLoading(false);
        }
    }, [sortOrder]); // Re-fetch if sortOrder changes (optional, could just re-sort client-side)

    // Fetch data on initial mount
    useEffect(() => {
        fetchSentences();
    }, [fetchSentences]); // Dependency array includes fetchSentences

    // --- Sorting Logic ---
    const sortSentences = (sentencesToSort, order) => {
        return [...sentencesToSort].sort((a, b) => {
            // Handle null dates (never practiced) - place them at the end if descending, start if ascending
            const dateA = a.lastPracticedAt ? new Date(a.lastPracticedAt) : null;
            const dateB = b.lastPracticedAt ? new Date(b.lastPracticedAt) : null;

            if (dateA === null && dateB === null) return 0; // Both null, keep order
            if (dateA === null) return order === 'desc' ? 1 : -1; // A is null, goes last in desc, first in asc
            if (dateB === null) return order === 'desc' ? -1 : 1; // B is null, goes last in desc, first in asc

            // Both dates are valid
            if (order === 'desc') {
                return dateB - dateA; // Most recent first
            } else {
                return dateA - dateB; // Oldest first
            }
        });
    };

     // Function to handle sorting change
     const handleSortChange = (newOrder) => {
        setSortOrder(newOrder);
        setSentences(prevSentences => sortSentences(prevSentences, newOrder));
    };


    // --- CRUD Operations ---

    // Add Sentence
    const addSentence = async (formData) => {
         // formData should be a FormData object because it includes the file
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post(API_URL, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data', // Important for file uploads!
                },
            });
            // Add new sentence and re-sort
            setSentences(prevSentences => sortSentences([...prevSentences, response.data], sortOrder));
        } catch (err) {
            console.error("Failed to add sentence:", err);
            setError(err.response?.data?.message || "Failed to add sentence.");
        } finally {
             setIsLoading(false);
        }
    };

    // Mark as Practiced
    const markAsPracticed = async (id) => {
        setError(null); // Clear previous errors
        try {
            const response = await axios.patch(`${API_URL}/${id}/practice`);
            const updatedSentence = response.data;
            // Update the specific sentence and re-sort
            setSentences(prevSentences => {
                 const updatedList = prevSentences.map(s =>
                    s.id === id ? updatedSentence : s
                );
                return sortSentences(updatedList, sortOrder); // Re-sort after update
            });
        } catch (err) {
             console.error("Failed to mark as practiced:", err);
             setError(err.response?.data?.message || "Failed to update practice status.");
        }
    };

    // Delete Sentence
    const deleteSentence = async (id) => {
         if (!window.confirm("Are you sure you want to delete this sentence?")) {
            return;
        }
        setError(null);
        try {
            await axios.delete(`${API_URL}/${id}`);
             // Filter out the deleted sentence (no need to re-sort necessarily, but doesn't hurt)
            setSentences(prevSentences => {
                const filteredList = prevSentences.filter(s => s.id !== id);
                return sortSentences(filteredList, sortOrder); // Maintain sort order
            });
        } catch (err) {
             console.error("Failed to delete sentence:", err);
              setError(err.response?.data?.message || "Failed to delete sentence.");
        }
    };

    return (
        <div className="App">
            <h1>Chinese Sentence Practice</h1>
            <SentenceForm onAddSentence={addSentence} isLoading={isLoading} />

            {error && <p className="error-message">{error}</p>}

            <div className="sentence-list-controls">
                <h2>My Sentences</h2>
                <label htmlFor="sortOrder">Sort by Last Practiced: </label>
                <select
                    id="sortOrder"
                    value={sortOrder}
                    onChange={(e) => handleSortChange(e.target.value)}
                    >
                    <option value="desc">Most Recent First</option>
                    <option value="asc">Oldest First</option>
                </select>
            </div>


            {isLoading && sentences.length === 0 && <p>Loading sentences...</p>}

            <SentenceList
                sentences={sentences}
                onMarkAsPracticed={markAsPracticed}
                onDeleteSentence={deleteSentence}
                audioBaseUrl={AUDIO_BASE_URL}
            />
             { !isLoading && sentences.length === 0 && !error && <p>No sentences yet. Add one above!</p>}
        </div>
    );
}

export default App;