let sortOrder = {
    domain: true,  // true bedeutet aufsteigend, false absteigend
    referer: true
};

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('refererTableBody');
    const addRowButton = document.getElementById('addRowButton');

    // Lade die gespeicherten Referer-Header aus Chrome Storage
    chrome.storage.local.get('refererHeaders', (result) => {
        const refererHeaders = result.refererHeaders || {};
        populateTable(refererHeaders);
    });

    // Füge Filter-Event hinzu
    document.getElementById('search').addEventListener('input', filterTable);

    // Füge Event-Listener für das Sortieren der Tabelle hinzu
    document.getElementById('sortDomain').addEventListener('click', () => {
        toggleSort('domain');
        sortTable(0, 'domain');
    });
    document.getElementById('sortReferer').addEventListener('click', () => {
        toggleSort('referer');
        sortTable(1, 'referer');
    });
    
    // Tabelle befüllen
    function populateTable(refererHeaders) {
        tableBody.innerHTML = ''; // Tabelle leeren
        for (let domain in refererHeaders) {
            const row = createRow(domain, refererHeaders[domain]);
            tableBody.appendChild(row);
        }
    }

    // Zeile hinzufügen
    function createRow(domain, refererValue) {
        const row = document.createElement('tr');

        // Domain-Spalte
        const domainCell = document.createElement('td');
        const domainInput = document.createElement('input');
        domainInput.value = domain;
        domainInput.addEventListener('input', () => saveChanges(domainInput, refererValue));
        domainCell.appendChild(domainInput);

        // Referer-Spalte
        const refererCell = document.createElement('td');
        const refererSelect = document.createElement('select');
        [0, 1, 2, 3].forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = getRefererText(value);
            if (value === refererValue) option.selected = true;
            refererSelect.appendChild(option);
        });
        refererSelect.addEventListener('change', () => saveChanges(domainInput, refererSelect.value));
        refererCell.appendChild(refererSelect);

        // Aktionen-Spalte (Bearbeiten, Löschen)
        const actionsCell = document.createElement('td');
        const actionsDiv = document.createElement('div');
        actionsDiv.classList.add('actions');

        // Bearbeiten-Button (für Inline-Editing)
        const editButton = document.createElement('button');
        editButton.innerHTML = '&#9998;'; // Bleistift-Symbol
        editButton.addEventListener('click', function() {
            domainInput.removeAttribute('readonly');
            refererSelect.disabled = false;
        });

        // Löschen-Button
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '&#10006;'; // Kreuz-Symbol
        deleteButton.addEventListener('click', function() {
            row.remove();
            deleteRow(domainInput.value);
        });

        actionsDiv.appendChild(editButton);
        actionsDiv.appendChild(deleteButton);
        actionsCell.appendChild(actionsDiv);

        row.appendChild(domainCell);
        row.appendChild(refererCell);
        row.appendChild(actionsCell);

        return row;
    }

    // Speichern der Änderungen
    function saveChanges(domainInput, refererValue) {
        const domain = domainInput ? domainInput.value : null;
        const referer = refererValue ? refererValue : null;

        if (!domain || !referer) return;

        chrome.storage.local.get('refererHeaders', function(result) {
            const refererHeaders = result.refererHeaders || {};
            refererHeaders[domain] = parseInt(referer);
            chrome.storage.local.set({ refererHeaders });
        });
    }
    
    function deleteRow(domainInput) {
        chrome.storage.local.get('refererHeaders', (result) => {
            const refererHeaders = result.refererHeaders || {};
    
            // Entfernen der Zeile (Domain) aus dem Speicher
            delete refererHeaders[domainInput];
    
            chrome.storage.local.set({ refererHeaders }, () => {
                console.log('Zeile gelöscht:', domainInput);
            });
        });
    }

    // Dropdown-Text basierend auf Wert
    function getRefererText(value) {
        switch (value) {
            case 0: return 'Kein Referer';
            case 1: return 'Nur Domain';
            case 2: return 'Voller Referer';
            case 3: return 'Immer voller Referer';
            default: return 'Unbekannt';
        }
    }

    // Zeile zum Hinzufügen
    addRowButton.addEventListener('click', function() {
        const newRow = createRow('', 0);
        tableBody.appendChild(newRow);
    });

});

// Funktion zum Umschalten der Sortierreihenfolge
function toggleSort(columnName) {
    // Kehre die Sortierreihenfolge für die angeklickte Spalte um
    sortOrder[columnName] = !sortOrder[columnName];
}

function filterTable() {
    const searchValue = document.getElementById('search').value.toLowerCase();
    const rows = document.querySelectorAll('#refererTable tbody tr');
    
    rows.forEach(row => {
        const domainCell = row.querySelector('td');
        const domainText = domainCell.textContent.toLowerCase();
        
        if (domainText.includes(searchValue)) {
            row.style.display = ''; // Zeige die Zeile an
        } else {
            row.style.display = 'none'; // Verstecke die Zeile
        }
    });
}

// Funktion zum Sortieren der Tabelle
function sortTable(columnIndex, columnName) {
    const table = document.getElementById('refererTable');
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    const sortedRows = rows.sort((a, b) => {
        const cellA = a.children[columnIndex].textContent.toLowerCase();
        const cellB = b.children[columnIndex].textContent.toLowerCase();

        if (cellA < cellB) return sortOrder[columnName] ? -1 : 1;
        if (cellA > cellB) return sortOrder[columnName] ? 1 : -1;
        return 0;
    });

    // Leere den Tabellenkörper und füge die sortierten Zeilen hinzu
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';
    sortedRows.forEach(row => tbody.appendChild(row));
}
