import React from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";

import MainApp from "./MainApp";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
          <Routes>
            <Route path="/*" element={<MainApp />} />
          </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
