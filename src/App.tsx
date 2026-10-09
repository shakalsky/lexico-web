import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { Notifications } from './components/Notifications';
import { AddWordPage } from './pages/AddWordPage';
import { DeckWordsPage } from './pages/DeckWordsPage';
import { DecksPage } from './pages/DecksPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { StudyPage } from './pages/StudyPage';
import { WordsPage } from './pages/WordsPage';
import { refreshWords } from './state/deck';
import { refreshDecks } from './state/decks';
import './App.css';

function App() {
  useEffect(() => {
    // The deck list, and the words of the decks opened from the saved copy (if any).
    // Different decks picked once the list arrives load their own words.
    void refreshDecks();
    void refreshWords();
  }, []);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="decks" element={<DecksPage />} />
          <Route path="decks/:deckId" element={<DeckWordsPage />} />
          <Route path="words" element={<WordsPage />} />
          <Route path="words/new" element={<AddWordPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="study" element={<StudyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Notifications />
    </>
  );
}

export default App;
