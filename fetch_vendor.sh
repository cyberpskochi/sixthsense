#!/usr/bin/env bash
# Downloads the exact npm packages that the page loads from jsDelivr, so build.py can compute SRI hashes.
set -e; mkdir -p vendor && cd vendor
for p in @e965/xlsx@0.20.3 pdfjs-dist@3.11.174 cytoscape@3.30.2 chart.js@4.4.4 jspdf@2.5.1 jspdf-autotable@3.8.2 tesseract.js@5.1.1 leaflet@1.9.4; do npm pack "$p" --silent; done
mkdir -p e965 && tar xzf e965-xlsx-0.20.3.tgz -C e965
for f in pdfjs-dist-3.11.174 cytoscape-3.30.2 chart.js-4.4.4 jspdf-2.5.1 jspdf-autotable-3.8.2 tesseract.js-5.1.1 leaflet-1.9.4; do mkdir -p $f && tar xzf $f.tgz -C $f; done
echo "vendor ready"
