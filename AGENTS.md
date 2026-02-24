# AGENTS.md

## Cursor Cloud specific instructions

This is a zero-dependency static HTML landing page ("Химичка" / ximi4ka). There is no build system, no package manager, no linting, and no automated tests.

### Running the development server

Serve the project root with any static HTTP server. The simplest option:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/chimichka-v2.html` in a browser.

### Key files

- `chimichka-v2.html` — the entire application (single self-contained HTML page with inline CSS and vanilla JS)
- `MazzardH-*.woff` / `MazzardH-*.woff2` — custom font files referenced by `@font-face` in the HTML

### Notes

- Fonts are loaded via relative paths, so a local HTTP server is required (opening the file directly via `file://` may cause CORS issues with font loading in some browsers).
- The page uses an `IntersectionObserver` for scroll-triggered fade-in animations — scroll slowly when testing to see them trigger.
- No lint, test, or build commands exist for this project.
