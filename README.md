# Referer By Domain

**Referer By Domain** is a Firefox extension that allows users to control the `Referer` header based on the domain.  
It simulates the behaviour of the `network.http.sendRefererHeader` preference on a per-domain basis.

---

## ✨ Features

- 🌐 Set different `Referer` policies depending on the visited domain.
- 🎯 Choose between sending no referer, only the origin, or the full URL.
- ⚡ Lightweight and privacy-focused.

---

## ⚙️ Options

The options page allows users to configure the `sendRefererHeader` mode:

- **0**: 🚫 Do not send a referer.
- **1**: 🏠 Send only the origin.
- **2**: 🌎 Send the full URL.

---

## 🧪 Running Tests

This project uses [Jest](https://jestjs.io/) and [Babel](https://babeljs.io/) to run unit tests.

```bash
npm install
npm test
```

### Project Test Structure

`test/*.test.js`: Unit tests for `src/*/*.js`.

### Development
`test/testserver/`: Simple Express server for manual header testing.

```bash
npm run start-server
```

Open `http://localhost:3000/Test.html` and fire your requests.

---

## 🚀 Future Improvements

- Support complex per-domain rules (wildcards, regex).
- Potential switch to Manifest V3 when Firefox support stabilises.

---

## 🤝 Contributing

We welcome contributions to improve the add-on.  
If you find any issues or have suggestions, feel free to open an issue or submit a pull request.

---

## 📜 License

This project is open-source and licensed under the **GNU General Public License v3.0**.

For more details, see the [LICENSE](LICENSE) file.
