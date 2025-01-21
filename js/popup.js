import {saveRefererHeaderForDomain} from './lib.js';


//if (document.getElementById('domain') != null)
//    document.getElementById('domain').addEventListener('input', loadSavedSettings);


if (document.getElementById("saveButton") != null) {
    document.getElementById("saveButton").addEventListener("click", () => {
        const domain = document.getElementById("domain").value.trim(); // Eingabe für Domain
        const refererValue = parseInt(document.getElementById("refererHeader").value, 10); // Ausgewählter Referer-Wert

        if (domain) {
            saveRefererHeaderForDomain(domain, refererValue); // Funktion zum Speichern des Werts für die Domain aufrufen
            window.close();
        } else {
            console.error("Bitte eine gültige Domain eingeben.");
        }
    });
}


if (document.getElementById("clearButton") != null) {
    document.getElementById("clearButton").addEventListener("click", () => {
        chrome.storage.local.remove("refererHeaders", () => {
            console.log("Storage cleared.");
        });
    });
}
/*
document.addEventListener('DOMContentLoaded', function() {
  // Hole die gespeicherte URL aus dem Local Storage
  chrome.storage.local.get(['currentUrl'], function(result) {
    if (result.currentUrl) {
      // Extrahiere die Domain aus der URL (z.B. https://example.com -> example.com)
      let url = new URL(result.currentUrl);
      let domain = url.hostname;

      // Trage die Domain in das Eingabefeld ein
      document.getElementById('domain').value = domain;
    }
  });
});
*/

document.addEventListener('DOMContentLoaded', function() {
  // Hole die URL der aktuellen aktiven Registerkarte, wenn das Popup geöffnet wird
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length > 0) {
      let currentUrl = tabs[0].url;  // Die URL der aktuellen Registerkarte
      console.log('Aktuelle URL:', currentUrl);

      // Extrahiere die Domain aus der URL (z.B. https://example.com -> example.com)
      let url = new URL(currentUrl);
      let domain = url.hostname;

      // Trage die Domain in das Eingabefeld ein
      document.getElementById('domain').value = domain;

      
      // Lade die gespeicherten Referer-Header aus dem Speicher
      chrome.storage.local.get('refererHeaders', (result) => {
        const refererHeaders = result.refererHeaders || {};
  
        // Ueberpruefe, ob fuer die aktuelle Domain ein Wert gespeichert ist
        const refererValue = refererHeaders[domain];
  
        // Wenn ein Wert gespeichert ist, setze den Referer-Wert im Select und hebe das hervor
        if (refererValue !== undefined) {
            document.getElementById('refererHeader').value = refererValue;
            //document.getElementById('refererHeader').classList.add('highlight'); // CSS-Klasse für Hervorhebung
            updateHighlight(refererValue);
        }
      });
    }
  });
});

function updateHighlight(value) {
    const refererSelectContainer = document.getElementById('refererHeader');

    // Entferne alle bisherigen Highlight-Klassen
    refererSelectContainer.classList.remove('highlight-0', 'highlight-1', 'highlight-2', 'highlight-3');

    // Füge die passende Highlight-Klasse hinzu
    if (value === 0) {
        refererSelectContainer.classList.add('highlight-0');
    } else if (value === 1) {
        refererSelectContainer.classList.add('highlight-1');
    } else if (value === 2) {
        refererSelectContainer.classList.add('highlight-2');
    } else if (value === 3) {
        refererSelectContainer.classList.add('highlight-3');
    }
    
    console.log(value, (value===1));
}