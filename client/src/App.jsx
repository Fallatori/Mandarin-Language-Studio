import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SentencePage from './components/SentencePage';
import WordPage from './components/WordPage';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import FlashcardPage from './components/FlashcardPage';
import DeckPage from './components/DeckPage';
import { AuthProvider } from './context/AuthContext';

import './App.css'; 

function App() {
    return (
        <AuthProvider>
            <div className="App">
                <Navbar />
                <div className="content-wrapper">
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route 
                            path="/" 
                            element={
                                <ProtectedRoute>
                                    <SentencePage />
                                </ProtectedRoute>
                            } 
                        />
                        <Route path="/cards" element={
                            <ProtectedRoute><FlashcardPage /></ProtectedRoute>
                        } />
                        <Route 
                            path="/words" 
                            element={
                                <ProtectedRoute>
                                    <WordPage />
                                </ProtectedRoute>
                            } 
                        />
                        <Route path="/decks" element={<ProtectedRoute><DeckPage /></ProtectedRoute>} />
                    </Routes>
                </div>
            </div>
        </AuthProvider>
    );
}

export default App;