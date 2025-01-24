# WebLab functionality for Visual Studio Code
Tired of using the default WebLab editor? Me too! This extension brings the WebLab environment right into Visual Studio Code.

## Disclaimer
This extension is not affiliated with WebLab in any way. It is a personal project and is not endorsed by WebLab.

Because WebLab is closed-source, this extension uses some 'questionable' methods to make WebLab work within VS Code. It runs WebLab in a headless Chromium browser and uses Playwright to retrieve, modify and send data to the WebLab editor. This means that the extension is not very stable and may break at any time, and may use a significant amount of system resources.

## Features
Some notable features include:
- Sidebar: Find all your courses, assignments and files in the WebLab sidebar
- File structure: Auto import solution code to your file system, whilst keeping the WebLab file structure
- Auto login: It saves your credentials in the VSC secret storage, so you don't have to login every time (I don't know how secure this is)
... with all the benefits of VS code.

## Roadmap
- WebLab Library support: Emulates the given WebLab libraries in the editor
- See issues

## Installing
- Install the specific Playwright version (1.38.0) (using npm playwright install ?)

## Known Issues
- The extension is not very stable and may break at any time

Please let me know :)

## Questions

'' Why no Intellij plugin? ''
A: Because VS-code extensions are way easier to write in my opinion.
