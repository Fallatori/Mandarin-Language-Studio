import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import SentencePage from './components/SentencePage';
import WordPage from './components/WordPage';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import FlashcardPage from './components/FlashcardPage';
import DeckPage from './components/DeckPage';
import StoryPage from './components/StoryPage';
import { AuthProvider } from './context/AuthContext';
import './App.css'; 

function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={
                    <ProtectedRoute>
                         <div className="app-container">
                            <Navbar />
                               <div className="main-wrapper">
                                <Routes>
                                    <Route path="/" element={<SentencePage />} />
                                    <Route path="/cards" element={<FlashcardPage />} />
                                    <Route path="/words" element={<WordPage />} />
                                    <Route path="/decks" element={<DeckPage />} />
                                    <Route path="/stories" element={<StoryPage />} />
                                </Routes>
                            </div>
                        </div>
                    </ProtectedRoute>
                } />
             </Routes>
        </AuthProvider>
    );
}

export default App;