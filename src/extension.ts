import * as vscode from "vscode";
import { Browser, chromium, Locator } from "playwright";
import { CourseProvider } from "./courseProvider";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { AssignmentProvider, TestWebviewViewProvider } from "./assignmentProvider";

export async function activate(context: vscode.ExtensionContext) {
	vscode.commands.executeCommand('setContext', 'weblab-vscode.enabled', false);

	let browser: Browser;
	try {
		browser = await chromium.launch({ headless: true });
	} catch (e) {
		await installHelper(e);
		return;
	}
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
	const assignmentProvider = new AssignmentProvider(browserProvider, webLabFs, testWebviewViewProvider, context);

	assignmentProvider.registerCommands(context);
	assignmentProvider.registerOnSave();
}

export function deactivate() { }

async function installHelper(e: any) {
	vscode.window.showErrorMessage("Playwright is probably not installed.\n" + e);
	const result: string = (await vscode.window.showQuickPick([
		"Yes, please install Playwright browsers for WebLab (requires NPM)",
		"No (This will deactivate WebLab plugin)"],
		{
			title: "Playwright browsers are probably not installed. Would you like to install?"
		}) ?? "No");
	if (result.startsWith("Yes")) {
		const terminal = vscode.window.createTerminal("Playwright Install Terminal");
		terminal.show(false);
		terminal.sendText("npx playwright@1.38.0 install", true);
		vscode.window.showInformationMessage("Please restart VS Code after installing Playwright browser");
	} else {
		vscode.window.showErrorMessage("Deactivating WebLab for VS Code");
	}
}