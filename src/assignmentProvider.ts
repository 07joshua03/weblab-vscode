import * as vscode from "vscode";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { Assignment } from "./courseProvider";
import { posix } from "path";

export class AssignmentProvider {

    private browserProvider: BrowserProvider;
    private webLabFs: WebLabFs;
    private userTestButton: vscode.StatusBarItem;
    private specTestButton: vscode.StatusBarItem;

    constructor(browserProvider: BrowserProvider, webLabFs: WebLabFs) {
        this.browserProvider = browserProvider;
        this.webLabFs = webLabFs;
        const [a, b] = this.registerActionButtons(context);
        this.userTestButton = a;
        this.specTestButton = b;
    }

    registerActionButtons(context: vscode.ExtensionContext) {
        const userTestButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        userTestButton.text = "Your Test";
        userTestButton.command = "weblab-vscode.yourTestActive";
        // userTestButton.show();
        context.subscriptions.push(userTestButton);

        const specTestButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
        specTestButton.text = "Spec Test";
        specTestButton.command = "weblab-vscode.specTestActive";
        // specTestButton.show();
        context.subscriptions.push(specTestButton);
        return [userTestButton, specTestButton];
    }
    registerCommands(context: vscode.ExtensionContext) {
        const openAssignment = vscode.commands.registerCommand(
            "weblab-vscode.openAssignment",
            async (assignment: Assignment) => {
                this.openAssignment(assignment);
            }
        );
        context.subscriptions.push(openAssignment);

        const syncAssignment = vscode.commands.registerCommand(
            "weblab-vscode.syncAssignment",
            async (assignment: Assignment) => {
                this.openAssignment(assignment, true);
            }
        );
        context.subscriptions.push(syncAssignment);

        const submitAssignment = vscode.commands.registerCommand(
            "weblab-vscode.submitAssignment",
            async (assignment: Assignment) => {
                this.submitAssignment(assignment);
            }
        );
        context.subscriptions.push(submitAssignment);

        const yourTest = vscode.commands.registerCommand(
            "weblab-vscode.yourTest",
            async (assignment: Assignment) => {
                this.yourTest(assignment);
            }
        );
        context.subscriptions.push(yourTest);

        const specTest = vscode.commands.registerCommand(
            "weblab-vscode.specTest",
            async (assignment: Assignment) => {
                this.specTest(assignment);
            }
        );
        context.subscriptions.push(specTest);

        const yourTestActive = vscode.commands.registerCommand(
            "weblab-vscode.yourTestActive",
            async () => {
                if (this.activeAssignment) {
                    this.yourTest(this.activeAssignment);
                }
            }
        );
        context.subscriptions.push(yourTestActive);

        const specTestActive = vscode.commands.registerCommand(
            "weblab-vscode.specTestActive",
            async () => {
                if (this.activeAssignment) {
                    this.specTest(this.activeAssignment);
                }
            }
        );
        context.subscriptions.push(specTestActive);
    }

    async openAssignment(assignment: Assignment, sync: boolean = false) {
        if (!vscode.workspace.workspaceFolders) {
            return vscode.window.showInformationMessage('No folder or workspace opened');
        }
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
    
        const [solutionFile, testFile] = await this.getAssignmentData(assignment.link);
        
        const solutionLocation = assignment.folderLocation + "/" + "solution.java";
        const solutionUri = folderUri.with({ path: posix.join(folderUri.path, assignment.folderLocation, "solution.java") });
        if (!this.webLabFs.fileExists(solutionUri) || sync) {
            await this.webLabFs.createFile(solutionLocation, solutionFile);
            console.log("File created: " + solutionLocation);
        } else { console.log("File already exists: " + solutionLocation); };
        
        const testLocation = assignment.folderLocation + "/" + "test.java";
        const testUri = folderUri.with({ path: posix.join(folderUri.path, assignment.folderLocation, "test.java") });
        if (!this.webLabFs.fileExists(testUri) || sync) {
            await this.webLabFs.createFile(testLocation, testFile);
            console.log("File created: " + testLocation);
        } else { console.log("File already exists: " + testLocation); };
        await this.webLabFs.openFile(solutionUri);
        await this.openDescription(assignment);
        this.activeAssignment = assignment;
        this.userTestButton.show();
        this.specTestButton.show();
    }


    async getAssignmentData(link: string): Promise<[string, string]> {
        const page = await this.browserProvider.getBrowserContext().newPage();

        await page.goto(link.replace("view", "edit"), {
            waitUntil: "networkidle",
        });
        const requestPromise = page.waitForRequest("https://weblab.tudelft.nl/codeEditorAjaxProgrammingAnswer_String_Bool");
        await page.locator("span.save-button.saved").click();
        const request = await requestPromise;
        const splitHeader = (await request.allHeaders())["content-type"].split(";")[1].split("=")[1];
        await page.close();
        const rawData = request.postData();
        if (!rawData) {
            throw new Error("No assignment data found");
        }
        const solutionData = this.processRawData(rawData, splitHeader, 5);
        const testData = this.processRawData(rawData, splitHeader, 6);
        return [solutionData, testData];
    }

    async submitAssignment(assignment: Assignment) {
        if (!vscode.workspace.workspaceFolders) {
            return vscode.window.showInformationMessage('No folder or workspace opened');
        }
        const folderUri = vscode.workspace.workspaceFolders[0].uri;
    
        const page = await this.browserProvider.getBrowserContext().newPage();
        await page.goto(assignment.link.replace("view", "edit"), {
            waitUntil: "networkidle",
        });
        const requestPromise = page.waitForRequest("https://weblab.tudelft.nl/codeEditorAjaxProgrammingAnswer_String_Bool");
        await page.locator("span.save-button.saved").click();
        const request = await requestPromise;
        const requestHeader = await request.allHeaders();
        delete requestHeader[":method"];
        delete requestHeader[":authority"];
        delete requestHeader[":path"];
        delete requestHeader[":scheme"];
        const splitHeader = "--" + (await request.allHeaders())["content-type"].split(";")[1].split("=")[1];
        await page.waitForTimeout(100);

        const solutionUri = folderUri.with({ path: posix.join(folderUri.path, assignment.folderLocation, "solution.java") });
        const solutionFileData = await this.webLabFs.getFileData(solutionUri);
        const solutionNewData = this.injectNewData(request.postData() ?? "", solutionFileData, splitHeader, 5);

        const testUri = folderUri.with({ path: posix.join(folderUri.path, assignment.folderLocation, "test.java") });
        const testFileData = await this.webLabFs.getFileData(testUri);
        const testNewData = this.injectNewData(solutionNewData, testFileData, splitHeader, 6);

        console.log("Split header: " + splitHeader);
        console.log(solutionNewData);
        await this.browserProvider.getBrowserContext().request.post(
            "https://weblab.tudelft.nl/codeEditorAjaxProgrammingAnswer_String_Bool",
            {
                headers: requestHeader,
                data: testNewData,
            }
        );
        await page.close();

    }

    async openDescription(assignment: Assignment) {
        const page = await this.browserProvider.getBrowserContext().newPage();

        await page.goto(assignment.link.replace("view", "edit"), {
            waitUntil: "networkidle",
        });

        const descriptionHTML = await page.locator("div.assignment-text").innerHTML();

        const panel = vscode.window.createWebviewPanel(
            "assignmentDescription",
            "Assignment Description",
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            },
            {}
        );
        panel.webview.html = descriptionHTML;
    }

    async yourTest(assignment: Assignment) {
        const page = await this.browserProvider.getBrowserContext().newPage();
        await page.goto(assignment.link.replace("view", "edit"), {
            waitUntil: "networkidle",
        });
        const requestPromise = page.waitForRequest("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");
        const responsePromise = page.waitForResponse("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");
        await page.locator("a.btn.userTestBtn").click();
        const request = await requestPromise;
        const response = await responsePromise;
        const requestHeader = await request.allHeaders();
        delete requestHeader[":method"];
        delete requestHeader[":authority"];
        delete requestHeader[":path"];
        delete requestHeader[":scheme"];
        await page.waitForTimeout(200);

        const responseData = (await response.body()).toString();
        const sessionId = this.getSessionId(responseData);

        const buttonIdRegex = /consoleButtonsProgrammingAnswer_Int_String_Bool_update(.+)/;
        const updateButtonId = (await page.locator(`button[id^="update-"]`).getAttribute("submitid")) ?? "";
        const newButtonIdGroup = buttonIdRegex.exec(updateButtonId);
        if (!newButtonIdGroup) {
            throw new Error("No button id found");
        }
        const newButtonId = newButtonIdGroup[1];
        console.log(sessionId);
        console.log(updateButtonId);

        let newData = request.postData() ?? "";

        newData = newData.replace(/"consoleButtonsProgrammingAnswer_Int_String_Bool_(runTest.+)"/, "\"consoleButtonsProgrammingAnswer_Int_String_Bool_update" + newButtonId + "\"");
        const sessionRegex = /"session"\n\n([0-9]+)\n/;
        newData.replace(sessionRegex, "\"session\"\n\n" + sessionId + "\n");
        console.log(newData);
        const jaja = page.waitForResponse("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");

        await this.browserProvider.getBrowserContext().request.post(
            "https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool",
            {
                headers: requestHeader,
                data: newData,
            }
        );
        const dataa = await jaja;
        const dataJson = await dataa.json();
        // console.log((await dataa.body()).toString());    
        // console.log(dataJson[1]["value"]);
        const panel = vscode.window.createWebviewPanel(
            "yourTestResults",
            "Your Test Results",
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            },
            {}
        );
        panel.webview.html = dataJson[1]["value"];


        await page.close();

    }

    async specTest(assignment: Assignment) {
        const page = await this.browserProvider.getBrowserContext().newPage();
        await page.goto(assignment.link.replace("view", "edit"), {
            waitUntil: "networkidle",
        });
        const requestPromise = page.waitForRequest("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");
        const responsePromise = page.waitForResponse("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");
        await page.locator("a.btn.specTestBtn").click();
        const request = await requestPromise;
        const response = await responsePromise;
        const requestHeader = await request.allHeaders();
        delete requestHeader[":method"];
        delete requestHeader[":authority"];
        delete requestHeader[":path"];
        delete requestHeader[":scheme"];
        await page.waitForTimeout(200);

        const responseData = (await response.body()).toString();
        const sessionId = this.getSessionId(responseData);

        const buttonIdRegex = /consoleButtonsProgrammingAnswer_Int_String_Bool_update(.+)/;
        const updateButtonId = (await page.locator(`button[id^="update-"]`).getAttribute("submitid")) ?? "";
        const newButtonIdGroup = buttonIdRegex.exec(updateButtonId);
        if (!newButtonIdGroup) {
            throw new Error("No button id found");
        }
        const newButtonId = newButtonIdGroup[1];
        console.log(sessionId);
        console.log(updateButtonId);

        let newData = request.postData() ?? "";

        newData = newData.replace(/"consoleButtonsProgrammingAnswer_Int_String_Bool_(runTest.+)"/, "\"consoleButtonsProgrammingAnswer_Int_String_Bool_update" + newButtonId + "\"");
        const sessionRegex = /"session"\n\n([0-9]+)\n/;
        newData.replace(sessionRegex, "\"session\"\n\n" + sessionId + "\n");
        console.log(newData);
        const jaja = page.waitForResponse("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");

        await this.browserProvider.getBrowserContext().request.post(
            "https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool",
            {
                headers: requestHeader,
                data: newData,
            }
        );
        const dataa = await jaja;
        const dataJson = await dataa.json();
        // console.log((await dataa.body()).toString());    
        // console.log(dataJson[1]["value"]);
        const panel = vscode.window.createWebviewPanel(
            "specTestResults",
            "Spec Test Results",
            {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: true
            },
            {}
        );
        panel.webview.html = dataJson[1]["value"];


        await page.close();

    }

    getSessionId(responseData: string): string {
        var regex = /\\"name\\":\\"session\\", \\"value\\":\\"([0-9]+)\\"/g;
        const sessionsMatch = regex.exec(responseData);
        if (!sessionsMatch) {
            throw new Error("No session found");
        }
        const sessionId = sessionsMatch[1];
        return sessionId;
    }


    processRawData(rawData: string, splitHeader: string, index: number): string {
        const trimmedData = rawData.split(splitHeader)[index].split("\n");
        trimmedData.splice(0, 3);
        const processedData = trimmedData.slice(0, -1).join("\n");
        return processedData;
    }

    injectNewData(rawData: string, newData: string, splitHeader: string, index: number): string {
        const trimmedData = rawData.split(splitHeader);
        const dataPrefix = trimmedData[index].split("\n").slice(0, 3).join("\n");

        // There are some fucking special characters added to the data, which are required, so just remove all actual data and fuck the clear lines
        // Please API when
        const dataSuffix = trimmedData[index].split("\n").slice(-2).join("\n").replace(/[0-9a-zA-Z\-\;\:\'\"\[\]\(\)\{\}]/g, "");
        trimmedData[index] = [dataPrefix, newData, dataSuffix].join("\n");
        return trimmedData.join(splitHeader).replace(splitHeader + splitHeader, splitHeader);
    }
}