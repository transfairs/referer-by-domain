# Short Description
## 🇬🇧 English
Control the Referer header per domain. Improve privacy and compatibility with fine-grained rules.
## 🇩🇪 German
Steuern Sie den Referer-Header pro Domain. Verbesserter Datenschutz und Kompatibilität durch gezielte Regeln.

---
# Description
## 🇬🇧 English
**Referer By Domain** gives you fine-grained control over how your browser sends referer headers.
You can:
- disable referrers for specific domains,
- send only the origin (e.g. https://example.com/),
- send the full URL (e.g. https://example.com/path/page.html), or
- leave Referers unrestricted.

The extension supports:
- wildcard rules (*.example.org),
- per-domain settings, and
- detection and display of related domains (used by background requests).

All settings are stored **locally** in your browser. Nothing is synced or transmitted.

🛡️ Protect your privacy.
🧩 Fix site compatibility when Referers are required.

## 🇩🇪 German
**Referer nach Domain** erlaubt es Ihnen, gezielt zu steuern, wie Ihr Browser den Referer-Header an Webseiten sendet.
Sie können:
- Referer für bestimmte Domains deaktivieren,
- nur den Ursprung senden (z. B. https://beispiel.de/),
- die väollständige URL senden,
- oder den Referer uneingeschränkt zulassen.

Unterstützt werden:
- Wildcard-Regeln (*.beispiel.de),
- pro-Domain-Einstellungen und
- die Anzeige verwandter Domains (durch Hintergrundanalyse).

Alle Einstellungen werden **ausschließlich lokal** gespeichert. Es erfolgt keinerlei Übertragung oder Synchronisation.

🛡️ Mehr Datenschutz.
🔧 Bessere Kompatibilität mit Diensten, die Referer erwarten.
---
# Privacy
## 🇬🇧 English
This extension stores all settings locally in your browser.
It does not transmit, track, or collect any data.

## 🇩🇪 German
Alle Einstellungen werden ausschließlich lokal im Browser gespeichert.
Es werden keine Daten übertragen, getrackt oder erfasst.
---
# Release Notes
## Version 2.0.1
### 🇬🇧 English
- Fixed Help tab images (GitHub/LinkedIn/YouTube icons, login example screenshots) not loading in the packaged extension

### 🇩🇪 German
- Fehler behoben: Bilder im Hilfe-Tab (GitHub/LinkedIn/YouTube-Icons, Login-Beispielscreenshots) wurden im gepackten Add-on nicht geladen

## Version 2.0.0
### 🇬🇧 English
- Added a light/dark/auto theme toggle, applied consistently across the popup and options pages
- Added a language selector to override the browser's locale, with an "auto" option that follows the browser default
- Replaced native browser dialogs with themed modals for adding, editing, deleting, and importing domains
- Added settings import/export; detection of related domains now persists across background worker restarts
- Added domain renaming, a popup reload button, and expanded in-extension help documentation
- Fixed referer header handling and bounded memory usage of domain tracking

### 🇩🇪 German
- Hell-/Dunkel-/Automatikmodus hinzugefügt, einheitlich in Popup und Einstellungen
- Sprachauswahl hinzugefügt, um die Browsersprache zu überschreiben, mit einer "automatisch"-Option, die der Standardsprache des Browsers folgt
- Native Browser-Dialoge durch gestaltete Modals ersetzt (Hinzufügen, Bearbeiten, Löschen und Importieren von Domains)
- Import/Export der Einstellungen hinzugefügt; die Erkennung verwandter Domains bleibt nun auch nach einem Neustart des Hintergrundprozesses erhalten
- Umbenennen von Domains, ein Neuladen-Button im Popup und erweiterte Hilfe-Dokumentation hinzugefügt
- Fehlerbehebung bei der Referer-Header-Verarbeitung und Begrenzung des Speicherverbrauchs der Domain-Verfolgung