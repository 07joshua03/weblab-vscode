import * as vscode from "vscode";
import { Browser, chromium, Locator } from "playwright";
import { CourseProvider } from "./courseProvider";
import { BrowserManager } from "./browserManager";
import { WebLabFs } from "./fileSystemProvider";

export async function activate(context: vscode.ExtensionContext) {
	const browser: Browser = await chromium.launch({ headless: false });
	const browserContext = await browser.newContext();
	const browserManager = new BrowserManager(context, browserContext);
	vscode.commands.executeCommand('setContext', 'extensionEnabled', true);

	const webLabFs = new WebLabFs();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('weblabfs', webLabFs, { isCaseSensitive: true }));

	context.subscriptions.push(vscode.commands.registerCommand('weblab-vscode.resetFs', _ => {
		for (const [name] of webLabFs.readDirectory(vscode.Uri.parse('weblabfs:/'))) {
			webLabFs.delete(vscode.Uri.parse(`weblabfs:/${name}`));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('weblab-vscode.addFile', async (filename: string, data) => {
		webLabFs.writeFile(vscode.Uri.parse(`weblabfs:/${filename}`), Buffer.from(data), { create: true, overwrite: true });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('weblab-vscode.initFs', _ => {
		vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('weblabfs:/'), name: "WebLab Workspace" });
	}));


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
				(await browserManager.isLoggedIn()) ? "Logged in" : "Not logged in"
			);
		}
	);
	context.subscriptions.push(isLoggedIn);

	const openAssignment = vscode.commands.registerCommand(
		"weblab-vscode.openAssignment",
		async (link: string) => {
			const page = await browserContext.newPage();
			await page.goto(link.replace("view", "edit"), {
				waitUntil: "networkidle",
			});
			const requestPromise = page.waitForRequest("https://weblab.tudelft.nl/codeEditorAjaxProgrammingAnswer_String_Bool");
			await page.locator("span.save-button.saved").click();
			const request = await requestPromise;
			const splitHeader = (await request.allHeaders())["content-type"].split(";")[1].split("=")[1];
			await page.close();
			const solutionData = request.postData()?.split(splitHeader)[5].split("\n");
			if (solutionData) {
				solutionData.splice(0, 3);
				const solutionFile = solutionData.slice(0, -1).join("\n");
				const filename = "solution.java";
				await vscode.commands.executeCommand("weblab-vscode.addFile", filename, solutionFile);
				await vscode.commands.executeCommand("weblab-vscode.openFile", vscode.Uri.parse(`weblabfs:/${filename}`));
			}
			const testData = request.postData()?.split(splitHeader)[6].split("\n");
			if (testData) {
				testData.splice(0, 3);
				const testFile = testData.slice(0, -1).join("\n");
				await vscode.commands.executeCommand("weblab-vscode.addFile", "test.java", testFile);

			}
		}
	);
	context.subscriptions.push(openAssignment);

	const openBrowser = vscode.commands.registerCommand(
		"weblab-vscode.openBrowser",
		async () => {
			const username = await browserManager.getUsername();
			const page = await browserContext.newPage();
			await page.goto(`https://weblab.tudelft.nl/profile/${username}`);
		}
	);
	context.subscriptions.push(openBrowser);

	const openFile = vscode.commands.registerCommand(
		"weblab-vscode.openFile",
		async (file: vscode.Uri) => {
			await vscode.workspace.openTextDocument(file).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		});
	context.subscriptions.push(openFile);
}

export function deactivate() { }
