import * as vscode from "vscode";
import { Browser, chromium, Locator } from "playwright";
import { CourseProvider } from "./courseProvider";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { AssignmentProvider, TestWebviewViewProvider } from "./assignmentProvider";

export async function activate(context: vscode.ExtensionContext) {
	const browser: Browser = await chromium.launch({ headless: true });
	const browserContext = await browser.newContext();
	const browserProvider = new BrowserProvider(context, browserContext);
	browserProvider.registerCommands(context);
	vscode.commands.executeCommand('setContext', 'extensionEnabled', true);

	const webLabFs = new WebLabFs();

	const courseProvider = new CourseProvider(browserProvider);
	courseProvider.registerTreeDataProvider(context);
	courseProvider.registerCommands(context);
	const testWebviewViewProvider: TestWebviewViewProvider = new TestWebviewViewProvider();
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("testWebviewView", testWebviewViewProvider));
	testWebviewViewProvider.setHtml("<div>Good luck with studying!</div>");
	const assignmentProvider = new AssignmentProvider(browserProvider, webLabFs, testWebviewViewProvider, context);

	assignmentProvider.registerCommands(context);
	assignmentProvider.registerOnSave();
}

export function deactivate() { }
