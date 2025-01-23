import * as vscode from "vscode";
import { Browser, chromium, Locator } from "playwright";
import { CourseProvider } from "./courseProvider";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { AssignmentProvider } from "./assignmentProvider";

export async function activate(context: vscode.ExtensionContext) {
	const browser: Browser = await chromium.launch({ headless: true });
	const browserContext = await browser.newContext();
	const browserProvider = new BrowserProvider(context, browserContext);
	browserProvider.registerCommands(context);
	vscode.commands.executeCommand('setContext', 'extensionEnabled', true);

	const webLabFs = new WebLabFs();
	webLabFs.registerFileSystemProvider(context);
	webLabFs.registerCommands(context);

	const courseProvider = new CourseProvider(browserProvider);
	courseProvider.registerTreeDataProvider(context);
	courseProvider.registerCommands(context);

	const assignmentProvider = new AssignmentProvider(browserProvider, webLabFs);
	assignmentProvider.registerCommands(context);
}

export function deactivate() { }
