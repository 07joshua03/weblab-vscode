/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { BrowserProvider } from './browserProvider';

export class File implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	data?: Uint8Array;

	constructor(name: string) {
		this.type = vscode.FileType.File;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
	}
}

export class Directory implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	entries: Map<string, File | Directory>;

	constructor(name: string) {
		this.type = vscode.FileType.Directory;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.entries = new Map();
	}
}

export type Entry = File | Directory;

export class WebLabFs {

	private browserProvider: BrowserProvider;

	constructor(browserProvider: BrowserProvider) {
		this.browserProvider = browserProvider;
	}

	registerCommands(context: vscode.ExtensionContext) {
		context.subscriptions.push(vscode.commands.registerCommand("weblab-vscode.enableWebLab", async () => {
			await this.initFileSystem(context);
		}));

		context.subscriptions.push(vscode.commands.registerCommand("weblab-vscode.resetDefaultLocation", async () => {
			context.globalState.update("weblab-vscode.defaultLocation", undefined);
			vscode.commands.executeCommand('setContext', 'weblab-vscode.enabled', false);
			vscode.window.showWarningMessage("Disabled WebLab");
		}));
	}

	async initFileSystem(context: vscode.ExtensionContext) {
		if (!vscode.workspace.workspaceFolders) { // No workspace opened
			// vscode.window.showInformationMessage('No folder or workspace opened');
			const defaultLocation = context.globalState.get("weblab-vscode.defaultLocation") as string | undefined;
			if (!defaultLocation) { // If also no default, just stop and disable WebLab
				vscode.commands.executeCommand('setContext', 'weblab-vscode.enabled', false);
				return vscode.window.showWarningMessage("No workspace or folder opened and no default set. Disabling WebLab.");
			} else { // If default is set, please opfen
				vscode.window.showInformationMessage("Opening Default WebLab location");
				vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse(defaultLocation) });
				await this.enableWebLab();
				return;
			}
		} else { // If a workspace is open
			const folderUri = vscode.workspace.workspaceFolders[0].uri;
			const defaultLocation = context.globalState.get("weblab-vscode.defaultLocation") as string | undefined;
			if (!defaultLocation) { // And no default set
				const decision = await vscode.window.showQuickPick(["Yes, set current workspace as default", "No, keep current default"], { title: "WebLab: Set current workspace as default?" }) ?? "No";
				if (decision.startsWith("Yes")) {
					context.globalState.update("weblab-vscode.defaultLocation", folderUri.fsPath);
				}
				await this.enableWebLab();
			} else if (folderUri.fsPath !== defaultLocation) { // If workspace opened and default set
				vscode.window.showInformationMessage("Opening default WebLab location");
				vscode.workspace.updateWorkspaceFolders(0, 1, { uri: vscode.Uri.parse(defaultLocation) });
				await this.enableWebLab();;
			} else {
				vscode.window.showWarningMessage("Already in default WebLab location, weblab should be enabled.");
			}

		}
	}

	async enableIfDefault(context: vscode.ExtensionContext) {
		const defaultLocation = context.globalState.get("weblab-vscode.defaultLocation") as string | undefined;
		if (!vscode.workspace.workspaceFolders || !defaultLocation) {
			return;
		} else if (defaultLocation === vscode.workspace.workspaceFolders[0].uri.fsPath) {
			await this.enableWebLab();
		}
	}

	async enableWebLab() {
		await this.browserProvider.initializeBrowser();
		vscode.commands.executeCommand('setContext', 'weblab-vscode.enabled', true);
		vscode.window.showInformationMessage("Enabled WebLab!");
	} 
	// --- manage file contents

	async openFile(file: vscode.Uri) {
		await vscode.workspace.openTextDocument(file).then(doc => {
			vscode.window.showTextDocument(doc);
		});;
	}

	async getFileData(uri: vscode.Uri): Promise<string> {
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			return document.getText();
		} catch (error) {
			throw new Error("Reading file " + uri.fsPath + "failed");
		}
	}

	//TODO Test whether directory creation works correctly on all file systems
	async createFile(fileUri: vscode.Uri, data: string) {
		// Create possible parent directories
		vscode.workspace.fs.createDirectory(vscode.Uri.parse(fileUri.fsPath.split(path.sep).slice(0, -1).join(path.sep)));

		await vscode.workspace.fs.writeFile(fileUri, Buffer.from(data, 'utf8'));
	}

	// --- lookup

	public fileExists(uri: vscode.Uri): boolean {
		return fs.existsSync(uri.fsPath);
	}

	public folderExists(uri: vscode.Uri): boolean {
		return fs.existsSync(uri.fsPath);
	}
}