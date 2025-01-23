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
    }

    async openAssignment(assignment: Assignment, sync: boolean = false) {
        const [solutionFile, testFile] = await this.getAssignmentData(assignment.link);

        const fileLocation = assignment.folderLocation + "/" + "solution.java";
        if (!this.webLabFs.fileExists(vscode.Uri.parse(`weblabfs:/${fileLocation}`)) || sync) {
            this.webLabFs.createFile(fileLocation, solutionFile);
            console.log("File created");
        } else { console.log("File already exists"); };
        // this.webLabFs.createFile(folderLocation + "/" + "test.java", testFile);
        await this.webLabFs.openFile(vscode.Uri.parse(`weblabfs:/${fileLocation}`));
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

    processRawData(rawData: string, splitHeader: string, index: number): string {
        const trimmedData = rawData.split(splitHeader)[index].split("\n");
        trimmedData.splice(0, 3);
        const processedData = trimmedData.slice(0, -1).join("\n");
        return processedData;
    }


}