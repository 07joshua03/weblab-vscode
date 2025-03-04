# Change Log

All notable changes to the "weblab-vscode" extension will be documented in this file.

## [0.2.6]
- [Sideview] Fixed loading of folders and assignments
- Updated playwright fix version
- Add reauthenticate command

## [0.2.5]

### Features
- [Description] Description now opens by default in the sidebar
- [Description] Added possibility to open description in panel

## Fixes
- [Filesystem] Fixed incorrect folder creation (subfolders >2 levels deep non-existent)

## [0.2.4]

### Fixes
- Fixed duplicate assignment creation
- Fixed on-save running when weblab disabled

## [0.2.3]

### Features
- Added installation helper for playwright browser
- Added default weblab location

## [0.2.2]

### Other
- Added publish pipeline

## [0.2.1]

### Features
- Added language detection (please let me know if any unknown language errors pop up)
- Changed the way folders are created. This could introduce errors on specific filesystems with weird seperators/starters.

### Other
- Removed error on Test Results panel creation
- Added some nice text to Test Results panel

## [0.2.0]

### Features
- Added save to WebLab on filesave
- Improved assignment-testing submissions
- Added bottom-display for test results
- Added buttons on bottom-bar for spec/user-test

## Fixes
- Fixed user/spec test race condition
- Added clearer documentation for installing and developing

## [0.1.0]

### Features
- Added initial login functionality
- Added tree view with courses
- Added file-system based assignment loading
- Added saving solutions/tests to WebLab
- Added syncing solutions/tests from WebLab
- Added showing description text on opening assignment
- Added ability to submit user/spec-tests via the Sidebar
