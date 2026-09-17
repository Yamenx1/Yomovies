// ---------------------------------------------------------------------------
// APP — Router shell for Yo Movies.
// /            → Home (search, rails, grid, overlays)
// /movie/:id   → Home with the details overlay open (shareable movie URLs,
//                 back button closes it; see openMovie/closeMovie in Home)
// /profile     → ProfilePage (library, ratings, insights)
// Deep links work on refresh thanks to the vercel.json SPA rewrite.
// ---------------------------------------------------------------------------

import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movie/:id" element={<Home />} />
      <Route path="/tv/:id" element={<Home />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  );
}
