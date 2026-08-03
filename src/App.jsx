import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Watch from './pages/Watch';
import Search from './pages/Search';

import './App.css';

function AppContent() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      {!isLanding && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/browse" element={<Home />} />
          <Route path="/browse/:type" element={<Home />} />
          <Route path="/anime/:id" element={<Watch />} />
          <Route path="/search" element={<Search />} />

        </Routes>
      </main>
      {!isLanding && <Footer />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
