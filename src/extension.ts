import * as vscode from "vscode";
import { Browser, chromium, Locator } from "playwright";
import { CourseProvider } from "./courseProvider";
import { BrowserManager } from "./browserManager";

export async function activate(context: vscode.ExtensionContext) {
	const browser: Browser = await chromium.launch({ headless: false });
	const browserContext = await browser.newContext();
	const browserManager = new BrowserManager(context, browserContext);

	// Sidebar implementation
	const courseProvider = new CourseProvider(browserManager);
	vscode.window.registerTreeDataProvider("courses", courseProvider);
	const view = vscode.window.createTreeView("courses", {
		treeDataProvider: courseProvider,
	});
	context.subscriptions.push(view);

	const login = vscode.commands.registerCommand(
		"weblab-vscode.login",
		async () => {
			await browserManager.login();
		}
	);
	context.subscriptions.push(login);

	const showCourses = vscode.commands.registerCommand(
		"weblab-vscode.showCourses",
		async () => {
			const courses = await courseProvider.getCourses();
			vscode.window.showInformationMessage(courses.join(", "));
		}
	);
	context.subscriptions.push(showCourses);

	const isLoggedIn = vscode.commands.registerCommand(
		"weblab-vscode.isLoggedIn",
		async () => {
			vscode.window.showInformationMessage(
				(await browserManager.loggedIn()) ? "Logged in" : "Not logged in"
			);
		}
	);
	context.subscriptions.push(isLoggedIn);
}

export function deactivate() { }
