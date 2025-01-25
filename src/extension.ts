import * as vscode from "vscode";
import { Browser, chromium, Locator } from "playwright";
import { CourseProvider } from "./courseProvider";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { AssignmentProvider, TestWebviewViewProvider } from "./assignmentProvider";

export async function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand('setContext', 'weblab-vscode.enabled', false);

	const browserProvider = new BrowserProvider(context);
	browserProvider.registerCommands(context);

	const webLabFs = new WebLabFs(browserProvider);
	webLabFs.registerCommands(context);

	const courseProvider = new CourseProvider(browserProvider);
	courseProvider.registerTreeDataProvider(context);
	courseProvider.registerCommands(context);

	const testWebviewViewProvider: TestWebviewViewProvider = new TestWebviewViewProvider();
	context.subscriptions.push(vscode.window.registerWebviewViewProvider("testWebviewView", testWebviewViewProvider));
	const assignmentProvider = new AssignmentProvider(browserProvider, webLabFs, testWebviewViewProvider, context);

	assignmentProvider.registerCommands(context);
	assignmentProvider.registerOnSave();

	await webLabFs.enableIfDefault(context);
}

export function deactivate() { }

