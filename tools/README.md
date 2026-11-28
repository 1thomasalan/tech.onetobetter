# The Tech Brief · AI Tools Directory

This directory is a standalone static page at `/tools/`. Review it without changing the home page or the GitHub Pages configuration.

## Edit and preview

- `tools.json`: product descriptions, pricing snapshots, experience levels, examples, and source links.
- `directory.template.html`: layout, styles, and interactions.
- `build.py`: generates `index.html` with Python 3 and no third-party dependencies. Edit the inputs, not the generated page, and commit the regenerated `index.html` along with your changes.
- `candle-campaign-reference.jpg`: crop from Marco Riccetti’s [sponsored Adobe Firefly demo](https://x.com/shikoba_86/status/2126281514606379367), credited on the page. Confirm image reuse before publishing to the live site.

From the repository root:

```sh
python3 tools/build.py
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/tools/`. Gallery and Light Mode are the defaults; switch to List or Dark Mode in the header. Search and filters use JavaScript, but both layouts and all listings are available without it.

## Review checklist

- Try Gallery and List on desktop and mobile, then toggle the theme. Check a tool’s deep link (for example, `/tools/#hermes-agent`).
- Check that Beginner-friendly returns Canva and Photoroom, and that Job and Cost filters combine correctly.
- Recheck each price, free-access limit and external rating against its linked source before merging. The listed experience levels are editorial assessments for the featured workflows, not hands-on ratings.
- Decide where to link `/tools/` from the main Tech Brief UI; this branch does not change the home page.
