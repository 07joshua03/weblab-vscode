/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';

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

	registerCommands(context: vscode.ExtensionContext) {
		// context.subscriptions.push(vscode.commands.registerCommand('weblab-vscode.initFs', _ => {
		// 	while(!context.globalState.get("weblabDefaultLocation")){
		// 		vscode.window.showWorkspaceFolderPick({}).then(value => {

		// 		});
		// 		vscode.window.showInputBox({"placeHolder": "Enter the default location for the WebLab workspace", title: "WebLab Workspace Location"}).then(value => {
		// 			if(value){
		// 				context.globalState.update("weblabDefaultLocation", value);
		// 			}
		// 		});
		// 	}
		// 	vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('weblabfs:/'), name: "WebLab Workspace" });
		// }));
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
		vscode.workspace.fs.createDirectory(vscode.Uri.parse(fileUri.fsPath.split(path.sep).slice(0,-1).join(path.sep)));

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