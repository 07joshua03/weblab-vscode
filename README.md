# WebLab functionality for Visual Studio Code

Tired of using the default WebLab editor? Me too! This extension brings the WebLab environment right into Visual Studio Code.This is the README for your extension "weblab-vscode". After writing up a brief description, we recommend including the following sections.

## Disclaimer
**This extension does not work yet! It is very much W.I.P. and is not ready for use. Please do not install it yet.**

This extension is not affiliated with WebLab in any way. It is a personal project and is not endorsed by WebLab.

Because WebLab is closed-source, this extension uses some 'questionable' methods to make WebLab work within VS Code. It runs WebLab in a headless Chromium browser and uses Playwright to retrieve, modify and send data to the WebLab editor. This means that the extension is not very stable and may break at any time, and can use a significant amount of system resources.

## Features
Some notable features include:
- Sidebar: Find all your courses, assignments and files in the WebLab sidebar
- File structure: Auto import solution code to your file system, whilst keeping the WebLab file structure
- WebLab Library support: Emulates the given WebLab libraries in the editor
... with all the benefits of VS code.

## Requirements

- Install the specific Playwright version (1.38.0) (using npm playwright install ?)

## Extension Settings

Not for now :(

## Known Issues

- The extension is not very stable and may break at any time

Please let me know :)

## Release Notes

Users appreciate release notes as you update your extension.

### 0.0.1 pre-alpha

It doesn't even work yet

---

## Questions

'' Why no Intellij plugin? ''
A: Because VS-code extensions are way easier to write in my opinion.
