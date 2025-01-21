// npm init -y
// Reload changes with CTRL+F5
const express = require('express'); //npm install express
const path = require('path');
const favicon = require('serve-favicon'); //npm install serve-favicon
const app = express();
const port = 3000;

// Setze das Favicon
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// Serve statische Dateien aus dem 'public'-Ordner
app.use(express.static(path.join(__dirname, 'public')));

// Route, die alle empfangenen Header anzeigt
app.get('/headers', (req, res) => {
    console.log('Anfrage-Header:', req.headers);
    res.json(req.headers); // Antwort mit den Headern als JSON
});

// Start des Servers
app.listen(port, () => {
    console.log(`Server läuft unter http://localhost:${port}`);
});
