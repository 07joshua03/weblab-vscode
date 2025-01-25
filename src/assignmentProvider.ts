import * as vscode from "vscode";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { Assignment } from "./courseProvider";
import { posix } from "path";

export class AssignmentProvider {

    private browserProvider: BrowserProvider;
    private webLabFs: WebLabFs;
    private activeAssignment: Assignment | undefined;
    private userTestButton: vscode.StatusBarItem;
    private specTestButton: vscode.StatusBarItem;
    private testWebviewViewProvider: TestWebviewViewProvider;

    constructor(browserProvider: BrowserProvider, webLabFs: WebLabFs, testWebviewViewProvider: TestWebviewViewProvider, context: vscode.ExtensionContext) {
        this.browserProvider = browserProvider;
        this.webLabFs = webLabFs;
        this.testWebviewViewProvider = testWebviewViewProvider;
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

    registerOnSave() {
        vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            if(!this.webLabFs.isEnabled()){
                return;
            }
            if (!this.activeAssignment) {
                return vscode.window.showWarningMessage("No active assignment found. Please select your assignment in the Sidebar before saving.");
            }

            if (document.uri.fsPath === this.activeAssignment.getSolutionUri().fsPath || document.uri.fsPath === this.activeAssignment.getTestUri().fsPath) {
                await this.submitAssignment(this.activeAssignment);
                vscode.window.showInformationMessage("Saved assignment!");
            } else {
                return vscode.window.showWarningMessage("You just saved a non-active assignment. Please select your assignment in the Sidebar before saving.");
            }
        });
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

        const solutionUri = assignment.getSolutionUri();
        if (!this.webLabFs.fileExists(solutionUri) || sync) {
            await this.webLabFs.createFile(solutionUri, solutionFile);
            console.log("File created: " + solutionUri.fsPath);
        } else { console.log("File already exists: " + solutionUri.fsPath); };

        const testUri = assignment.getTestUri();
        if (!this.webLabFs.fileExists(testUri) || sync) {
            await this.webLabFs.createFile(testUri, testFile);
            console.log("File created: " + testUri.fsPath);
        } else { console.log("File already exists: " + testUri.fsPath); };
        await this.webLabFs.openFile(solutionUri);
        await this.openDescription(assignment);
        const [postData, splitHeader, requestHeader] = await this.getSubmitInfo(assignment);
        assignment.saveSubmitData(postData, splitHeader, requestHeader);
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

    async getSubmitInfo(assignment: Assignment): Promise<[string, string, { [key: string]: string }]> {
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
        const postData = request.postData();
        if (!postData) {
            throw new Error("PostData for assignment not found");
        }
        await page.close();
        return [postData, splitHeader, requestHeader];
    }

    async submitAssignment(assignment: Assignment) {
        if (!assignment.postData || !assignment.splitHeader) {
            throw new Error("Assignment submit data not found");
        }

        const solutionUri = assignment.getSolutionUri();
        const solutionFileData = await this.webLabFs.getFileData(solutionUri);
        const solutionNewData = this.injectNewData(assignment.postData, solutionFileData, assignment.splitHeader, 5);

        const testUri = assignment.getTestUri();
        const testFileData = await this.webLabFs.getFileData(testUri);
        const testNewData = this.injectNewData(solutionNewData, testFileData, assignment.splitHeader, 6);

        await this.browserProvider.getBrowserContext().request.post(
            "https://weblab.tudelft.nl/codeEditorAjaxProgrammingAnswer_String_Bool",
            {
                headers: assignment.requestHeader,
                data: testNewData,
            }
        );
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
        let testResultsGotten = false;
        while (!testResultsGotten) {
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

            let newData = request.postData() ?? "";

            newData = newData.replace(/"consoleButtonsProgrammingAnswer_Int_String_Bool_(runTest.+)"/, "\"consoleButtonsProgrammingAnswer_Int_String_Bool_update" + newButtonId + "\"");
            const sessionRegex = /"session"\n\n([0-9]+)\n/;
            newData.replace(sessionRegex, "\"session\"\n\n" + sessionId + "\n");
            const testResponseData = page.waitForResponse("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");

            await this.browserProvider.getBrowserContext().request.post(
                "https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool",
                {
                    headers: requestHeader,
                    data: newData,
                }
            );
            const dataJson = await (await testResponseData).json();
            if (!(dataJson[1]["value"] as string).startsWith("updateJobTimeout")) {
                testResultsGotten = true;
            }
            this.testWebviewViewProvider.setHtml(dataJson[1]["value"]);
        }

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
        let testResultsGotten = false;
        while (!testResultsGotten) {
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

            let newData = request.postData() ?? "";

            newData = newData.replace(/"consoleButtonsProgrammingAnswer_Int_String_Bool_(runTest.+)"/, "\"consoleButtonsProgrammingAnswer_Int_String_Bool_update" + newButtonId + "\"");
            const sessionRegex = /"session"\n\n([0-9]+)\n/;
            newData.replace(sessionRegex, "\"session\"\n\n" + sessionId + "\n");
            const testResponseData = page.waitForResponse("https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool");

            await this.browserProvider.getBrowserContext().request.post(
                "https://weblab.tudelft.nl/consoleButtonsProgrammingAnswer_Int_String_Bool",
                {
                    headers: requestHeader,
                    data: newData,
                }
            );
            const dataJson = await (await testResponseData).json();
            if (!(dataJson[1]["value"] as string).startsWith("updateJobTimeout")) {
                testResultsGotten = true;
            }
            this.testWebviewViewProvider.setHtml(dataJson[1]["value"]);
        }

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

export class TestWebviewViewProvider implements vscode.WebviewViewProvider {
    private view?: vscode.WebviewView;

    setHtml(html: string) {
        if (this.view) {
            this.view.webview.html = html;
            this.view.show();
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        this.view = webviewView;
        this.view.webview.html = "<div>Good luck with studying!</div></br><div>No test results available yet.</div>";

    }
}