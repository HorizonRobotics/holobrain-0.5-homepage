HoloBrain-0.5 project homepage

Open index.html in a modern browser. Keep the assets folder, app.js and
styles.css next to index.html. No build step or online service is required
for local viewing. The Code and UniURDF links open external GitHub pages; the Model link opens
the HoloBrain v0.5 repository on Hugging Face.

After a paper revision, copy the final compiled PDF to assets/paper.pdf.
Check the method text, figure assets and page links, result tabs in app.js,
and both the inline and downloadable BibTeX against the same revision.
Mirror changed files into the homepage publishing checkout before deployment.

For a local HTTP preview, run in this directory:
  python serve.py 8000
Then open http://localhost:8000

For access from another computer, add --bind 0.0.0.0. The optional
--directory argument selects the directory to serve. This server supports
HTTP byte-range requests, allowing video timelines to seek without first
downloading the entire file. The standard Python http.server does not provide
this support; use serve.py for previews and a static host with range support
when publishing.

To publish, upload this directory to a static website host while preserving
its relative paths. The homepage has not been deployed by this task.

Layout: white background and a single main content column. Numbered section
headings and divider lines separate the sections. A sticky left-hand contents
list links to each section and highlights the current reading position. On
narrow screens, the Contents button in the header opens this navigation. The two detailed
method figures are always visible, side by side on desktop and stacked on
narrow screens. Click either figure to open it at full size. The 30 bimanual
demonstrations appear in one horizontally scrollable row. Swipe or scroll
horizontally, use the arrow buttons, or focus the row and use arrow keys.
Videos retain their original aspect ratios and are vertically centered.

Demonstrations follow the project film, before Method and Results. The film
contains the complete title sequence, but autoplays muted from the overview
at 00:04 on its first appearance. Seek to 00:00 to watch the opening. Use the
player controls to enable sound. Keep its MP4, WebM and poster under
assets/videos and assets/posters when publishing the homepage.
Resources and citation come last. Results open with the paper’s Figure 11
pretraining curve; the remaining tabs show real-robot progress scores.

Contents: updated technical report, author affiliations, 38 complete demo
videos with posters, method figures, evaluation results and BibTeX citation.
Demonstration clips use H.264 MP4 without audio tracks and load when requested. Shorts folding plays at its
original speed for the first 60 seconds, then at 3x speed with a white "x3"
label in the upper-left corner. Organizing medicine plays at 3x throughout
with a white "x3" label. Folding a long-sleeved shirt plays at original speed
until 2:15, then at 3x with the same label. Putting the shirt onto the hanger
plays at original speed until 0:53, then at 3x with the same label.
T-shirt folding plays at original speed until 1:24, then at 3x with the same label.
All demonstration videos and posters
include a mild brightness adjustment and fixed white-balance corrections
for each camera view, reducing yellow and green casts.
For vertically stacked two-camera recordings, the homepage video and poster
show only the top camera view, cropped directly from the full-resolution
demo before color correction.
Single-camera recordings are unchanged. The Tianji + Wuji2 Hands demo
keeps all four panels and the supplied 2x playback speed.
