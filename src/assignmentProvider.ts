import * as vscode from "vscode";
import { BrowserProvider } from "./browserProvider";
import { WebLabFs } from "./fileSystemProvider";
import { Assignment } from "./courseProvider";

export class AssignmentProvider {

    private browserProvider: BrowserProvider;
    private webLabFs: WebLabFs;

    constructor(browserProvider: BrowserProvider, webLabFs: WebLabFs) {
        this.browserProvider = browserProvider;
        this.webLabFs = webLabFs;
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
    }

    async openAssignment(assignment: Assignment, sync: boolean = false) {
        const [solutionFile, testFile] = await this.getAssignmentData(assignment.link);

        const solutionLocation = assignment.folderLocation + "/" + "solution.java";
        if (!this.webLabFs.fileExists(vscode.Uri.parse(`weblabfs:/${solutionLocation}`)) || sync) {
            this.webLabFs.createFile(solutionLocation, solutionFile);
            console.log("File created: " + solutionLocation);
        } else { console.log("File already exists: " + solutionLocation); };
        
        const testLocation = assignment.folderLocation + "/" + "test.java";
        if (!this.webLabFs.fileExists(vscode.Uri.parse(`weblabfs:/${testLocation}`)) || sync) {
            this.webLabFs.createFile(testLocation, testFile);
            console.log("File created: " + testLocation);
        } else { console.log("File already exists: " + testLocation); };
        await this.webLabFs.openFile(vscode.Uri.parse(`weblabfs:/${solutionLocation}`));
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
        await page.waitForTimeout(10000);
        const solutionFileData = await this.webLabFs.getFileData(vscode.Uri.parse(`weblabfs:/${assignment.folderLocation}/solution.java`));
        const solutionNewData = this.injectNewData(request.postData()?? "", solutionFileData, splitHeader, 5);

        const testFileData = await this.webLabFs.getFileData(vscode.Uri.parse(`weblabfs:/${assignment.folderLocation}/test.java`));
        const testNewData = this.injectNewData(solutionNewData, testFileData, splitHeader, 6);

        console.log("Split header: "+splitHeader);
        console.log(solutionNewData);
        await this.browserProvider.getBrowserContext().request.post(
            "https://weblab.tudelft.nl/codeEditorAjaxProgrammingAnswer_String_Bool",
            {
                headers: requestHeader,
                data: testNewData,
            }
        );
        await page.waitForTimeout(30000);
        await page.close();
        
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