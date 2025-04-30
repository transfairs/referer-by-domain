# Referer By Domain

**Referer By Domain** is a Firefox extension that allows users to control the `Referer` header on a per-domain basis.  
It simulates the behaviour of `network.http.sendRefererHeader`, but with fine-grained control.

---

## ✨ Features

- 🌐 Set different `Referer` policies depending on the visited domain
- 🧩 Wildcard support (e.g. `*.example.com`)
- 🔄 Automatically detects **related domains** used by each site (e.g. APIs, CDNs)
- 🌍 Localised in 🇬🇧 English and 🇩🇪 German
- 📘 Built-in help section with tabbed overview
- 🎯 Choose between no Referer, only origin, full URL, or unrestricted
- ⚡ Lightweight and privacy-focused

---

## ⚙️ Referer Modes

The options page lets you configure Referer behaviour for any domain:

| Mode | Value | Behaviour |
|:----:|:-----:|:----------|
| 🚫   | 0     | Do not send a Referer |
| 🏠   | 1     | Send only the origin (e.g. `https://example.com`) |
| 🌎   | 2     | Send the full URL |
| ♾️   | 3     | Send Referer without restrictions |

Wildcard rules (e.g. `*.example.com`) apply to all matching subdomains.

---

## 🔍 Related Domains

When a website loads resources from other domains (like `api.example.com`),  
those related domains are automatically detected and displayed in the popup.  
You can configure them just like the main domain.

Use this to fix login flows, media delivery, or API calls that depend on Referer headers.

---

## 🧪 Running Tests

This project uses [Jest](https://jestjs.io/) and [Babel](https://babeljs.io/) to run unit tests.

```bash
npm install
npm test
```

###  Test Structure

`test/*.test.js`: Unit tests for core logic (`src/*/*.js`).

### Development
`test/testserver/`: Simple Express server for manual header testing.

```bash
npm run start-server
```

Open `http://localhost:3000/Test.html` and fire your requests.

---

## 🚀 Future Improvements

- Support complex domain rules (wildcards inside domain name, regex).
- Auto-reload of tabs on rule change
- Dark Mode for all screens

---

## 🤝 Contributing

Feedback, bug reports and pull requests are welcome.
Feel free to open an <a href="https://github.com/transfairs/referer-by-domain/issues">issue or contribute directly.

---

## 📜 License

This project is open-source and licensed under the **GNU General Public License v3.0**. See the [LICENSE](LICENSE) file for details.
